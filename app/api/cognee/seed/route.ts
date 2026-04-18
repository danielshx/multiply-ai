import { NextResponse } from "next/server";
import { cognee } from "@/lib/cognee/client";
import { DEMO_LEARNINGS, DISTRIBUTION } from "@/lib/cognee/seed-data";

export const dynamic = "force-dynamic";

/**
 * POST /api/cognee/seed — ingest the 64-entry learning library into the
 * "multiply" dataset and trigger cognify.
 *
 * Body: { reset?: boolean, dataset?: string }
 *
 * NOTE: This endpoint mutates the graph. UI components that just need stats
 * should call /api/cognee/stats instead — that one does NOT re-ingest.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const reset = body?.reset === true;
  const dataset = body?.dataset ?? "multiply";

  try {
    if (reset) await cognee.forget(dataset).catch(() => null);

    let ingested = 0;
    let failed = 0;
    for (const item of DEMO_LEARNINGS) {
      try {
        await cognee.remember({ text: item.text, dataset, metadata: item.metadata });
        ingested++;
      } catch (err) {
        failed++;
        console.warn(`seed: failed to ingest "${item.text.slice(0, 60)}..."`, (err as Error).message);
      }
    }
    await cognee.cognify(dataset, true).catch((e) => {
      console.warn("cognify warning:", (e as Error).message);
    });

    return NextResponse.json({
      ok: true,
      ingested,
      failed,
      total: DEMO_LEARNINGS.length,
      dataset,
      reset,
      distribution: DISTRIBUTION,
      next: "Cognify running in background. Rich graph ready in ~60-120s.",
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 502 },
    );
  }
}
