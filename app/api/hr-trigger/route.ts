import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/hr-trigger — kicks off a HappyRobot run for the Multiply Call Agent
 * workflow. Used by the Command Palette "Trigger a test call" action.
 *
 * Body (optional):
 *   { phone_number?: string, customer_name?: string, company?: string, persona_role?: string }
 *
 * Defaults match the Sarah Chen demo persona.
 */
const WF_ID =
  process.env.HR_WORKFLOW_ID ?? "019da0e8-895e-7e43-962d-e4972c27345f"; // Multiply · Daniel (auto-provisioned)
const BASE = "https://platform.eu.happyrobot.ai/api/v2";

type Body = {
  phone_number?: string;
  customer_name?: string;
  company?: string;
  persona_role?: string;
  lead_id?: string;
};

export async function POST(req: Request) {
  const key = process.env.HR_API_KEY;
  if (!key) {
    return NextResponse.json({ ok: false, error: "HR_API_KEY not set" }, { status: 500 });
  }
  const body = (await req.json().catch(() => ({}))) as Body;

  const payload = {
    lead_id: body.lead_id ?? `ui-${Date.now()}`,
    phone_number: body.phone_number ?? process.env.DEMO_TARGET_PHONE ?? "+4917681136011",
    customer_name: body.customer_name ?? "Sarah Chen",
    company: body.company ?? "Northwind Robotics",
    persona_role: body.persona_role ?? "CTO",
    agent_index: 1,
  };

  try {
    const res = await fetch(`${BASE}/workflows/${WF_ID}/runs`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ environment: "production", payload }),
    });
    const text = await res.text();
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, status: res.status, error: text.slice(0, 300) },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true, ...JSON.parse(text), triggered: payload });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "/api/hr-trigger",
    usage: "POST with optional { phone_number, customer_name, company, persona_role }",
  });
}
