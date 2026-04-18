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

    sb.from('us_outreach_messages')
      .select('*')
      .eq('call_id', callId)
      .order('ts', { ascending: true })
      .then(({ data }) => {
        if (cancelled) return;
        const rows = data ?? [];
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
          setMessages((prev) => [...prev, row]);
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
