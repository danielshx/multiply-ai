import { DEMO_LEARNINGS, type Learning } from "./seed-data";

export type GraphNode = {
  id: string;
  label: string;
  type:
    | "persona"
    | "rebuttal_pattern"
    | "outcome"
    | "objection"
    | "industry"
    | "company_stage"
    | "region"
    | "journey"
    | "temporal_pattern"
    | "call_outcome";
  weight: number;
  meta?: Record<string, unknown>;
};

export type GraphEdge = {
  source: string;
  target: string;
  relation: string;
  weight: number;
};

export type DerivedGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  source: "cognee" | "derived" | "fallback";
  generatedAt: string;
  stats: {
    totalNodes: number;
    totalEdges: number;
    learnings: number;
  };
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function ensureNode(map: Map<string, GraphNode>, id: string, label: string, type: GraphNode["type"], meta?: Record<string, unknown>) {
  const existing = map.get(id);
  if (existing) {
    existing.weight += 1;
    if (meta) existing.meta = { ...(existing.meta ?? {}), ...meta };
    return existing;
  }
  const node: GraphNode = { id, label, type, weight: 1, meta };
  map.set(id, node);
  return node;
}

function addEdge(edges: Map<string, GraphEdge>, source: string, target: string, relation: string) {
  if (!source || !target || source === target) return;
  const key = `${source}::${target}::${relation}`;
  const existing = edges.get(key);
  if (existing) {
    existing.weight += 1;
    return;
  }
  edges.set(key, { source, target, relation, weight: 1 });
}

/**
 * Project the seed-learnings into a graph. Each learning contributes nodes
 * for its entities (persona, rebuttal, outcome, industry, journey, etc.)
 * and edges for the relations encoded in its metadata.
 */
export function deriveGraph(learnings: Learning[] = DEMO_LEARNINGS): DerivedGraph {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();

  for (const l of learnings) {
    const m = l.metadata;

    const personaId = m.persona_role ? `persona:${slug(m.persona_role)}` : null;
    const rebuttalId = m.rebuttal_pattern ? `rebuttal:${slug(m.rebuttal_pattern)}` : null;
    const outcomeId = m.outcome ? `outcome:${slug(m.outcome)}` : null;
    const objectionId = m.objection_type ? `objection:${slug(m.objection_type)}` : null;
    const industryId = m.industry ? `industry:${slug(m.industry)}` : null;
    const stageId = m.company_stage ? `stage:${slug(m.company_stage)}` : null;
    const regionId = m.region ? `region:${slug(m.region)}` : null;
    const journeyId = m.account ? `journey:${slug(m.account)}` : null;
    const temporalId = m.quarter
      ? `temporal:${slug(m.quarter)}`
      : m.weekday
      ? `temporal:${slug(m.weekday)}`
      : m.season
      ? `temporal:${slug(m.season)}`
      : m.trigger
      ? `temporal:${slug(m.trigger)}`
      : null;

    if (personaId) ensureNode(nodes, personaId, m.persona_role!, "persona", { stage: m.company_stage });
    if (rebuttalId) ensureNode(nodes, rebuttalId, m.rebuttal_pattern!, "rebuttal_pattern");
    if (outcomeId) ensureNode(nodes, outcomeId, m.outcome!, "outcome");
    if (objectionId) ensureNode(nodes, objectionId, m.objection_type!, "objection");
    if (industryId) ensureNode(nodes, industryId, m.industry!, "industry");
    if (stageId) ensureNode(nodes, stageId, m.company_stage!, "company_stage");
    if (regionId) ensureNode(nodes, regionId, m.region!, "region");
    if (journeyId) ensureNode(nodes, journeyId, m.account!, "journey", { totalCalls: m.total_calls, finalOutcome: m.final_outcome });
    if (temporalId) ensureNode(nodes, temporalId, m.quarter ?? m.weekday ?? m.season ?? m.trigger!, "temporal_pattern");

    // call_outcome rows fan out into a rich set of relations.
    if (m.node_type === "call_outcome") {
      if (personaId && objectionId) addEdge(edges, personaId, objectionId, "raises");
      if (objectionId && rebuttalId) addEdge(edges, objectionId, rebuttalId, "answered_by");
      if (rebuttalId && outcomeId) addEdge(edges, rebuttalId, outcomeId, "leads_to");
      if (personaId && rebuttalId) addEdge(edges, personaId, rebuttalId, "won_by");
      if (industryId && objectionId) addEdge(edges, industryId, objectionId, "common_in");
      if (industryId && personaId) addEdge(edges, industryId, personaId, "buys_through");
      if (stageId && personaId) addEdge(edges, stageId, personaId, "common_at");
      if (regionId && industryId) addEdge(edges, regionId, industryId, "active_in");
    }

    if (m.node_type === "industry_playbook" && industryId) {
      // industry → likely rebuttals (if mentioned in text); minimal heuristic
      const text = l.text.toLowerCase();
      for (const candidate of [
        "eu-region-byok",
        "deterministic-outputs",
        "zero-code-integration",
        "stack-additive",
        "clean-attribution",
        "pre-cleared-vendors",
      ]) {
        if (text.includes(candidate)) {
          const rid = `rebuttal:${candidate}`;
          ensureNode(nodes, rid, candidate, "rebuttal_pattern");
          addEdge(edges, industryId, rid, "playbook_uses");
        }
      }
    }
  }

  return {
    nodes: Array.from(nodes.values()),
    edges: Array.from(edges.values()),
    source: "derived",
    generatedAt: new Date().toISOString(),
    stats: {
      totalNodes: nodes.size,
      totalEdges: edges.size,
      learnings: learnings.length,
    },
  };
}
