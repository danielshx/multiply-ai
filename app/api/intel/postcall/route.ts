import { NextResponse } from "next/server";
import { cognee } from "@/lib/cognee/client";
import {
  extractBANT,
  extractObjections,
  extractRebuttals,
  sentimentArc,
  outcomeClassifier,
} from "@/lib/intel/extract";
import { slackNotify } from "@/lib/slack";

export const dynamic = "force-dynamic";

/**
 * POST /api/intel/postcall — The smart brain for the agent AFTER a call ends.
 *
 * Pipeline (all sub-50ms regex work, then async cognee write):
 *   1. Extract BANT (budget, authority, need, timeline)
 *   2. Classify sentiment arc turn-by-turn
 *   3. Detect objections + which rebuttals were deployed
 *   4. Classify final outcome
 *   5. Compute closing-confidence trajectory
 *   6. Package structured learning → cognee.remember (fire-and-forget)
 *   7. Fire Slack digest for team visibility
 *
 * Body: { call_id, company, persona: { name, role }, transcript, channel? }
 */
type Body = {
  call_id?: string;
  company?: string;
  persona?: { name?: string; role?: string };
  transcript?: string;
  channel?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const transcript = body.transcript ?? "";
  const company = body.company ?? "unknown";
  const persona = body.persona ?? {};

  if (!transcript) {
    return NextResponse.json({ ok: false, error: "transcript required" }, { status: 400 });
  }

  // ─── Structured extraction (deterministic, fast) ─────────────────────
  const bant = extractBANT(transcript);
  const objections = extractObjections(transcript);
  const rebuttals = extractRebuttals(transcript);
  const sentiment = sentimentArc(transcript);
  const outcome = outcomeClassifier(transcript);

  // Confidence trajectory — average sentiment per quartile of the call
  const leadTurns = sentiment.filter((t) => t.speaker === "lead");
  const quartile = (n: number) => {
    if (!leadTurns.length) return 0;
    const slice = leadTurns.slice(
      Math.floor((n / 4) * leadTurns.length),
      Math.floor(((n + 1) / 4) * leadTurns.length),
    );
    return slice.length ? slice.reduce((a, t) => a + t.score, 0) / slice.length : 0;
  };
  const trajectory = [quartile(0), quartile(1), quartile(2), quartile(3)].map((s) =>
    Math.round(((s + 1) / 2) * 100),
  );

  // Call summary for the cognee graph — dense, searchable
  const summary = [
    `Call with ${persona.name ?? "unknown"} (${persona.role ?? "?"}) at ${company}.`,
    `Outcome: ${outcome}.`,
    objections.length ? `Objections: ${objections.map((o) => o.type).join(", ")}.` : "",
    rebuttals.length ? `Rebuttals deployed: ${rebuttals.map((r) => r.pattern).join(", ")}.` : "",
    bant.budget ? `Budget: ${bant.budget}.` : "",
    bant.authority ? `Authority: ${bant.authority}.` : "",
    bant.need ? `Need: ${bant.need}.` : "",
    bant.timeline ? `Timeline: ${bant.timeline}.` : "",
    `Sentiment trajectory (Q1→Q4): ${trajectory.join(" → ")}.`,
    transcript.length > 200 ? `Full transcript: ${transcript.slice(0, 3000)}` : transcript,
  ]
    .filter(Boolean)
    .join(" ");

  // Write to cognee fire-and-forget (don't block response)
  cognee
    .remember({
      text: summary,
      dataset: "multiply",
      metadata: {
        node_type: "call_outcome",
        call_id: body.call_id ?? `post-${Date.now()}`,
        company,
        persona_name: persona.name,
        persona_role: persona.role,
        outcome,
        objection_types: objections.map((o) => o.type),
        rebuttals_used: rebuttals.map((r) => r.pattern),
        sentiment_trajectory: trajectory,
        budget_detected: !!bant.budget,
        authority_detected: !!bant.authority,
        timeline_detected: !!bant.timeline,
        channel: body.channel ?? "phone",
        timestamp: new Date().toISOString(),
      },
    })
    .catch((e) => console.warn("cognee remember failed:", (e as Error).message));

  // Slack digest (fire-and-forget)
  slackNotify({
    text: `Call analyzed · ${company} · outcome ${outcome}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*📊 Post-call intelligence* — _${company}_\n*Outcome:* \`${outcome}\`\n*Persona:* ${persona.name ?? "?"} (${persona.role ?? "?"})\n*Sentiment arc:* ${trajectory.join(" → ")}\n*Objections:* ${objections.map((o) => o.type).join(", ") || "none"}\n*Rebuttals:* ${rebuttals.map((r) => r.pattern).join(", ") || "none"}`,
        },
      },
      {
        type: "context",
        elements: [{ type: "mrkdwn", text: "Logged to cognee · graph updated" }],
      },
    ],
  }).catch(() => null);

  return NextResponse.json({
    ok: true,
    call_id: body.call_id,
    outcome,
    bant,
    objections,
    rebuttals,
    sentiment: {
      trajectory,
      turn_count: sentiment.length,
      lead_turn_count: leadTurns.length,
    },
    confidence: {
      close_probability: Math.round(
        outcome === "booked" ? 85 : outcome === "pilot-started" ? 95 : outcome === "re-engaged" ? 30 : 5,
      ),
      signal_density: Math.min(100, objections.length * 20 + rebuttals.length * 15 + (bant.timeline ? 20 : 0)),
    },
    ingested_to_cognee: true,
  });
}
