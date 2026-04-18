import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * POST /api/research/agent/callback
 * Receives results from the HappyRobot Research Agent workflow and inserts
 * each place into googlemaps_candidates.
 *
 * Tolerant to multiple payload shapes HR can emit:
 *   { topic, agent, candidates: [ ... ] }
 *   { topic, agent, places: [ ... ] }
 *   { topic, agent, places_json: "[...]" }     // stringified JSON array
 *   { topic, agent, places_json: [ ... ] }     // already-parsed array
 *   { topic, agent, places_json: { ... } }     // single object
 *   { topic, agent, ...single_candidate_fields }
 *
 * Always returns 200 so the HR workflow run is not marked as a schema error;
 * failure reasons are surfaced in the JSON body (ok: false).
 */
type Candidate = Record<string, unknown>;

function parseCandidates(body: Record<string, unknown>): Candidate[] {
  if (Array.isArray(body.candidates)) return body.candidates as Candidate[];
  if (Array.isArray(body.places)) return body.places as Candidate[];
  if (Array.isArray(body.local_results)) return body.local_results as Candidate[];

  const pj = body.places_json;
  if (Array.isArray(pj)) return pj as Candidate[];
  if (pj && typeof pj === "object") return [pj as Candidate];
  if (typeof pj === "string" && pj.trim()) {
    const cleaned = pj
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/, "")
      .replace(/```\s*$/, "")
      .trim();
    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) return parsed as Candidate[];
      if (parsed && typeof parsed === "object") return [parsed as Candidate];
    } catch {
      /* fall through */
    }
  }

  if (
    body.place_name ||
    body.name ||
    body.phone_number ||
    body.phone ||
    body.formatted_address ||
    body.address
  ) {
    return [body as Candidate];
  }

  return [];
}

function pickString(c: Candidate, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = c[k];
    if (typeof v === "string" && v.trim()) return v;
    if (typeof v === "number") return String(v);
  }
  return null;
}

function pickNumber(c: Candidate, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = c[k];
    if (v === null || v === undefined || v === "") continue;
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function pickInt(c: Candidate, ...keys: string[]): number | null {
  const n = pickNumber(c, ...keys);
  return n === null ? null : Math.trunc(n);
}

function normalize(
  c: Candidate,
  topic: string,
  agent: string,
  searchQuery: string | null,
  totalFound: number | null,
) {
  return {
    agent_name: agent || null,
    topic: topic || null,
    search_query: searchQuery,
    total_found: totalFound,
    place_name: pickString(c, "place_name", "name", "title"),
    phone_number: pickString(c, "phone_number", "phone", "international_phone_number"),
    company_type: pickString(c, "company_type", "category", "type", "types"),
    address: pickString(c, "address", "formatted_address", "vicinity"),
    website: pickString(c, "website", "url"),
    rating: pickNumber(c, "rating"),
    review_count: pickInt(c, "review_count", "reviews_count", "user_ratings_total", "reviews"),
    hours: pickString(c, "hours", "opening_hours"),
    description: pickString(c, "description", "snippet", "about"),
    google_place_id: pickString(c, "google_place_id", "place_id", "google_maps_url"),
    raw: c && typeof c === "object" ? c : { value: c },
  };
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const topic = typeof body.topic === "string" ? body.topic : "";
  const agent = typeof body.agent === "string" ? body.agent : "";
  const searchQuery =
    typeof body.search_query === "string" && body.search_query.trim()
      ? body.search_query
      : null;
  const totalFoundRaw = body.total_found;
  const totalFoundNum =
    typeof totalFoundRaw === "number"
      ? totalFoundRaw
      : typeof totalFoundRaw === "string"
        ? Number(totalFoundRaw)
        : NaN;
  const totalFound = Number.isFinite(totalFoundNum) ? Math.trunc(totalFoundNum) : null;

  const candidates = parseCandidates(body);

  console.log("[research/agent/callback] received", {
    keys: Object.keys(body),
    topic,
    agent,
    search_query: searchQuery,
    total_found: totalFound,
    candidate_count: candidates.length,
  });

  const supabase = getServerSupabase();

  if (candidates.length === 0) {
    // Store a single debug row so nothing gets lost, still return 200.
    const debugRow = {
      agent_name: agent || null,
      topic: topic || null,
      search_query: searchQuery,
      total_found: totalFound,
      place_name: null,
      phone_number: null,
      company_type: null,
      address: null,
      website: null,
      rating: null,
      review_count: null,
      hours: null,
      description: "debug: no candidates parsed from payload",
      google_place_id: null,
      raw: body,
    };
    const { error: debugErr } = await supabase
      .from("googlemaps_candidates")
      .insert(debugRow);
    if (debugErr) console.error("debug insert failed", debugErr);
    return NextResponse.json({
      ok: false,
      inserted: 0,
      reason: "no candidates found in payload",
      received_keys: Object.keys(body),
    });
  }

  const rows = candidates.map((c) => normalize(c, topic, agent, searchQuery, totalFound));

  const { error } = await supabase.from("googlemaps_candidates").insert(rows);

  if (error) {
    console.error("googlemaps_candidates insert failed", error);
    return NextResponse.json({
      ok: false,
      inserted: 0,
      error: error.message,
      hint: error.hint ?? null,
      code: error.code ?? null,
    });
  }

  return NextResponse.json({ ok: true, inserted: rows.length });
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "research/agent/callback" });
}
