import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/us-outreach/webhook — single endpoint that accepts both:
 *   1) HR auto-fired events (workflow.settings.webhooks)
 *      { type: "message.created" | "run.started" | "run.completed" | "call.ended" | "run.failed", data: { ... } }
 *      Payload variables we set at trigger time (call_id, contact_name, ...) surface as `data.<key>`.
 *
 *   2) Manual disposition payload (from a future Condition node)
 *      { call_id, disposition, transcript_url?, recording_url?, duration_sec?, reason?, raw? }
 *
 * The endpoint discriminates by body shape.
 */

type HrEvent = {
  type?: string;
  event?: string;
  data?: Record<string, unknown>;
};

type DispositionBody = {
  call_id?: string;
  disposition?: string;
  hr_session_id?: string;
  transcript_url?: string;
  recording_url?: string;
  duration_sec?: number;
  reason?: string;
  raw?: Record<string, unknown>;
};

const TERMINAL = new Set([
  "closed",
  "interested_no_sms",
  "callback",
  "not_interested",
  "voicemail",
  "invalid",
]);

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as HrEvent & DispositionBody;
  const supabase = getServerSupabase();

  // Audit-log every incoming payload so we can debug HR-side delivery without
  // Vercel logs. Survives forever; query: select * from hr_events order by ts desc;
  await supabase
    .from("hr_events")
    .insert({
      type: `us_outreach:${body.type ?? body.event ?? "manual_disposition"}`,
      payload: body as unknown as Record<string, unknown>,
    })
    .then(
      () => null,
      () => null,
    );

  // --- HR auto-event path ---
  const eventType = body.type ?? body.event;
  if (eventType && body.data) {
    return handleHrEvent(eventType, body.data);
  }

  // --- Manual disposition path ---
  if (!body.call_id) {
    return NextResponse.json(
      { ok: false, error: "call_id required (or HR event with type+data)" },
      { status: 400 },
    );
  }
  const disposition = body.disposition ?? "unknown";

  const update: Record<string, unknown> = {
    status: "completed",
    disposition,
    updated_at: new Date().toISOString(),
    raw_outcome: body.raw ?? {},
  };
  if (body.hr_session_id) update.hr_session_id = body.hr_session_id;
  if (body.transcript_url) update.transcript_url = body.transcript_url;
  if (body.recording_url) update.recording_url = body.recording_url;
  if (typeof body.duration_sec === "number") update.duration_sec = body.duration_sec;
  if (body.reason) update.reason = body.reason;
  if (disposition === "closed") update.closed_at = new Date().toISOString();

  const { error } = await supabase
    .from("us_outreach_calls")
    .update(update)
    .eq("id", body.call_id);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    call_id: body.call_id,
    disposition,
    known: TERMINAL.has(disposition),
  });
}

async function handleHrEvent(
  eventType: string,
  data: Record<string, unknown>,
) {
  const supabase = getServerSupabase();

  // HR fires `session.status_changed` with shape:
  //   { run_id, session_id, status: { current, previous, updated_at }, ... }
  // and `message.created` (if ever) with shape:
  //   { role, content, id, lead_id|call_id }
  const callIdFromPayload =
    (data.call_id as string | undefined) ?? undefined;
  const runId =
    (data.run_id as string | undefined) ??
    (data.id as string | undefined) ??
    undefined;
  const sessionId =
    (data.session_id as string | undefined) ??
    ((data.session as { id?: string } | undefined)?.id as string | undefined) ??
    undefined;

  // Resolve our internal call_id (uuid)
  let callId: string | null = callIdFromPayload ?? null;
  if (!callId && runId) {
    const { data: row } = await supabase
      .from("us_outreach_calls")
      .select("id")
      .eq("hr_run_id", runId)
      .maybeSingle();
    callId = (row?.id as string | undefined) ?? null;
  }
  if (!callId && sessionId) {
    const { data: row } = await supabase
      .from("us_outreach_calls")
      .select("id")
      .eq("hr_session_id", sessionId)
      .maybeSingle();
    callId = (row?.id as string | undefined) ?? null;
  }

  switch (eventType) {
    // HR's primary event type for the voice-agent template.
    case "session.status_changed": {
      if (!callId) break;
      const current =
        ((data.status as { current?: string } | undefined)?.current as string | undefined) ??
        undefined;
      const update: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (sessionId) update.hr_session_id = sessionId;
      if (runId) update.hr_run_id = runId;
      if (current === "queued" || current === "in-progress") update.status = "live";
      if (current === "completed") update.status = "completed";
      if (current === "failed" || current === "error") update.status = "failed";
      await supabase.from("us_outreach_calls").update(update).eq("id", callId);

      // AWAIT the sync (not fire-and-forget — Vercel kills the lambda on
      // response otherwise, so fire-and-forget fetches were silently dying).
      // Slight webhook latency penalty, but messages actually land in DB.
      if (current === "in-progress" || current === "completed") {
        const appUrl =
          process.env.MULTIPLY_APP_URL ??
          process.env.NEXT_PUBLIC_APP_URL ??
          "https://multiply-danielshxs-projects.vercel.app";
        try {
          await fetch(`${appUrl}/api/us-outreach/sync/${callId}`);
        } catch {
          /* best-effort */
        }
      }
      break;
    }

    case "run.started":
    case "session.started":
    case "call.started": {
      if (!callId) break;
      const update: Record<string, unknown> = {
        status: "live",
        updated_at: new Date().toISOString(),
      };
      if (sessionId) update.hr_session_id = sessionId;
      if (runId) update.hr_run_id = runId;
      await supabase.from("us_outreach_calls").update(update).eq("id", callId);
      break;
    }

    case "message.created":
    case "message": {
      if (!callId) break;
      const role = (data.role as string | undefined) ?? "agent";
      const content =
        (data.content as string | undefined) ??
        (data.text as string | undefined) ??
        "";
      const hrMsgId =
        (data.id as string | undefined) ??
        (data.message_id as string | undefined) ??
        null;
      if (!content.trim()) break;
      await supabase
        .from("us_outreach_messages")
        .insert({
          call_id: callId,
          role,
          content,
          hr_msg_id: hrMsgId,
        })
        .then(
          () => null,
          () => null, // ignore unique-violations from re-deliveries
        );
      break;
    }

    case "run.completed":
    case "call.ended":
    case "session.ended": {
      if (!callId) break;
      const transcriptUrl =
        (data.transcript_url as string | undefined) ?? undefined;
      const recordingUrl =
        (data.recording_url as string | undefined) ?? undefined;
      const duration =
        typeof data.duration_sec === "number"
          ? (data.duration_sec as number)
          : typeof data.duration === "number"
            ? (data.duration as number)
            : undefined;
      const update: Record<string, unknown> = {
        status: "completed",
        updated_at: new Date().toISOString(),
      };
      if (transcriptUrl) update.transcript_url = transcriptUrl;
      if (recordingUrl) update.recording_url = recordingUrl;
      if (typeof duration === "number") update.duration_sec = duration;
      await supabase.from("us_outreach_calls").update(update).eq("id", callId);
      break;
    }

    case "run.failed":
    case "call.failed": {
      if (!callId) break;
      await supabase
        .from("us_outreach_calls")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
          reason: (data.reason as string | undefined) ?? "hr reported failure",
        })
        .eq("id", callId);
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ ok: true, event: eventType, mapped_call_id: callId });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/us-outreach/webhook",
    accepts: [
      "HR auto-events: message.created, run.started, run.completed, call.ended, run.failed",
      "Manual disposition: { call_id, disposition, ... }",
    ],
  });
}
