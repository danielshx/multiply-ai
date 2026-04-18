import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { sendSms } from "@/lib/twilio/client";
import { AFFILIATE, buildTrackedQuizUrl } from "@/lib/us-outreach/affiliate";

export const dynamic = "force-dynamic";

/**
 * POST /api/tools/us-send-quiz-link — HR custom tool. The Voice Agent calls
 * this when the contact verbally agrees to receive the affiliate funnel link
 * via SMS. Sends through Twilio, persists the message SID + sent timestamp.
 *
 * Body (HR sends): { call_id, phone_number, tracked_url? }
 *   tracked_url is optional — if missing we rebuild it from call_id.
 */
type Body = {
  call_id?: string;
  phone_number?: string;
  tracked_url?: string;
};

function normalizePhone(raw: string): string {
  const trimmed = raw.trim().replace(/[^\d+]/g, "");
  if (trimmed.startsWith("+")) return trimmed;
  if (trimmed.startsWith("00")) return `+${trimmed.slice(2)}`;
  if (trimmed.length === 10) return `+1${trimmed}`;
  return `+${trimmed}`;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.call_id || !body.phone_number) {
    return NextResponse.json(
      { ok: false, error: "call_id and phone_number required" },
      { status: 400 },
    );
  }

  const to = normalizePhone(body.phone_number);
  const url = body.tracked_url ?? buildTrackedQuizUrl(body.call_id);
  const message = `${AFFILIATE.productName} — take the 60-sec job-fit quiz, see what type of writing fits you ($1 trial): ${url}`;

  try {
    const sms = await sendSms({ to, body: message });
    const supabase = getServerSupabase();
    await supabase
      .from("us_outreach_calls")
      .update({
        sms_sent_at: new Date().toISOString(),
        sms_sid: sms.sid,
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.call_id);
    return NextResponse.json({ ok: true, sid: sms.sid, to: sms.to });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 502 },
    );
  }
}
