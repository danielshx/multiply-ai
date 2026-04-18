import { NextResponse } from "next/server";

/**
 * POST /api/watcher/run — runs ONE full watcher pass server-side:
 *
 *   1. /api/watcher/tick to discover changes (manual + googlemaps + us_outreach)
 *   2. Apply the deterministic decision rule (call/sms/email/skip)
 *   3. Fan out to /api/watcher/route, with concurrency control
 *
 * Designed to be called every 60s by scripts/watcher-cron.ts (or by HR's
 * Cron workflow once it's published).
 *
 * Body:
 *   { since?: string,                    // ISO 8601, default last 70s
 *     dry_run?: boolean,                 // true = decide but DON'T fan out
 *     max?: number,                      // hard cap of triggers per call (default WATCHER_MAX_PER_TICK or 10)
 *     concurrency?: number,              // parallel route calls (default 3)
 *     enabled?: boolean }                // override env WATCHER_ENABLED
 *
 * Response:
 *   { ok, ticks: { count, sources, since, next_since },
 *     decisions: [{ lead, decision, reasoning }],
 *     dispatched: [{ lead_id, name, decision, downstream_status, action_taken }],
 *     skipped_due_to_limit: number }
 */
type TickChange = {
  lead_id: string;
  source: "manual" | "googlemaps" | "us_outreach";
  name: string;
  company: string;
  phone_number: string;
  email: string;
  customer_goal: string;
  current_time: string;
  current_mode: "cold" | "warm" | "hot";
  stage: string;
  reason_changed: string;
  business_context: Record<string, unknown>;
  recent_messages: { ts: string; role: string | null; channel: string | null; content: string }[];
  cognee_context: string;
};

type Body = {
  since?: string;
  dry_run?: boolean;
  max?: number;
  concurrency?: number;
  enabled?: boolean;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const origin = new URL(req.url).origin;
  const dryRun = body.dry_run === true;
  const enabled =
    body.enabled !== undefined
      ? body.enabled
      : process.env.WATCHER_ENABLED === "true";
  const maxPerTick = Math.max(
    1,
    body.max ?? Number(process.env.WATCHER_MAX_PER_TICK ?? 10),
  );
  const concurrency = Math.max(
    1,
    Math.min(body.concurrency ?? Number(process.env.WATCHER_CONCURRENCY ?? 3), 10),
  );

  const tickRes = await fetch(`${origin}/api/watcher/tick`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...(body.since ? { since: body.since } : {}),
      limit: 50000, // effectively unlimited — `max` further down controls actual fan-out
    }),
    cache: "no-store",
  });
  if (!tickRes.ok) {
    return NextResponse.json(
      { ok: false, error: `tick failed: HTTP ${tickRes.status}` },
      { status: 502 },
    );
  }
  const tick = (await tickRes.json()) as {
    count: number;
    total: number;
    returned: number;
    sources: { leads: number; googlemaps: number; us_outreach: number };
    since: string;
    next_since: string;
    changes: TickChange[];
  };

  const decisions = tick.changes.map((c) => ({ change: c, ...decide(c) }));
  const eligible = decisions.filter((d) => d.decision !== "skip");
  const limited = eligible.slice(0, maxPerTick);
  const skipped = eligible.length - limited.length;

  if (dryRun || !enabled) {
    return NextResponse.json({
      ok: true,
      mode: dryRun ? "dry_run" : "watcher_disabled",
      hint: enabled
        ? null
        : "Set WATCHER_ENABLED=true in .env.local OR pass enabled:true in the body to actually fan out.",
      tick: {
        total: tick.total,
        returned: tick.returned,
        sources: tick.sources,
        since: tick.since,
        next_since: tick.next_since,
      },
      decisions: decisions.map((d) => ({
        lead_id: d.change.lead_id,
        name: d.change.name,
        company: d.change.company,
        source: d.change.source,
        rating:
          (d.change.business_context as { rating?: number | null }).rating ?? null,
        phone: d.change.phone_number || null,
        email: d.change.email || null,
        decision: d.decision,
        reasoning: d.reasoning,
      })),
      skipped_due_to_limit: skipped,
    });
  }

  const dispatched: Array<{
    lead_id: string;
    name: string;
    company: string;
    source: string;
    decision: string;
    downstream_status?: number;
    action_taken?: string;
    error?: string;
  }> = [];

  // Concurrency-bounded fan-out: simple semaphore via batches.
  for (let i = 0; i < limited.length; i += concurrency) {
    const batch = limited.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(async (d) => {
        try {
          const res = await fetch(`${origin}/api/watcher/route`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              decision: d.decision,
              reasoning: d.reasoning,
              reason_changed: d.change.reason_changed,
              lead: {
                lead_id: d.change.lead_id,
                name: d.change.name,
                company: d.change.company,
                phone_number: d.change.phone_number,
                email: d.change.email,
                current_time: d.change.current_time,
                customer_goal: enrichGoalWithContext(
                  d.change.customer_goal,
                  d.change.business_context as Record<string, unknown>,
                ),
                business_context: d.change.business_context,
              },
            }),
            cache: "no-store",
          });
          const json = (await res.json()) as {
            action_taken?: string;
            downstream_status?: number;
          };
          return {
            lead_id: d.change.lead_id,
            name: d.change.name,
            company: d.change.company,
            source: d.change.source,
            decision: d.decision,
            downstream_status: json.downstream_status ?? res.status,
            action_taken: json.action_taken ?? "unknown",
          };
        } catch (err) {
          return {
            lead_id: d.change.lead_id,
            name: d.change.name,
            company: d.change.company,
            source: d.change.source,
            decision: d.decision,
            error: (err as Error).message,
          };
        }
      }),
    );
    dispatched.push(...results);
  }

  return NextResponse.json({
    ok: true,
    mode: "live",
    tick: {
      total: tick.total,
      returned: tick.returned,
      sources: tick.sources,
      since: tick.since,
      next_since: tick.next_since,
    },
    fan_out: {
      eligible: eligible.length,
      dispatched: dispatched.length,
      concurrency,
      max_per_tick: maxPerTick,
      skipped_due_to_limit: skipped,
    },
    dispatched,
  });
}

function decide(c: TickChange): {
  decision: "call" | "sms" | "email" | "skip";
  reasoning: string;
} {
  const phone = (c.phone_number ?? "").trim();
  const email = (c.email ?? "").trim();
  const mode = (c.current_mode ?? "").toLowerCase();
  const ctx = (c.cognee_context ?? "").toLowerCase();

  // (us_outreach: previously skipped rows that already had hr_run_id /
  // terminal stage — disabled per request, the user wants to re-attempt
  // every us_outreach contact through the watcher's Mini Voice Agent.)

  if (ctx.includes("booked") || ctx.includes("meeting_booked"))
    return { decision: "skip", reasoning: "already booked recently" };
  if (ctx.includes("opt_out") || ctx.includes("unsubscribe"))
    return { decision: "skip", reasoning: "opted out" };
  if (!phone && !email)
    return { decision: "skip", reasoning: "no phone and no email" };
  if (!phone) return { decision: "email", reasoning: "no phone → email" };

  if (mode === "hot") return { decision: "call", reasoning: `hot (${heatHint(c)}) → voice` };
  if (mode === "warm") return { decision: "call", reasoning: `warm (${heatHint(c)}) → voice` };
  if (mode === "cold")
    return email
      ? { decision: "email", reasoning: "cold + has email → email" }
      : { decision: "call", reasoning: "cold but no email, has phone → call anyway" };
  return { decision: "email", reasoning: `unknown mode → email` };
}

function heatHint(c: TickChange): string {
  const r = (c.business_context as { rating?: number | null }).rating;
  return r != null ? `rating ${r}` : c.reason_changed;
}

function enrichGoalWithContext(
  baseGoal: string,
  ctx: Record<string, unknown>,
): string {
  if (!ctx || ctx.source !== "googlemaps") return baseGoal;
  const parts: string[] = [];
  if (ctx.company_type) parts.push(String(ctx.company_type));
  if (ctx.address) parts.push(String(ctx.address).split(",")[0]);
  if (ctx.rating) parts.push(`${ctx.rating}/5`);
  const suffix = parts.length > 0 ? ` (${parts.join(" · ")})` : "";
  return `${baseGoal}${suffix}`.slice(0, 600);
}

const US_OUTREACH_TERMINAL_STAGES = new Set([
  "completed",
  "closed",
  "failed",
  "canceled",
]);
