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
  const { data: nameDist } = await sb
    .from("us_outreach_calls")
    .select("contact_name");
  const counts = new Map<string, number>();
  for (const r of nameDist ?? []) {
    const n = r.contact_name ?? "(null)";
    counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  console.log(`Distinct contact_name values in us_outreach_calls (${(nameDist ?? []).length} rows):`);
  for (const [n, c] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  "${n}": ${c}`);
  }
  console.log(`\n--- All columns of one sample row ---`);
  const { data: sample } = await sb
    .from("us_outreach_calls")
    .select("*")
    .limit(1)
    .single();
  console.log(Object.keys(sample ?? {}).join(", "));
  console.log(`\n--- raw_outcome of one row ---`);
  const { data: withOutcome } = await sb
    .from("us_outreach_calls")
    .select("contact_name, phone_number, raw_outcome")
    .not("raw_outcome", "eq", "{}")
    .limit(2);
  console.log(JSON.stringify(withOutcome, null, 2));
})();
