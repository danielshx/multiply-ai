'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { Pill, Dot } from './ui';

const PAGE_SIZE = 500;

// Matches MAX_ENRICH in the HR "Parse Places" Python node.
// Only the first N candidates with websites are sent through the enrichment loop.
const ENRICHMENT_BATCH_CAP = 10;

export function ResearchView({ showToast }) {
  const [topic, setTopic] = useState('');
  const [agent, setAgent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [focusKey, setFocusKey] = useState(null);
  const [contactsRow, setContactsRow] = useState(null);
  const [pendingRuns, setPendingRuns] = useState([]);
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
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'googlemaps_candidates' },
        (payload) => {
          const row = payload.new;
          if (!row?.id) return;
          setRows((prev) => {
            const idx = prev.findIndex((r) => r.id === row.id);
            if (idx === -1) return prev;
            const copy = prev.slice();
            copy[idx] = { ...copy[idx], ...row };
            return copy;
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
          pending: false,
        });
      } else {
        g.items.push(r);
        if (r.created_at && (!g.latest_at || r.created_at > g.latest_at)) {
          g.latest_at = r.created_at;
        }
        if (g.total_found == null && r.total_found != null) g.total_found = r.total_found;
      }
    }

    const dbGroups = Array.from(byKey.values()).map((g) => ({
      ...g,
      status: deriveRunStatus(g),
    }));

    const matchesPending = (g, p) =>
      g.agent_name === p.agent &&
      g.topic === p.topic &&
      new Date(g.latest_at).getTime() >= p.at - 5_000;

    const pendingGroups = pendingRuns
      .filter((p) => !dbGroups.some((g) => matchesPending(g, p)))
      .map((p) => ({
        key: `pending:${p.id}`,
        agent_name: p.agent,
        topic: p.topic,
        search_query: null,
        total_found: null,
        latest_at: new Date(p.at).toISOString(),
        items: [],
        pending: true,
        status: 'dispatching',
      }));

    return [...pendingGroups, ...dbGroups].sort((a, b) =>
      a.latest_at > b.latest_at ? -1 : 1,
    );
  }, [rows, pendingRuns]);

  // Garbage-collect pending entries older than 3 min (HR should have responded by then).
  useEffect(() => {
    if (pendingRuns.length === 0) return undefined;
    const id = setInterval(() => {
      const cutoff = Date.now() - 3 * 60 * 1000;
      setPendingRuns((prev) => prev.filter((p) => p.at > cutoff));
    }, 5000);
    return () => clearInterval(id);
  }, [pendingRuns.length]);

  useEffect(() => {
    if (focusKey) return;
    if (groups.length > 0) setFocusKey(groups[0].key);
  }, [groups, focusKey]);

  const focusGroup = useMemo(
    () => groups.find((g) => g.key === focusKey) ?? groups[0] ?? null,
    [groups, focusKey],
  );

  const dispatchRun = async ({ topic: t, agent: a, source } = {}) => {
    const topicVal = (t ?? topic).trim();
    const agentVal = (a ?? agent).trim();
    if (!topicVal || !agentVal) {
      showToast?.('Topic and agent name are both required.', 'warning');
      return false;
    }
    setSubmitting(true);
    const pendingId = `${agentVal}-${topicVal}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const pendingEntry = { id: pendingId, agent: agentVal, topic: topicVal, at: Date.now() };
    setPendingRuns((prev) => [pendingEntry, ...prev]);
    setFocusKey(`pending:${pendingId}`);
    lastRunRef.current = { topic: topicVal, agent: agentVal, at: Date.now() };
    try {
      const res = await fetch('/api/research/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topicVal, agent: agentVal }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        showToast?.(`Research agent failed: ${data.error ?? res.statusText}`, 'danger');
        setPendingRuns((prev) => prev.filter((p) => p.id !== pendingId));
        return false;
      }
      const verb = source === 'rerun' ? 'Re-dispatched' : 'Dispatched';
      showToast?.(`${verb} "${agentVal}" · topic: ${topicVal}`, 'success');
      return true;
    } catch (err) {
      showToast?.(`Network error: ${err?.message ?? 'unknown'}`, 'danger');
      setPendingRuns((prev) => prev.filter((p) => p.id !== pendingId));
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const start = () => dispatchRun();

  const rerun = (group) =>
    dispatchRun({
      topic: group.topic || '',
      agent: group.agent_name || '',
      source: 'rerun',
    });

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
        <RunsList
          groups={groups}
          focusKey={focusKey}
          onPick={setFocusKey}
          loading={loading}
          onRerun={rerun}
          submitting={submitting}
        />
      </div>

      <ResultsTable
        group={focusGroup}
        loading={loading}
        onOpenContacts={setContactsRow}
      />

      <ContactsModal row={contactsRow} onClose={() => setContactsRow(null)} />
    </div>
  );
}

function Header({ connected, totalRows, totalRuns }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 4 }}>
      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--mono)', padding: '2px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
        source: googlemaps_candidates
      </span>
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

function RunsList({ groups, focusKey, onPick, loading, onRerun, submitting }) {
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
          const canRerun = (g.status === 'done' || g.status === 'stalled') && !!g.agent_name && !!g.topic;
          return (
            <div
              key={g.key}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: 8,
                padding: '10px 16px',
                background: active ? 'var(--accent-soft)' : 'transparent',
                borderBottom: '1px solid var(--border-subtle)',
                alignItems: 'center',
              }}
            >
              <button
                onClick={() => onPick(g.key)}
                style={{
                  minWidth: 0,
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: 'var(--text)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: active ? 'var(--accent-text)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {g.agent_name || '—'}
                  </span>
                  <RunStatusPill status={g.status} group={g} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {g.search_query || g.topic || '—'}
                </div>
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-secondary)' }}>
                  {g.items.length}
                  {g.total_found != null && g.total_found !== g.items.length
                    ? ` / ${g.total_found}`
                    : ''}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-quaternary)', fontFamily: 'var(--mono)' }}>
                  {formatRelative(g.latest_at)}
                </span>
                {canRerun && (
                  <button
                    onClick={() => onRerun?.(g)}
                    disabled={submitting}
                    title={`Re-run agent "${g.agent_name}" with topic "${g.topic}"`}
                    style={{
                      marginTop: 2,
                      padding: '3px 8px',
                      fontSize: 10,
                      fontFamily: 'var(--mono)',
                      color: submitting ? 'var(--text-quaternary)' : 'var(--accent-text)',
                      background: 'var(--accent-soft)',
                      border: '1px solid var(--accent-border)',
                      borderRadius: 'var(--radius-sm)',
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      transition: 'all 120ms ease',
                    }}
                  >
                    ↻ rerun
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RunStatusPill({ status, group }) {
  const map = {
    dispatching: { label: 'dispatching', color: 'accent',  pulse: true },
    scraping:    { label: 'scraping',    color: 'info',    pulse: true },
    enriching:   { label: 'enriching',   color: 'info',    pulse: true },
    done:        { label: 'done',        color: 'success', pulse: false },
    stalled:     { label: 'stalled',     color: 'warning', pulse: false },
    empty:       { label: 'empty',       color: 'neutral', pulse: false },
  };
  const m = map[status] ?? map.empty;
  const subtitle =
    status === 'enriching' && group
      ? ` ${group.items.filter((r) => r.enrichment_status === 'enriched' || r.enrichment_status === 'skipped' || r.enrichment_status === 'failed').length}/${group.items.length}`
      : '';
  return (
    <Pill color={m.color} size="xs">
      {m.pulse && <Dot color={m.color} pulse size={4} />}
      {m.label}{subtitle}
    </Pill>
  );
}

function ResultsTable({ group, loading, onOpenContacts }) {
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
              <Th>Main phone</Th>
              <Th>Address</Th>
              <Th>Description</Th>
              <Th>Contacts</Th>
              <Th style={{ width: 80, textAlign: 'right' }}>Rating</Th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><Td colSpan={7}><Placeholder>Loading…</Placeholder></Td></tr>
            )}
            {!loading && !group && (
              <tr><Td colSpan={7}><Placeholder>Dispatch a run to see results stream in.</Placeholder></Td></tr>
            )}
            {!loading && group && group.items.length === 0 && (
              <tr><Td colSpan={7}><Placeholder>No places in this run.</Placeholder></Td></tr>
            )}
            {group?.items.map((r, i) => (
              <tr key={r.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <Td style={{ color: 'var(--text-quaternary)', fontFamily: 'var(--mono)' }}>{i + 1}</Td>
                <Td>
                  <div style={{ fontWeight: 500, color: 'var(--text)' }}>{r.place_name || '—'}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 3, alignItems: 'center' }}>
                    {r.company_type && (
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{r.company_type}</span>
                    )}
                    <EnrichmentBadge status={r.enrichment_status} />
                    {r.website && (
                      <a
                        href={/^https?:\/\//i.test(r.website) ? r.website : `https://${r.website}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: 11, color: 'var(--accent-text)', fontFamily: 'var(--mono)' }}
                      >
                        site ↗
                      </a>
                    )}
                  </div>
                </Td>
                <Td style={{ fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>
                  {r.phone_number ? (
                    <a href={`tel:${r.phone_number}`} style={{ color: 'var(--accent-text)' }}>{r.phone_number}</a>
                  ) : <span style={{ color: 'var(--text-quaternary)' }}>—</span>}
                </Td>
                <Td style={{ color: 'var(--text-secondary)' }}>{r.address || '—'}</Td>
                <Td style={{ color: 'var(--text-secondary)', maxWidth: 380 }}>
                  <DescriptionCell row={r} />
                </Td>
                <Td>
                  <ContactsCell row={r} runStatus={group?.status} onOpen={() => onOpenContacts?.(r)} />
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

function DescriptionCell({ row }) {
  const summary = row.website_summary?.trim();
  if (summary) {
    return (
      <div>
        <span style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {summary}
        </span>
        {row.description && row.description !== summary && (
          <div style={{ fontSize: 11, color: 'var(--text-quaternary)', marginTop: 4, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            maps: {row.description}
          </div>
        )}
      </div>
    );
  }
  if (row.description) {
    return (
      <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {row.description}
      </span>
    );
  }
  return <span style={{ color: 'var(--text-quaternary)' }}>—</span>;
}

function ContactsCell({ row, runStatus, onOpen }) {
  const contacts = Array.isArray(row.contacts) ? row.contacts : [];
  const status = row.enrichment_status;

  if (contacts.length > 0) {
    return (
      <button
        onClick={onOpen}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          fontSize: 11,
          fontFamily: 'var(--mono)',
          color: 'var(--accent-text)',
          background: 'var(--accent-soft)',
          border: '1px solid var(--accent-border)',
          borderRadius: 999,
          cursor: 'pointer',
          transition: 'all 120ms ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.08)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
      >
        <span>👥</span>
        <span style={{ fontWeight: 600 }}>{contacts.length}</span>
        <span>{contacts.length === 1 ? 'contact' : 'contacts'}</span>
      </button>
    );
  }

  // If the run has finished its enrichment batch, stop showing "scraping…" — the
  // remaining pending rows were beyond the cap and won't ever be enriched.
  const runFinishedEnrichment =
    runStatus === 'done' || runStatus === 'stalled';

  if ((status === 'enriching' || status === 'pending') && !runFinishedEnrichment) {
    return <span style={{ color: 'var(--text-quaternary)', fontSize: 11 }}>scraping…</span>;
  }
  return <span style={{ color: 'var(--text-quaternary)', fontSize: 11 }}>—</span>;
}

function ContactsModal({ row, onClose }) {
  useEffect(() => {
    if (!row) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [row, onClose]);

  if (!row) return null;
  const contacts = Array.isArray(row.contacts) ? row.contacts : [];

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10,10,10,0.45)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        zIndex: 1500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        animation: 'backdrop-in 150ms ease',
      }}
    >
      <div
        style={{
          width: 'min(560px, 100%)',
          maxHeight: '80vh',
          background: 'var(--surface)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-xl)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {row.place_name || '—'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--mono)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {row.website || '—'}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '4px 10px',
                fontSize: 11,
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
                fontFamily: 'var(--mono)',
              }}
            >
              esc
            </button>
          </div>
        </div>
        <div style={{ padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {contacts.length === 0 ? (
            <Placeholder>No contacts extracted.</Placeholder>
          ) : (
            contacts.map((c, i) => (
              <div
                key={i}
                style={{
                  padding: 14,
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{c.name}</div>
                    {c.role && (
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{c.role}</div>
                    )}
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text-quaternary)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    contact {i + 1}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {c.phone && (
                    <ContactAction icon="📞" label="Call" value={c.phone} href={`tel:${c.phone}`} />
                  )}
                  {c.email && (
                    <ContactAction icon="✉" label="Email" value={c.email} href={`mailto:${c.email}`} />
                  )}
                  {!c.phone && !c.email && (
                    <span style={{ fontSize: 11, color: 'var(--text-quaternary)', fontFamily: 'var(--mono)' }}>
                      no phone or email extracted
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ContactAction({ icon, label, value, href }) {
  return (
    <a
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        textDecoration: 'none',
        color: 'var(--text)',
        transition: 'all 120ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--accent-border)';
        e.currentTarget.style.background = 'var(--accent-soft)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.background = 'var(--surface)';
      }}
    >
      <span style={{ fontSize: 14 }}>{icon}</span>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'var(--mono)' }}>
          {label}
        </span>
        <span style={{ fontSize: 12, color: 'var(--text)', fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {value}
        </span>
      </div>
    </a>
  );
}

function EnrichmentBadge({ status }) {
  const map = {
    pending:    { label: 'queued',    color: 'neutral' },
    enriching:  { label: 'scraping…', color: 'info' },
    enriched:   { label: 'enriched',  color: 'success' },
    skipped:    { label: 'no site',   color: 'neutral' },
    failed:     { label: 'failed',    color: 'warning' },
  };
  const m = map[status];
  if (!m) return null;
  return (
    <Pill color={m.color} size="xs">
      {status === 'enriching' && <Dot color="info" pulse size={4} />}
      {m.label}
    </Pill>
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

function deriveRunStatus(group) {
  const items = group.items ?? [];
  if (items.length === 0) return 'empty';
  const latest = group.latest_at ? new Date(group.latest_at).getTime() : 0;
  const ageMs = latest ? Date.now() - latest : 0;

  const expected = group.total_found;
  const scraping = expected != null && items.length < expected;
  if (scraping) {
    return ageMs > 10 * 60 * 1000 ? 'stalled' : 'scraping';
  }

  // HR's Parse Places only enriches the first N candidates with websites.
  // Beyond that, rows stay 'pending' forever — not a real scraping state.
  const withWebsite = items.filter((r) => !!r.website);
  const expectedEnriched = Math.min(withWebsite.length, ENRICHMENT_BATCH_CAP);
  const enrichmentTerminal = withWebsite.filter(
    (r) => r.enrichment_status === 'enriched' || r.enrichment_status === 'failed',
  );
  if (enrichmentTerminal.length < expectedEnriched) {
    return ageMs > 10 * 60 * 1000 ? 'stalled' : 'enriching';
  }
  return 'done';
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
