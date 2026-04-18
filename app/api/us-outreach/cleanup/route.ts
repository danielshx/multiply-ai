import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/us-outreach/cleanup — marks any call that's been stuck in
 * "live"/"triggered" for > 5 minutes as "completed" (if it has messages) or
 * "failed" (if not). Run this on a periodic basis or hit it from the UI.
 */
export async function POST() {
  const supabase = getServerSupabase();
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { data: stuck } = await supabase
    .from("us_outreach_calls")
    .select("id, created_at")
    .in("status", ["live", "triggered"])
    .lt("created_at", fiveMinAgo);

  if (!stuck || stuck.length === 0) {
    return NextResponse.json({ ok: true, cleaned: 0 });
  }

  const results: Array<{ id: string; status: string }> = [];
  for (const call of stuck) {
    // Does this call have messages? If yes, treat as completed; else failed.
    const { count } = await supabase
      .from("us_outreach_messages")
      .select("*", { count: "exact", head: true })
      .eq("call_id", call.id);
    const newStatus = (count ?? 0) > 0 ? "completed" : "failed";
    await supabase
      .from("us_outreach_calls")
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
        reason: `auto-resolved after 5 min (${count ?? 0} messages)`,
      })
      .eq("id", call.id);
    results.push({ id: call.id, status: newStatus });
  }

  return NextResponse.json({ ok: true, cleaned: results.length, results });
}

export async function GET() {
  return POST();
}
