/**
 * Idempotent HR workflow provisioning.
 *
 * What this does via API:
 *   1. Syncs workflow variables (BASE_URL, WEBHOOK_SECRET, DEMO_*)
 *   2. Configures outgoing webhook → our /api/hr-webhook
 *   3. Optionally publishes the version
 *   4. Fires a smoke-test trigger so you see an end-to-end run
 *
 * What HR UI still requires (HR API doesn't expose tool-node creation in a
 * docs-backed way we can rely on yet):
 *   - Register the 3 custom tools (research, log_learning, book_meeting)
 *     as children of the Outbound Voice Agent node.
 *
 * Usage:
 *   pnpm tsx scripts/provision-hr.ts
 *   pnpm tsx scripts/provision-hr.ts --publish
 *   pnpm tsx scripts/provision-hr.ts --smoke-test
 */

const HR_KEY = process.env.HR_API_KEY;
const WF_SLUG = process.env.HR_WORKFLOW_SLUG_OVERRIDE ?? "veprnuu1mzdz"; // "Multiply · Daniel (auto-provisioned)"
const APP_URL =
  process.env.MULTIPLY_APP_URL ??
  "https://multiply-danielshxs-projects.vercel.app";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET ?? "";
const BASE = "https://platform.eu.happyrobot.ai/api/v2";

// Discovered event_ids for the built-in Webhook integration (HR EU):
const EVENT_POST = "01926f2b-2973-7ebf-ada1-e984251e27ec";

// Slate rich-text helpers — HR's config fields expect Slate trees
const para = (text: string) => [{ type: "paragraph", children: [{ text }] }];
const plainKV = (key: string, value: string) => ({ key, value: para(value) });

if (!HR_KEY) throw new Error("HR_API_KEY is not set");
if (!WEBHOOK_SECRET) throw new Error("WEBHOOK_SECRET is not set");

type Variable = {
  id?: string;
  key: string;
  value_production: string;
  value_staging?: string;
  value_development?: string;
};

const VARIABLES: Variable[] = [
  { key: "BASE_URL", value_production: APP_URL, value_development: "http://localhost:3000" },
  { key: "WEBHOOK_SECRET", value_production: WEBHOOK_SECRET },
  { key: "DEMO_PERSONA_NAME", value_production: "Sarah Chen" },
  { key: "DEMO_PERSONA_ROLE", value_production: "CTO" },
  { key: "DEMO_COMPANY", value_production: "Northwind Robotics" },
  { key: "DEMO_ATTENDEE_EMAIL", value_production: "noobskill500002@gmail.com" },
  { key: "DEMO_FOCUS", value_production: "post-Series-B GTM scaling, contract flexibility" },
  { key: "COGNEE_RESEARCH_URL", value_production: `${APP_URL}/api/tools/research` },
  { key: "COGNEE_LOG_LEARNING_URL", value_production: `${APP_URL}/api/tools/log-learning` },
  { key: "BOOK_MEETING_URL", value_production: `${APP_URL}/api/tools/book-meeting` },
];

async function hr<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const baseHeaders: Record<string, string> = {
    Authorization: `Bearer ${HR_KEY}`,
  };
  // Only set Content-Type when we actually send a body
  if (init.body) baseHeaders["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    method,
    headers: { ...baseHeaders, ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HR ${res.status} on ${init.method ?? "GET"} ${path}\n${text}`);
  }
  return text ? JSON.parse(text) : ({} as T);
}

async function getWorkflow() {
  return hr<{
    id: string;
    slug: string;
    name: string;
    latest_version: { id: string; is_live: boolean; version_number: number };
  }>(`/workflows/${WF_SLUG}`);
}

async function listVariables(workflowId: string) {
  const res = await hr<{ data: Variable[] } | Variable[]>(
    `/workflows/${workflowId}/variables`,
  );
  return Array.isArray(res) ? res : (res.data ?? []);
}

async function upsertVariable(workflowId: string, existing: Variable[], v: Variable) {
  const found = existing.find((e) => e.key === v.key);
  if (found?.id) {
    if (
      found.value_production === v.value_production &&
      (found.value_development ?? "") === (v.value_development ?? "")
    ) {
      return { key: v.key, action: "skip" };
    }
    await hr(`/workflows/${workflowId}/variables/${found.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        value_production: v.value_production,
        value_staging: v.value_staging ?? v.value_production,
        value_development: v.value_development ?? v.value_production,
      }),
    });
    return { key: v.key, action: "update" };
  }
  await hr(`/workflows/${workflowId}/variables`, {
    method: "POST",
    body: JSON.stringify({
      key: v.key,
      value_production: v.value_production,
      value_staging: v.value_staging ?? v.value_production,
      value_development: v.value_development ?? v.value_production,
      is_hidden_in_ui: false,
    }),
  });
  return { key: v.key, action: "create" };
}

async function syncWebhook(workflowId: string) {
  const webhookUrl = `${APP_URL}/api/hr-webhook`;
  await hr(`/workflows/${workflowId}`, {
    method: "PATCH",
    body: JSON.stringify({
      settings: {
        webhooks: [
          {
            url: webhookUrl,
            headers: {
              "X-HR-Signature": `hmac:${WEBHOOK_SECRET}`, // HR signs with this secret
            },
          },
        ],
      },
    }),
  });
  return webhookUrl;
}

type ToolDef = {
  name: string;
  path: string; // /api/tools/...
  description: string;
  parameters: Array<{ name: string; description: string; required?: boolean; example?: string }>;
  bodyFields: Record<string, string>; // body shape with @variable refs
  messageExample: string;
};

const TOOLS: ToolDef[] = [
  {
    name: "research",
    path: "/api/tools/research",
    description:
      "Call BEFORE greeting the lead. Fetches a synthesized dossier from the Multiply cognee knowledge graph — prior calls with similar personas, relevant rebuttal patterns, and company context. Use the returned briefing to personalize your opening.",
    parameters: [
      { name: "company", description: "Target company name", required: true, example: "Northwind Robotics" },
      { name: "persona_name", description: "Full name of person being called", required: true, example: "Sarah Chen" },
      { name: "persona_role", description: "Job title", required: true, example: "CTO" },
      { name: "focus", description: "Optional focus area for the research", example: "contract flexibility" },
    ],
    bodyFields: {
      company: "@company",
      "person.name": "@persona_name",
      "person.role": "@persona_role",
      focus: "@focus",
    },
    messageExample: "One sec, pulling up your details.",
  },
  {
    name: "book_meeting",
    path: "/api/tools/book-meeting",
    description:
      "Call AFTER the lead verbally agrees to a meeting. Books a real Google Calendar event and sends an invite. Always pass at least two proposed slots, weighted toward Thursday or Friday.",
    parameters: [
      { name: "company", description: "Target company name", required: true, example: "Northwind Robotics" },
      { name: "attendee_email", description: "Email of the lead", required: true, example: "sarah@northwind.ai" },
      { name: "proposed_slot_1", description: "First proposed ISO 8601 datetime", required: true, example: "2026-04-23T14:00:00+02:00" },
      { name: "proposed_slot_2", description: "Second proposed ISO 8601 datetime", required: false, example: "2026-04-24T10:00:00+02:00" },
    ],
    bodyFields: {
      company: "@company",
      attendee_email: "@attendee_email",
      "proposed_slots[0]": "@proposed_slot_1",
      "proposed_slots[1]": "@proposed_slot_2",
      duration_minutes: "30",
    },
    messageExample: "Perfect — let me lock that in right now.",
  },
  {
    name: "log_learning",
    path: "/api/tools/log-learning",
    description:
      "Call at the END of every call regardless of outcome. Ingests the transcript, detected objections, rebuttal pattern, and outcome into the cognee knowledge graph so the next call is smarter.",
    parameters: [
      { name: "company", description: "Target company name", required: true, example: "Northwind Robotics" },
      { name: "persona_name", description: "Lead's full name", required: true, example: "Sarah Chen" },
      { name: "persona_role", description: "Job title", required: true, example: "CTO" },
      { name: "transcript", description: "Full diarized call transcript", required: true, example: "Agent: Hi Sarah... | Lead: ..." },
      { name: "objections", description: "Comma-separated objection labels", example: "contract lock-in, pricing" },
      { name: "rebuttal_pattern", description: "Identifier of rebuttal used", example: "no-lock-pilot" },
      { name: "outcome", description: "One of: booked, pilot-started, re-engaged, lost", required: true, example: "booked" },
    ],
    bodyFields: {
      call_id: "{{session.id}}",
      company: "@company",
      "persona.name": "@persona_name",
      "persona.role": "@persona_role",
      transcript: "@transcript",
      "objections[0]": "@objections",
      rebuttal_pattern: "@rebuttal_pattern",
      outcome: "@outcome",
      channel: "happyrobot-voice",
    },
    messageExample: "",
  },
];

/**
 * Creates a tool node (function definition) under the agent and a POST
 * action child that hits our /api/tools/* endpoint with a JSON body.
 */
async function syncTool(versionId: string, agentNodeId: string, existingTools: any[], def: ToolDef) {
  const already = existingTools.find((t) => t.name === def.name && t.type === "tool");
  let toolId: string;

  if (already) {
    toolId = already.id;
  } else {
    const created = await hr<{ data: Array<{ id: string }> }>(`/versions/${versionId}/nodes`, {
      method: "POST",
      body: JSON.stringify({
        nodes: [
          {
            type: "tool",
            name: def.name,
            parent_node_id: agentNodeId,
            configuration: {},
          },
        ],
      }),
    });
    toolId = created.data[0].id;
  }

  // PUT the tool function (description + parameters + message)
  await hr(`/versions/${versionId}/nodes/${toolId}`, {
    method: "PUT",
    body: JSON.stringify({
      type: "tool",
      name: def.name,
      function: {
        description: para(def.description),
        parameters: def.parameters.map((p) => ({
          name: p.name,
          description: para(p.description),
          required: p.required ?? false,
          example: p.example ?? "",
        })),
        message: def.messageExample
          ? {
              type: "fixed",
              description: para(""),
              example: def.messageExample,
            }
          : { type: "none", description: para(""), example: "" },
      },
    }),
  });

  // Create a POST action child node (idempotent: delete + recreate is safest)
  const currentNodes = await hr<{ data: any[] }>(`/versions/${versionId}/nodes`);
  const existingAction = currentNodes.data.find(
    (n) => n.parent_id === toolId && n.type === "action",
  );
  if (existingAction) {
    await hr(`/versions/${versionId}/nodes/${existingAction.id}`, { method: "DELETE" });
  }

  // Flatten bodyFields into Slate "params" array (HR's POST body mode uses params=array-of-{key,value})
  // Actually for JSON body it's "body" — but we use params here since the Scrape example does that
  const bodyParams = Object.entries(def.bodyFields).map(([k, v]) => plainKV(k, v));

  await hr(`/versions/${versionId}/nodes`, {
    method: "POST",
    body: JSON.stringify({
      nodes: [
        {
          type: "action",
          name: `POST ${def.path}`,
          parent_node_id: toolId,
          event_id: EVENT_POST,
          configuration: {
            url: para(`${APP_URL}${def.path}`),
            headers: [plainKV("Content-Type", "application/json")],
            params: bodyParams,
            body_mode: "json",
          },
        },
      ],
    }),
  });

  return { name: def.name, id: toolId };
}

async function publishVersion(versionId: string) {
  return hr(`/versions/${versionId}/publish`, {
    method: "POST",
    body: JSON.stringify({ environment: "production", force: true }),
  });
}

async function smokeTriggerWorkflow() {
  const hooksUrl = `https://platform.eu.happyrobot.ai/hooks/${WF_SLUG}`;
  const res = await fetch(hooksUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HR_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      lead_id: `smoke-${Date.now()}`,
      phone_number: "+49000000000",
      customer_name: "Sarah Chen",
      company: "Northwind Robotics",
      persona_role: "CTO",
      agent_index: 1,
    }),
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body: body.slice(0, 300) };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  console.log(`\n▶ Multiply · HR Provisioning\n  workflow slug: ${WF_SLUG}\n  app URL: ${APP_URL}\n`);

  // 1. Workflow
  const wf = await getWorkflow();
  console.log(`✓ Workflow found: "${wf.name}" (id=${wf.id.slice(0, 8)}, version=${wf.latest_version.version_number})`);

  // 2. Variables
  const existing = await listVariables(wf.id);
  console.log(`\n▶ Syncing ${VARIABLES.length} workflow variables...`);
  for (const v of VARIABLES) {
    try {
      const r = await upsertVariable(wf.id, existing, v);
      const icon = r.action === "create" ? "+" : r.action === "update" ? "~" : "·";
      console.log(`  ${icon} ${r.key}`);
    } catch (err) {
      console.log(`  ✗ ${v.key} — ${(err as Error).message.slice(0, 120)}`);
    }
  }

  // 3. Outgoing webhook
  console.log("\n▶ Configuring outgoing webhook...");
  try {
    const url = await syncWebhook(wf.id);
    console.log(`  ✓ webhook → ${url}`);
  } catch (err) {
    console.log(`  ✗ ${(err as Error).message.slice(0, 180)}`);
  }

  // 4. Sync custom tools (research, log_learning, book_meeting)
  console.log("\n▶ Syncing custom tools...");
  const allNodes = await hr<{ data: any[] }>(`/versions/${wf.latest_version.id}/nodes`);
  const voiceAgent = allNodes.data.find(
    (n) => n.type === "action" && n.name?.toLowerCase().includes("voice"),
  );
  if (!voiceAgent) {
    console.log("  ✗ Outbound Voice Agent node not found — cannot attach tools");
  } else {
    for (const def of TOOLS) {
      try {
        const r = await syncTool(wf.latest_version.id, voiceAgent.id, allNodes.data, def);
        console.log(`  ✓ tool ${r.name} (id=${r.id.slice(0, 8)})`);
      } catch (err) {
        console.log(`  ✗ tool ${def.name} — ${(err as Error).message.slice(0, 200)}`);
      }
    }
  }

  // 4. Optional publish
  if (args.has("--publish")) {
    console.log("\n▶ Publishing latest version...");
    try {
      await publishVersion(wf.latest_version.id);
      console.log("  ✓ published to production");
    } catch (err) {
      console.log(`  ✗ ${(err as Error).message.slice(0, 240)}`);
    }
  }

  // 5. Smoke test
  if (args.has("--smoke-test")) {
    console.log("\n▶ Smoke-triggering workflow...");
    const r = await smokeTriggerWorkflow();
    console.log(`  ${r.ok ? "✓" : "✗"} HTTP ${r.status}: ${r.body}`);
  }

  const WORKSPACE = "tumaimultiply";
  console.log("\n" + "─".repeat(72));
  console.log(`Workflow overview: https://platform.eu.happyrobot.ai/${WORKSPACE}/workflows/${wf.slug}`);
  console.log(`Live version (v${wf.latest_version.version_number}):  https://platform.eu.happyrobot.ai/${WORKSPACE}/workflows/${wf.slug}/editor/${wf.latest_version.id}`);
  console.log(`Trigger API:       POST /api/v2/workflows/${wf.id}/runs`);
  console.log(`From UI:           ⌘K → "Trigger a test call"`);
  console.log("─".repeat(72) + "\n");
}

main().catch((err) => {
  console.error("\n✗ provisioning failed:", err.message);
  process.exit(1);
});
