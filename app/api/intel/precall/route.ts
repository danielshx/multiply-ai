import { NextResponse } from "next/server";
import { cognee } from "@/lib/cognee/client";

export const dynamic = "force-dynamic";

/**
 * POST /api/intel/precall — The "smart brain" for the agent before a call.
 *
 * Orchestrates in parallel:
 *   1. Cognee recall: persona dossier + prior calls + similar objection patterns
 *   2. Recent news about the company (Google News RSS)
 *   3. Industry playbook lookup
 *   4. Temporal signal (Series-B within 14d? Q1 freeze? etc.)
 *
 * Returns a single structured "brief" the voice agent can use as its
 * ground-truth context. Hard 6s budget — if cognee is slow, we still return
 * news + inferred context so the agent never waits.
 *
 * Body: { company, person: { name, role }, focus? }
 */
type Body = {
  company?: string;
  person?: { name?: string; role?: string };
  focus?: string;
};

async function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

async function fetchCompanyNews(company: string, appUrl: string): Promise<Array<{ headline: string; source: string; daysAgo: number; url?: string }>> {
  try {
    const u = new URL("/api/news", appUrl);
    u.searchParams.set("q", "funding");
    const res = await fetch(u.toString(), { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as { signals?: Array<{ company: string; desc: string; source: string; time: number; url?: string }> };
    const lcCompany = company.toLowerCase();
    return (data.signals ?? [])
      .filter((s) => s.company?.toLowerCase().includes(lcCompany.slice(0, 8)) || s.desc?.toLowerCase().includes(lcCompany))
      .slice(0, 3)
      .map((s) => ({
        headline: s.desc ?? "",
        source: s.source ?? "Google News",
        daysAgo: Math.floor((s.time ?? 0) / 60 / 24),
        url: s.url,
      }));
  } catch {
    return [];
  }
}

function personaColor(role: string): string {
  const r = role.toLowerCase();
  if (r.includes("cto") || r.includes("vp eng")) return "technical";
  if (r.includes("cfo") || r.includes("finance")) return "financial";
  if (r.includes("cro") || r.includes("sales")) return "revenue";
  if (r.includes("cmo") || r.includes("marketing")) return "brand";
  if (r.includes("coo") || r.includes("operations")) return "operational";
  if (r.includes("founder") || r.includes("ceo")) return "visionary";
  if (r.includes("head of data") || r.includes("cdo")) return "data";
  return "generic";
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const company = body.company ?? "";
  const person = body.person ?? {};
  const role = person.role ?? "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;

  const archetype = personaColor(role);

  // Run cognee recalls + news fetch in parallel with aggressive timeout
  const [personaRecall, priorCallsRecall, companyNews, industryRecall] = await Promise.all([
    withTimeout(
      cognee.recall(`${role} persona dossier traits values`, { topK: 1, searchType: "CHUNKS" }),
      4000,
      { results: [] } as { results: Array<{ text?: string }> },
    ),
    withTimeout(
      cognee.recall(`prior call ${company} ${role}`, { topK: 2, searchType: "CHUNKS" }),
      4000,
      { results: [] } as { results: Array<{ text?: string }> },
    ),
    withTimeout(fetchCompanyNews(company, appUrl), 3500, []),
    withTimeout(
      cognee.recall(`industry playbook best rebuttal`, { topK: 1, searchType: "CHUNKS" }),
      4000,
      { results: [] } as { results: Array<{ text?: string }> },
    ),
  ]);

  // Temporal signal detection
  const now = new Date();
  const month = now.getMonth() + 1;
  const temporal = {
    quarter: `Q${Math.ceil(month / 3)}` as "Q1" | "Q2" | "Q3" | "Q4",
    freezeRisk: month === 1 || month === 2 || month === 11 || month === 12,
    weekday: now.toLocaleDateString("en-US", { weekday: "long" }),
  };

  const brief = {
    ok: true,
    generated_at: now.toISOString(),
    lead: { company, ...person, archetype },
    temporal,

    // The agent should open with this hook
    opener_hint: companyNews[0]
      ? `Reference "${companyNews[0].headline.slice(0, 80)}" (${companyNews[0].source}, ${companyNews[0].daysAgo}d ago)`
      : `Generic ${archetype} opener — no fresh news signal`,

    // Cognee persona intel
    persona_dossier: personaRecall.results?.[0]?.text ?? null,

    // Prior call history with this account
    prior_calls: priorCallsRecall.results?.map((r) => r.text).filter(Boolean) ?? [],

    // Fresh news
    recent_news: companyNews,

    // Industry context
    industry_playbook: industryRecall.results?.[0]?.text ?? null,

    // Confidence score (0-100) — do we have enough context for a personalized call?
    confidence_score: Math.min(
      100,
      (personaRecall.results?.length ? 30 : 0) +
      (priorCallsRecall.results?.length ? 25 : 0) +
      (companyNews.length ? 25 : 0) +
      (industryRecall.results?.length ? 20 : 0),
    ),

    // Pre-picked rebuttals to have ready
    ready_rebuttals: suggestRebuttals(archetype, temporal),
  };

  return NextResponse.json(brief);
}

function suggestRebuttals(archetype: string, temporal: { freezeRisk: boolean }): Array<{ pattern: string; trigger: string }> {
  const base: Array<{ pattern: string; trigger: string }> = [];

  if (archetype === "technical") {
    base.push({ pattern: "no-lock-pilot", trigger: "any lock-in or commitment pushback" });
    base.push({ pattern: "deterministic-outputs", trigger: "ai-trust or hallucination concern" });
    base.push({ pattern: "zero-code-integration", trigger: "integration timeline fear" });
  } else if (archetype === "financial") {
    base.push({ pattern: "roi-anchor", trigger: "price or ROI pushback" });
    base.push({ pattern: "build-vs-maintain-tco", trigger: 'we could build this' });
  } else if (archetype === "data") {
    base.push({ pattern: "eu-region-byok", trigger: "GDPR / data residency / compliance" });
    base.push({ pattern: "pre-cleared-vendors", trigger: "security review timeline fear" });
  } else if (archetype === "revenue") {
    base.push({ pattern: "silent-co-pilot", trigger: "rep adoption concern" });
    base.push({ pattern: "stack-additive", trigger: "already-using-X pushback" });
  } else if (archetype === "brand") {
    base.push({ pattern: "clean-attribution", trigger: "tool sprawl or attribution concern" });
  }

  if (temporal.freezeRisk) {
    base.push({ pattern: "budget-flex-pilot", trigger: "Q1/Q4 frozen budget" });
  }

  // Always keep an "oh shit" universal fallback
  base.push({ pattern: "live-demo-not-deck", trigger: "any vendor-fatigue signal" });

  return base;
}
