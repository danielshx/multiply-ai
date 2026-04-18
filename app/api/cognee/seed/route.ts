import { NextResponse } from "next/server";
import { cognee } from "@/lib/cognee/client";

export const dynamic = "force-dynamic";

/**
 * POST /api/cognee/seed — seeds the demo dataset with prior calls + learnings
 * so the Knowledge Graph tab is non-empty before the first live demo call,
 * and the Negotiator's recall() returns real patterns from turn 1.
 *
 * Body (optional): { reset?: boolean }
 */
const DEMO_LEARNINGS = [
  {
    text: 'Call with Lena Mahler (Head of Platform) at Vossloh. Objection: "we just renewed Datadog last quarter." Rebuttal pattern: "complementary-not-replacement" (positioned as logs layer beneath APM). Outcome: booked 30min follow-up. Win-rate update: 64%.',
    metadata: { persona_role: "Head of Platform", company_stage: "Series-C", objection_type: "incumbent-renewal", rebuttal_pattern: "complementary-not-replacement", outcome: "booked", channel: "phone", region: "DACH" },
  },
  {
    text: 'Call with Marco Steinhoff (CTO) at Otto Group spinout. Objection: "annual contract lock-in scares us, last vendor took 6mo to unwind." Rebuttal: "no-lock-pilot" (2-week trial, monthly billing). Outcome: booked. Win-rate: 73%.',
    metadata: { persona_role: "CTO", company_stage: "Spinout", objection_type: "contract-lock-in", rebuttal_pattern: "no-lock-pilot", outcome: "booked", channel: "phone", region: "DACH" },
  },
  {
    text: 'Call with Sarah Chen (CTO) at Northwind Robotics. Series B closed 2 days ago. Objection: contract lock-in. Rebuttal: no-lock-pilot. Pre-queued one-pager + dual-calendar slots. Outcome: booked Thursday.',
    metadata: { persona_role: "CTO", company_stage: "Series-B", objection_type: "contract-lock-in", rebuttal_pattern: "no-lock-pilot", outcome: "booked", channel: "phone", region: "DACH" },
  },
  {
    text: 'Call with Helene Voigt (VP Eng) at Celonis-spinout. Objection: "procurement takes 90 days." Rebuttal: "monthly-startable" (no procurement under €15k MRR). Outcome: pilot started same week. Win-rate: 81%.',
    metadata: { persona_role: "VP Engineering", company_stage: "Spinout", objection_type: "procurement-cycle", rebuttal_pattern: "monthly-startable", outcome: "pilot-started", channel: "email", region: "DACH" },
  },
  {
    text: 'Call with Daniel Becker (Head of Data) at Trade Republic. Objection: "we need on-prem, GDPR." Rebuttal: "EU-region + BYOK encryption" (Frankfurt deployment, customer holds keys). Outcome: legal review scheduled. Win-rate for FinTech persona: 58%.',
    metadata: { persona_role: "Head of Data", company_stage: "Late-stage", objection_type: "data-residency", rebuttal_pattern: "eu-region-byok", outcome: "legal-review", channel: "phone", region: "DACH", industry: "FinTech" },
  },
  {
    text: 'Call with Anika Roth (CTO) at Forto. Objection: "we built it in-house already." Rebuttal: "build-vs-maintain" (TCO of in-house = 2.4x year 2). Outcome: re-engaged for Q3. Win-rate: 41%.',
    metadata: { persona_role: "CTO", company_stage: "Late-stage", objection_type: "built-in-house", rebuttal_pattern: "build-vs-maintain-tco", outcome: "re-engaged", channel: "phone", region: "DACH" },
  },
  {
    text: 'Call with Pavel Kuznetsov (VP Platform) at Personio. Objection: "budget is frozen until Q1." Rebuttal: "budget-flex-pilot" (free 30-day pilot, billing starts in Q1). Outcome: pilot started immediately. Win-rate: 69%.',
    metadata: { persona_role: "VP Platform", company_stage: "Late-stage", objection_type: "frozen-budget", rebuttal_pattern: "budget-flex-pilot", outcome: "pilot-started", channel: "phone", region: "DACH" },
  },
  {
    text: 'Call with Mireille Carron (Head of Engineering) at Doctolib. Objection: "we evaluated 3 competitors and they were all the same." Rebuttal: "live-demo-not-deck" (15min screen-share with their actual stack). Outcome: booked the live demo. Win-rate: 77%.',
    metadata: { persona_role: "Head of Engineering", company_stage: "Late-stage", objection_type: "vendor-fatigue", rebuttal_pattern: "live-demo-not-deck", outcome: "booked", channel: "linkedin", region: "EU", industry: "HealthTech" },
  },
  {
    text: 'Persona dossier: CTO at Series-B B2B SaaS post-funding. Tends to value: speed, autonomy, engineering-led decisions. Avoids: long procurement, annual lock-in, vendor over-promising. Best opener: reference recent funding + technical specificity. Worst opener: ROI-first pitch.',
    metadata: { node_type: "persona", persona_role: "CTO", company_stage: "Series-B" },
  },
  {
    text: 'Persona dossier: VP Engineering at Late-stage. Values team velocity, hiring leverage, on-call quality of life. Decision shared with CTO + Head of Platform. Best channels: email then phone (not LinkedIn first).',
    metadata: { node_type: "persona", persona_role: "VP Engineering", company_stage: "Late-stage" },
  },
  {
    text: 'Persona dossier: Head of Data at FinTech. Always raises GDPR + data residency in first 90 seconds. Need EU-region story locked before any feature pitch. Decision is theirs but legal review is mandatory.',
    metadata: { node_type: "persona", persona_role: "Head of Data", company_stage: "Any", industry: "FinTech" },
  },
  {
    text: 'Pattern catalog: "no-lock-pilot" — Best for: post-raise CTOs, scaling teams, teams burned by previous vendor. Mechanic: 2-week pilot on one cluster/team, monthly billing, open-source migration tooling. Average lift: +73% on contract-lock-in objections for CTO persona.',
    metadata: { node_type: "rebuttal_pattern", rebuttal_pattern: "no-lock-pilot" },
  },
  {
    text: 'Pattern catalog: "complementary-not-replacement" — Best for: teams who just renewed an incumbent. Mechanic: position in adjacent layer (e.g. logs vs APM), no migration required, triggers expand-not-replace mental model. Average lift: +64%.',
    metadata: { node_type: "rebuttal_pattern", rebuttal_pattern: "complementary-not-replacement" },
  },
  {
    text: 'Pattern catalog: "eu-region-byok" — Best for: FinTech, HealthTech, regulated. Mechanic: Frankfurt or Dublin deployment, customer-held encryption keys, audit-ready logs. Average lift: +58% on data-residency objections.',
    metadata: { node_type: "rebuttal_pattern", rebuttal_pattern: "eu-region-byok" },
  },
  {
    text: 'Pattern catalog: "monthly-startable" — Best for: avoiding 90-day procurement cycles. Mechanic: stay under company\'s procurement threshold (€15k MRR typical), credit card start, upgrade later. Average lift: +81% on procurement-cycle objections.',
    metadata: { node_type: "rebuttal_pattern", rebuttal_pattern: "monthly-startable" },
  },
  {
    text: 'Pattern catalog: "live-demo-not-deck" — Best for: vendor-fatigued buyers. Mechanic: 15min unscripted screen-share against their actual stack, no slides. Average lift: +77%.',
    metadata: { node_type: "rebuttal_pattern", rebuttal_pattern: "live-demo-not-deck" },
  },
  {
    text: 'Pattern catalog: "build-vs-maintain-tco" — Best for: teams who built in-house. Mechanic: TCO model showing year-2 maintenance load = 2.4x build cost. Average lift: +41% (lower because emotional attachment to in-house).',
    metadata: { node_type: "rebuttal_pattern", rebuttal_pattern: "build-vs-maintain-tco" },
  },
  {
    text: 'Pattern catalog: "budget-flex-pilot" — Best for: frozen Q1/Q4 budgets. Mechanic: free 30-day pilot, billing starts new fiscal period. Average lift: +69%.',
    metadata: { node_type: "rebuttal_pattern", rebuttal_pattern: "budget-flex-pilot" },
  },
  {
    text: 'Outcome catalog: booked — counts as success when calendar invite is accepted within 24h. Tracks: persona, objection patterns hit, rebuttal patterns used, channel, time-to-book.',
    metadata: { node_type: "outcome", outcome: "booked" },
  },
  {
    text: 'Outcome catalog: pilot-started — stronger than booked. Customer is in product within 7 days. Strong predictor of close (62% close rate at 90d).',
    metadata: { node_type: "outcome", outcome: "pilot-started" },
  },
  {
    text: 'Outcome catalog: re-engaged — call did not convert but new touch scheduled. Use when the buyer signals timing is wrong but interest exists.',
    metadata: { node_type: "outcome", outcome: "re-engaged" },
  },
];

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const reset = body?.reset === true;
  const dataset = body?.dataset ?? "multiply";

  try {
    if (reset) await cognee.forget(dataset).catch(() => null);

    const results = [];
    for (const item of DEMO_LEARNINGS) {
      const r = await cognee.remember({ text: item.text, dataset, metadata: item.metadata });
      results.push(r);
    }
    await cognee.cognify(dataset).catch(() => null);

    return NextResponse.json({
      ok: true,
      ingested: DEMO_LEARNINGS.length,
      dataset,
      reset,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 502 },
    );
  }
}
