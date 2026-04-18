import { NextResponse } from "next/server";
import { persistMessage, findLeadIdByContact } from "@/lib/supabase/persistMessage";
import { getPriorContext } from "@/lib/cognee/priorContext";

/**
 * POST /api/watcher/trigger-mini — proxy that the Watcher Cron HR Workflow
 * calls to invoke the Mini Voice Agent for a single lead. Keeps the HR API
 * key server-side instead of baking it into a workflow webhook header.
 *
 * Body: { name, company, phone_number, email, current_time, customer_goal }
 *
 * The body is forwarded as-is to the Mini Agent's run endpoint.
 */
const MINI_WORKFLOW_ID = "019da1b8-1af3-70fe-af69-3e24e327289c";
// Staging is currently the only environment with a working outbound voice
// trunk for this org — production trunk is broken (HR-side issue, 2026-04-18).
const HR_ENVIRONMENT = process.env.HR_MINI_ENVIRONMENT ?? "staging";
const HR_RUNS_URL = `https://platform.eu.happyrobot.ai/api/v2/workflows/${MINI_WORKFLOW_ID}/runs`;

type Body = {
  name?: string;
  company?: string;
  phone_number?: string;
  email?: string;
  current_time?: string;
  customer_goal?: string;
  business_context?: Record<string, unknown> | null;
  reason?: string;
};

export async function POST(req: Request) {
  const apiKey = process.env.HR_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "HR_API_KEY not set" },
      { status: 500 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as Body;

  if (!body.phone_number) {
    return NextResponse.json(
      { ok: false, error: "phone_number is required" },
      { status: 400 },
    );
  }

  const ctxBlob = body.business_context
    ? `\n\n[business_context]\n${JSON.stringify(body.business_context).slice(0, 600)}`
    : "";
  const prior = await getPriorContext({
    name: body.name,
    company: body.company,
    phone: body.phone_number,
    email: body.email,
    channel: "voice",
  });
  const priorBlob = prior ? `\n\n[prior_context]\n${prior}` : "";

  const payload = {
    name: body.name ?? "",
    company: body.company ?? "",
    phone_number: body.phone_number,
    email: body.email ?? "",
    current_time: body.current_time ?? new Date().toISOString(),
    customer_goal: `${body.customer_goal ?? ""}${ctxBlob}${priorBlob}`.slice(0, 2400),
  };

  const res = await fetch(HR_RUNS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ payload, environment: HR_ENVIRONMENT }),
    cache: "no-store",
  });
  console.log(`[trigger-mini] HR env=${HR_ENVIRONMENT} status=${res.status}`);

  const text = await res.text();
  if (!res.ok) {
    return NextResponse.json(
      {
        ok: false,
        status: res.status,
        error: `HR run failed: ${text.slice(0, 400)}`,
        sent: payload,
        reason: body.reason ?? null,
      },
      { status: 502 },
    );
  }

  const hr = safeJson(text) as { run_id?: string; queued_run_ids?: string[] } | string;
  const runId =
    typeof hr === "object" && hr
      ? hr.run_id ?? hr.queued_run_ids?.[0] ?? null
      : null;

  const leadId = await findLeadIdByContact({
    phone: payload.phone_number,
    email: payload.email,
  });
  await persistMessage({
    lead_id: leadId,
    role: "system",
    channel: "phone",
    content: `📞 Voice call queued via HR (${HR_ENVIRONMENT}). run_id=${runId ?? "?"}. Goal: ${payload.customer_goal || "—"}`,
    hr_msg_id: runId,
  });

  return NextResponse.json({
    ok: true,
    triggered: "mini_voice_agent",
    workflow_id: MINI_WORKFLOW_ID,
    sent: payload,
    reason: body.reason ?? null,
    hr_run_id: runId,
    persisted_to_lead_id: leadId,
    hr_response: hr,
  });
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
