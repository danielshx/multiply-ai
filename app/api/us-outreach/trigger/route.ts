import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { AFFILIATE, buildTrackedQuizUrl } from "@/lib/us-outreach/affiliate";

export const dynamic = "force-dynamic";

/**
 * POST /api/us-outreach/trigger — places a US cold call via HappyRobot for the
 * Paid Online Writing Jobs affiliate funnel. Inserts a row into
 * `us_outreach_calls` first so the dashboard can render the call optimistically
 * (status=triggered) and then live-update via Supabase Realtime as the HR
 * webhook + custom tools fire.
 *
 * Body: { phone_number: string, contact_name?: string }
 */
const HR_BASE = "https://platform.eu.happyrobot.ai/api/v2";

type Body = {
  phone_number?: string;
  contact_name?: string;
};

function normalizePhone(raw: string): string {
  const trimmed = raw.trim().replace(/[^\d+]/g, "");
  if (trimmed.startsWith("+")) return trimmed;
  if (trimmed.startsWith("00")) return `+${trimmed.slice(2)}`;
  return `+${trimmed}`;
}

/**
 * Map the phone's country prefix to a language code + opener. German-speaking
 * regions (Germany, Austria, Switzerland) get German; everything else English.
 */
function languageFor(phone: string, name: string) {
  const n = name?.trim() || "";
  const firstName = n || "there";
  if (/^\+49/.test(phone) || /^\+43/.test(phone) || /^\+41/.test(phone)) {
    return {
      language: "de",
      language_name: "Deutsch",
      greeting_word: "Hallo",
      initial_line: `Hallo ${firstName}, hier ist Alex vom Writers Network — hast du kurz eine Sekunde?`,
    };
  }
  return {
    language: "en",
    language_name: "English",
    greeting_word: "Hey",
    initial_line: `Hey ${firstName}, this is Alex from the Writers Network — got a quick second?`,
  };
}

export async function POST(req: Request) {
  const key = process.env.HR_API_KEY;
  const wfId = process.env.HR_US_WORKFLOW_ID ?? process.env.HR_WORKFLOW_ID;
  if (!key) {
    return NextResponse.json(
      { ok: false, error: "HR_API_KEY not set" },
      { status: 500 },
    );
  }
  if (!wfId) {
    return NextResponse.json(
      { ok: false, error: "HR_US_WORKFLOW_ID not set" },
      { status: 500 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.phone_number) {
    return NextResponse.json(
      { ok: false, error: "phone_number is required" },
      { status: 400 },
    );
  }
  const phone = normalizePhone(body.phone_number);
  const contactName = body.contact_name?.trim() || "there";

  const supabase = getServerSupabase();

  const { data: row, error: insertErr } = await supabase
    .from("us_outreach_calls")
    .insert({
      contact_name: contactName,
      phone_number: phone,
      status: "triggered",
    })
    .select()
    .single();

  if (insertErr || !row) {
    return NextResponse.json(
      { ok: false, error: insertErr?.message ?? "insert failed" },
      { status: 500 },
    );
  }

  const callId = row.id as string;
  const trackedUrl = buildTrackedQuizUrl(callId);
  const lang = languageFor(phone, contactName);

  const payload = {
    call_id: callId,
    phone_number: phone,
    contact_name: contactName,
    product_name: AFFILIATE.productName,
    product_url: AFFILIATE.productUrl,
    quiz_hop_id: AFFILIATE.hopId,
    tracked_quiz_url: trackedUrl,
    language: lang.language,
    language_name: lang.language_name,
    initial_line: lang.initial_line,
  };

  try {
    const res = await fetch(`${HR_BASE}/workflows/${wfId}/runs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ environment: "production", payload }),
    });
    const text = await res.text();
    if (!res.ok) {
      await supabase
        .from("us_outreach_calls")
        .update({
          status: "failed",
          reason: text.slice(0, 300),
          updated_at: new Date().toISOString(),
        })
        .eq("id", callId);
      return NextResponse.json(
        { ok: false, status: res.status, error: text.slice(0, 300) },
        { status: 502 },
      );
    }
    const parsed = JSON.parse(text) as { id?: string; run_id?: string };
    const runId = parsed.run_id ?? parsed.id ?? null;
    await supabase
      .from("us_outreach_calls")
      .update({
        hr_run_id: runId,
        status: "live",
        updated_at: new Date().toISOString(),
      })
      .eq("id", callId);

    // Fire-and-forget: kick the sync endpoint a few times so session_id + early
    // messages get pulled even if the dashboard tab isn't open. Each attempt
    // just hits our own /sync/[callId] — the serverless fn runs independently
    // and won't block this response.
    const appUrl =
      process.env.MULTIPLY_APP_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      new URL(req.url).origin;
    const schedule = [3000, 6000, 10000, 18000, 30000, 60000];
    for (const delay of schedule) {
      setTimeout(() => {
        fetch(`${appUrl}/api/us-outreach/sync/${callId}`).catch(() => null);
      }, delay);
    }

    return NextResponse.json({
      ok: true,
      call_id: callId,
      hr_run_id: runId,
      triggered: payload,
    });
  } catch (err) {
    await supabase
      .from("us_outreach_calls")
      .update({
        status: "failed",
        reason: (err as Error).message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", callId);
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/us-outreach/trigger",
    usage: "POST { phone_number: '+1...', contact_name?: string }",
  });
}
