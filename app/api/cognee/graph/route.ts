import { NextResponse } from "next/server";
import { cognee } from "@/lib/cognee/client";

export const dynamic = "force-dynamic";

/**
 * GET /api/cognee/graph — proxies cognee's knowledge graph for the UI tab.
 * Returns { nodes, edges } shaped for the SVG renderer in KnowledgeGraph.jsx.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const dataset = url.searchParams.get("dataset") ?? "multiply";
  try {
    const graph = await cognee.graph(dataset);
    return NextResponse.json({ graph: graph ?? { nodes: [], edges: [] } });
  } catch (err) {
    return NextResponse.json(
      { graph: { nodes: [], edges: [] }, error: (err as Error).message },
      { status: 200 },
    );
  }
}
