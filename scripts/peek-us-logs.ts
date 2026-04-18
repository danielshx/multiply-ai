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
  const { count: lCount, error: lErr } = await sb.from("us_outreach_logs").select("*", { count: "exact", head: true });
  if (lErr) {
    console.error("us_outreach_logs ERROR:", lErr.message);
  } else {
    console.log(`us_outreach_logs: ${lCount} rows`);
    const { data } = await sb.from("us_outreach_logs").select("*").order("ts", { ascending: false }).limit(3);
    console.log(`Sample:\n${JSON.stringify(data, null, 2)}`);
  }

  console.log("\n--- us_outreach_calls latest 3 ---");
  const { data: calls } = await sb
    .from("us_outreach_calls")
    .select("id, contact_name, phone_number, status, disposition, hr_run_id, created_at, updated_at, ended_at")
    .order("updated_at", { ascending: false })
    .limit(3);
  console.log(JSON.stringify(calls, null, 2));

  // Distinct status values
  const { data: statuses } = await sb.from("us_outreach_calls").select("status, disposition");
  const statusSet = new Set();
  const dispoSet = new Set();
  for (const s of statuses ?? []) {
    statusSet.add(s.status ?? "(null)");
    dispoSet.add(s.disposition ?? "(null)");
  }
  console.log(`\ndistinct statuses: ${[...statusSet].join(", ")}`);
  console.log(`distinct dispositions: ${[...dispoSet].join(", ")}`);
})();
