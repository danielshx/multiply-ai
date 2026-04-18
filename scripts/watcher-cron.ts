/**
 * Local Watcher Cron — calls /api/watcher/run every INTERVAL_SECONDS
 * (default 60). Acts as a stand-in for the HR Cron Workflow which can't
 * currently be published via the API.
 *
 * Each tick:
 *   - On the FIRST tick: backfill — `since` defaults to BACKFILL_SINCE
 *     (env, ISO 8601) or "1970-01-01" so all existing googlemaps_candidates
 *     are picked up. Subsequent ticks use the previous run's `next_since`.
 *   - Logs a one-line summary per tick.
 *
 *   pnpm tsx scripts/watcher-cron.ts                       # live, 60s interval
 *   pnpm tsx scripts/watcher-cron.ts --dry-run             # decisions only
 *   pnpm tsx scripts/watcher-cron.ts --interval=15         # every 15s
 *   pnpm tsx scripts/watcher-cron.ts --max=3 --concurrency=2
 *   pnpm tsx scripts/watcher-cron.ts --once                # single run, exit
 *   pnpm tsx scripts/watcher-cron.ts --since=2026-04-18T00:00:00Z
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

loadDotEnvLocal();

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const once = args.includes("--once");
const intervalSec = numArg("--interval=", 60);
const max = numArg("--max=", Number(process.env.WATCHER_MAX_PER_TICK ?? 5));
const concurrency = numArg("--concurrency=", Number(process.env.WATCHER_CONCURRENCY ?? 3));
const initialSince = strArg("--since=", process.env.BACKFILL_SINCE ?? "1970-01-01T00:00:00Z");

let nextSince: string | null = initialSince;
let tickNum = 0;

console.log(
  `[watcher-cron] starting · APP_URL=${APP_URL} interval=${intervalSec}s dry_run=${dryRun} max=${max} concurrency=${concurrency} initial_since=${initialSince}`,
);

async function tick() {
  tickNum++;
  const since = nextSince!;
  const startedAt = new Date();
  let outcome = "ok";
  let summary = "";
  try {
    const res = await fetch(`${APP_URL}/api/watcher/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ since, dry_run: dryRun, max, concurrency }),
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) {
      outcome = `fail HTTP ${res.status}`;
      summary = text.slice(0, 240);
    } else {
      const json = JSON.parse(text) as {
        mode?: string;
        tick: {
          total: number;
          sources: { leads: number; googlemaps: number; us_outreach?: number };
          next_since: string;
        };
        fan_out?: { dispatched: number; eligible: number; skipped_due_to_limit: number };
        decisions?: Array<{ name: string; decision: string; reasoning: string }>;
      };
      nextSince = json.tick.next_since;
      const fan = json.fan_out;
      summary = `mode=${json.mode} found=${json.tick.total} (manual=${json.tick.sources.leads}, gmaps=${json.tick.sources.googlemaps}, us=${json.tick.sources.us_outreach ?? 0})${fan ? ` dispatched=${fan.dispatched}/${fan.eligible} skipped=${fan.skipped_due_to_limit}` : ""}`;
      if (json.decisions && json.decisions.length > 0) {
        const top = json.decisions
          .slice(0, Math.min(5, max))
          .map((d) => `${d.name.split(" at ")[1] ?? d.name}→${d.decision}`)
          .join(", ");
        summary += ` | ${top}`;
      }
    }
  } catch (err) {
    outcome = "exception";
    summary = (err as Error).message;
  }
  const dur = Date.now() - startedAt.getTime();
  const ts = startedAt.toISOString().slice(11, 19);
  console.log(`[${ts}] tick #${tickNum} ${outcome} (${dur}ms) ${summary}`);
}

(async () => {
  await tick();
  if (once) return;
  setInterval(tick, intervalSec * 1000);
})();

function strArg(prefix: string, fallback: string): string {
  const a = args.find((x) => x.startsWith(prefix));
  return a ? a.slice(prefix.length) : fallback;
}
function numArg(prefix: string, fallback: number): number {
  const a = args.find((x) => x.startsWith(prefix));
  if (!a) return fallback;
  const n = Number(a.slice(prefix.length));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function loadDotEnvLocal(): void {
  try {
    const path = resolve(process.cwd(), ".env.local");
    const raw = readFileSync(path, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 1) continue;
      if (!process.env[t.slice(0, i).trim()]) {
        process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
      }
    }
  } catch {
    // best-effort
  }
}
