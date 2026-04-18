'use client';
import { useEffect, useRef, useState } from 'react';
import { getBrowserSupabase } from '@/lib/supabase/client';

/**
 * Subscribes to messages for a single us_outreach call. Returns the in-order
 * list, plus a `connected` flag for the Realtime channel state.
 */
export function useCallMessages(callId) {
  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(false);
  const seenIds = useRef(new Set());

  useEffect(() => {
    if (!callId) {
      setMessages([]);
      seenIds.current = new Set();
      return;
    }

    const sb = getBrowserSupabase();
    let cancelled = false;
    seenIds.current = new Set();
    setMessages([]);

    // Note: .order('ts') was returning 0 rows due to a PostgREST quirk.
    // Fetch without order, then sort in JS.
    sb.from('us_outreach_messages')
      .select('id, call_id, role, content, ts, hr_msg_id')
      .eq('call_id', callId)
      .limit(500)
      .then(({ data }) => {
        if (cancelled) return;
        const rows = (data ?? []).slice().sort((a, b) => {
          const ta = new Date(a.ts ?? 0).getTime();
          const tb = new Date(b.ts ?? 0).getTime();
          return ta - tb;
        });
        rows.forEach((r) => seenIds.current.add(r.id));
        setMessages(rows);
      });

    const ch = sb
      .channel(`realtime:us_outreach_messages:${callId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'us_outreach_messages',
          filter: `call_id=eq.${callId}`,
        },
        (payload) => {
          const row = payload.new;
          if (!row || seenIds.current.has(row.id)) return;
          seenIds.current.add(row.id);
          setMessages((prev) => {
            const next = [...prev, row].sort((a, b) => {
              const ta = new Date(a.ts ?? 0).getTime();
              const tb = new Date(b.ts ?? 0).getTime();
              return ta - tb;
            });
            return next;
          });
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setConnected(true);
      });

    return () => {
      cancelled = true;
      sb.removeChannel(ch);
      setConnected(false);
    };
  }, [callId]);

  return { messages, connected };
}
