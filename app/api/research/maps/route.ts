import { NextResponse } from "next/server";

/**
 * POST /api/research/maps
 * Triggers the HappyRobot "Research: Google Maps" workflow.
 * Body: { task: string }
 * The workflow will POST its results back to /api/research/maps/callback.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const task = (body.task as string | undefined)?.trim();

  if (!task) {
    return NextResponse.json({ error: "task is required" }, { status: 400 });
  }

  const apiKey = process.env.HR_MULTIPLY_API_KEY;
  const workflowId = process.env.HR_MAPS_WORKFLOW_ID ?? "019da0cd-77a7-7f1d-8f54-81021f1aced8";
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "https://multiply-git-main-danielshxs-projects.vercel.app";

  const callbackUrl = `${appUrl}/api/research/maps/callback`;

  const hrRes = await fetch(
    `https://platform.eu.happyrobot.ai/api/v2/workflows/${workflowId}/runs`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({ task, callback_url: callbackUrl }),
    },
  );

  if (!hrRes.ok) {
    const text = await hrRes.text().catch(() => "");
    return NextResponse.json(
      { error: "Failed to start workflow", detail: text },
      { status: 502 },
    );
  }

  const run = await hrRes.json().catch(() => ({}));
  return NextResponse.json({ status: "started", run_id: run.id ?? run.run_id ?? null, task, callback_url: callbackUrl });
}
