import { NextResponse } from "next/server";
import { cognee } from "@/lib/cognee/client";
import { slackNotify, learningBlocks } from "@/lib/slack";

/**
 * POST /api/tools/log-learning — HR custom tool. Called when a call ends:
 * persists the transcript + outcome + metadata into the cognee knowledge graph
 * so the next Negotiator call recalls patterns that worked / failed.
 *
 * Body (HR sends):
 * {
 *   call_id: string,
 *   company: string,
 *   persona: { name, role },
 *   transcript: string,                   // full call text
 *   objections: string[],
 *   rebuttal_pattern: string,
 *   outcome: 'booked' | 'pilot-started' | 're-engaged' | 'lost',
 *   channel: 'phone' | 'email' | 'linkedin' | 'sms',
 *   metadata?: Record<string, unknown>,
 * }
 */
type Body = {
  call_id?: string;
  company?: string;
  persona?: { name?: string; role?: string };
  transcript?: string;
  objections?: string[];
  rebuttal_pattern?: string;
  outcome?: string;
  channel?: string;
  metadata?: Record<string, unknown>;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;

  const persona = body.persona ?? {};
  const objections = body.objections ?? [];
  const objectionLine = objections.length
    ? `Objection: "${objections.join('", "')}".`
    : "No major objections.";
  const rebuttal = body.rebuttal_pattern
    ? `Rebuttal pattern: ${body.rebuttal_pattern}.`
    : "";
  const outcome = body.outcome ? `Outcome: ${body.outcome}.` : "";
  const transcriptSnippet = body.transcript
    ? `\n\nTranscript:\n${body.transcript.slice(0, 4000)}`
    : "";

  const text = [
    `Call with ${persona.name ?? "unknown"} (${persona.role ?? "unknown role"}) at ${body.company ?? "unknown company"}.`,
    objectionLine,
    rebuttal,
    outcome,
    transcriptSnippet,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  try {
    await cognee.remember({
      text,
      dataset: "multiply",
      metadata: {
        node_type: "call_outcome",
        call_id: body.call_id,
        company: body.company,
        persona_name: persona.name,
        persona_role: persona.role,
        objection_type: objections[0],
        rebuttal_pattern: body.rebuttal_pattern,
        outcome: body.outcome,
        channel: body.channel,
        timestamp: new Date().toISOString(),
        ...(body.metadata ?? {}),
      },
    });

    slackNotify({
      text: `Call logged · ${body.company ?? "unknown"} · outcome ${body.outcome ?? "re-engaged"}`,
      blocks: learningBlocks({
        company: body.company ?? "unknown",
        personaName: persona.name ?? "unknown",
        personaRole: persona.role ?? "unknown",
        outcome: body.outcome ?? "re-engaged",
        rebuttalPattern: body.rebuttal_pattern,
        objectionCount: objections.length,
      }),
    }).catch(() => null);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 502 },
    );
  }
}
