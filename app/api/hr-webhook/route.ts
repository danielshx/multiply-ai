import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getServerSupabase } from "@/lib/supabase/server";
import { cognee } from "@/lib/cognee/client";

export const dynamic = "force-dynamic";

/**
 * POST /api/hr-webhook — receives HappyRobot events.
 *
 * Auth: HR signs the body with HMAC-SHA256(WEBHOOK_SECRET, raw_body), header
 * `X-HR-Signature: sha256=<hex>`. We verify before parsing JSON.
 *
 * Dispatch:
 *   message.created  → upsert messages, push to Realtime
 *   run.started      → upsert lead, mark live
 *   run.completed    → mark lead booked/closed, fire log-learning into cognee
 *   run.failed       → mark lead lost, log failure
 *   contact.updated  → update lead profile
 *
 * Every event is also written raw into `hr_events` for audit.
 */
type HRPayload = {
  type?: string;
  data?: Record<string, unknown>;
  event?: string;
  [k: string]: unknown;
};

function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const provided = header.replace(/^sha256=/, "").trim();
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("x-hr-signature") ?? req.headers.get("x-happyrobot-signature");

  // Allow unsigned in dev only (when WEBHOOK_SECRET is empty).
  const secretSet = !!process.env.WEBHOOK_SECRET;
  if (secretSet && !verifySignature(raw, sig)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let payload: HRPayload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const type = payload.type ?? payload.event ?? "unknown";
  const data = (payload.data ?? {}) as Record<string, unknown>;

  const supabase = getServerSupabase();

  // 1. always write to audit log
  await supabase.from("hr_events").insert({ type, payload }).then(
    () => null,
    (err) => console.error("hr_events insert failed", err),
  );

  // 2. dispatch
  try {
    switch (type) {
      case "message.created":
      case "message": {
        const leadId = (data.lead_id ?? data.contact_id ?? null) as string | null;
        await supabase.from("messages").insert({
          lead_id: leadId,
          role: (data.role ?? "agent") as string,
          content: (data.content ?? data.text ?? "") as string,
          channel: (data.channel ?? "phone") as string,
          hr_msg_id: (data.id ?? data.message_id ?? null) as string | null,
        });
        break;
      }

      case "run.started": {
        const leadId = (data.lead_id ?? data.contact_id) as string | null;
        if (leadId) {
          await supabase
            .from("leads")
            .update({
              hr_run_id: (data.run_id ?? null) as string | null,
              hr_session_id: (data.session_id ?? null) as string | null,
              stage: "engaged",
            })
            .eq("id", leadId);
        }
        break;
      }

      case "run.completed":
      case "call.ended": {
        const leadId = (data.lead_id ?? data.contact_id) as string | null;
        const outcome = (data.outcome ?? "completed") as string;
        const newStage = outcome === "booked" ? "booked" : outcome === "lost" ? "lost" : "qualified";

        if (leadId) {
          await supabase.from("leads").update({ stage: newStage }).eq("id", leadId);
        }

        // Fire-and-forget: stash full call into cognee for next-call recall.
        const transcript = (data.transcript as string) ?? "";
        const company = (data.company as string) ?? "";
        const personaName = (data.persona_name as string) ?? (data.contact_name as string) ?? "";
        const personaRole = (data.persona_role as string) ?? (data.contact_role as string) ?? "";
        if (transcript) {
          cognee
            .remember({
              text: `Call with ${personaName} (${personaRole}) at ${company}. Outcome: ${outcome}. Transcript:\n${transcript.slice(0, 4000)}`,
              dataset: "multiply",
              metadata: {
                node_type: "call_outcome",
                lead_id: leadId,
                company,
                persona_name: personaName,
                persona_role: personaRole,
                outcome,
                timestamp: new Date().toISOString(),
              },
            })
            .catch((e) => console.warn("cognee remember failed:", (e as Error).message));
        }
        break;
      }

      case "run.failed": {
        const leadId = (data.lead_id ?? data.contact_id) as string | null;
        if (leadId) {
          await supabase.from("leads").update({ stage: "lost" }).eq("id", leadId);
        }
        break;
      }

      case "contact.updated": {
        const leadId = (data.lead_id ?? data.contact_id) as string | null;
        if (leadId) {
          await supabase
            .from("leads")
            .update({
              name: data.name as string,
              email: data.email as string,
              phone: data.phone as string,
              metadata: (data.metadata ?? {}) as Record<string, unknown>,
            })
            .eq("id", leadId);
        }
        break;
      }

      default:
        // unknown event types just sit in hr_events for inspection
        break;
    }
  } catch (err) {
    console.error(`hr-webhook dispatch failed for ${type}:`, err);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, type });
}

/** GET for health check — useful when registering the URL in HR's editor. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/hr-webhook",
    accepts: ["message.created", "run.started", "run.completed", "run.failed", "contact.updated"],
    auth: process.env.WEBHOOK_SECRET ? "hmac-sha256 X-HR-Signature" : "none (dev)",
  });
}
