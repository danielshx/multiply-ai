import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/us-outreach/sync-all — backfills every non-terminal call by
 * invoking /api/us-outreach/sync/[id] in parallel. Used by the Refresh
 * button on the dashboard.
 */
export async function POST(req: Request) {
  const supabase = getServerSupabase();
  const { data: calls } = await supabase
    .from("us_outreach_calls")
    .select("id")
    .in("status", ["triggered", "live"])
    .order("created_at", { ascending: false })
    .limit(50);

  const ids = (calls ?? []).map((c) => c.id as string);
  const appUrl =
    process.env.MULTIPLY_APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    new URL(req.url).origin;

  const results = await Promise.all(
    ids.map((id) =>
      fetch(`${appUrl}/api/us-outreach/sync/${id}`)
        .then((r) => r.json())
        .catch((e) => ({ ok: false, error: (e as Error).message, id })),
    ),
  );

  return NextResponse.json({ ok: true, synced: ids.length, results });
}

export async function GET(req: Request) {
  return POST(req);
}
