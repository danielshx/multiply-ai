"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { getBrowserSupabase } from "./client";

/**
 * Supabase Realtime helpers — subscribe to lead + message + tile + learning
 * changes. Returned function unsubscribes the channel.
 */
export type RealtimeUnsubscribe = () => void;

type ChangePayload = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
  table: string;
};

function subscribeTable(
  table: string,
  onChange: (payload: ChangePayload) => void,
  filter?: string,
): RealtimeUnsubscribe {
  const supabase = getBrowserSupabase();
  const channel: RealtimeChannel = supabase
    .channel(`realtime:${table}:${filter ?? "all"}`)
    .on(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "postgres_changes" as any,
      { event: "*", schema: "public", table, filter },
      (payload: unknown) => {
        const p = payload as {
          eventType: ChangePayload["eventType"];
          new: ChangePayload["new"];
          old: ChangePayload["old"];
          table: string;
        };
        onChange({
          eventType: p.eventType,
          new: p.new,
          old: p.old,
          table: p.table,
        });
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeLeads(onChange: (p: ChangePayload) => void): RealtimeUnsubscribe {
  return subscribeTable("leads", onChange);
}

export function subscribeMessages(
  leadId: string | null,
  onChange: (p: ChangePayload) => void,
): RealtimeUnsubscribe {
  return subscribeTable("messages", onChange, leadId ? `lead_id=eq.${leadId}` : undefined);
}

export function subscribeAgentTiles(
  swarmRunId: string | null,
  onChange: (p: ChangePayload) => void,
): RealtimeUnsubscribe {
  return subscribeTable(
    "agent_tiles",
    onChange,
    swarmRunId ? `swarm_run_id=eq.${swarmRunId}` : undefined,
  );
}

export function subscribeLearnings(onChange: (p: ChangePayload) => void): RealtimeUnsubscribe {
  return subscribeTable("learnings", onChange);
}
