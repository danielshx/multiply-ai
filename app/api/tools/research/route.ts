import { NextResponse } from "next/server";
import { cognee } from "@/lib/cognee/client";

/**
 * POST /api/tools/research — HR custom tool. Called before/during a call to
 * pull a dossier on the lead. Cognee is queried first (semantic + graph
 * recall over all prior calls + persona dossiers + rebuttal patterns); if
 * empty, falls back to a stub so the demo always returns something.
 *
 * Body:
 * {
 *   company: string,
 *   person?: { name?: string, role?: string },
 *   focus?: string                           // e.g. "objection patterns", "ICP fit"
 * }
 */
type Body = {
  company?: string;
  person?: { name?: string; role?: string };
  focus?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const company = body.company ?? "";
  const person = body.person ?? {};
  const focus = body.focus ?? "dossier and prior interactions";

  const query = [
    company && `company: ${company}`,
    person.name && `person: ${person.name}`,
    person.role && `role: ${person.role}`,
    `focus: ${focus}`,
  ]
    .filter(Boolean)
    .join(" · ");

  try {
    const recall = await cognee.recall(query, { topK: 6 });
    const hits = recall?.results ?? [];

    if (hits.length === 0) {
      return NextResponse.json({
        ok: true,
        source: "fallback",
        company,
        person,
        dossier: stubDossier(company, person.role),
        prior_calls: [],
        suggested_patterns: [],
      });
    }

    const dossierItems = hits.filter((h) => h.metadata?.node_type === "persona");
    const priorCalls = hits.filter((h) => h.metadata?.node_type === "call_outcome");
    const patterns = hits.filter((h) => h.metadata?.node_type === "rebuttal_pattern");

    return NextResponse.json({
      ok: true,
      source: "cognee",
      company,
      person,
      dossier: dossierItems.map((h) => h.text),
      prior_calls: priorCalls.map((h) => ({
        text: h.text,
        outcome: h.metadata?.outcome,
        objection: h.metadata?.objection_type,
        pattern: h.metadata?.rebuttal_pattern,
      })),
      suggested_patterns: patterns.map((h) => ({
        pattern: h.metadata?.rebuttal_pattern,
        text: h.text,
      })),
      raw_hits: hits.length,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: true,
        source: "error-fallback",
        company,
        person,
        dossier: stubDossier(company, person.role),
        error: (err as Error).message,
      },
      { status: 200 },
    );
  }
}

function stubDossier(company: string, role?: string): string[] {
  return [
    `${company || "Target"} — public dossier not yet ingested into cognee.`,
    role
      ? `Best opener for ${role}: technical specificity + reference to recent company moves.`
      : "Best opener: technical specificity + reference to recent company moves.",
    "Avoid: ROI-first pitch, long procurement framing.",
  ];
}
