import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * POST /api/research/maps/callback
 * HappyRobot calls this when the Research: Google Maps workflow finishes.
 * Parses places_json and upserts into the research_results table.
 *
 * Body (from workflow Return Results node):
 *   { task, search_query, location, total_found, places_json, status }
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const {
    task = "",
    search_query = "",
    location = "",
    total_found = 0,
    places_json = "[]",
    status = "success",
  } = body as Record<string, string>;

  let places: unknown[] = [];
  try {
    places = JSON.parse(places_json);
    if (!Array.isArray(places)) places = [];
  } catch {
    places = [];
  }

  const supabase = getServerSupabase();

  const { error } = await supabase.from("research_results").insert({
    task,
    search_query,
    location,
    total_found: Number(total_found) || places.length,
    places,
    status,
  });

  if (error) {
    console.error("research_results insert failed", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, inserted: places.length });
}

// HappyRobot sometimes sends a GET to verify the endpoint is alive
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "research/maps/callback" });
}
