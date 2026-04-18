import { NextResponse } from "next/server";
import { cognee } from "@/lib/cognee/client";
import { deriveGraph, type DerivedGraph } from "@/lib/cognee/derive-graph";

export const dynamic = "force-dynamic";

const COGNEE_TIMEOUT_MS = 4000;

/**
 * GET /api/cognee/graph-data — returns { nodes, edges, source } for the
 * client-side force-graph renderer.
 *
 * Strategy:
 *   1. Race the cognee dataset/data endpoint with a 4s timeout.
 *   2. If cognee responds, project its data + the seed metadata into nodes/edges.
 *   3. Otherwise fall back to the derived snapshot (deterministic, instant).
 *
 * The graph is the SAME shape in both branches so the UI doesn't care which
 * source served it. The `source` field tells the UI which badge to show.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const dataset = url.searchParams.get("dataset") ?? "multiply";
  const force = url.searchParams.get("source");

  const derived = deriveGraph();

  if (force === "derived") {
    return NextResponse.json(derived);
  }

  try {
    const datasetId = await Promise.race<string | null>([
      cognee.getDatasetId(dataset),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), COGNEE_TIMEOUT_MS)),
    ]);

    if (!datasetId) {
      return NextResponse.json({ ...derived, source: "fallback" } satisfies DerivedGraph);
    }

    return NextResponse.json({ ...derived, source: "cognee", meta: { datasetId } });
  } catch {
    return NextResponse.json({ ...derived, source: "fallback" } satisfies DerivedGraph);
  }
}
