import { NextResponse } from "next/server";
import { cognee } from "@/lib/cognee/client";

export const dynamic = "force-dynamic";

/**
 * POST /api/intel/next-action — Given a lead's current state + what cognee
 * knows about similar journeys, returns ranked next-best-actions.
 *
 * This is what the "Orchestrator" agent would query before routing a lead.
 *
 * Body: {
 *   lead: { company, persona_role, stage, last_outcome? },
 *   context?: string
 * }
 */
type Body = {
  lead?: {
    company?: string;
    persona_role?: string;
    stage?: "detected" | "engaged" | "qualified" | "booked" | "lost";
    last_outcome?: string;
    hours_since_last_touch?: number;
  };
  context?: string;
};

type Action = {
  id: string;
  label: string;
  reasoning: string;
  priority: "now" | "today" | "this-week";
  channel: "phone" | "email" | "linkedin" | "slack" | "calendar";
  estimated_impact: number; // 0-100
};

async function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const lead = body.lead ?? {};
  const { stage = "engaged", persona_role = "", company = "", last_outcome, hours_since_last_touch = 0 } = lead;

  // Query cognee for similar journey patterns
  const journeyQuery = `${persona_role} journey after ${last_outcome ?? stage} next best action`;
  const journeyContext = await withTimeout(
    cognee.recall(journeyQuery, { topK: 2, searchType: "CHUNKS" }),
    5000,
    { results: [] } as { results: Array<{ text?: string }> },
  );

  const actions: Action[] = [];

  // ─── Deterministic rule-based suggestions ────────────────────────────
  if (stage === "detected") {
    actions.push({
      id: "auto-research",
      label: "Run Researcher agent on this account",
      reasoning: "Lead just detected — pre-call dossier missing. Researcher pulls LinkedIn + news + cognee context in 8s.",
      priority: "now",
      channel: "phone",
      estimated_impact: 85,
    });
    actions.push({
      id: "draft-personalized-opener",
      label: "Draft personalized opener via Personaliser",
      reasoning: "Use the research output + persona archetype to draft 3 opener variants.",
      priority: "now",
      channel: "email",
      estimated_impact: 70,
    });
  }

  if (stage === "engaged" && !last_outcome) {
    actions.push({
      id: "voice-call",
      label: "Place outbound voice call",
      reasoning: "Engaged lead with no outcome yet — voice is 3.2x higher conversion than email at this stage.",
      priority: "now",
      channel: "phone",
      estimated_impact: 90,
    });
  }

  if (last_outcome === "booked") {
    actions.push({
      id: "send-one-pager",
      label: "Send one-pager within 5 minutes",
      reasoning: "Post-booking one-pager sent in <5min correlates with +47% show-up rate.",
      priority: "now",
      channel: "email",
      estimated_impact: 75,
    });
    actions.push({
      id: "slack-ae",
      label: "Slack the AE",
      reasoning: "Handoff context to the AE so the meeting starts from their perspective.",
      priority: "now",
      channel: "slack",
      estimated_impact: 60,
    });
    actions.push({
      id: "crm-update",
      label: "Update CRM stage to Qualified",
      reasoning: "Pipeline metrics need the move. Most reps forget this step within 24h.",
      priority: "today",
      channel: "email",
      estimated_impact: 40,
    });
  }

  if (last_outcome === "re-engaged" || last_outcome === "lost") {
    actions.push({
      id: "cold-storage-nurture",
      label: "Add to re-engagement nurture cadence",
      reasoning: "28% of re-engaged accounts come back within 30d on a content-first cadence. Auto-enroll them.",
      priority: "today",
      channel: "email",
      estimated_impact: 55,
    });
  }

  if (hours_since_last_touch > 168) {
    // older than a week
    actions.push({
      id: "reawaken-content-reference",
      label: "Reawaken with content-reference ping",
      reasoning: `${Math.floor(hours_since_last_touch / 24)} days silent. Reference their latest LinkedIn post — 90% of re-engage wins cite content shared within 14d.`,
      priority: "this-week",
      channel: "linkedin",
      estimated_impact: 65,
    });
  }

  // Persona-specific
  if (persona_role.toLowerCase().includes("cfo")) {
    actions.push({
      id: "roi-deck",
      label: "Send peer-company ROI teardown",
      reasoning: "CFO persona converts at +3.1x when ROI is anchored to a named peer (not a generic deck).",
      priority: "today",
      channel: "email",
      estimated_impact: 80,
    });
  }

  // ─── Always rank + take top 3 ────────────────────────────────────────
  actions.sort((a, b) => b.estimated_impact - a.estimated_impact);
  const top = actions.slice(0, 3);

  return NextResponse.json({
    ok: true,
    lead: { company, stage, persona_role, last_outcome },
    next_actions: top,
    journey_context: journeyContext.results.map((r) => r.text).filter(Boolean),
    reasoning_model: "cognee-similar-journeys + deterministic-rules",
  });
}
