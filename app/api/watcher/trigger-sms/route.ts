import { NextResponse } from "next/server";
import { persistMessage, findLeadIdByContact } from "@/lib/supabase/persistMessage";
import { getPriorContext } from "@/lib/cognee/priorContext";

/**
 * POST /api/watcher/trigger-sms — SMS branch of the Watcher Cron Workflow.
 *
 * The HR organization currently has invalid Twilio credentials (HTTP 401
 * from Twilio's API on every send attempt), so by default this route runs
 * in STUB+EMAIL_FALLBACK mode:
 *
 *   - Always logs the would-be SMS payload.
 *   - If `lead.email` is present, transparently forwards to /api/watcher/trigger-email
 *     so the cold/warm lead still gets reached.
 *   - Returns ok=true with sent=false and fallback details.
 *
 * To switch to real SMS once the HR org's Twilio sub-account is fixed:
 *   Set SMS_ENABLED=true in .env.local — the route will then proxy to the
 *   Mini SMS Agent HR workflow as originally intended.
 *
 * Body: { name, company, phone_number, email, current_time, customer_goal, reason }
 */
const SMS_WORKFLOW_ID = "019da21f-9d7c-7457-96cb-53d1db972baf";
const HR_ENVIRONMENT = process.env.HR_SMS_ENVIRONMENT ?? process.env.HR_MINI_ENVIRONMENT ?? "staging";
const HR_RUNS_URL = `https://platform.eu.happyrobot.ai/api/v2/workflows/${SMS_WORKFLOW_ID}/runs`;

const SMS_ENABLED = process.env.SMS_ENABLED === "true";

type Body = {
  name?: string;
  company?: string;
  phone_number?: string;
  email?: string;
  current_time?: string;
  customer_goal?: string;
  reason?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;

  if (!body.phone_number) {
    return NextResponse.json(
      { ok: false, error: "phone_number is required" },
      { status: 400 },
    );
  }

  // Pull prior interaction context from Cognee (best-effort, 4s timeout) so the
  // SMS agent doesn't ping someone who already opted out / was contacted yesterday.
  const prior = await getPriorContext({
    name: body.name,
    company: body.company,
    phone: body.phone_number,
    email: body.email,
    channel: "sms",
  });
  const priorBlob = prior ? `\n\n[prior_context]\n${prior}` : "";

  const payload = {
    name: body.name ?? "",
    company: body.company ?? "",
    phone_number: body.phone_number,
    email: body.email ?? "",
    current_time: body.current_time ?? new Date().toISOString(),
    customer_goal: `${body.customer_goal ?? ""}${priorBlob}`.slice(0, 1500),
  };

  const leadId = await findLeadIdByContact({
    phone: payload.phone_number,
    email: payload.email || null,
  });

  if (!SMS_ENABLED) {
    console.log(
      `[trigger-sms] STUB (SMS_ENABLED!=true) to=${payload.phone_number}`,
    );
    await persistMessage({
      lead_id: leadId,
      role: "system",
      channel: "sms",
      content: `📱 SMS skipped (HR Twilio creds invalid). Falling back to email${payload.email ? ` (${payload.email})` : " — no email available"}.`,
    });
    if (payload.email) {
      const fallback = await emailFallback(req, body, "sms_disabled_fallback_to_email");
      return NextResponse.json({
        ok: true,
        sent: false,
        stub: true,
        fallback: "email",
        from_intended: "+498962824034",
        to: payload.phone_number,
        note: "SMS disabled (HR org Twilio creds invalid). Forwarded to /api/watcher/trigger-email.",
        downstream: fallback,
      });
    }
    return NextResponse.json({
      ok: true,
      sent: false,
      stub: true,
      fallback: "none",
      from_intended: "+498962824034",
      to: payload.phone_number,
      note: "SMS disabled and no email available — logged only.",
    });
  }

  const apiKey = process.env.HR_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "HR_API_KEY not set" },
      { status: 500 },
    );
  }

  const res = await fetch(HR_RUNS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ payload, environment: HR_ENVIRONMENT }),
    cache: "no-store",
  });
  console.log(`[trigger-sms] HR env=${HR_ENVIRONMENT} status=${res.status}`);

  const text = await res.text();
  if (!res.ok) {
    if (payload.email) {
      const fallback = await emailFallback(req, body, "sms_send_failed_fallback_to_email");
      return NextResponse.json({
        ok: true,
        sent: false,
        fallback: "email",
        from_intended: "+498962824034",
        to: payload.phone_number,
        sms_error: text.slice(0, 200),
        downstream: fallback,
      });
    }
    return NextResponse.json(
      {
        ok: false,
        status: res.status,
        error: `HR run failed: ${text.slice(0, 400)}`,
        sent: payload,
        reason: body.reason ?? null,
      },
      { status: 502 },
    );
  }

  const hr = safeJson(text) as { run_id?: string } | string;
  const runId = typeof hr === "object" && hr ? hr.run_id ?? null : null;
  await persistMessage({
    lead_id: leadId,
    role: "agent",
    channel: "sms",
    content: `📱 SMS queued via HR (${HR_ENVIRONMENT}) from +498962824034 to ${payload.phone_number}.`,
    hr_msg_id: runId,
  });

  return NextResponse.json({
    ok: true,
    triggered: "mini_sms_agent",
    workflow_id: SMS_WORKFLOW_ID,
    from: "+498962824034",
    sent: payload,
    reason: body.reason ?? null,
    hr_run_id: runId,
    hr_response: hr,
  });
}

async function emailFallback(req: Request, body: Body, reason: string): Promise<unknown> {
  const origin = new URL(req.url).origin;
  try {
    const res = await fetch(`${origin}/api/watcher/trigger-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, reason }),
      cache: "no-store",
    });
    return { status: res.status, response: safeJson(await res.text()) };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
