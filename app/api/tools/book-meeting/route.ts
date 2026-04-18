import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { cognee } from "@/lib/cognee/client";
import { slackNotify, bookedBlocks } from "@/lib/slack";

/**
 * POST /api/tools/book-meeting — HR custom tool. Books a meeting on the
 * configured Google Calendar.
 *
 * Two modes:
 *   - If GOOGLE_OAUTH_REFRESH_TOKEN is set → real Google Calendar insert.
 *   - Otherwise → "demo mode": picks the first slot, returns a fake event id,
 *     records the booking in supabase + cognee. The pitch demo runs in this
 *     mode unless you explicitly hooked up Calendar.
 *
 * Body:
 *   { company: string, attendee_email: string,
 *     proposed_slots: string[] (ISO 8601), duration_minutes?: number }
 */
type Body = {
  company?: string;
  attendee_email?: string;
  proposed_slots?: string[];
  duration_minutes?: number;
  lead_id?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const slot = body.proposed_slots?.[0];
  if (!slot) {
    return NextResponse.json({ ok: false, error: "no proposed_slots" }, { status: 400 });
  }

  const hasGoogle =
    !!process.env.GOOGLE_OAUTH_REFRESH_TOKEN &&
    !!process.env.GOOGLE_OAUTH_CLIENT_ID &&
    !!process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  let calendarEventId: string;
  let calendarLink: string | null = null;
  let mode: "google" | "demo";

  if (hasGoogle) {
    try {
      const result = await bookOnGoogleCalendar(body, slot);
      calendarEventId = result.id;
      calendarLink = result.htmlLink;
      mode = "google";
    } catch (err) {
      return NextResponse.json(
        { ok: false, error: `google calendar error: ${(err as Error).message}` },
        { status: 502 },
      );
    }
  } else {
    calendarEventId = `demo_${Date.now().toString(36)}`;
    mode = "demo";
  }

  // Side effects: log to supabase + ingest into cognee for the graph
  const supabase = getServerSupabase();
  if (body.lead_id) {
    await supabase
      .from("leads")
      .update({ stage: "booked" })
      .eq("id", body.lead_id)
      .then(
        () => null,
        () => null,
      );
  }

  cognee
    .remember({
      text: `Meeting booked with ${body.company ?? "unknown"} (${body.attendee_email ?? "no email"}) for ${slot}. Outcome: booked. Channel: phone. Mode: ${mode}.`,
      dataset: "multiply",
      metadata: {
        node_type: "meeting_booked",
        company: body.company,
        slot,
        outcome: "booked",
        mode,
        timestamp: new Date().toISOString(),
      },
    })
    .catch(() => null);

  slackNotify({
    text: `🎯 Meeting booked with ${body.company ?? "unknown"} for ${slot}`,
    blocks: bookedBlocks({
      company: body.company ?? "unknown",
      attendeeEmail: body.attendee_email ?? "",
      slot,
      mode,
      link: calendarLink,
    }),
  }).catch(() => null);

  return NextResponse.json({
    ok: true,
    mode,
    slot_booked: slot,
    calendar_event_id: calendarEventId,
    calendar_link: calendarLink,
  });
}

async function bookOnGoogleCalendar(
  body: Body,
  slot: string,
): Promise<{ id: string; htmlLink: string }> {
  const accessToken = await getGoogleAccessToken();
  const start = new Date(slot);
  const durationMs = (body.duration_minutes ?? 30) * 60_000;
  const end = new Date(start.getTime() + durationMs);
  const calendarId = process.env.DEMO_CALENDAR_ID ?? "primary";

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: `Multiply demo follow-up · ${body.company ?? ""}`,
        description: "Booked by the Multiply Closer agent.",
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        attendees: body.attendee_email ? [{ email: body.attendee_email }] : [],
      }),
    },
  );
  if (!res.ok) throw new Error(`Calendar API ${res.status}: ${await res.text()}`);
  const event = (await res.json()) as { id: string; htmlLink: string };
  return event;
}

async function getGoogleAccessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`OAuth refresh failed: ${await res.text()}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}
