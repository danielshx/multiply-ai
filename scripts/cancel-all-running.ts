/**
 * Emergency stop: list all currently RUNNING HR runs for the Mini Voice
 * Agent and cancel each one via the REST API. Runs in parallel batches.
 *
 *   pnpm tsx scripts/cancel-all-running.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

(function loadEnv() {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const l of raw.split(/\r?\n/)) {
    const t = l.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i > 0 && !process.env[t.slice(0, i).trim()]) {
      process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
  }
})();

const WORKFLOW_IDS = [
  "019da1b8-1af3-70fe-af69-3e24e327289c", // Mini Voice
  "019da1ed-4f91-74ae-a195-84a6ba8e5e23", // Email Agent
  "019da21f-9d7c-7457-96cb-53d1db972baf", // Mini SMS
];

const apiKey = process.env.HR_API_KEY;
if (!apiKey) {
  console.error("HR_API_KEY missing");
  process.exit(1);
}
const BASE = "https://platform.eu.happyrobot.ai/api/v2";

async function listRunning(workflowId: string): Promise<string[]> {
  const url = `${BASE}/workflows/${workflowId}/runs?status=running&page_size=200`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!res.ok) {
    console.warn(`  list ${workflowId} HTTP ${res.status}`);
    return [];
  }
  const json = (await res.json()) as { data?: Array<{ id: string }> };
  return (json.data ?? []).map((r) => r.id);
}

async function cancelOne(_workflowId: string, runId: string): Promise<boolean> {
  // HR cancel is run-scoped, NOT workflow-scoped.
  for (const url of [
    `${BASE}/runs/${runId}/cancel`,
    `${BASE}/runs/${runId}/stop`,
    `${BASE}/runs/${runId}`, // DELETE fallback
  ]) {
    const method = url.endsWith("/runs/" + runId) ? "DELETE" : "POST";
    const res = await fetch(url, { method, headers: { Authorization: `Bearer ${apiKey}` } });
    if (res.ok) return true;
    if (res.status === 404) continue;
    if (res.status === 409 || res.status === 410) return true; // already done
  }
  return false;
}

async function cancelAll(workflowId: string): Promise<{ tried: number; ok: number }> {
  let tried = 0;
  let ok = 0;
  for (let round = 0; round < 10; round++) {
    const ids = await listRunning(workflowId);
    if (ids.length === 0) break;
    console.log(`  workflow ${workflowId.slice(0, 8)} round ${round + 1}: ${ids.length} running`);
    const concurrency = 10;
    for (let i = 0; i < ids.length; i += concurrency) {
      const batch = ids.slice(i, i + concurrency);
      const results = await Promise.all(batch.map((id) => cancelOne(workflowId, id)));
      tried += batch.length;
      ok += results.filter(Boolean).length;
    }
    // small breather so HR doesn't rate-limit us
    await new Promise((r) => setTimeout(r, 500));
  }
  return { tried, ok };
}

(async () => {
  for (const wf of WORKFLOW_IDS) {
    console.log(`\n→ workflow ${wf}`);
    const { tried, ok } = await cancelAll(wf);
    console.log(`  tried=${tried} ok=${ok}`);
  }
  console.log("\nDone.");
})();
