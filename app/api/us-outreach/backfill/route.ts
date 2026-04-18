import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/us-outreach/backfill — rescues calls that were triggered before the
 * webhook handler knew how to process `session.status_changed` events.
 *
 * For every call still missing hr_session_id, walk through hr_events looking
 * for events whose payload.data.run_id matches the call's hr_run_id. Apply the
 * latest session_id + status, then fire a sync so messages get pulled.
 */
export async function POST(req: Request) {
  const supabase = getServerSupabase();

  const { data: stuck } = await supabase
    .from("us_outreach_calls")
    .select("id, hr_run_id, hr_session_id, status")
    .or("hr_session_id.is.null,status.neq.completed")
    .limit(50);

  if (!stuck || stuck.length === 0) {
    return NextResponse.json({ ok: true, backfilled: 0 });
  }

  const { data: events } = await supabase
    .from("hr_events")
    .select("type, payload")
    .like("type", "us_outreach:session.status_changed")
    .order("ts", { ascending: true });

  const byRunId = new Map<string, { sessionId?: string; status?: string }>();
  for (const ev of events ?? []) {
    const payload = ev.payload as {
      data?: {
        run_id?: string;
        session_id?: string;
        status?: { current?: string };
      };
    };
    const d = payload?.data;
    if (!d?.run_id) continue;
    const prev = byRunId.get(d.run_id) ?? {};
    byRunId.set(d.run_id, {
      sessionId: d.session_id ?? prev.sessionId,
      status: d.status?.current ?? prev.status,
    });
  }

  const appUrl =
    process.env.MULTIPLY_APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    new URL(req.url).origin;

  const results: Array<{ id: string; session_id?: string; status?: string }> = [];
  for (const call of stuck) {
    if (!call.hr_run_id) continue;
    const match = byRunId.get(call.hr_run_id);
    if (!match) continue;
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (match.sessionId && !call.hr_session_id) update.hr_session_id = match.sessionId;
    if (match.status === "completed") update.status = "completed";
    else if (match.status === "in-progress" || match.status === "queued") update.status = "live";
    else if (match.status === "failed" || match.status === "error") update.status = "failed";

    if (Object.keys(update).length > 1) {
      await supabase.from("us_outreach_calls").update(update).eq("id", call.id);
    }
    // Also fire sync to pull messages now that we have session_id
    if (match.sessionId) {
      fetch(`${appUrl}/api/us-outreach/sync/${call.id}`).catch(() => null);
    }
    results.push({ id: call.id, session_id: match.sessionId, status: match.status });
  }

  return NextResponse.json({ ok: true, backfilled: results.length, results });
}

export async function GET(req: Request) {
  return POST(req);
}
