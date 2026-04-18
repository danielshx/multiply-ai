"use client";

import { useEffect, useState } from "react";
import { subscribeLeads, subscribeMessages, subscribeLearnings } from "./realtime";

export type LiveEvent = {
  id: string;
  ts: number;
  table: "leads" | "messages" | "learnings";
  type: "INSERT" | "UPDATE" | "DELETE";
  summary: string;
};

/**
 * Subscribes to leads + messages + learnings on Supabase Realtime and
 * returns a rolling buffer of the last N events. Used by the top-bar
 * "Live activity" indicator and the optional Live Feed panel.
 */
export function useLiveActivity(limit = 50) {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    setConnected(true);
    const push = (e: LiveEvent) => setEvents((prev) => [e, ...prev].slice(0, limit));

    const u1 = subscribeLeads((p) => {
      const row = (p.new ?? p.old ?? {}) as { name?: string; stage?: string; company?: string };
      push({
        id: `lead-${Date.now()}-${Math.random()}`,
        ts: Date.now(),
        table: "leads",
        type: p.eventType,
        summary: `${p.eventType === "INSERT" ? "New lead" : "Lead updated"}: ${row.name ?? row.company ?? "unknown"}${row.stage ? ` → ${row.stage}` : ""}`,
      });
    });
    const u2 = subscribeMessages(null, (p) => {
      const row = (p.new ?? {}) as { role?: string; content?: string; channel?: string };
      const text = (row.content ?? "").slice(0, 60);
      push({
        id: `msg-${Date.now()}-${Math.random()}`,
        ts: Date.now(),
        table: "messages",
        type: p.eventType,
        summary: `${row.role === "agent" ? "Agent" : "Lead"} (${row.channel ?? "phone"}): ${text}${text.length === 60 ? "…" : ""}`,
      });
    });
    const u3 = subscribeLearnings((p) => {
      const row = (p.new ?? {}) as { pattern?: string; trigger?: string };
      push({
        id: `learn-${Date.now()}-${Math.random()}`,
        ts: Date.now(),
        table: "learnings",
        type: p.eventType,
        summary: `Learning logged: "${row.pattern ?? "?"}" triggered by "${row.trigger ?? "?"}"`,
      });
    });

    return () => {
      setConnected(false);
      u1();
      u2();
      u3();
    };
  }, [limit]);

  return { events, connected };
}
