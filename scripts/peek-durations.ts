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
  const { data } = await sb
    .from("us_outreach_calls")
    .select("created_at, disposition, duration_sec, total_duration_sec, talk_duration_sec, started_at, connected_at, ended_at, closed_at, phone_number")
    .eq("disposition", "closed")
    .not("sms_sent_at", "is", null)
    .order("created_at", { ascending: false });
  console.log(`Echt geschlossen: ${data?.length}\n`);
  for (const c of data ?? []) {
    const derived = c.ended_at && c.started_at
      ? Math.round((new Date(c.ended_at).getTime() - new Date(c.started_at).getTime()) / 1000)
      : c.closed_at && c.created_at
        ? Math.round((new Date(c.closed_at).getTime() - new Date(c.created_at).getTime()) / 1000)
        : null;
    console.log(`${c.created_at}  ${c.phone_number}`);
    console.log(`   duration_sec=${c.duration_sec}  total=${c.total_duration_sec}  talk=${c.talk_duration_sec}  started=${c.started_at}  connected=${c.connected_at}  ended=${c.ended_at}  derived≈${derived}s`);
  }
})();
