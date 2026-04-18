'use client';
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { Dot } from './ui';

const CHANNEL_META = {
  phone: { label: 'Voice', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.10)', border: 'rgba(34, 197, 94, 0.35)', icon: '📞' },
  sms: { label: 'SMS', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.10)', border: 'rgba(168, 85, 247, 0.35)', icon: '📱' },
  email: { label: 'Email', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.10)', border: 'rgba(59, 130, 246, 0.35)', icon: '✉️' },
  watcher: { label: 'Watcher', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.10)', border: 'rgba(251, 191, 36, 0.35)', icon: '👁' },
  seed: { label: 'Inbound', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.10)', border: 'rgba(148, 163, 184, 0.30)', icon: '⚑' },
};

const HEAT_META = {
  hot: { label: 'HOT', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.40)' },
  warm: { label: 'WARM', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.40)' },
  cold: { label: 'COLD', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.40)' },
};

export function LiveMonitor() {
  const [leads, setLeads] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [watcherStatus, setWatcherStatus] = useState({
    enabled: null, max: null, concurrency: null, lastTick: null, lastResult: null,
  });
  const [busy, setBusy] = useState(null);
  const [preview, setPreview] = useState(null); // { decisions, total, sources } when confirmation is open
  const [view, setView] = useState('active'); // 'active' | 'conversation' | 'closed'
  const [showSystemEvents, setShowSystemEvents] = useState(false);

  useEffect(() => {
    const sb = getBrowserSupabase();
    let cancelled = false;
    (async () => {
      const [{ data: leadsData }, { data: msgsData }] = await Promise.all([
        sb.from('leads').select('*').order('created_at', { ascending: false }).limit(50000),
        sb.from('messages').select('*').order('ts', { ascending: false }).limit(50000),
      ]);
      if (cancelled) return;
      setLeads(leadsData ?? []);
      setMessages(msgsData ?? []);
      setLoading(false);
    })();

    const leadsCh = sb
      .channel('lm-leads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (p) => {
        if (p.eventType === 'INSERT' && p.new) setLeads(prev => [p.new, ...prev]);
        else if (p.eventType === 'UPDATE' && p.new) setLeads(prev => prev.map(l => (l.id === p.new.id ? p.new : l)));
        else if (p.eventType === 'DELETE' && p.old) setLeads(prev => prev.filter(l => l.id !== p.old.id));
      })
      .subscribe((s) => setConnected(s === 'SUBSCRIBED'));

    const msgsCh = sb
      .channel('lm-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => {
        if (p.new) setMessages(prev => [p.new, ...prev].slice(0, 1500));
      })
      .subscribe();

    return () => {
      cancelled = true;
      sb.removeChannel(leadsCh);
      sb.removeChannel(msgsCh);
    };
  }, []);

  const refreshWatcher = useCallback(async () => {
    try {
      const r = await fetch('/api/watcher/status', { cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      setWatcherStatus(s => ({ ...s, enabled: j.enabled, max: j.max, concurrency: j.concurrency }));
    } catch {}
  }, []);

  useEffect(() => {
    refreshWatcher();
    const id = setInterval(refreshWatcher, 5000);
    return () => clearInterval(id);
  }, [refreshWatcher]);

  const runWatcher = useCallback(async ({ dryRun, max, since }) => {
    const r = await fetch('/api/watcher/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dry_run: dryRun,
        since: since ?? '1970-01-01T00:00:00Z',
        max: max ?? 200,
      }),
    });
    return r.json();
  }, []);

  // "🧪 dry-run" button: preview only, no confirmation needed
  const doDryRun = useCallback(async () => {
    setBusy('dry');
    try {
      const j = await runWatcher({ dryRun: true });
      setWatcherStatus(s => ({ ...s, lastTick: new Date().toISOString(), lastResult: j }));
    } catch (e) {
      setWatcherStatus(s => ({ ...s, lastTick: new Date().toISOString(), lastResult: { ok: false, error: e.message } }));
    } finally {
      setBusy(null);
    }
  }, [runWatcher]);

  // "🚀 fire watcher" button: STEP 1 — open the confirmation modal with a dry-run preview
  const openFireConfirmation = useCallback(async () => {
    setBusy('preview');
    try {
      const j = await runWatcher({ dryRun: true });
      setPreview(j);
    } catch (e) {
      setWatcherStatus(s => ({ ...s, lastTick: new Date().toISOString(), lastResult: { ok: false, error: e.message } }));
    } finally {
      setBusy(null);
    }
  }, [runWatcher]);

  // STEP 2 — user confirmed, fire it for real
  const confirmFire = useCallback(async () => {
    setBusy('live');
    try {
      const j = await runWatcher({ dryRun: false, max: 500 });
      setWatcherStatus(s => ({ ...s, lastTick: new Date().toISOString(), lastResult: j }));
      setPreview(null);
    } catch (e) {
      setWatcherStatus(s => ({ ...s, lastTick: new Date().toISOString(), lastResult: { ok: false, error: e.message } }));
    } finally {
      setBusy(null);
    }
  }, [runWatcher]);

  const messagesByLead = useMemo(() => {
    const map = new Map();
    for (const m of messages) {
      const key = m.lead_id ?? '_unmatched';
      const arr = map.get(key) ?? [];
      arr.push(m);
      map.set(key, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
    }
    return map;
  }, [messages]);

  const isClosedStage = (s) => s === 'booked' || s === 'lost' || s === 'qualified';

  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      const closed = isClosedStage(l.stage) || !!l.closed_at;
      if (view === 'closed') return closed;
      if (view === 'conversation') {
        const arr = messagesByLead.get(l.id) ?? [];
        return hasRealConversation(arr);
      }
      return !closed;
    });
  }, [leads, view, messagesByLead]);

  const orderedLeads = useMemo(() => {
    const lastTs = (id) => {
      const arr = messagesByLead.get(id);
      if (!arr || arr.length === 0) return 0;
      return new Date(arr[arr.length - 1].ts).getTime();
    };
    let list = filteredLeads;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(l =>
        (l.name ?? '').toLowerCase().includes(q) ||
        (l.email ?? '').toLowerCase().includes(q) ||
        (l.phone ?? '').toLowerCase().includes(q) ||
        ((l.metadata?.company ?? '') + '').toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      const tA = Math.max(lastTs(a.id), new Date(a.created_at ?? 0).getTime());
      const tB = Math.max(lastTs(b.id), new Date(b.created_at ?? 0).getTime());
      return tB - tA;
    });
  }, [filteredLeads, messagesByLead, search]);

  const stats = useMemo(() => {
    const total = leads.length;
    const closed = leads.filter(l => isClosedStage(l.stage) || l.closed_at).length;
    const active = total - closed;
    const conversation = leads.filter(l => hasRealConversation(messagesByLead.get(l.id) ?? [])).length;
    const hot = leads.filter(l => l.current_mode === 'hot' && !isClosedStage(l.stage)).length;
    const warm = leads.filter(l => l.current_mode === 'warm' && !isClosedStage(l.stage)).length;
    const cold = leads.filter(l => l.current_mode === 'cold' && !isClosedStage(l.stage)).length;
    const realMsgs = messages.filter(m => m.role !== 'system');
    const channelCount = (ch) => realMsgs.filter(m => m.channel === ch).length;
    return {
      total, active, closed, conversation, hot, warm, cold,
      voice: channelCount('phone'),
      sms: channelCount('sms'),
      email: channelCount('email'),
      msgs: realMsgs.length,
    };
  }, [leads, messages, messagesByLead]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Header
        connected={connected}
        stats={stats}
        filter={filter}
        setFilter={setFilter}
        search={search}
        setSearch={setSearch}
        watcher={watcherStatus}
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        onFireDry={doDryRun}
        onFireLive={openFireConfirmation}
        busy={busy}
        view={view}
        setView={setView}
        showSystemEvents={showSystemEvents}
        setShowSystemEvents={setShowSystemEvents}
      />

      {showSettings && (
        <SettingsPanel watcher={watcherStatus} lastResult={watcherStatus.lastResult} />
      )}

      {preview && (
        <ConfirmFireModal
          preview={preview}
          busy={busy === 'live'}
          onCancel={() => setPreview(null)}
          onConfirm={confirmFire}
        />
      )}

      {loading ? (
        <div style={{ padding: 80, textAlign: 'center', color: 'var(--text-tertiary)', fontFamily: 'var(--mono)', fontSize: 12 }}>
          loading leads + messages…
        </div>
      ) : orderedLeads.length === 0 && search ? (
        <div style={{ padding: 80, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
          no leads match "{search}"
        </div>
      ) : orderedLeads.length === 0 ? (
        <div style={{ padding: 80, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
          {view === 'closed' ? (
            'no closed leads yet — they\'ll appear here once stage = booked / qualified / lost.'
          ) : view === 'conversation' ? (
            'no real conversations yet — this tab only shows leads with actual human replies (email/call), excluding no-answer / immediate hang-up.'
          ) : (
            <>no active leads — click <strong>🚀 fire watcher</strong> above to start outreach.</>
          )}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: 12,
        }}>
          {orderedLeads.map(lead => {
            const all = messagesByLead.get(lead.id) ?? [];
            const visible = all.filter(m => {
              if (!showSystemEvents && m.role === 'system') return false;
              if (filter !== 'all' && m.channel !== filter) return false;
              return true;
            });
            return (
              <LeadCard
                key={lead.id}
                lead={lead}
                messages={visible}
                totalCount={all.length}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function Header({ connected, stats, filter, setFilter, search, setSearch, watcher, showSettings, setShowSettings, onFireDry, onFireLive, busy, view, setView, showSystemEvents, setShowSystemEvents }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      padding: 14,
      border: '1px solid var(--border)',
      borderRadius: 8,
      background: 'var(--bg-subtle)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Dot color={connected ? 'success' : 'warning'} pulse={connected} size={6} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Live Monitor</span>
          <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 1 }}>
            realtime
          </span>
        </div>

        <div style={{ display: 'flex', gap: 2, padding: 2, background: 'var(--surface)', borderRadius: 6, border: '1px solid var(--border)', marginLeft: 8 }}>
          <button
            onClick={() => setView('active')}
            style={{
              padding: '5px 12px',
              fontSize: 12,
              background: view === 'active' ? 'var(--bg-subtle)' : 'transparent',
              color: view === 'active' ? 'var(--text)' : 'var(--text-tertiary)',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontWeight: view === 'active' ? 600 : 500,
            }}
          >
            Active <span style={{ opacity: 0.6, marginLeft: 4 }}>{stats.active}</span>
          </button>
          <button
            onClick={() => setView('closed')}
            style={{
              padding: '5px 12px',
              fontSize: 12,
              background: view === 'closed' ? 'var(--bg-subtle)' : 'transparent',
              color: view === 'closed' ? 'var(--text)' : 'var(--text-tertiary)',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontWeight: view === 'closed' ? 600 : 500,
            }}
          >
            ✓ Closed <span style={{ opacity: 0.6, marginLeft: 4 }}>{stats.closed}</span>
          </button>
          <button
            onClick={() => setView('conversation')}
            style={{
              padding: '5px 12px',
              fontSize: 12,
              background: view === 'conversation' ? 'var(--bg-subtle)' : 'transparent',
              color: view === 'conversation' ? 'var(--text)' : 'var(--text-tertiary)',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontWeight: view === 'conversation' ? 600 : 500,
            }}
          >
            💬 Conversation <span style={{ opacity: 0.6, marginLeft: 4 }}>{stats.conversation}</span>
          </button>
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Stat label="leads" value={stats.total} />
          <Stat label="hot" value={stats.hot} color="#ef4444" />
          <Stat label="warm" value={stats.warm} color="#f59e0b" />
          <Stat label="cold" value={stats.cold} color="#3b82f6" />
          <Stat label="msgs" value={stats.msgs} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="filter leads (name / company / phone / email)"
          style={{
            flex: '1 1 220px',
            minWidth: 0,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: 12,
            color: 'var(--text)',
            outline: 'none',
          }}
        />

        <FilterTabs
          filter={filter}
          setFilter={setFilter}
          counts={{ all: stats.msgs, phone: stats.voice, sms: stats.sms, email: stats.email }}
        />

        <button
          onClick={() => setShowSystemEvents(s => !s)}
          title="Toggle visibility of [system] queued/skipped/fallback log entries inside lead cards"
          style={btnStyle(showSystemEvents)}
        >
          {showSystemEvents ? '👁 hide system' : '👁 show system'}
        </button>

        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setShowSettings(s => !s)} style={btnStyle(showSettings)}>
            ⚙ settings
          </button>
          <button onClick={onFireDry} disabled={busy != null} style={btnStyle(false)}>
            {busy === 'dry' ? '…' : '🧪 dry-run'}
          </button>
          <button
            onClick={onFireLive}
            disabled={busy != null || watcher.enabled === false}
            title={watcher.enabled === false ? 'Set WATCHER_ENABLED=true in .env.local to enable' : 'Preview + confirm before firing'}
            style={btnStyle(false, true)}
          >
            {busy === 'preview' ? 'preview…' : busy === 'live' ? 'firing…' : '🚀 fire watcher'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--mono)' }}>
        <span>
          watcher:{' '}
          <span style={{ color: watcher.enabled ? '#22c55e' : '#94a3b8' }}>
            {watcher.enabled === null ? '?' : watcher.enabled ? 'ENABLED' : 'DISABLED (dry-run only)'}
          </span>
        </span>
        <span>·</span>
        <span>max: {watcher.max ?? '?'}/tick</span>
        <span>·</span>
        <span>concurrency: {watcher.concurrency ?? '?'}</span>
        {watcher.lastTick && (
          <>
            <span>·</span>
            <span>last fire: {new Date(watcher.lastTick).toLocaleTimeString()}</span>
          </>
        )}
      </div>
    </div>
  );
}

function ConfirmFireModal({ preview, busy, onCancel, onConfirm }) {
  // Group decisions by action so the user sees exactly what's about to happen
  const eligible = (preview.decisions ?? []).filter(d => d.decision !== 'skip');
  const skipped = (preview.decisions ?? []).filter(d => d.decision === 'skip');
  const byChannel = { call: 0, sms: 0, email: 0 };
  for (const d of eligible) {
    if (byChannel[d.decision] != null) byChannel[d.decision]++;
  }
  const bySource = { manual: 0, googlemaps: 0 };
  for (const d of eligible) {
    if (bySource[d.source] != null) bySource[d.source]++;
  }
  const top10 = eligible.slice(0, 10);
  const more = Math.max(0, eligible.length - 10);

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          maxWidth: 720,
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 56px rgba(0,0,0,0.45)',
        }}
      >
        <header style={{
          padding: 18,
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>⚠️</span>
              Confirm watcher fire
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              The watcher detected <strong>{eligible.length}</strong> lead(s) to reach out to right now.
              This will trigger <strong>real</strong> outbound HR calls, SMS, and emails. Review below before confirming.
            </div>
          </div>
          <button onClick={onCancel} style={{
            background: 'transparent', border: 'none', color: 'var(--text-tertiary)',
            fontSize: 18, cursor: 'pointer', padding: 4,
          }}>
            ×
          </button>
        </header>

        <div style={{ padding: 18, overflow: 'auto', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, marginBottom: 16 }}>
            <BigStat label="Voice calls" value={byChannel.call} color="#22c55e" icon="📞" />
            <BigStat label="SMS" value={byChannel.sms} color="#a855f7" icon="📱" />
            <BigStat label="Emails" value={byChannel.email} color="#3b82f6" icon="✉️" />
            <BigStat label="Skipped" value={skipped.length} color="#94a3b8" icon="⊘" />
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--mono)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
            sources: manual {bySource.manual} · googlemaps {bySource.googlemaps}
          </div>

          <div style={{
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: 10,
            marginBottom: 12,
            maxHeight: 300,
            overflowY: 'auto',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
              Will trigger ({eligible.length} lead{eligible.length === 1 ? '' : 's'}):
            </div>
            {top10.map((d, i) => (
              <div key={i} style={{
                fontSize: 11,
                fontFamily: 'var(--mono)',
                color: 'var(--text-secondary)',
                padding: '3px 0',
                borderBottom: i < top10.length - 1 ? '1px solid var(--border)' : 'none',
                display: 'flex',
                gap: 8,
              }}>
                <span style={{ color: decisionColor(d.decision), fontWeight: 700, width: 50 }}>
                  {d.decision.toUpperCase()}
                </span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {d.name} {d.rating != null ? `(${d.rating}★)` : ''}
                </span>
                <span style={{ color: 'var(--text-quaternary)', whiteSpace: 'nowrap' }}>
                  {d.phone ?? d.email ?? '—'}
                </span>
              </div>
            ))}
            {more > 0 && (
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '6px 0 0', textAlign: 'center', fontStyle: 'italic' }}>
                … and {more} more
              </div>
            )}
            {skipped.length > 0 && (
              <details style={{ marginTop: 8 }}>
                <summary style={{ fontSize: 11, color: 'var(--text-tertiary)', cursor: 'pointer' }}>
                  {skipped.length} skipped (no contact / opted out / already booked)
                </summary>
                <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-quaternary)', fontFamily: 'var(--mono)' }}>
                  {skipped.slice(0, 8).map((d, i) => (
                    <div key={i}>· {d.name} — {d.reasoning}</div>
                  ))}
                  {skipped.length > 8 && <div>· … +{skipped.length - 8}</div>}
                </div>
              </details>
            )}
          </div>

          <div style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.30)',
            borderRadius: 6,
            padding: 10,
            fontSize: 11,
            color: 'var(--text-secondary)',
            display: 'flex',
            gap: 8,
            alignItems: 'flex-start',
          }}>
            <span style={{ fontSize: 14 }}>⚠️</span>
            <div>
              <strong style={{ color: '#ef4444' }}>Real outbound traffic.</strong> HR will dial the listed phones via the
              staging trunk. Email goes from <code>happymultiply@gmail.com</code> via Gmail SMTP.
              Once you click <em>Confirm & fire</em>, all {eligible.length} requests are dispatched in parallel
              (concurrency = 5). There is no undo.
            </div>
          </div>
        </div>

        <footer style={{
          padding: 14,
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 8,
        }}>
          <button onClick={onCancel} disabled={busy} style={{
            padding: '8px 16px',
            fontSize: 13,
            background: 'transparent',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            cursor: 'pointer',
            fontWeight: 500,
          }}>
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy || eligible.length === 0}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              background: eligible.length === 0 ? 'var(--bg-subtle)' : '#ef4444',
              color: eligible.length === 0 ? 'var(--text-tertiary)' : '#fff',
              border: '1px solid ' + (eligible.length === 0 ? 'var(--border)' : '#ef4444'),
              borderRadius: 6,
              cursor: busy || eligible.length === 0 ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              minWidth: 180,
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? 'firing…' : eligible.length === 0 ? 'Nothing to fire' : `🚀 Confirm & fire ${eligible.length}`}
          </button>
        </footer>
      </div>
    </div>
  );
}

function BigStat({ label, value, color, icon }) {
  return (
    <div style={{
      padding: '12px 10px',
      background: 'var(--bg-subtle)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 16, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 4, fontFamily: 'var(--mono)' }}>
        {label}
      </div>
    </div>
  );
}

function decisionColor(d) {
  return d === 'call' ? '#22c55e' : d === 'sms' ? '#a855f7' : d === 'email' ? '#3b82f6' : '#94a3b8';
}

function SettingsPanel({ watcher, lastResult }) {
  return (
    <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Watcher controls</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        Set in <code>.env.local</code>:
        <pre style={{
          background: 'var(--bg)',
          padding: 10,
          borderRadius: 6,
          fontSize: 11,
          fontFamily: 'var(--mono)',
          marginTop: 6,
          color: 'var(--text)',
          whiteSpace: 'pre',
          overflow: 'auto',
        }}>
{`WATCHER_ENABLED=${watcher.enabled ? 'true' : 'false'}     # flip to 'true' to fan out to real HR/email
WATCHER_MAX_PER_TICK=${watcher.max ?? '?'}        # hard cap of triggers per minute
WATCHER_CONCURRENCY=${watcher.concurrency ?? '?'}        # parallel HR/email/SMS calls in flight`}
        </pre>
      </div>
      {lastResult && (
        <details style={{ marginTop: 10 }}>
          <summary style={{ fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
            last run output
          </summary>
          <pre style={{
            background: 'var(--bg)', padding: 10, borderRadius: 6, fontSize: 10,
            fontFamily: 'var(--mono)', marginTop: 6, color: 'var(--text-secondary)',
            maxHeight: 240, overflow: 'auto',
          }}>
            {JSON.stringify(lastResult, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

function FilterTabs({ filter, setFilter, counts }) {
  const tabs = [
    { id: 'all', label: 'all', count: counts.all },
    { id: 'phone', label: '📞 voice', count: counts.phone },
    { id: 'sms', label: '📱 sms', count: counts.sms },
    { id: 'email', label: '✉️ email', count: counts.email },
  ];
  return (
    <div style={{ display: 'flex', gap: 2, padding: 2, background: 'var(--surface)', borderRadius: 6, border: '1px solid var(--border)' }}>
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => setFilter(t.id)}
          style={{
            padding: '4px 8px',
            fontSize: 11,
            background: filter === t.id ? 'var(--bg-subtle)' : 'transparent',
            color: filter === t.id ? 'var(--text)' : 'var(--text-tertiary)',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontWeight: filter === t.id ? 600 : 400,
          }}
        >
          {t.label} <span style={{ opacity: 0.6, marginLeft: 2 }}>{t.count}</span>
        </button>
      ))}
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '4px 10px',
      borderRadius: 6,
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      minWidth: 50,
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: color ?? 'var(--text)' }}>{value}</div>
      <div style={{ fontSize: 9, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'var(--mono)' }}>{label}</div>
    </div>
  );
}

function LeadCard({ lead, messages, totalCount }) {
  const ref = useRef(null);
  const company =
    (typeof lead.metadata === 'object' && lead.metadata?.company) || '(no company)';
  const role = (typeof lead.metadata === 'object' && lead.metadata?.role) || null;
  const heat = HEAT_META[lead.current_mode] ?? HEAT_META.cold;
  const stage = lead.stage ?? 'new';
  const last = messages[messages.length - 1];
  const hiddenCount = (totalCount ?? messages.length) - messages.length;

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [messages.length]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      overflow: 'hidden',
      height: 480,
      transition: 'border-color 200ms ease',
    }}>
      <header style={{ padding: 12, borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {lead.name ?? '(no name)'}
              </div>
              <span style={{
                fontSize: 9, padding: '1px 6px', borderRadius: 3,
                background: heat.bg, color: heat.color, border: `1px solid ${heat.border}`,
                fontFamily: 'var(--mono)', fontWeight: 700, letterSpacing: 0.5,
              }}>
                {heat.label}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {company}{role ? ` · ${role}` : ''}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 8px', fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-tertiary)' }}>
          {lead.phone && <><span>📞</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.phone}</span></>}
          {lead.email && <><span>✉️</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.email}</span></>}
          {lead.interest && <><span>🎯</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.interest}</span></>}
        </div>

        <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text-quaternary)', textTransform: 'uppercase', letterSpacing: 1 }}>
          <span>stage: {stage}</span>
          <span>
            {messages.length} msgs
            {hiddenCount > 0 && (
              <span style={{ color: 'var(--text-quaternary)', marginLeft: 4 }}>
                (+{hiddenCount} system)
              </span>
            )}
          </span>
        </div>
      </header>

      <div ref={ref} style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {messages.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--text-quaternary)', fontFamily: 'var(--mono)', padding: 20, textAlign: 'center' }}>
            {hiddenCount > 0
              ? <>no conversation yet<br/><span style={{ opacity: 0.6 }}>({hiddenCount} system events hidden)</span></>
              : 'no activity yet — waiting for HR transcript or email reply'}
          </div>
        ) : messages.map(m => <Bubble key={m.id} m={m} />)}
      </div>

      {last && (
        <footer style={{ padding: 8, borderTop: '1px solid var(--border)', fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text-quaternary)', display: 'flex', justifyContent: 'space-between' }}>
          <span>last: {new Date(last.ts).toLocaleTimeString()}</span>
          <span>{(last.channel ?? '?').toUpperCase()} · {last.role ?? '?'}</span>
        </footer>
      )}
    </div>
  );
}

function Bubble({ m }) {
  const channel = CHANNEL_META[m.channel] ?? { color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.10)', border: 'rgba(148, 163, 184, 0.30)', icon: '?' };
  const isAgent = m.role === 'agent';
  const isLead = m.role === 'lead';
  const align = isAgent ? 'flex-end' : 'flex-start';
  const ts = new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div style={{ display: 'flex', justifyContent: align }}>
      <div style={{
        maxWidth: '92%',
        background: channel.bg,
        border: `1px solid ${channel.border}`,
        borderRadius: 6,
        padding: '6px 8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ fontSize: 10 }}>{channel.icon}</span>
          <span style={{ fontSize: 9, fontFamily: 'var(--mono)', color: channel.color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {(m.role ?? 'system').toUpperCase()}
          </span>
          <span style={{ fontSize: 9, color: 'var(--text-quaternary)', fontFamily: 'var(--mono)' }}>{ts}</span>
        </div>
        <div style={{
          fontSize: 12,
          color: isAgent ? 'var(--text)' : isLead ? 'var(--text)' : 'var(--text-secondary)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          lineHeight: 1.4,
        }}>
          {m.content ?? '(empty)'}
        </div>
      </div>
    </div>
  );
}

function btnStyle(active, primary) {
  return {
    padding: '5px 10px',
    fontSize: 11,
    fontWeight: primary ? 600 : 500,
    background: active ? 'var(--bg-subtle)' : primary ? 'var(--text)' : 'transparent',
    color: primary ? 'var(--bg)' : 'var(--text-secondary)',
    border: `1px solid ${primary ? 'var(--text)' : 'var(--border)'}`,
    borderRadius: 5,
    cursor: 'pointer',
    transition: 'all 120ms ease',
  };
}

function hasRealConversation(messages) {
  const real = (messages ?? []).filter(m => m.role !== 'system');
  if (real.length < 2) return false;

  const leadMsgs = real.filter(m => isLeadRole(m.role) && hasMeaningfulContent(m.content));
  const agentMsgs = real.filter(m => isAgentRole(m.role) && hasMeaningfulContent(m.content));
  if (leadMsgs.length === 0 || agentMsgs.length === 0) return false;

  // Exclude no-answer / immediate hang-up type interactions.
  const noConversationSignals = [
    'no answer',
    'did not answer',
    'not answered',
    'voicemail',
    'went to voicemail',
    'hung up',
    'hang up',
    'call dropped',
    'unreachable',
    'line busy',
  ];
  const transcript = real.map(m => String(m.content ?? '').toLowerCase()).join(' \n ');
  if (noConversationSignals.some(s => transcript.includes(s)) && leadMsgs.length <= 1) {
    return false;
  }

  return true;
}

function isLeadRole(role) {
  return role === 'lead' || role === 'user' || role === 'customer' || role === 'contact';
}

function isAgentRole(role) {
  return role === 'agent' || role === 'assistant';
}

function hasMeaningfulContent(content) {
  const text = String(content ?? '').trim();
  if (!text) return false;
  if (text.length < 2) return false;
  if (/^[.?!,;:-]+$/.test(text)) return false;
  return true;
}
