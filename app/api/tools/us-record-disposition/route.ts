import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/tools/us-record-disposition — HR custom tool the Outbound Voice
 * Agent calls mid-call (or just before hanging up) to persist the outcome.
 *
 * Body (HR sends): { call_id, decision, reason?, callback_at? }
 *   decision ∈ { closed | interested_no_sms | callback | not_interested }
 */
type Body = {
  call_id?: string;
  decision?: string;
  reason?: string;
  callback_at?: string;
};

const VALID = new Set([
  "closed",
  "interested_no_sms",
  "callback",
  "not_interested",
]);

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.call_id) {
    return NextResponse.json(
      { ok: false, error: "call_id required" },
      { status: 400 },
    );
  }
  const decision = body.decision ?? "not_interested";
  if (!VALID.has(decision)) {
    return NextResponse.json(
      { ok: false, error: `unknown decision: ${decision}` },
      { status: 400 },
    );
  }

  const supabase = getServerSupabase();

  const update: Record<string, unknown> = {
    disposition: decision,
    updated_at: new Date().toISOString(),
  };
  if (body.reason) update.reason = body.reason;
  if (decision === "closed") update.closed_at = new Date().toISOString();

  const { error } = await supabase
    .from("us_outreach_calls")
    .update(update)
    .eq("id", body.call_id);

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, recorded: decision });
}
