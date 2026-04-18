import { NextResponse } from "next/server";
import { sendEmail, EMAIL_FROM } from "@/lib/email/sender";
import { persistMessage, findLeadIdByContact } from "@/lib/supabase/persistMessage";
import { getPriorContext } from "@/lib/cognee/priorContext";

/**
 * POST /api/watcher/trigger-email — Email Agent branch of the Watcher Cron
 * Workflow. Sends a real outbound email via Gmail SMTP from EMAIL_AGENT_FROM
 * (defaults to happymultiply@gmail.com) to the lead.
 *
 * Body: {
 *   name?, company?, email, customer_goal?, current_time?, reason?
 * }
 *
 * Response includes the actual SMTP messageId so the caller can confirm.
 *
 * If GMAIL_APP_PASSWORD is missing, the route falls back to STUB mode and
 * returns ok=true with a stub note (so the watcher pipeline stays green
 * during local dev without credentials).
 */
type Body = {
  name?: string;
  company?: string;
  email?: string;
  customer_goal?: string;
  current_time?: string;
  reason?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;

  if (!body.email) {
    return NextResponse.json(
      { ok: false, error: "email is required" },
      { status: 400 },
    );
  }

  const leadId = await findLeadIdByContact({ email: body.email });

  // Pull what we already know from Cognee. Used both as an opt-out guard
  // (don't email someone who said STOP) and to personalize the opener.
  const prior = await getPriorContext({
    name: body.name,
    company: body.company,
    email: body.email,
    channel: "email",
  });
  const priorLower = prior.toLowerCase();
  if (
    priorLower.includes("opt_out") ||
    priorLower.includes("unsubscrib") ||
    priorLower.includes("do not contact") ||
    priorLower.includes("stop sending")
  ) {
    await persistMessage({
      lead_id: leadId,
      role: "system",
      channel: "email",
      content: `✉️ Skipped — prior_context shows opt-out signal: ${prior.slice(0, 200)}`,
    });
    return NextResponse.json({
      ok: true,
      sent: false,
      skipped: true,
      reason: "opt_out_detected_in_prior_context",
      from: EMAIL_FROM,
      to: body.email,
      prior_context: prior,
    });
  }

  const subject = subjectFor(body);
  const text = bodyTextFor(body, prior);
  const html = bodyHtmlFor(body, prior);

  if (!process.env.GMAIL_APP_PASSWORD) {
    console.log(
      `[watcher/trigger-email] STUB (no GMAIL_APP_PASSWORD) — would send FROM=${EMAIL_FROM} TO=${body.email}`,
    );
    await persistMessage({
      lead_id: leadId,
      role: "system",
      channel: "email",
      content: `✉️ STUB email skipped (no GMAIL_APP_PASSWORD) — would have sent: "${subject}"`,
    });
    return NextResponse.json({
      ok: true,
      sent: false,
      stub: true,
      from: EMAIL_FROM,
      to: body.email,
      subject,
      reason: body.reason ?? null,
      note: "Set GMAIL_APP_PASSWORD in .env.local to send real emails.",
    });
  }

  const result = await sendEmail({
    to: body.email,
    subject,
    text,
    html,
    replyTo: EMAIL_FROM,
  });

  if (!result.ok) {
    console.error(`[watcher/trigger-email] FAILED to=${body.email} err=${result.error}`);
    await persistMessage({
      lead_id: leadId,
      role: "system",
      channel: "email",
      content: `✉️ Email FAILED to ${body.email}: ${result.error?.slice(0, 200)}`,
    });
    return NextResponse.json(
      {
        ok: false,
        sent: false,
        from: EMAIL_FROM,
        to: body.email,
        subject,
        error: result.error,
      },
      { status: 502 },
    );
  }

  console.log(
    `[watcher/trigger-email] SENT message_id=${result.messageId} to=${body.email}`,
  );
  await persistMessage({
    lead_id: leadId,
    role: "agent",
    channel: "email",
    content: `✉️ Sent: "${subject}"\n\n${text.slice(0, 800)}`,
    hr_msg_id: result.messageId ?? null,
  });
  return NextResponse.json({
    ok: true,
    sent: true,
    from: EMAIL_FROM,
    to: body.email,
    subject,
    message_id: result.messageId,
    accepted: result.accepted,
    rejected: result.rejected,
    reason: body.reason ?? null,
  });
}

/**
 * Mirror the Mini Voice Agent's prompt style: brutally short, one ask, no
 * marketing fluff, language follows the lead's locale (DE for DACH).
 *
 * Pitch: AI courses — practical, hands-on, for people who want to actually
 * build with AI, not theory. One question per email.
 */
function isDachContext(body: Body): boolean {
  const text = `${body.name ?? ""} ${body.company ?? ""} ${body.email ?? ""} ${body.customer_goal ?? ""}`.toLowerCase();
  return (
    text.includes(".de") ||
    text.includes(" gmbh") ||
    text.includes("german") ||
    text.includes("deutsch") ||
    text.includes("münchen") ||
    text.includes("munich") ||
    text.includes("berlin") ||
    text.includes("tum.ai") ||
    text.includes("lmu")
  );
}

function subjectFor(body: Body): string {
  return isDachContext(body)
    ? "AI Kurs — passt das?"
    : "AI course — quick fit?";
}

function bodyTextFor(body: Body, prior: string): string {
  const de = isDachContext(body);
  const name = body.name?.trim().split(" ")[0] || (de ? "Hi" : "Hey");

  if (de) {
    return [
      `Hi ${name},`,
      ``,
      prior ? `(Kurz aus unseren Notizen: ${prior})` : null,
      prior ? `` : null,
      `Wir bauen praktische AI-Kurse — kein Theorie-Geschwätz, du baust am ersten Tag selbst was.`,
      ``,
      `Passt für dich? Antworte einfach mit "ja" oder "nein".`,
      ``,
      `— Alex`,
    ]
      .filter((l) => l !== null)
      .join("\n");
  }

  return [
    `Hi ${name},`,
    ``,
    prior ? `(Quick context from our notes: ${prior})` : null,
    prior ? `` : null,
    `We build hands-on AI courses — no theory fluff, you ship something on day one.`,
    ``,
    `Fit for you? Just reply "yes" or "no".`,
    ``,
    `— Alex`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

function bodyHtmlFor(body: Body, prior: string): string {
  const de = isDachContext(body);
  const name = body.name?.trim().split(" ")[0] || (de ? "Hi" : "Hey");
  const priorBlock = prior
    ? `<p style="color:#666; font-size:12px; font-style:italic; margin:0 0 12px;">(${de ? "Kurz aus unseren Notizen" : "Quick context from our notes"}: ${escape(prior)})</p>`
    : "";

  const greeting = `Hi ${escape(name)},`;
  const pitch = de
    ? `Wir bauen praktische AI-Kurse — kein Theorie-Geschw&auml;tz, du baust am ersten Tag selbst was.`
    : `We build hands-on AI courses — no theory fluff, you ship something on day one.`;
  const ask = de
    ? `Passt f&uuml;r dich? Antworte einfach mit <strong>"ja"</strong> oder <strong>"nein"</strong>.`
    : `Fit for you? Just reply <strong>"yes"</strong> or <strong>"no"</strong>.`;

  return `<!doctype html><html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 15px; line-height: 1.55; color: #111; max-width: 480px;">
<p style="margin:0 0 12px;">${greeting}</p>
${priorBlock}
<p style="margin:0 0 12px;">${pitch}</p>
<p style="margin:0 0 12px;">${ask}</p>
<p style="margin:0; color:#444;">— Alex</p>
</body></html>`;
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
