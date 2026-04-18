'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { Pill, Dot } from './ui';

const PAGE_SIZE = 500;

export function ResearchView({ showToast }) {
  const [topic, setTopic] = useState('');
  const [agent, setAgent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [focusKey, setFocusKey] = useState(null);
  const lastRunRef = useRef(null);

  useEffect(() => {
    const sb = getBrowserSupabase();
    let cancelled = false;

    sb.from('googlemaps_candidates')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          showToast?.(`Load failed: ${error.message}`, 'danger');
        }
        setRows(data ?? []);
        setLoading(false);
      });

    const ch = sb
      .channel('realtime:googlemaps_candidates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'googlemaps_candidates' },
        (payload) => {
          const row = payload.new;
          if (!row) return;
          setRows((prev) => {
            if (prev.some((r) => r.id === row.id)) return prev;
            return [row, ...prev].slice(0, PAGE_SIZE);
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
  }, [showToast]);

  const groups = useMemo(() => {
    const byKey = new Map();
    for (const r of rows) {
      const key = `${r.agent_name ?? ''}|${r.topic ?? ''}|${r.search_query ?? ''}|${r.created_at?.slice(0, 16) ?? ''}`;
      const g = byKey.get(key);
      if (!g) {
        byKey.set(key, {
          key,
          agent_name: r.agent_name,
          topic: r.topic,
          search_query: r.search_query,
          total_found: r.total_found ?? null,
          latest_at: r.created_at,
          items: [r],
        });
      } else {
        g.items.push(r);
        if (r.created_at && (!g.latest_at || r.created_at > g.latest_at)) {
          g.latest_at = r.created_at;
        }
        if (g.total_found == null && r.total_found != null) g.total_found = r.total_found;
      }
    }
    return Array.from(byKey.values()).sort((a, b) => (a.latest_at > b.latest_at ? -1 : 1));
  }, [rows]);

  useEffect(() => {
    if (focusKey) return;
    if (groups.length > 0) setFocusKey(groups[0].key);
  }, [groups, focusKey]);

  const focusGroup = useMemo(
    () => groups.find((g) => g.key === focusKey) ?? groups[0] ?? null,
    [groups, focusKey],
  );

  const start = async () => {
    const t = topic.trim();
    const a = agent.trim();
    if (!t || !a) {
      showToast?.('Topic and agent name are both required.', 'warning');
      return;
    }
    setSubmitting(true);
    lastRunRef.current = { topic: t, agent: a, at: Date.now() };
    try {
      const res = await fetch('/api/research/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: t, agent: a }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        showToast?.(`Research agent failed: ${data.error ?? res.statusText}`, 'danger');
      } else {
        showToast?.(`Agent "${a}" dispatched · topic: ${t}`, 'success');
      }
    } catch (err) {
      showToast?.(`Network error: ${err?.message ?? 'unknown'}`, 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1480, margin: '0 auto' }}>
      <Header connected={connected} totalRows={rows.length} totalRuns={groups.length} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 1fr) minmax(0, 2.2fr)', gap: 16 }}>
        <TriggerPanel
          topic={topic}
          agent={agent}
          setTopic={setTopic}
          setAgent={setAgent}
          submitting={submitting}
          onStart={start}
        />
        <RunsList groups={groups} focusKey={focusKey} onPick={setFocusKey} loading={loading} />
      </div>

      <ResultsTable group={focusGroup} loading={loading} />
    </div>
  );
}

function Header({ connected, totalRows, totalRuns }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ fontSize: 18 }}>🔎</span>
        <h1 style={{ fontSize: 20, letterSpacing: -0.3, fontWeight: 500, color: 'var(--text)', margin: 0 }}>
          Research Agent
        </h1>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--mono)', padding: '2px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
          googlemaps_candidates
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Pill color="neutral" size="sm">
          <span style={{ fontFamily: 'var(--mono)' }}>{totalRuns}</span> runs
        </Pill>
        <Pill color="neutral" size="sm">
          <span style={{ fontFamily: 'var(--mono)' }}>{totalRows}</span> places
        </Pill>
        <Pill color={connected ? 'success' : 'neutral'} size="sm">
          <Dot color={connected ? 'success' : 'neutral'} pulse={connected} size={5} />
          {connected ? 'realtime' : 'connecting…'}
        </Pill>
      </div>
    </div>
  );
}

function TriggerPanel({ topic, agent, setTopic, setAgent, submitting, onStart }) {
  const disabled = submitting || !topic.trim() || !agent.trim();
  return (
    <div style={panelStyle}>
      <SectionTitle>Dispatch new run</SectionTitle>
      <Field label="Agent name" hint="Tags the candidates this run produces.">
        <input
          value={agent}
          onChange={(e) => setAgent(e.target.value)}
          placeholder="e.g. Berlin Coffee Scout"
          disabled={submitting}
          style={inputStyle}
        />
      </Field>
      <Field label="Topic" hint="Google Maps research query — include the location.">
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. specialty coffee shops in Berlin Mitte with >4.3 rating"
          disabled={submitting}
          rows={4}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'var(--sans)' }}
        />
      </Field>
      <button
        onClick={onStart}
        disabled={disabled}
        style={{
          padding: '10px 16px',
          fontSize: 13,
          fontWeight: 600,
          color: '#fff',
          background: submitting ? 'var(--accent-soft)' : 'var(--accent)',
          border: '1px solid var(--accent-border)',
          borderRadius: 'var(--radius-md)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.55 : 1,
          transition: 'all 120ms ease',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {submitting ? (<><Dot color="accent" pulse size={6} />Dispatching…</>) : (<>Start Agent →</>)}
      </button>
      <div style={{ fontSize: 11, color: 'var(--text-quaternary)', lineHeight: 1.5, marginTop: 4 }}>
        Results stream in live via Supabase Realtime as HappyRobot returns them.
      </div>
    </div>
  );
}

function RunsList({ groups, focusKey, onPick, loading }) {
  return (
    <div style={{ ...panelStyle, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
        <SectionTitle style={{ marginBottom: 0 }}>Runs</SectionTitle>
      </div>
      <div style={{ maxHeight: 260, overflowY: 'auto' }}>
        {loading && <Placeholder>Loading runs…</Placeholder>}
        {!loading && groups.length === 0 && (
          <Placeholder>No research runs yet. Dispatch one on the left.</Placeholder>
        )}
        {groups.map((g) => {
          const active = g.key === focusKey;
          return (
            <button
              key={g.key}
              onClick={() => onPick(g.key)}
              style={{
                width: '100%',
                textAlign: 'left',
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: 12,
                padding: '10px 16px',
                background: active ? 'var(--accent-soft)' : 'transparent',
                border: 'none',
                borderBottom: '1px solid var(--border-subtle)',
                cursor: 'pointer',
                color: 'var(--text)',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: active ? 'var(--accent-text)' : 'var(--text)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {g.agent_name || '—'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {g.search_query || g.topic || '—'}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-secondary)' }}>
                  {g.items.length}
                  {g.total_found != null && g.total_found !== g.items.length
                    ? ` / ${g.total_found}`
                    : ''}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-quaternary)', fontFamily: 'var(--mono)' }}>
                  {formatRelative(g.latest_at)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ResultsTable({ group, loading }) {
  return (
    <div style={{ ...panelStyle, padding: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ minWidth: 0 }}>
          <SectionTitle style={{ marginBottom: 2 }}>
            {group ? group.agent_name || 'Unnamed agent' : 'Results'}
          </SectionTitle>
          {group && (
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {group.search_query || group.topic || '—'}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {group && (
            <>
              <Pill color="accent" size="sm">
                <span style={{ fontFamily: 'var(--mono)' }}>{group.items.length}</span> shown
              </Pill>
              {group.total_found != null && (
                <Pill color="neutral" size="sm">
                  <span style={{ fontFamily: 'var(--mono)' }}>{group.total_found}</span> returned
                </Pill>
              )}
            </>
          )}
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: 'var(--bg-subtle)' }}>
              <Th style={{ width: 44 }}>#</Th>
              <Th>Name</Th>
              <Th>Phone</Th>
              <Th>Address</Th>
              <Th>Description</Th>
              <Th style={{ width: 80, textAlign: 'right' }}>Rating</Th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><Td colSpan={6}><Placeholder>Loading…</Placeholder></Td></tr>
            )}
            {!loading && !group && (
              <tr><Td colSpan={6}><Placeholder>Dispatch a run to see results stream in.</Placeholder></Td></tr>
            )}
            {!loading && group && group.items.length === 0 && (
              <tr><Td colSpan={6}><Placeholder>No places in this run.</Placeholder></Td></tr>
            )}
            {group?.items.map((r, i) => (
              <tr key={r.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <Td style={{ color: 'var(--text-quaternary)', fontFamily: 'var(--mono)' }}>{i + 1}</Td>
                <Td>
                  <div style={{ fontWeight: 500, color: 'var(--text)' }}>{r.place_name || '—'}</div>
                  {r.company_type && (
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{r.company_type}</div>
                  )}
                </Td>
                <Td style={{ fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>
                  {r.phone_number ? (
                    <a href={`tel:${r.phone_number}`} style={{ color: 'var(--accent-text)' }}>{r.phone_number}</a>
                  ) : <span style={{ color: 'var(--text-quaternary)' }}>—</span>}
                </Td>
                <Td style={{ color: 'var(--text-secondary)' }}>{r.address || '—'}</Td>
                <Td style={{ color: 'var(--text-secondary)', maxWidth: 420 }}>
                  <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {r.description || '—'}
                  </span>
                </Td>
                <Td style={{ textAlign: 'right', fontFamily: 'var(--mono)' }}>
                  {r.rating != null ? (
                    <span style={{ color: 'var(--text)' }}>
                      {Number(r.rating).toFixed(1)}
                      {r.review_count != null && (
                        <span style={{ color: 'var(--text-quaternary)', fontSize: 11 }}> ({r.review_count})</span>
                      )}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-quaternary)' }}>—</span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, style }) {
  return (
    <th style={{
      padding: '8px 12px',
      textAlign: 'left',
      fontSize: 11,
      fontWeight: 500,
      color: 'var(--text-tertiary)',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      fontFamily: 'var(--mono)',
      borderBottom: '1px solid var(--border)',
      ...style,
    }}>{children}</th>
  );
}

function Td({ children, style, colSpan }) {
  return (
    <td colSpan={colSpan} style={{ padding: '10px 12px', verticalAlign: 'top', ...style }}>
      {children}
    </td>
  );
}

function Placeholder({ children }) {
  return (
    <div style={{ padding: '18px 20px', fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>
      {children}
    </div>
  );
}

function SectionTitle({ children, style }) {
  return (
    <div style={{
      fontSize: 11,
      fontWeight: 500,
      color: 'var(--text-tertiary)',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      fontFamily: 'var(--mono)',
      marginBottom: 12,
      ...style,
    }}>{children}</div>
  );
}

function Field({ label, hint, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: 11, color: 'var(--text-quaternary)' }}>{hint}</span>}
    </label>
  );
}

function formatRelative(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diff = Date.now() - then;
  const s = Math.round(diff / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  fontSize: 13,
  background: 'var(--bg-subtle)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text)',
  outline: 'none',
  fontFamily: 'var(--sans)',
};

const panelStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: 16,
};
