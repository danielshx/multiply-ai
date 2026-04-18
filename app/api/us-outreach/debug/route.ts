import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/us-outreach/debug — diagnostics dump.
 * Returns:
 *   - last 5 us_outreach_calls rows (statuses + HR IDs + counts)
 *   - last 10 us_outreach_messages rows
 *   - last 20 hr_events rows tagged as us_outreach
 *   - for the most recent call: live HR GET /runs/{run_id} response shape
 */
export async function GET() {
  const supabase = getServerSupabase();
  const key = process.env.HR_API_KEY;
  const HR_BASE = "https://platform.eu.happyrobot.ai/api/v2";

  const { data: calls } = await supabase
    .from("us_outreach_calls")
    .select("id, contact_name, phone_number, status, disposition, hr_run_id, hr_session_id, created_at, updated_at, duration_sec, sms_sent_at, closed_at, reason")
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: messages } = await supabase
    .from("us_outreach_messages")
    .select("id, call_id, role, content, ts")
    .order("ts", { ascending: false })
    .limit(10);

  const { data: events } = await supabase
    .from("hr_events")
    .select("ts, type, payload")
    .like("type", "us_outreach:%")
    .order("ts", { ascending: false })
    .limit(20);

  let latestRunDump: unknown = null;
  let latestMessagesDump: unknown = null;
  const latest = calls?.[0];
  if (latest?.hr_run_id && key) {
    try {
      const runRes = await fetch(`${HR_BASE}/runs/${latest.hr_run_id}`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      latestRunDump = {
        status: runRes.status,
        ok: runRes.ok,
        body: await runRes.text().then((t) => t.slice(0, 2000)),
      };
    } catch (e) {
      latestRunDump = { error: (e as Error).message };
    }

    if (latest.hr_session_id) {
      try {
        const msgRes = await fetch(
          `${HR_BASE}/sessions/${latest.hr_session_id}/messages?page=1&page_size=50&sort=asc`,
          { headers: { Authorization: `Bearer ${key}` } },
        );
        latestMessagesDump = {
          status: msgRes.status,
          ok: msgRes.ok,
          body: await msgRes.text().then((t) => t.slice(0, 2500)),
        };
      } catch (e) {
        latestMessagesDump = { error: (e as Error).message };
      }
    }
  }

  return NextResponse.json({
    calls,
    messages,
    events,
    latest_run_hr_response: latestRunDump,
    latest_messages_hr_response: latestMessagesDump,
    hr_us_workflow_id: process.env.HR_US_WORKFLOW_ID ?? null,
    app_url: process.env.MULTIPLY_APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? null,
    hr_api_key_set: !!key,
  });
}
