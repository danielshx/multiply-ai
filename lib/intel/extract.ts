/**
 * Transcript intelligence — rule-based extractors for BANT, sentiment,
 * objections, rebuttals. Runs fast (single-pass regex/keyword over transcript)
 * so it can execute in HR webhook timeout budget.
 *
 * This is deliberately NOT LLM-based. Keeps latency <50ms, deterministic,
 * testable. LLM refinement happens downstream via cognee when we log the
 * learning.
 */

export type BANT = {
  budget?: string;
  authority?: string;
  need?: string;
  timeline?: string;
  confidence: { budget: number; authority: number; need: number; timeline: number };
};

export type TurnSentiment = { speaker: "agent" | "lead"; ts: string; score: number; text: string };

export type ObjectionHit = { type: string; ts: string; quote: string; confidence: number };

export type RebuttalHit = { pattern: string; ts: string; quote: string };

const OBJECTION_PATTERNS: Array<{ type: string; keywords: RegExp[] }> = [
  { type: "contract-lock-in", keywords: [/annual\b[^.!?]{0,40}\b(contract|vendor|commit|lock|deal)/i, /lock.?in/i, /long.?term (contract|deal|commit)/i, /multi.?year/i, /commit to.*(another|a)\s*(annual|long)/i] },
  { type: "pricing", keywords: [/too expensive/i, /too pricey/i, /high (price|cost)/i, /budget.?wise/i, /can.?t afford/i] },
  { type: "timing", keywords: [/bad time(ing)?/i, /not (right|the) (time|moment)/i, /later this (year|quarter)/i, /maybe next/i, /revisit/i] },
  { type: "frozen-budget", keywords: [/budget.*(froz|lock|cut|tight)/i, /no budget/i, /(q[1-4]|quarter).*froz/i, /fiscal.*clos/i] },
  { type: "incumbent-renewal", keywords: [/already (renewed|signed|have)/i, /we (use|have) (datadog|slack|hubspot|salesforce|splunk)/i, /just renewed/i] },
  { type: "built-in-house", keywords: [/built (it |this )?in.?house/i, /home.?grown/i, /our own (system|tool)/i, /internal (team|platform)/i] },
  { type: "security-review", keywords: [/security review/i, /info.?sec/i, /(soc2|iso|gdpr|dora|compliance)/i, /legal (team|review)/i] },
  { type: "data-residency", keywords: [/data residency/i, /on.?prem/i, /eu.?based/i, /gdpr/i, /cross.?border/i] },
  { type: "procurement-cycle", keywords: [/procurement/i, /vendor review/i, /90 days/i, /approved vendor/i, /po process/i] },
  { type: "vendor-fatigue", keywords: [/all the same/i, /tested (many|several|3|4|5)/i, /another tool/i, /tool sprawl/i, /pitch.?fatigue/i] },
  { type: "rep-adoption", keywords: [/reps (hate|won.?t)/i, /adoption/i, /another thing to learn/i, /change management/i] },
  { type: "ai-trust", keywords: [/hallucina/i, /trust.*ai/i, /ai (can|will|might)/i, /scary|risky (ai|model)/i] },
];

const REBUTTAL_PATTERNS: Array<{ pattern: string; keywords: RegExp[] }> = [
  { pattern: "no-lock-pilot", keywords: [/no.?lock pilot/i, /(2|two).?week (pilot|trial)/i, /month.?to.?month/i, /cancel any.?time/i, /monthly,? cancel/i, /don.?t do annual lock/i, /(no|without) annual.?lock/i, /pilot on one cluster/i] },
  { pattern: "complementary-not-replacement", keywords: [/complement/i, /alongside/i, /not (replacing|a rip.?and.?replace)/i, /layer (on top of|beneath)/i] },
  { pattern: "eu-region-byok", keywords: [/frankfurt/i, /eu.?region/i, /byok/i, /your (own )?keys/i, /customer.?held/i] },
  { pattern: "monthly-startable", keywords: [/monthly billing/i, /credit card/i, /under.*threshold/i, /no procurement/i] },
  { pattern: "live-demo-not-deck", keywords: [/no slides/i, /screen.?share/i, /put your (stack|system) in front/i, /live demo/i] },
  { pattern: "build-vs-maintain-tco", keywords: [/year.?2 maintenance/i, /maintenance (load|cost)/i, /fte.?s saved/i, /tco/i] },
  { pattern: "budget-flex-pilot", keywords: [/billing starts/i, /fiscal period/i, /free.*pilot/i, /30.?day (free|pilot)/i] },
  { pattern: "roi-anchor", keywords: [/saved.*€?\$?[0-9]/i, /payback/i, /roi/i, /peer.?company (saved|achieved)/i] },
  { pattern: "stack-additive", keywords: [/integrates with/i, /augment/i, /additive/i, /works alongside/i] },
  { pattern: "silent-co-pilot", keywords: [/background/i, /opt.?in/i, /drafts/i, /co.?pilot/i] },
  { pattern: "zero-code-integration", keywords: [/zero.?code/i, /webhook/i, /api/i, /two hour setup/i, /no engineering/i] },
  { pattern: "deterministic-outputs", keywords: [/audit log/i, /human.?reviewable/i, /provenance/i, /traceable/i, /deterministic/i] },
  { pattern: "pre-cleared-vendors", keywords: [/pre.?filled/i, /soc2 type ii/i, /iso.?27001/i, /questionnaire/i, /fast.?track/i] },
];

/** Strips the [HH:MM] timestamp prefix and returns the speaker + body. */
function parseLine(line: string): { ts: string; isAgent: boolean; body: string } {
  const ts = line.match(/\[([\d:]+)\]/)?.[1] ?? "";
  const cleaned = line.replace(/^\s*\[[\d:]+\]\s*/, "");
  const m = cleaned.match(/^(agent|you|operator|bot|lead|\w+)\s*:\s*(.*)$/is);
  if (!m) return { ts, isAgent: false, body: cleaned };
  const speaker = m[1].toLowerCase();
  const isAgent = speaker === "agent" || speaker === "you" || speaker === "operator" || speaker === "bot";
  return { ts, isAgent, body: m[2] };
}

export function extractObjections(transcript: string): ObjectionHit[] {
  const hits: ObjectionHit[] = [];
  for (const rawLine of transcript.split(/\n+/)) {
    const { ts, isAgent, body } = parseLine(rawLine);
    if (isAgent || !body) continue; // only analyze lead turns
    for (const obj of OBJECTION_PATTERNS) {
      if (obj.keywords.some((re) => re.test(body))) {
        hits.push({ type: obj.type, ts, quote: body.slice(0, 160), confidence: 0.8 });
      }
    }
  }
  return dedupeByType(hits);
}

export function extractRebuttals(transcript: string): RebuttalHit[] {
  const hits: RebuttalHit[] = [];
  for (const rawLine of transcript.split(/\n+/)) {
    const { ts, isAgent, body } = parseLine(rawLine);
    if (!isAgent || !body) continue;
    for (const reb of REBUTTAL_PATTERNS) {
      if (reb.keywords.some((re) => re.test(body))) {
        hits.push({ pattern: reb.pattern, ts, quote: body.slice(0, 160) });
      }
    }
  }
  return dedupeByPattern(hits);
}

export function extractBANT(transcript: string): BANT {
  const text = transcript.toLowerCase();
  const bant: BANT = {
    confidence: { budget: 0, authority: 0, need: 0, timeline: 0 },
  };

  // Budget
  const budgetMatch = transcript.match(/([€$£]\s*[\d,\.]+\s*(k|m|mm|thousand|million)?)/i) ??
    transcript.match(/\b(\d+)\s*k\b/i);
  if (budgetMatch) {
    bant.budget = budgetMatch[0];
    bant.confidence.budget = 0.8;
  } else if (/budget.*confirmed|approved for/i.test(text)) {
    bant.budget = "confirmed (amount not stated)";
    bant.confidence.budget = 0.6;
  }

  // Authority
  if (/\b(i|me)\b.*(decide|decision|own|sign off)/i.test(text)) {
    bant.authority = "self";
    bant.confidence.authority = 0.75;
  } else if (/ceo|cto|vp|head of|chief/i.test(text) && /loop in|bring in|talk to/i.test(text)) {
    bant.authority = "shared with executive";
    bant.confidence.authority = 0.65;
  } else if (/board|committee|procurement/i.test(text)) {
    bant.authority = "committee-driven";
    bant.confidence.authority = 0.55;
  }

  // Need
  const needSignals = [
    /(pain|problem|struggle|issue) (is|with|around)/i,
    /(looking for|evaluating|considering)/i,
    /(want|need|require)/i,
  ];
  if (needSignals.some((re) => re.test(text))) {
    const m = transcript.match(/(pain|problem|issue|looking for|evaluating)[^.]{5,120}/i);
    if (m) {
      bant.need = m[0].slice(0, 120);
      bant.confidence.need = 0.7;
    }
  }

  // Timeline — match number words + specific days + ranges
  const WORD_NUMBERS: Record<string, number> = {
    zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,
    eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,twenty:20,thirty:30,
  };
  const timelineMatch =
    transcript.match(/\b(\d+)[-–to\s]+(\d+)\s*(weeks?|months?|days?)\b/i) ??
    transcript.match(/\b([a-z]+)[-–to\s]+([a-z]+)\s*(weeks?|months?|days?)\b/i) ??
    transcript.match(/\b(next|within)\s+(week|month|quarter|[\d]+\s*(days?|weeks?|months?))\b/i) ??
    transcript.match(/\b(thursday|friday|monday|tuesday|wednesday|saturday|sunday)\b/i) ??
    transcript.match(/\bq[1-4]\b/i) ??
    transcript.match(/\b\d+\s*(weeks?|months?|days?)\b/i);
  if (timelineMatch) {
    bant.timeline = timelineMatch[0];
    bant.confidence.timeline = 0.8;
  }

  // Also detect meeting durations like "thirty minutes on thursday"
  const meetingMatch = transcript.match(/\b(\d+|thirty|sixty|ninety|fifteen|forty.?five)\s*(min(utes?)?|hours?)/i);
  if (meetingMatch && !bant.timeline) {
    bant.timeline = meetingMatch[0];
    bant.confidence.timeline = 0.55;
  }

  return bant;
}

export function sentimentArc(transcript: string): TurnSentiment[] {
  const POSITIVE = /\b(yes|great|interested|love|perfect|exactly|makes sense|definitely|absolutely)\b/i;
  const NEGATIVE = /\b(no|not interested|can.?t|won.?t|never|stop|cancel|bad|hate|waste|no way)\b/i;
  const HESITANT = /\b(maybe|unsure|hmm|not sure|possibly|might)\b/i;

  const turns: TurnSentiment[] = [];
  for (const rawLine of transcript.split(/\n+/).filter((l) => l.trim())) {
    const { ts, isAgent, body } = parseLine(rawLine);
    let score = 0;
    if (POSITIVE.test(body)) score += 0.4;
    if (NEGATIVE.test(body)) score -= 0.5;
    if (HESITANT.test(body)) score -= 0.2;
    turns.push({
      speaker: isAgent ? "agent" : "lead",
      ts,
      score: Math.max(-1, Math.min(1, score)),
      text: body.slice(0, 120),
    });
  }
  return turns;
}

export function outcomeClassifier(transcript: string): "booked" | "pilot-started" | "re-engaged" | "lost" {
  const text = transcript.toLowerCase();
  if (/pilot (starts|started|running)/i.test(text)) return "pilot-started";
  if (/(calendar|book|schedule|invite).*(thursday|friday|monday|tuesday|wednesday|\d+[:/]\d+)/i.test(text)) return "booked";
  if (/stop calling|remove me|not interested at all|please don.?t/i.test(text)) return "lost";
  if (/follow up|circle back|touch base|reach out again|let.?s talk (next|later)/i.test(text)) return "re-engaged";
  return "re-engaged";
}

// ─── helpers ────────────────────────────────────────────────────────────────
function dedupeByType<T extends { type: string; confidence: number }>(arr: T[]): T[] {
  const map = new Map<string, T>();
  for (const hit of arr) {
    const existing = map.get(hit.type);
    if (!existing || existing.confidence < hit.confidence) map.set(hit.type, hit);
  }
  return Array.from(map.values());
}

function dedupeByPattern<T extends { pattern: string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  return arr.filter((h) => (seen.has(h.pattern) ? false : (seen.add(h.pattern), true)));
}
