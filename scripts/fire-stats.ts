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
  // Calls fired
  const { count: queued } = await sb
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("role", "system")
    .eq("channel", "phone")
    .like("content", "%Voice call queued%");

  // Real human replies (lead role) – total ever
  const { count: leadMsgs } = await sb
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("role", "lead");

  // Real agent transcripts (the HR webhook posts these from real calls)
  const { count: agentMsgs } = await sb
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("role", "agent")
    .eq("channel", "phone");

  // Distinct lead_ids that have real lead messages (= conversations)
  const { data: convoLeads } = await sb
    .from("messages")
    .select("lead_id")
    .eq("role", "lead")
    .not("lead_id", "is", null);
  const distinctConvoLeads = new Set((convoLeads ?? []).map((r) => r.lead_id));

  // Stage distribution in leads
  const { data: stages } = await sb.from("leads").select("stage, current_mode");
  const stageCount = new Map<string, number>();
  const heatCount = new Map<string, number>();
  for (const r of stages ?? []) {
    stageCount.set(r.stage ?? "(null)", (stageCount.get(r.stage ?? "(null)") ?? 0) + 1);
    heatCount.set(r.current_mode ?? "(null)", (heatCount.get(r.current_mode ?? "(null)") ?? 0) + 1);
  }

  // Leads counted as "closed" by the LiveMonitor heuristic (booked / lost / qualified)
  const closedStages = ["booked", "lost", "qualified"];
  const closedCount = closedStages.reduce((acc, s) => acc + (stageCount.get(s) ?? 0), 0);

  console.log("┌──────────────────────────────────────────────────────────┐");
  console.log("│  FIRE STATS  ·  " + new Date().toISOString().slice(11, 19) + "                        │");
  console.log("├──────────────────────────────────────────────────────────┤");
  console.log(`│  📞 Calls queued (system+phone msgs):      ${String(queued ?? 0).padStart(6)}     │`);
  console.log(`│  💬 Real conversations (distinct leads):    ${String(distinctConvoLeads.size).padStart(6)}     │`);
  console.log(`│  ✓ Closed (booked/qualified/lost):         ${String(closedCount).padStart(6)}     │`);
  console.log("├──────────────────────────────────────────────────────────┤");
  console.log(`│  Lead replies total (role=lead msgs):      ${String(leadMsgs ?? 0).padStart(6)}     │`);
  console.log(`│  Agent transcripts total (role=agent ch=phone): ${String(agentMsgs ?? 0).padStart(6)}│`);
  console.log("├──────────────────────────────────────────────────────────┤");
  console.log("│  Stage distribution:                                     │");
  for (const [k, v] of [...stageCount.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`│    ${k.padEnd(15)} ${String(v).padStart(6)}                          │`);
  }
  console.log("│  Heat distribution:                                      │");
  for (const [k, v] of [...heatCount.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`│    ${k.padEnd(15)} ${String(v).padStart(6)}                          │`);
  }
  console.log("└──────────────────────────────────────────────────────────┘");
})();
