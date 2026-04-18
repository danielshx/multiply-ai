import { NextResponse } from "next/server";
import { cognee } from "@/lib/cognee/client";

export const dynamic = "force-dynamic";

/**
 * POST /api/cognee/recall — debug + dev tool for testing recall queries.
 * Body: { query: string, dataset?: string, topK?: number, sessionId?: string }
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { query, dataset, topK, searchType } = body as {
    query?: string;
    dataset?: string;
    topK?: number;
    searchType?: "GRAPH_COMPLETION" | "RAG_COMPLETION" | "CHUNKS" | "SUMMARIES" | "FEELING_LUCKY";
  };
  if (!query) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }
  try {
    const result = await cognee.recall(query, { dataset, topK, searchType });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
