import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

/**
 * POST /api/research/agent/enrich-callback
 *
 * Called once per place from inside the HappyRobot "Research: Google Maps"
 * workflow's enrichment loop. Each loop iteration fetches the place's
 * website, runs an AI Extract for contacts + a refined description, then
 * POSTs the result here. We UPDATE the candidate row matching
 * (agent_name, google_place_id) so the Research tab streams enrichment in
 * via Supabase Realtime UPDATE events.
 *
 * Accepted payload shapes (tolerant to how HR formats the fields):
 *   {
 *     agent: string,
 *     search_query?: string,
 *     google_place_id: string,
 *     place_name?: string,
 *     website?: string,
 *     contacts: array | string (JSON),
 *     contacts_json?: string,
 *     website_summary?: string,
 *     enrichment_error?: string
 *   }
 */

type Contact = {
  name: string | null;
  role: string | null;
  phone: string | null;
  email: string | null;
};

function parseContacts(v: unknown): Contact[] {
  let raw: unknown = v;
  if (typeof raw === "string" && raw.trim()) {
    const cleaned = raw
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/, "")
      .replace(/```\s*$/, "")
      .trim();
    try {
      raw = JSON.parse(cleaned);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  const out: Contact[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const name = typeof r.name === "string" && r.name.trim() ? r.name.trim() : null;
    if (!name) continue;
    out.push({
      name,
      role: typeof r.role === "string" && r.role.trim() ? r.role.trim() : null,
      phone: typeof r.phone === "string" && r.phone.trim() ? r.phone.trim() : null,
      email: typeof r.email === "string" && r.email.trim() ? r.email.trim() : null,
    });
  }
  return out;
}

function pickString(body: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = body[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const agent = pickString(body, "agent", "agent_name");
  const placeId = pickString(body, "google_place_id", "place_id");
  const placeName = pickString(body, "place_name", "name");
  const website = pickString(body, "website", "url");
  const searchQuery = pickString(body, "search_query");
  const websiteSummary = pickString(body, "website_summary", "summary");
  const enrichmentError = pickString(body, "enrichment_error", "error");

  const contacts = parseContacts(body.contacts ?? body.contacts_json);

  console.log("[enrich-callback] received", {
    keys: Object.keys(body),
    agent,
    placeId,
    placeName,
    website,
    searchQuery,
    contacts_count: contacts.length,
    has_summary: !!websiteSummary,
  });

  // Need at least one identifier to find the row.
  if (!placeId && !placeName && !website) {
    return NextResponse.json({
      ok: false,
      reason: "need at least one of google_place_id, place_name, or website",
      received_keys: Object.keys(body),
    });
  }

  const supabase = getServerSupabase();

  const buildQuery = () => {
    let q = supabase
      .from("googlemaps_candidates")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(1);
    if (agent) q = q.eq("agent_name", agent);
    if (searchQuery) q = q.eq("search_query", searchQuery);
    return q;
  };

  // Try by place_id → place_name → website. Each step first with agent+search_query
  // filters (if provided), then falls back to global match by that identifier.
  const attempts: { col: string; val: string }[] = [];
  if (placeId) attempts.push({ col: "google_place_id", val: placeId });
  if (placeName) attempts.push({ col: "place_name", val: placeName });
  if (website) attempts.push({ col: "website", val: website });

  let match: { id: string } | null = null;
  let findErr: unknown = null;

  for (const { col, val } of attempts) {
    const scoped = await buildQuery().eq(col, val).maybeSingle();
    if (scoped.data) {
      match = scoped.data;
      break;
    }
    if (scoped.error) findErr = scoped.error;
    // Fall back to matching just by this identifier, no agent/search_query.
    const broad = await supabase
      .from("googlemaps_candidates")
      .select("id")
      .eq(col, val)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (broad.data) {
      match = broad.data;
      break;
    }
    if (broad.error) findErr = broad.error;
  }

  if (!match) {
    console.error("[enrich-callback] no matching row", {
      agent,
      placeId,
      placeName,
      website,
      searchQuery,
      findErr,
    });
    return NextResponse.json({
      ok: false,
      reason: "no matching candidate row",
      agent,
      google_place_id: placeId,
      place_name: placeName,
      website,
    });
  }

  const hasContent = contacts.length > 0 || websiteSummary;
  const nextStatus = enrichmentError
    ? "failed"
    : hasContent
      ? "enriched"
      : "skipped";

  const { error: updErr } = await supabase
    .from("googlemaps_candidates")
    .update({
      contacts,
      website_summary: websiteSummary,
      enrichment_status: nextStatus,
      enrichment_error: enrichmentError,
      enriched_at: new Date().toISOString(),
    })
    .eq("id", match.id);

  if (updErr) {
    console.error("[enrich-callback] update failed", { id: match.id, updErr });
    return NextResponse.json({
      ok: false,
      id: match.id,
      error: updErr.message,
    });
  }

  return NextResponse.json({
    ok: true,
    id: match.id,
    contacts_count: contacts.length,
    status: nextStatus,
  });
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "research/agent/enrich-callback" });
}
