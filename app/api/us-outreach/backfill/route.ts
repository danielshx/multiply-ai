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
 *
 * Returns detailed per-call results including any supabase error so we can
 * see why a backfill didn't stick.
 */
export async function POST(req: Request) {
  const supabase = getServerSupabase();

  const { data: stuck, error: selErr } = await supabase
    .from("us_outreach_calls")
    .select("id, hr_run_id, hr_session_id, status")
    .neq("status", "completed")
    .neq("status", "failed");

  if (selErr) {
    return NextResponse.json(
      { ok: false, error: `select failed: ${selErr.message}` },
      { status: 500 },
    );
  }
  if (!stuck || stuck.length === 0) {
    return NextResponse.json({ ok: true, backfilled: 0, note: "no stuck calls" });
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

  const results: Array<Record<string, unknown>> = [];
  for (const call of stuck) {
    const entry: Record<string, unknown> = {
      id: call.id,
      hr_run_id: call.hr_run_id,
      current_session_id: call.hr_session_id,
    };
    if (!call.hr_run_id) {
      entry.skipped = "no hr_run_id";
      results.push(entry);
      continue;
    }
    const match = byRunId.get(call.hr_run_id);
    if (!match) {
      entry.skipped = "no matching event";
      results.push(entry);
      continue;
    }
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (match.sessionId && !call.hr_session_id) update.hr_session_id = match.sessionId;
    if (match.status === "completed") update.status = "completed";
    else if (match.status === "in-progress" || match.status === "queued") update.status = "live";
    else if (match.status === "failed" || match.status === "error") update.status = "failed";

    entry.attempted_update = update;
    entry.match = match;

    const { data: updatedRow, error: updErr } = await supabase
      .from("us_outreach_calls")
      .update(update)
      .eq("id", call.id)
      .select()
      .single();
    if (updErr) {
      entry.update_error = updErr.message;
    } else {
      entry.updated_row = {
        id: updatedRow?.id,
        status: updatedRow?.status,
        hr_session_id: updatedRow?.hr_session_id,
        updated_at: updatedRow?.updated_at,
      };
    }

    if (match.sessionId) {
      fetch(`${appUrl}/api/us-outreach/sync/${call.id}`).catch(() => null);
      entry.sync_kicked = true;
    }
    results.push(entry);
  }

  return NextResponse.json({
    ok: true,
    stuck_count: stuck.length,
    events_count: events?.length ?? 0,
    distinct_run_ids_in_events: byRunId.size,
    results,
  });
}

export async function GET(req: Request) {
  return POST(req);
}
