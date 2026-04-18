import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { log } from "@/lib/us-outreach/log";

export const dynamic = "force-dynamic";

/**
 * POST /api/us-outreach/cancel/[callId] — cancels an in-flight HR run and
 * marks our call row as canceled.
 */
const HR_BASE = "https://platform.eu.happyrobot.ai/api/v2";

export async function POST(
  _req: Request,
  ctx: { params: { callId: string } },
) {
  const callId = ctx.params.callId;
  const supabase = getServerSupabase();

  const { data: call } = await supabase
    .from("us_outreach_calls")
    .select("id, hr_run_id, status")
    .eq("id", callId)
    .maybeSingle();
  if (!call) {
    return NextResponse.json({ ok: false, error: "call not found" }, { status: 404 });
  }

  const key = process.env.HR_API_KEY;
  let hrStatus: string | null = null;
  let hrError: string | null = null;

  if (key && call.hr_run_id) {
    try {
      const res = await fetch(`${HR_BASE}/runs/${call.hr_run_id}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
      });
      const text = await res.text();
      if (!res.ok) {
        hrError = `HR ${res.status}: ${text.slice(0, 200)}`;
      } else {
        try {
          hrStatus = (JSON.parse(text) as { status?: string }).status ?? "canceled";
        } catch {
          hrStatus = "canceled";
        }
      }
    } catch (err) {
      hrError = (err as Error).message;
    }
  }

  const nowIso = new Date().toISOString();
  await supabase
    .from("us_outreach_calls")
    .update({
      status: "failed",
      reason: hrError ? `canceled (${hrError})` : "canceled by user",
      ended_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", callId);

  log.info(
    "cancel",
    hrError ? "hr_cancel_errored_marked_failed_locally" : "canceled",
    { hrStatus, hrError },
    callId,
  );

  return NextResponse.json({
    ok: true,
    call_id: callId,
    hr_status: hrStatus,
    hr_error: hrError,
  });
}
