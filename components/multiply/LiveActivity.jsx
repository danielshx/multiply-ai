'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useLiveActivity } from '@/lib/supabase/useRealtime';
import { Dot } from './ui';

/**
 * Top-bar pill: shows whether Supabase Realtime is wired up and the count
 * of live HR webhook events received this session. Click to expand a
 * dropdown showing the last 8 events.
 */
export function LiveActivityIndicator() {
  const { events, connected } = useLiveActivity(50);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '5px 10px',
          background: events.length > 0 ? 'var(--success-soft)' : 'var(--bg-subtle)',
          border: `1px solid ${events.length > 0 ? 'var(--success-border)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-sm)',
          fontSize: 12,
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          transition: 'all 120ms ease',
        }}
        title={connected ? 'Supabase Realtime connected' : 'Connecting...'}
      >
        <Dot color={connected ? 'success' : 'neutral'} pulse={connected && events.length === 0} size={5} />
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: events.length > 0 ? 'var(--success)' : 'var(--text-tertiary)' }}>
          live · {events.length}
        </span>
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          right: 0,
          width: 380,
          maxHeight: 420,
          overflowY: 'auto',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 500,
          animation: 'slide-in-up 200ms ease',
        }}>
          <div style={{
            padding: '10px 14px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Dot color="success" pulse={connected} size={5} />
              <span style={{ fontSize: 12, fontWeight: 500 }}>Supabase Realtime</span>
            </div>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--mono)' }}>
              {events.length} events
            </span>
          </div>

          {events.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
              <div style={{ marginBottom: 6 }}>Connected · waiting for events.</div>
              <div style={{ fontSize: 11, fontFamily: 'var(--mono)' }}>
                Trigger a HR webhook to /api/hr-webhook<br />
                or end a live call to ingest a learning.
              </div>
            </div>
          ) : (
            <div>
              {events.map((e) => (
                <div key={e.id} style={{
                  padding: '10px 14px',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Dot color={e.table === 'leads' ? 'accent' : e.table === 'messages' ? 'info' : 'purple'} size={4} />
                      <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 1 }}>
                        {e.table} · {e.type}
                      </span>
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--text-quaternary)', fontFamily: 'var(--mono)' }}>
                      {timeAgo(e.ts)}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                    {e.summary}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}
