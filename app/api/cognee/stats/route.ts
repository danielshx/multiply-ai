import { NextResponse } from "next/server";
import { cognee } from "@/lib/cognee/client";
import { DEMO_LEARNINGS, DISTRIBUTION } from "@/lib/cognee/seed-data";

export const dynamic = "force-dynamic";

const COGNEE_TIMEOUT_MS = 3500;

/**
 * GET /api/cognee/stats — read-only stats for the Knowledge Graph header.
 * NEVER re-ingests. Probes cognee for live dataset size with a short timeout,
 * falls back to seed-derived distribution. The `liveTotal` field is the true
 * count in Cognee; `total` stays the seed count for the category breakdown.
 */
export async function GET() {
  const base = {
    total: DEMO_LEARNINGS.length,
    liveTotal: DEMO_LEARNINGS.length,
    distribution: DISTRIBUTION,
    cogneeReachable: false,
    datasetId: null as string | null,
  };

  const withTimeout = <T>(p: Promise<T>, fallback: T): Promise<T> =>
    Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), COGNEE_TIMEOUT_MS))]);

  try {
    const datasetId = await withTimeout<string | null>(cognee.getDatasetId("multiply"), null);
    if (!datasetId) return NextResponse.json(base);

    const liveTotal = await withTimeout<number>(
      cognee.countDataset(datasetId).catch(() => DEMO_LEARNINGS.length),
      DEMO_LEARNINGS.length,
    );

    return NextResponse.json({
      ...base,
      liveTotal,
      cogneeReachable: true,
      datasetId,
    });
  } catch {
    return NextResponse.json(base);
  }
}
