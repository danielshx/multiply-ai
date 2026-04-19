import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const env = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
for (const l of env.split(/\r?\n/)) {
  const t = l.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i > 0 && !process.env[t.slice(0, i).trim()])
    process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!,
  { auth: { persistSession: false } },
);
(async () => {
  const since60 = new Date(Date.now() - 60_000).toISOString();
  const since5 = new Date(Date.now() - 5 * 60_000).toISOString();
  const since15 = new Date(Date.now() - 15 * 60_000).toISOString();

  const queries = [
    sb.from("messages").select("*", { count: "exact", head: true }).eq("role", "system").eq("channel", "phone").gte("ts", since60),
    sb.from("messages").select("*", { count: "exact", head: true }).eq("role", "system").eq("channel", "phone").gte("ts", since5),
    sb.from("messages").select("*", { count: "exact", head: true }).eq("role", "system").eq("channel", "phone").gte("ts", since15),
    sb.from("us_outreach_calls").select("*", { count: "exact", head: true }).is("hr_run_id", null),
  ];
  const results = await Promise.all(queries);
  const last1m = results[0].count ?? 0;
  const last5m = results[1].count ?? 0;
  const last15m = results[2].count ?? 0;
  const pendingCalls = results[3].count ?? 0;

  const ratePerMin = last5m / 5;

  console.log(`Calls queued (system+phone messages):`);
  console.log(`  last 1 min:  ${last1m}`);
  console.log(`  last 5 min:  ${last5m}  (${(last5m/5).toFixed(1)} / min)`);
  console.log(`  last 15 min: ${last15m} (${(last15m/15).toFixed(1)} / min)`);
  console.log(`\nPending us_outreach (no hr_run_id yet): ${pendingCalls}`);

  if (ratePerMin > 0) {
    const todoEstimate = Math.max(pendingCalls, 1500); // rough upper bound
    const minutes = todoEstimate / ratePerMin;
    console.log(
      `\nIf rate stays at ~${ratePerMin.toFixed(1)}/min, fully draining ` +
      `~${todoEstimate} more would take ~${Math.round(minutes)} min ` +
      `(${(minutes / 60).toFixed(1)}h).`,
    );
  }
})();
