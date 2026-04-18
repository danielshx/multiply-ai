import { NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { cognee } from "@/lib/cognee/client";

/**
 * POST /api/watcher/tick — called by the Watcher Cron loop. Returns leads
 * that have changed since the previous tick from TWO sources:
 *
 *   1. `leads` + `messages` (manual / seeded leads with profiles)
 *   2. `googlemaps_candidates` (Google Maps research output, rich business
 *      info: rating, address, website, hours, etc.)
 *
 * Each change is enriched with Cognee context (best-effort, swallowed on
 * error so a slow Cognee never blocks a tick).
 *
 * Body:
 *   { since?: string,                    // ISO 8601, default = now − 70s
 *     include_candidates?: boolean,      // default true
 *     include_leads?: boolean,           // default true
 *     limit?: number }                   // default 50, total cap
 */
type Lead = {
  id: string;
  created_at: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  interest: string | null;
  stage: string | null;
  current_mode: string | null;
  metadata: Record<string, unknown> | null;
  research: Record<string, unknown> | null;
};

type Message = {
  id: string;
  lead_id: string;
  ts: string;
  role: string | null;
  content: string | null;
  channel: string | null;
};

type Candidate = {
  id: string;
  created_at: string;
  agent_name: string | null;
  topic: string | null;
  search_query: string | null;
  total_found: number | null;
  place_name: string | null;
  phone_number: string | null;
  company_type: string | null;
  address: string | null;
  website: string | null;
  rating: number | null;
  review_count: number | null;
  hours: string | null;
  description: string | null;
  google_place_id: string | null;
  raw: Record<string, unknown> | null;
};

type UsOutreachCall = {
  id: string;
  contact_name: string | null;
  phone_number: string;
  status: string | null;
  disposition: string | null;
  hr_run_id: string | null;
  hr_session_id: string | null;
  reason: string | null;
  language: string | null;
  country_code: string | null;
  objection_tags: string[] | null;
  duration_sec: number | null;
  total_duration_sec: number | null;
  created_at: string;
  updated_at: string | null;
  ended_at: string | null;
};

type UsOutreachLog = {
  id: string;
  ts: string;
  level: string | null;
  source: string | null;
  event: string | null;
  detail: Record<string, unknown> | null;
  call_id: string | null;
};

type BusinessContext = {
  source: "manual" | "googlemaps" | "us_outreach";
  address?: string | null;
  website?: string | null;
  hours?: string | null;
  rating?: number | null;
  review_count?: number | null;
  description?: string | null;
  company_type?: string | null;
  topic?: string | null;
  agent_name?: string | null;
  google_place_id?: string | null;
  us_outreach_dispatchable?: boolean;
  last_log_level?: string | null;
  last_log_event?: string | null;
  last_log_source?: string | null;
};

type ChangeItem = {
  lead_id: string;
  source: "manual" | "googlemaps" | "us_outreach";
  name: string;
  company: string;
  phone_number: string;
  email: string;
  customer_goal: string;
  current_time: string;
  current_mode: "cold" | "warm" | "hot";
  stage: string;
  reason_changed: string;
  business_context: BusinessContext;
  recent_messages: Pick<Message, "ts" | "role" | "channel" | "content">[];
  cognee_context: string;
};

const DEFAULT_LOOKBACK_MS = 70_000;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    since?: string;
    include_candidates?: boolean;
    include_leads?: boolean;
    include_us_outreach?: boolean;
    with_cognee?: boolean;
    limit?: number;
  };
  const now = new Date();
  const since = body.since
    ? new Date(body.since)
    : new Date(now.getTime() - DEFAULT_LOOKBACK_MS);
  const sinceISO = since.toISOString();
  const nextSinceISO = now.toISOString();
  const includeCandidates = body.include_candidates !== false;
  const includeLeads = body.include_leads !== false;
  const includeUsOutreach = body.include_us_outreach !== false;
  // Cognee recall is slow (1-3s per lead) — opt-in only. The watcher
  // decision rule already works fine with stage + heat + reason_changed.
  const withCognee = body.with_cognee === true;
  const totalLimit = Math.max(1, Math.min(body.limit ?? 50000, 50000));

  const supabase = getServerSupabase();
  const changes: ChangeItem[] = [];

  if (includeLeads) {
    const leadsChanges = await readLeadsSource(supabase, sinceISO, nextSinceISO, withCognee);
    changes.push(...leadsChanges);
  }

  if (includeCandidates) {
    const candChanges = await readCandidatesSource(supabase, sinceISO, nextSinceISO);
    changes.push(...candChanges);
  }

  if (includeUsOutreach) {
    const usChanges = await readUsOutreachSource(supabase, sinceISO, nextSinceISO);
    changes.push(...usChanges);
  }

  changes.sort(
    (a, b) =>
      new Date(b.current_time).getTime() - new Date(a.current_time).getTime(),
  );
  const trimmed = changes.slice(0, totalLimit);

  return NextResponse.json({
    ok: true,
    since: sinceISO,
    next_since: nextSinceISO,
    total: changes.length,
    returned: trimmed.length,
    sources: {
      leads: changes.filter((c) => c.source === "manual").length,
      googlemaps: changes.filter((c) => c.source === "googlemaps").length,
      us_outreach: changes.filter((c) => c.source === "us_outreach").length,
    },
    changes: trimmed,
  });
}

async function readLeadsSource(
  supabase: ReturnType<typeof getServerSupabase>,
  sinceISO: string,
  nowISO: string,
  withCognee: boolean,
): Promise<ChangeItem[]> {
  // Exclude leads that originated from googlemaps_candidates — those are
  // owned by the candidates source and would otherwise be triggered twice.
  const [newLeadsRes, newMessagesRes] = await Promise.all([
    supabase
      .from("leads")
      .select("*")
      .gte("created_at", sinceISO)
      .or("source.is.null,and(source.neq.googlemaps_candidates,source.neq.us_outreach_calls)")
      .limit(200),
    supabase.from("messages").select("*").gte("ts", sinceISO).limit(500),
  ]);

  if (newLeadsRes.error || newMessagesRes.error) {
    console.warn(
      `[tick] leads source error: ${newLeadsRes.error?.message ?? newMessagesRes.error?.message}`,
    );
    return [];
  }

  const newLeads = (newLeadsRes.data ?? []) as Lead[];
  const newMessages = (newMessagesRes.data ?? []) as Message[];
  const leadIdsFromMsgs = new Set(newMessages.map((m) => m.lead_id));
  const leadIdsFromNew = new Set(newLeads.map((l) => l.id));
  const all = new Set<string>([...leadIdsFromNew, ...leadIdsFromMsgs]);
  if (all.size === 0) return [];

  const leadsById = new Map<string, Lead>();
  for (const l of newLeads) leadsById.set(l.id, l);
  const missing = Array.from(all).filter((id) => !leadsById.has(id));
  if (missing.length > 0) {
    const { data } = await supabase.from("leads").select("*").in("id", missing);
    for (const l of (data ?? []) as Lead[]) leadsById.set(l.id, l);
  }

  const lastFiveMsgsByLead = new Map<string, Message[]>();
  {
    const ids = Array.from(all);
    const { data: recent } = await supabase
      .from("messages")
      .select("*")
      .in("lead_id", ids)
      .order("ts", { ascending: false })
      .limit(ids.length * 5);
    for (const m of (recent ?? []) as Message[]) {
      const arr = lastFiveMsgsByLead.get(m.lead_id) ?? [];
      if (arr.length < 5) {
        arr.push(m);
        lastFiveMsgsByLead.set(m.lead_id, arr);
      }
    }
  }

  return Promise.all(
    Array.from(all).map(async (leadId) => {
      const lead = leadsById.get(leadId);
      const recent = (lastFiveMsgsByLead.get(leadId) ?? []).reverse();
      const company = readMetaString(lead?.metadata, "company") ?? "";
      const customerGoal =
        lead?.interest ??
        readMetaString(lead?.metadata, "customer_goal") ??
        "";
      const reason = leadIdsFromNew.has(leadId) ? "new_lead" : "new_message";

      let cogneeContext = "";
      if (withCognee) {
        try {
          const r = await cognee.recall(
            `Recent interactions and learnings for ${lead?.name ?? "this lead"} at ${company || "their company"}.`,
            { dataset: "multiply", topK: 5, searchType: "GRAPH_COMPLETION" },
          );
          cogneeContext = r.results
            .map((h) => h.text ?? "")
            .filter(Boolean)
            .slice(0, 5)
            .join("\n---\n")
            .slice(0, 3000);
        } catch (err) {
          cogneeContext = `[cognee error: ${(err as Error).message}]`;
        }
      }

      const change: ChangeItem = {
        lead_id: leadId,
        source: "manual",
        name: lead?.name ?? "",
        company,
        phone_number: lead?.phone ?? "",
        email: lead?.email ?? "",
        customer_goal: customerGoal,
        current_time: nowISO,
        current_mode: (lead?.current_mode ?? "cold") as "cold" | "warm" | "hot",
        stage: lead?.stage ?? "new",
        reason_changed: reason,
        business_context: { source: "manual" },
        recent_messages: recent.map((m) => ({
          ts: m.ts,
          role: m.role,
          channel: m.channel,
          content: (m.content ?? "").slice(0, 500),
        })),
        cognee_context: cogneeContext,
      };
      return change;
    }),
  );
}

async function readCandidatesSource(
  supabase: ReturnType<typeof getServerSupabase>,
  sinceISO: string,
  nowISO: string,
): Promise<ChangeItem[]> {
  const { data, error } = await supabase
    .from("googlemaps_candidates")
    .select("*")
    .gte("created_at", sinceISO)
    .order("rating", { ascending: false, nullsFirst: false })
    .limit(200);

  if (error) {
    console.warn(`[tick] candidates source error: ${error.message}`);
    return [];
  }
  const rows = (data ?? []) as Candidate[];
  if (rows.length === 0) return [];

  // Upsert each candidate into the `leads` table so the Live Monitor sees
  // them as cards. The lead's id mirrors the candidate id (deterministic).
  // Best-effort: failures are swallowed so we still emit ChangeItems even
  // if the leads table can't take them.
  await syncCandidatesToLeads(supabase, rows);

  const enriched: ChangeItem[] = rows.map((row) => {
    const place = (row.place_name ?? "").trim() || "(unknown place)";
    const phone = normalizePhone(row.phone_number);
    const ratingHeat = ratingToHeat(row.rating);

    const goalParts: string[] = [];
    if (row.topic) goalParts.push(`topic: ${row.topic}`);
    if (row.company_type) goalParts.push(`type: ${row.company_type}`);
    if (row.rating != null)
      goalParts.push(`rating: ${row.rating}/5 (${row.review_count ?? 0} reviews)`);
    if (row.address) goalParts.push(`addr: ${row.address}`);
    if (row.hours) goalParts.push(`hours: ${row.hours}`);
    const customerGoal = goalParts.join(" | ").slice(0, 500) || "outbound from googlemaps_candidates";

    return {
      lead_id: row.id,
      source: "googlemaps",
      name: `Manager at ${place}`,
      company: place,
      phone_number: phone,
      email: "",
      customer_goal: customerGoal,
      current_time: nowISO,
      current_mode: ratingHeat,
      stage: "new",
      reason_changed: "new_googlemaps_candidate",
      business_context: {
        source: "googlemaps",
        address: row.address,
        website: row.website,
        hours: row.hours,
        rating: row.rating,
        review_count: row.review_count,
        description: row.description,
        company_type: row.company_type,
        topic: row.topic,
        agent_name: row.agent_name,
        google_place_id: row.google_place_id,
      },
      recent_messages: [],
      // Skip Cognee recall for candidates (60 sequential calls would block
      // the tick for ~60s); future iteration can fan out in parallel.
      cognee_context: "",
    };
  });

  return enriched;
}

async function syncCandidatesToLeads(
  supabase: ReturnType<typeof getServerSupabase>,
  rows: Candidate[],
): Promise<void> {
  if (rows.length === 0) return;
  const payload = rows.map((row) => {
    const place = (row.place_name ?? "").trim() || "(unknown place)";
    const phone = normalizePhone(row.phone_number);
    const ratingHeat = ratingToHeat(row.rating);
    const goalParts: string[] = [];
    if (row.company_type) goalParts.push(row.company_type);
    if (row.address) goalParts.push(row.address.split(",")[0]?.trim());
    if (row.rating != null) goalParts.push(`${row.rating}/5`);
    return {
      id: row.id,
      name: `Manager at ${place}`,
      phone,
      email: null,
      interest: goalParts.filter(Boolean).join(" · ").slice(0, 240),
      stage: "new",
      current_mode: ratingHeat,
      source: "googlemaps_candidates",
      metadata: {
        company: place,
        role: row.company_type ?? "business",
        rating: row.rating,
        review_count: row.review_count,
        address: row.address,
        website: row.website,
        hours: row.hours,
        topic: row.topic,
        google_place_id: row.google_place_id,
        candidate_synced_at: new Date().toISOString(),
      },
    };
  });
  const { error } = await supabase
    .from("leads")
    .upsert(payload, { onConflict: "id", ignoreDuplicates: false });
  if (error) {
    console.warn(`[tick] candidate→leads upsert failed: ${error.message}`);
  }
}

async function readUsOutreachSource(
  supabase: ReturnType<typeof getServerSupabase>,
  sinceISO: string,
  nowISO: string,
): Promise<ChangeItem[]> {
  // Pull changes from BOTH us_outreach tables:
  // - calls that were created/updated/ended in the window
  // - logs written in the same window (mapped back to call rows)
  // Supabase/PostgREST caps single queries at 1000 rows by default — paginate
  // both fetches so we get the full us_outreach_calls table even at scale.
  const [calls, logsRaw] = await Promise.all([
    fetchAllPaginated<UsOutreachCall>(supabase, (q) =>
      q
        .from("us_outreach_calls")
        .select("*")
        .or(`created_at.gte.${sinceISO},updated_at.gte.${sinceISO},ended_at.gte.${sinceISO}`)
        .order("updated_at", { ascending: false }),
    ),
    fetchAllPaginated<UsOutreachLog>(supabase, (q) =>
      q
        .from("us_outreach_logs")
        .select("*")
        .gte("ts", sinceISO)
        .not("call_id", "is", null)
        .order("ts", { ascending: false }),
    ),
  ]);

  const logs = logsRaw.filter(
    (l): l is UsOutreachLog & { call_id: string } => typeof l.call_id === "string",
  );

  const callsById = new Map<string, UsOutreachCall>();
  for (const row of calls) callsById.set(row.id, row);

  const callIdsFromLogs = Array.from(new Set(logs.map((l) => l.call_id)));
  const missingCallIds = callIdsFromLogs.filter((id) => !callsById.has(id));
  if (missingCallIds.length > 0) {
    const { data: extra } = await supabase
      .from("us_outreach_calls")
      .select("*")
      .in("id", missingCallIds)
      .limit(50000);
    for (const row of (extra ?? []) as UsOutreachCall[]) callsById.set(row.id, row);
  }

  if (callsById.size === 0) return [];

  const logsByCallId = new Map<string, UsOutreachLog[]>();
  for (const log of logs) {
    const arr = logsByCallId.get(log.call_id) ?? [];
    if (arr.length < 5) {
      arr.push(log);
      logsByCallId.set(log.call_id, arr);
    }
  }

  const rows = Array.from(callsById.values()).sort(
    (a, b) =>
      new Date(usOutreachChangedAt(b)).getTime() -
      new Date(usOutreachChangedAt(a)).getTime(),
  );

  await syncUsOutreachToLeads(supabase, rows, logsByCallId);

  return rows.map((row) => {
    const callLogs = logsByCallId.get(row.id) ?? [];
    const latestLog = callLogs[0];
    const dispatchable = isUsOutreachDispatchable(row, latestLog);
    const phone = (row.phone_number ?? "").trim();
    const heat = usOutreachHeat(row);
    const goalParts: string[] = [];
    if (row.language) goalParts.push(`lang=${row.language}`);
    if (row.country_code) goalParts.push(`country=${row.country_code}`);
    if (row.disposition) goalParts.push(`prev disposition=${row.disposition}`);
    if (row.objection_tags?.length) goalParts.push(`objections=${row.objection_tags.join(",")}`);
    if (latestLog?.event) {
      goalParts.push(
        `last_log=${latestLog.level ?? "info"}:${latestLog.event}`,
      );
    }
    const latestError = latestLog?.detail?.error;
    if (typeof latestError === "string" && latestError) {
      goalParts.push(`err=${latestError.slice(0, 120)}`);
    }
    const customerGoal =
      goalParts.join(" | ").slice(0, 500) || "us_outreach call update";
    const reason = usOutreachReasonChanged(row, latestLog, sinceISO);

    return {
      lead_id: row.id,
      source: "us_outreach",
      name: row.contact_name ?? `Contact ${phone}`,
      company: "(US Outreach)",
      phone_number: phone,
      email: "",
      customer_goal: customerGoal,
      current_time: nowISO,
      current_mode: heat,
      stage: row.status ?? "new",
      reason_changed: reason,
      business_context: {
        source: "us_outreach",
        topic: "Paid Online Writing Jobs",
        company_type: "us_cold_call",
        agent_name: "us_outreach",
        us_outreach_dispatchable: dispatchable,
        last_log_level: latestLog?.level ?? null,
        last_log_event: latestLog?.event ?? null,
        last_log_source: latestLog?.source ?? null,
      },
      recent_messages: callLogs.slice(0, 5).reverse().map((log) => ({
        ts: log.ts,
        role: log.level,
        channel: `us_outreach_log:${log.source ?? "unknown"}`,
        content: `[${log.event ?? "event"}] ${JSON.stringify(log.detail ?? {}).slice(0, 500)}`,
      })),
      cognee_context: "",
    };
  });
}

async function syncUsOutreachToLeads(
  supabase: ReturnType<typeof getServerSupabase>,
  rows: UsOutreachCall[],
  logsByCallId: Map<string, UsOutreachLog[]>,
): Promise<void> {
  if (rows.length === 0) return;
  const payload = rows.map((row) => {
    const heat = usOutreachHeat(row);
    const latestLog = logsByCallId.get(row.id)?.[0];
    const dispatchable = isUsOutreachDispatchable(row, latestLog);
    return {
      id: row.id,
      name: row.contact_name ?? `Contact ${row.phone_number}`,
      phone: row.phone_number,
      email: null,
      interest:
        `US cold call · status=${row.status ?? "?"}` +
        (row.disposition ? ` · disposition=${row.disposition}` : ""),
      stage: row.status === "live" ? "engaged" : "new",
      current_mode: heat,
      source: "us_outreach_calls",
      metadata: {
        company: "(US Outreach)",
        role: "Cold lead",
        country_code: row.country_code,
        language: row.language,
        objection_tags: row.objection_tags,
        prior_hr_run_id: row.hr_run_id,
        dispatchable,
        latest_log_level: latestLog?.level ?? null,
        latest_log_event: latestLog?.event ?? null,
        latest_log_source: latestLog?.source ?? null,
        synced_at: new Date().toISOString(),
      },
    };
  });
  const { error } = await supabase
    .from("leads")
    .upsert(payload, { onConflict: "id", ignoreDuplicates: false });
  if (error) {
    console.warn(`[tick] us_outreach→leads upsert failed: ${error.message}`);
  }
}

function usOutreachHeat(row: UsOutreachCall): "cold" | "warm" | "hot" {
  // Disposition is the strongest signal; status is the runtime state.
  const d = (row.disposition ?? "").toLowerCase();
  if (d.includes("interested") || d.includes("booked") || d.includes("warm")) return "hot";
  if (d.includes("callback") || d.includes("voicemail")) return "warm";
  if (row.status === "live" || row.status === "ringing") return "warm";
  return "cold";
}

function usOutreachChangedAt(row: UsOutreachCall): string {
  return row.ended_at ?? row.updated_at ?? row.created_at;
}

function isUsOutreachDispatchable(
  row: UsOutreachCall,
  latestLog: UsOutreachLog | undefined,
): boolean {
  if (row.hr_run_id) return false;
  const status = (row.status ?? "").toLowerCase();
  if (US_OUTREACH_TERMINAL_STATUSES.has(status)) return false;
  const event = (latestLog?.event ?? "").toLowerCase();
  if (event.includes("canceled") || event.includes("closed")) return false;
  return true;
}

function usOutreachReasonChanged(
  row: UsOutreachCall,
  latestLog: UsOutreachLog | undefined,
  sinceISO: string,
): string {
  if (isOnOrAfter(row.created_at, sinceISO)) return "new_us_outreach_pending";
  if (latestLog?.event) {
    const lvl = slugifyReasonToken(latestLog.level ?? "info");
    const ev = slugifyReasonToken(latestLog.event);
    return `us_log_${lvl}_${ev}`;
  }
  if (row.ended_at && isOnOrAfter(row.ended_at, sinceISO)) {
    return "us_outreach_ended";
  }
  return "us_outreach_updated";
}

function isOnOrAfter(ts: string, sinceISO: string): boolean {
  return new Date(ts).getTime() >= new Date(sinceISO).getTime();
}

function slugifyReasonToken(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

const US_OUTREACH_TERMINAL_STATUSES = new Set([
  "completed",
  "closed",
  "canceled",
  "failed",
  "invalid",
  "not_interested",
  "interested_no_sms",
  "voicemail",
  "callback",
]);

/**
 * Pull every row matching the query in 1000-row pages — works around
 * PostgREST's default db.max_rows cap. Stops when a page returns fewer
 * than PAGE_SIZE rows or when we hit the safety ceiling.
 */
async function fetchAllPaginated<T>(
  supabase: ReturnType<typeof getServerSupabase>,
  build: (sb: ReturnType<typeof getServerSupabase>) => {
    range: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;
  },
  pageSize = 1000,
  safetyCeiling = 50000,
): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  while (from < safetyCeiling) {
    const to = from + pageSize - 1;
    const { data, error } = await build(supabase).range(from, to);
    if (error) {
      console.warn(`[tick] paginated fetch error at offset ${from}: ${error.message}`);
      break;
    }
    const batch = (data ?? []) as T[];
    out.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

function ratingToHeat(rating: number | null): "cold" | "warm" | "hot" {
  if (rating == null) return "warm";
  if (rating >= 4.0) return "hot";
  if (rating >= 3.0) return "warm";
  return "cold";
}

function normalizePhone(raw: string | null): string {
  if (!raw) return "";
  // Drop spaces but keep the leading '+' so HR's outbound voice agent accepts it.
  return raw.replace(/\s+/g, "").replace(/[^\d+]/g, "");
}

function readMetaString(
  meta: Record<string, unknown> | null | undefined,
  key: string,
): string | undefined {
  if (!meta) return undefined;
  const v = meta[key];
  return typeof v === "string" ? v : undefined;
}
