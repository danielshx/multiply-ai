import { NextResponse } from "next/server";
import { cognee } from "@/lib/cognee/client";
import { DEMO_LEARNINGS, DISTRIBUTION } from "@/lib/cognee/seed-data";

export const dynamic = "force-dynamic";

const COGNEE_TIMEOUT_MS = 3000;

/**
 * GET /api/cognee/stats — read-only stats for the Knowledge Graph header.
 * NEVER re-ingests. Probes cognee for live state with a short timeout, then
 * falls back to the seed-derived distribution.
 */
export async function GET() {
  const base = {
    total: DEMO_LEARNINGS.length,
    distribution: DISTRIBUTION,
    cogneeReachable: false,
    datasetId: null as string | null,
  };

  try {
    const datasetId = await Promise.race<string | null>([
      cognee.getDatasetId("multiply"),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), COGNEE_TIMEOUT_MS)),
    ]);
    return NextResponse.json({ ...base, cogneeReachable: !!datasetId, datasetId });
  } catch {
    return NextResponse.json(base);
  }
}
