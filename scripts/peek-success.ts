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
  const { data, error } = await sb
    .from("us_outreach_calls")
    .select("id, hr_run_id, hr_session_id, phone_number, created_at, started_at, connected_at, ended_at, disposition, sms_sent_at")
    .eq("disposition", "closed")
    .not("sms_sent_at", "is", null)
    .order("created_at", { ascending: false });
  if (error) { console.error(error); process.exit(1); }
  console.log(`Echt geschlossen: ${data?.length}\n`);
  for (const c of data ?? []) {
    const talk = c.connected_at && c.ended_at
      ? Math.round((new Date(c.ended_at).getTime() - new Date(c.connected_at).getTime()) / 1000)
      : null;
    console.log(`${c.created_at}  ${c.phone_number}  talk=${talk}s`);
    console.log(`   call_id=${c.id}`);
    console.log(`   hr_run_id=${c.hr_run_id}`);
    console.log(`   hr_session_id=${c.hr_session_id}`);
  }
})();
