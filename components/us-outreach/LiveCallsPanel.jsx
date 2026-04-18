'use client';
import React, { useEffect, useState } from 'react';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { Pill, Dot } from '@/components/multiply/ui';

/**
 * LiveCallsPanel — prominent dashboard section showing currently ringing /
 * live calls and the last thing said on each, refreshed every ~2s via
 * Realtime + server-side sync polling.
 */
const STALE_MS = 3 * 60 * 1000; // 3 min — after this, don't show as "live"

export function LiveCallsPanel({ calls, onOpen }) {
  const now = Date.now();
  const live = calls.filter((c) => {
    if (c.status !== 'live' && c.status !== 'triggered') return false;
    const age = now - new Date(c.created_at ?? 0).getTime();
    return age < STALE_MS;
  });
  if (live.length === 0) return null;

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
        border: '1px solid var(--accent-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 18,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Dot color="accent" pulse size={8} />
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-text)', letterSpacing: -0.1 }}>
            Live calls · {live.length} active
          </h2>
        </div>
        <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--accent-text)', opacity: 0.7, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          updates every 2s
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fit, minmax(${live.length > 3 ? 320 : 420}px, 1fr))`,
          gap: 12,
        }}
      >
        {live.map((c) => (
          <LiveCallCard key={c.id} call={c} onOpen={() => onOpen(c.id)} />
        ))}
      </div>
    </div>
  );
}

function LiveCallCard({ call, onOpen }) {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const sb = getBrowserSupabase();
    let cancelled = false;

    sb.from('us_outreach_messages')
      .select('id, role, content, ts, hr_msg_id')
      .eq('call_id', call.id)
      .limit(200)
      .then(({ data }) => {
        if (cancelled) return;
        const rows = (data ?? [])
          .filter((r) => r.content && !r.content.startsWith('<Thoughts>'))
          .sort((a, b) => new Date(a.ts ?? 0).getTime() - new Date(b.ts ?? 0).getTime());
        setMessages(rows);
      });

    const ch = sb
      .channel(`live:${call.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'us_outreach_messages',
          filter: `call_id=eq.${call.id}`,
        },
        (payload) => {
          const row = payload.new;
          if (!row?.content || row.content.startsWith('<Thoughts>')) return;
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, row].sort(
              (a, b) => new Date(a.ts ?? 0).getTime() - new Date(b.ts ?? 0).getTime(),
            );
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      sb.removeChannel(ch);
    };
  }, [call.id]);

  // Show the last 3 messages so user sees the current conversation flow.
  const tail = messages.slice(-3);
  const latest = tail[tail.length - 1];

  return (
    <button
      onClick={onOpen}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--accent-border)',
        borderRadius: 'var(--radius-md)',
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        textAlign: 'left',
        cursor: 'pointer',
        minHeight: 140,
        boxShadow: 'var(--shadow-xs)',
        transition: 'all 120ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'var(--shadow-xs)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>
            {call.contact_name || 'Friend'}
          </span>
          <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-tertiary)' }}>
            {call.phone_number}
          </span>
        </div>
        <Pill color={call.status === 'live' ? 'info' : 'neutral'} size="sm">
          <Dot color={call.status === 'live' ? 'info' : 'neutral'} pulse size={5} />
          {call.status === 'live' ? 'live' : 'ringing…'}
        </Pill>
      </div>

      <div
        style={{
          flex: 1,
          background: 'var(--bg-subtle)',
          borderRadius: 'var(--radius-sm)',
          padding: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          minHeight: 80,
        }}
      >
        {tail.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontStyle: 'italic', textAlign: 'center', paddingTop: 16 }}>
            {call.status === 'triggered' ? 'Dialing…' : 'Waiting for first words…'}
          </div>
        ) : (
          tail.map((m) => {
            const isAgent = m.role === 'assistant' || m.role === 'agent';
            return (
              <div key={m.id} style={{ display: 'flex', gap: 6, fontSize: 12, lineHeight: 1.4 }}>
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: 'var(--mono)',
                    color: 'var(--text-tertiary)',
                    minWidth: 40,
                    flexShrink: 0,
                  }}
                >
                  {isAgent ? 'Alex' : 'User'}
                </span>
                <span style={{ color: isAgent ? 'var(--text)' : 'var(--accent-text)' }}>
                  {m.content}
                </span>
              </div>
            );
          })
        )}
        {latest && messages.length > tail.length && (
          <div style={{ fontSize: 10, color: 'var(--text-quaternary)', fontFamily: 'var(--mono)', textAlign: 'right' }}>
            +{messages.length - tail.length} earlier
          </div>
        )}
      </div>
    </button>
  );
}
