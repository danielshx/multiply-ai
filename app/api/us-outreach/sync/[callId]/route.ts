import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/us-outreach/sync/[callId] — pull-based sync from HR.
 *
 * The dashboard polls this endpoint every few seconds for any call that's not
 * yet completed. We:
 *   1. Read the call row to get hr_run_id (set by /api/us-outreach/trigger).
 *   2. Fetch GET /runs/{run_id} from HR to discover session_id + run status.
 *   3. If session_id is new, persist it on the call row + flip status=live.
 *   4. Fetch GET /sessions/{session_id}/messages, upsert any new ones into
 *      us_outreach_messages so Realtime broadcasts to the drawer.
 *   5. If the run is terminal (completed/failed), update the call row.
 *
 * This is a fallback for when HR's outgoing webhook doesn't push live events.
 */

// Use the same base as the trigger route — api.eu.happyrobot.ai reliably
// returns "fetch failed" from Vercel for these endpoints.
const HR_BASE = "https://platform.eu.happyrobot.ai/api/v2";

type RunDetails = {
  id?: string;
  status?: string;
  session_id?: string;
  session?: { id?: string; status?: string; duration_sec?: number };
  duration_sec?: number;
  transcript_url?: string;
  recording_url?: string;
};

type Message = {
  id: string;
  session_id?: string;
  role?: string;
  content?: string;
  timestamp?: string;
  is_filler?: boolean;
  is_interrupted?: boolean;
};

async function hrGet<T>(path: string): Promise<T> {
  const key = process.env.HR_API_KEY;
  if (!key) throw new Error("HR_API_KEY not set");
  const res = await fetch(`${HR_BASE}${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    throw new Error(`HR ${res.status} on GET ${path}: ${(await res.text()).slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export async function GET(
  _req: Request,
  ctx: { params: { callId: string } },
) {
  const supabase = getServerSupabase();
  const callId = ctx.params.callId;

  const { data: call, error } = await supabase
    .from("us_outreach_calls")
    .select("*")
    .eq("id", callId)
    .maybeSingle();
  if (error || !call) {
    return NextResponse.json({ ok: false, error: "call not found" }, { status: 404 });
  }
  if (!call.hr_run_id) {
    return NextResponse.json({ ok: false, reason: "no hr_run_id yet" });
  }

  // Fallback: if DB doesn't have session_id yet, try to recover it from the
  // audit log of session.status_changed events (which always carry session_id).
  if (!call.hr_session_id) {
    const { data: events } = await supabase
      .from("hr_events")
      .select("payload")
      .like("type", "us_outreach:session.status_changed")
      .order("ts", { ascending: false })
      .limit(50);
    for (const ev of events ?? []) {
      const d = (ev.payload as { data?: { run_id?: string; session_id?: string } } | undefined)?.data;
      if (!d) continue;
      if (d.run_id === call.hr_run_id && d.session_id) {
        call.hr_session_id = d.session_id;
        await supabase
          .from("us_outreach_calls")
          .update({ hr_session_id: d.session_id, updated_at: new Date().toISOString() })
          .eq("id", callId);
        break;
      }
    }
  }

  // 1. Run details → session_id
  let run: RunDetails;
  try {
    run = await hrGet<RunDetails>(`/runs/${call.hr_run_id}`);
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 502 },
    );
  }

  // HR's GET /runs/{id} doesn't return session_id, so rely on the value
  // already persisted on the call row (set by the webhook handler when HR
  // fires session.status_changed). Fall back to the run response in case
  // the API shape changes in a future version.
  const sessionId =
    (call.hr_session_id as string | undefined) ??
    run.session_id ??
    run.session?.id ??
    null;
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (sessionId && call.hr_session_id !== sessionId) update.hr_session_id = sessionId;
  if (run.status === "running" && call.status !== "live") update.status = "live";
  if (run.transcript_url) update.transcript_url = run.transcript_url;
  if (run.recording_url) update.recording_url = run.recording_url;
  const duration = run.duration_sec ?? run.session?.duration_sec;
  if (typeof duration === "number") update.duration_sec = duration;

  if (run.status === "completed" || run.status === "failed") {
    update.status = run.status === "failed" ? "failed" : "completed";
  }

  if (Object.keys(update).length > 1) {
    await supabase.from("us_outreach_calls").update(update).eq("id", callId);
  }

  // 2. Messages → upsert into us_outreach_messages
  let messageCount = 0;
  if (sessionId) {
    try {
      const { data: msgs } = await hrGet<{ data: Message[] }>(
        `/sessions/${sessionId}/messages?page=1&page_size=100&sort=asc`,
      );
      if (msgs && msgs.length > 0) {
        const candidates = msgs
          .filter((m) => !m.is_filler && (m.content ?? "").trim().length > 0)
          .filter((m) => {
            // skip obvious system noise like <Thoughts>... events
            const c = m.content ?? "";
            if (c.startsWith("<Thoughts>")) return false;
            return true;
          });

        // Fetch already-persisted hr_msg_ids for this call → skip them.
        const { data: existing } = await supabase
          .from("us_outreach_messages")
          .select("hr_msg_id")
          .eq("call_id", callId);
        const existingIds = new Set((existing ?? []).map((r) => r.hr_msg_id));

        const newRows = candidates
          .filter((m) => !existingIds.has(m.id))
          .map((m) => ({
            call_id: callId,
            ts: m.timestamp ?? new Date().toISOString(),
            role: m.role ?? "agent",
            content: m.content ?? "",
            hr_msg_id: m.id,
          }));

        // Insert rows one-by-one so a single duplicate doesn't abort the batch.
        // The unique index on hr_msg_id (partial) is idempotency protection.
        let insertedCount = 0;
        const errors: string[] = [];
        for (const row of newRows) {
          const { error: insErr } = await supabase
            .from("us_outreach_messages")
            .insert(row);
          if (insErr) {
            if (!insErr.message.includes("duplicate")) {
              errors.push(insErr.message.slice(0, 120));
            }
          } else {
            insertedCount++;
          }
        }
        messageCount = insertedCount;
        if (errors.length > 0) {
          return NextResponse.json({
            ok: false,
            session_id: sessionId,
            synced_messages: insertedCount,
            insert_errors: errors.slice(0, 3),
            attempted: newRows.length,
          });
        }
      }
    } catch (err) {
      // Session may not be ready yet — that's fine, next poll will retry.
      return NextResponse.json({
        ok: true,
        run_status: run.status,
        session_id: sessionId,
        messages_warning: (err as Error).message,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    run_status: run.status,
    session_id: sessionId,
    synced_messages: messageCount,
    final: run.status === "completed" || run.status === "failed",
  });
}
