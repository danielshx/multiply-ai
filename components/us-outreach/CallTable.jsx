'use client';
import React from 'react';
import { Panel, Pill, Dot, IconChevronRight } from '@/components/multiply/ui';

const STATUS_TONE = {
  triggered: { color: 'neutral', label: 'queued', dot: 'neutral' },
  live: { color: 'info', label: 'live', dot: 'info' },
  completed: { color: 'success', label: 'completed', dot: 'success' },
  failed: { color: 'danger', label: 'failed', dot: 'danger' },
};

const DISPOSITION_TONE = {
  closed: { color: 'success', label: 'closed · sms ✓' },
  interested_no_sms: { color: 'accent', label: 'interested' },
  callback: { color: 'warning', label: 'callback' },
  not_interested: { color: 'outline', label: 'not interested' },
  voicemail: { color: 'neutral', label: 'voicemail' },
  invalid: { color: 'danger', label: 'invalid' },
};

function fmtPhone(p) {
  if (!p) return '';
  const m = p.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  if (m) return `+1 ${m[1]} ${m[2]} ${m[3]}`;
  return p;
}

function fmtDuration(sec) {
  if (!sec) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function fmtAgo(ts) {
  if (!ts) return '';
  const ms = Date.now() - new Date(ts).getTime();
  if (ms < 60_000) return `${Math.max(1, Math.floor(ms / 1000))}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  return `${Math.floor(ms / 3_600_000)}h ago`;
}

export function CallTable({ calls, loading, commission, messageCounts = {}, onOpen }) {
  return (
    <Panel
      title="Calls"
      subtitle={loading ? 'loading…' : `${calls.length} total`}
    >
      {!loading && calls.length === 0 && (
        <div
          style={{
            padding: 48,
            textAlign: 'center',
            color: 'var(--text-tertiary)',
            fontSize: 13,
          }}
        >
          No calls yet. Tip a number above to start.
        </div>
      )}

      {calls.length > 0 && (
        <div style={{ overflow: 'hidden' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                '120px minmax(140px, 1.4fr) minmax(140px, 1fr) 80px minmax(160px, 1.4fr) 80px 80px 28px',
              gap: 10,
              padding: '10px 18px',
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              color: 'var(--text-tertiary)',
              borderBottom: '1px solid var(--border-subtle)',
              background: 'var(--bg-subtle)',
            }}
          >
            <div>Status</div>
            <div>Contact</div>
            <div>Phone</div>
            <div>Dur</div>
            <div>Disposition</div>
            <div style={{ textAlign: 'right' }}>SMS</div>
            <div style={{ textAlign: 'right' }}>$</div>
            <div></div>
          </div>

          {calls.map((c) => {
            const status = STATUS_TONE[c.status] ?? STATUS_TONE.triggered;
            const disp = c.disposition ? DISPOSITION_TONE[c.disposition] : null;
            const earned = c.disposition === 'closed' ? commission : 0;
            return (
              <button
                key={c.id}
                onClick={() => onOpen(c.id)}
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    '120px minmax(140px, 1.4fr) minmax(140px, 1fr) 80px minmax(160px, 1.4fr) 80px 80px 28px',
                  gap: 10,
                  padding: '12px 18px',
                  width: '100%',
                  textAlign: 'left',
                  alignItems: 'center',
                  borderBottom: '1px solid var(--border-subtle)',
                  background: 'transparent',
                  transition: 'background 120ms ease',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = 'var(--surface-hover)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = 'transparent')
                }
              >
                <Pill color={status.color} size="sm">
                  <Dot color={status.dot} pulse={c.status === 'live'} size={5} />
                  {status.label}
                </Pill>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.contact_name || '(unnamed)'}
                    {messageCounts[c.id] > 0 && (
                      <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--accent)', background: 'var(--accent-soft)', padding: '1px 6px', borderRadius: 999, fontWeight: 500 }}>
                        💬 {messageCounts[c.id]}
                      </span>
                    )}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--mono)' }}>
                    {fmtAgo(c.created_at)}
                  </span>
                </div>

                <div
                  style={{
                    fontSize: 12,
                    fontFamily: 'var(--mono)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {fmtPhone(c.phone_number)}
                </div>

                <div
                  style={{
                    fontSize: 12,
                    fontFamily: 'var(--mono)',
                    color: 'var(--text-secondary)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {fmtDuration(c.duration_sec)}
                </div>

                <div>
                  {disp ? (
                    <Pill color={disp.color} size="sm">
                      {disp.label}
                    </Pill>
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--text-quaternary)' }}>
                      —
                    </span>
                  )}
                </div>

                <div
                  style={{
                    textAlign: 'right',
                    fontSize: 12,
                    color: c.sms_sent_at ? 'var(--success)' : 'var(--text-quaternary)',
                  }}
                >
                  {c.sms_sent_at ? '✓' : '—'}
                </div>

                <div
                  style={{
                    textAlign: 'right',
                    fontSize: 12,
                    fontFamily: 'var(--mono)',
                    color: earned ? 'var(--accent)' : 'var(--text-quaternary)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {earned ? `$${earned.toFixed(0)}` : '—'}
                </div>

                <div style={{ color: 'var(--text-quaternary)' }}>
                  <IconChevronRight size={12} />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
