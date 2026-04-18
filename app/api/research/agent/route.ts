import { NextResponse } from "next/server";

/**
 * POST /api/research/agent
 * Kicks off the HappyRobot Research Agent webhook.
 * Body: { topic: string, agent: string }
 * HR posts enriched Google Maps results back to /api/research/agent/callback
 * (the callback URL is hardcoded inside the HR workflow's Return Results node).
 */
const HR_HOOK_URL =
  process.env.HR_RESEARCH_AGENT_HOOK_URL ??
  "https://workflows.platform.eu.happyrobot.ai/hooks/a7obz47xa3za";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const topic = (body.topic as string | undefined)?.trim();
  const agent = (body.agent as string | undefined)?.trim();

  if (!topic || !agent) {
    return NextResponse.json(
      { error: "topic and agent are required" },
      { status: 400 },
    );
  }

  const hrRes = await fetch(HR_HOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic, agent }),
  });

  if (!hrRes.ok) {
    const detail = await hrRes.text().catch(() => "");
    return NextResponse.json(
      { error: "HR webhook failed", status: hrRes.status, detail },
      { status: 502 },
    );
  }

  const raw = await hrRes.text().catch(() => "");
  let payload: unknown = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = raw;
  }

  return NextResponse.json({
    ok: true,
    topic,
    agent,
    hr_response: payload,
  });
}
