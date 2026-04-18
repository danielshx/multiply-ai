import { NextResponse } from "next/server";
import { cognee } from "@/lib/cognee/client";

/**
 * POST /api/tools/research — HR custom tool. Pulls a synthesized dossier on
 * the lead by querying cognee's GRAPH_COMPLETION over all prior calls,
 * persona dossiers, and rebuttal patterns. Cognee returns a single
 * graph-grounded answer rather than raw chunks — perfect to feed straight
 * into the next agent turn as context.
 *
 * Body:
 *   { company: string, person?: { name?, role? }, focus?: string }
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
  const focus = body.focus ?? "what should we know before the call";

  const query = [
    company && `Company: ${company}.`,
    person.role && `Persona role: ${person.role}.`,
    person.name && `Person: ${person.name}.`,
    `Surface: ${focus}. Include any prior calls, persona traits, and rebuttal patterns that map to this profile.`,
  ]
    .filter(Boolean)
    .join(" ");

  try {
    const recall = await cognee.recall(query, { topK: 5, searchType: "GRAPH_COMPLETION" });
    const hits = recall?.results ?? [];

    if (hits.length === 0 || !hits[0].text) {
      return NextResponse.json({
        ok: true,
        source: "fallback",
        company,
        person,
        dossier: stubDossier(company, person.role),
        synthesized: null,
      });
    }

    return NextResponse.json({
      ok: true,
      source: "cognee",
      company,
      person,
      synthesized: hits[0].text,
      additional: hits.slice(1).map((h) => h.text),
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
