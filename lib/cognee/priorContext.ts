import { cognee } from "./client";

/**
 * Server-only helper used by the watcher's trigger-* routes to look up
 * what we already know about a lead BEFORE handing them off to the agent.
 *
 * Returns a short, agent-ready brief like:
 *   "Prior calls: 2 (last 2026-04-18, outcome=missed). Past objection: too busy.
 *    Recommended approach: morning callback, mention HappyRobot Makathon."
 *
 * Uses GRAPH_COMPLETION so cognee returns ONE synthesized sentence rather than
 * raw chunks — fits straight into the voice-agent's customer_goal field.
 *
 * Hard 4s timeout. Empty string on miss/error so the trigger-* routes never
 * stall the watcher pipeline.
 */
const TIMEOUT_MS = 4000;

export type PriorContextInput = {
  name?: string | null;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  channel?: "voice" | "sms" | "email"; // bias the recall toward the right channel history
};

export async function getPriorContext(input: PriorContextInput): Promise<string> {
  const name = (input.name ?? "").trim();
  const company = (input.company ?? "").trim();
  const phone = (input.phone ?? "").trim();
  const email = (input.email ?? "").trim();
  if (!name && !company && !phone && !email) return "";

  const channelHint =
    input.channel === "sms"
      ? "Focus on prior SMS exchanges and replies."
      : input.channel === "email"
        ? "Focus on prior email threads and bounce/reply behavior."
        : "Focus on prior voice calls: count, outcomes, objections, last disposition.";

  const query = [
    name && `Lead: ${name}.`,
    company && `Company: ${company}.`,
    phone && `Phone: ${phone}.`,
    email && `Email: ${email}.`,
    channelHint,
    "Summarize what we already know in <=3 short sentences:",
    "(1) how often we've reached out + last outcome,",
    "(2) the last meaningful objection or signal,",
    "(3) one-line recommendation for THIS attempt.",
    "If you have no prior interaction with this lead, say exactly: NO_PRIOR.",
  ]
    .filter(Boolean)
    .join(" ");

  try {
    const r = await Promise.race([
      cognee.recall(query, {
        dataset: "multiply",
        topK: 5,
        searchType: "GRAPH_COMPLETION",
      }),
      new Promise<{ results: [] }>((resolve) =>
        setTimeout(() => resolve({ results: [] }), TIMEOUT_MS),
      ),
    ]);

    const text = (r.results?.[0]?.text ?? "").trim();
    if (!text) return "";

    // Cognee was instructed to return NO_PRIOR when there's nothing useful.
    // Strip it (along with surrounding whitespace) so we don't pack a useless
    // line into the agent's prompt.
    const cleaned = text
      .replace(/(^|[\.\s])NO_PRIOR(\.|$)/i, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!cleaned || cleaned.toUpperCase() === "NO_PRIOR") return "";
    return cleaned.slice(0, 600);
  } catch {
    return "";
  }
}
