/**
 * Slack notifier. Posts to SLACK_WEBHOOK_URL if set. Silently no-ops otherwise.
 * Used from book-meeting + log-learning routes to broadcast demo events to
 * a #multiply-demo Slack channel — visible to the jury on stage.
 */
export type SlackBlock = {
  type: "header" | "section" | "context" | "divider";
  text?: { type: "mrkdwn" | "plain_text"; text: string };
  elements?: Array<{ type: "mrkdwn"; text: string }>;
};

export async function slackNotify(opts: {
  text: string;
  blocks?: SlackBlock[];
}): Promise<{ ok: boolean; skipped?: boolean }> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return { ok: true, skipped: true };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: opts.text, blocks: opts.blocks }),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}

export function bookedBlocks(opts: {
  company: string;
  attendeeEmail: string;
  slot: string;
  mode: "google" | "demo";
  link?: string | null;
}): SlackBlock[] {
  const when = new Date(opts.slot);
  const niceWhen = when.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
  return [
    {
      type: "header",
      text: { type: "plain_text", text: `🎯 Meeting booked · ${opts.company}` },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*When:* ${niceWhen}\n*Attendee:* ${opts.attendeeEmail}\n*Mode:* ${opts.mode === "google" ? "Google Calendar" : "Demo mode"}${opts.link ? `\n<${opts.link}|Open event>` : ""}`,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "Booked by the _Closer_ agent · logged to cognee knowledge graph",
        },
      ],
    },
  ];
}

export function learningBlocks(opts: {
  company: string;
  personaName: string;
  personaRole: string;
  outcome: string;
  rebuttalPattern?: string;
  objectionCount: number;
}): SlackBlock[] {
  const emoji =
    opts.outcome === "booked"
      ? "✅"
      : opts.outcome === "pilot-started"
        ? "🚀"
        : opts.outcome === "re-engaged"
          ? "🔄"
          : "❌";
  return [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${emoji} *Call logged · ${opts.company}*\n*${opts.personaName}* (${opts.personaRole}) · outcome: \`${opts.outcome}\`${opts.rebuttalPattern ? ` · pattern: \`${opts.rebuttalPattern}\`` : ""} · objections: ${opts.objectionCount}`,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "Transcript ingested into cognee · graph edges added",
        },
      ],
    },
  ];
}
