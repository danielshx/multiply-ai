import { NextResponse } from "next/server";
import { cognee } from "@/lib/cognee/client";

export const dynamic = "force-dynamic";

/**
 * GET /api/cognee/graph — proxies cognee cloud's visualize endpoint.
 * Returns the dataset UUID so the UI can build its iframe URL,
 * plus the HTML for srcDoc-style embedding (no API key in DOM).
 *
 *   ?dataset=multiply         (default)
 *   ?format=html              → returns raw HTML for iframe srcDoc
 *   ?format=meta              → returns { datasetId } only (UI builds proxy URL)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const dataset = url.searchParams.get("dataset") ?? "multiply";
  const format = url.searchParams.get("format") ?? "meta";
  try {
    const datasetId = await cognee.getDatasetId(dataset);
    if (!datasetId) {
      return NextResponse.json({ datasetId: null, message: "dataset not found — seed first" });
    }
    if (format === "html") {
      const html = await cognee.visualizeHtml(datasetId);
      return new NextResponse(html, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
    return NextResponse.json({ datasetId, dataset });
  } catch (err) {
    return NextResponse.json(
      { datasetId: null, error: (err as Error).message },
      { status: 200 },
    );
  }
}
