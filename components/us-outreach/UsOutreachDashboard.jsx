'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { Wordmark, Pill, Dot } from '@/components/multiply/ui';
import { DialerPanel } from './DialerPanel';
import { CallTable } from './CallTable';
import { RevenueWidget } from './RevenueWidget';
import { TranscriptDrawer } from './TranscriptDrawer';
import { LiveCallsPanel } from './LiveCallsPanel';
import { MetricsPanel } from './MetricsPanel';
import { CampaignPanel } from './CampaignPanel';

const DEFAULT_COMMISSION = Number(process.env.NEXT_PUBLIC_DEFAULT_COMMISSION_USD ?? 25);

export default function UsOutreachDashboard() {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [commission, setCommission] = useState(DEFAULT_COMMISSION);
  const [openCallId, setOpenCallId] = useState(null);
  const [messageCounts, setMessageCounts] = useState({});
  const [lastMessageByCall, setLastMessageByCall] = useState({});
  const [autoOpenedIds, setAutoOpenedIds] = useState(new Set());
  const [dbTotals, setDbTotals] = useState({
    calls: 0,
    messages: 0,
    closed: 0,
    failed: 0,
    not_interested: 0,
  });

  useEffect(() => {
    const sb = getBrowserSupabase();
    let cancelled = false;

    // Auto-cleanup: resolve any "live" rows stuck >5min before loading.
    fetch('/api/us-outreach/cleanup', { method: 'POST' }).catch(() => null);

    sb.from('us_outreach_calls')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000)
      .then(({ data }) => {
        if (cancelled) return;
        setCalls(data ?? []);
        setLoading(false);
      });

    // Poll authoritative DB counts so the KPI strip can never drift or shrink
    // from transient state issues. Every 4s.
    const fetchTotals = async () => {
      const [callsRes, msgsRes, closedRes, failedRes, notInterestedRes] = await Promise.all([
        sb.from('us_outreach_calls').select('*', { count: 'exact', head: true }),
        sb.from('us_outreach_messages').select('*', { count: 'exact', head: true }),
        sb
          .from('us_outreach_calls')
          .select('*', { count: 'exact', head: true })
          .eq('disposition', 'closed'),
        sb
          .from('us_outreach_calls')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'failed'),
        sb
          .from('us_outreach_calls')
          .select('*', { count: 'exact', head: true })
          .eq('disposition', 'not_interested'),
      ]);
      if (cancelled) return;
      setDbTotals({
        calls: callsRes.count ?? 0,
        messages: msgsRes.count ?? 0,
        closed: closedRes.count ?? 0,
        failed: failedRes.count ?? 0,
        not_interested: notInterestedRes.count ?? 0,
      });
    };
    fetchTotals();
    const totalsPoll = setInterval(fetchTotals, 4000);

    sb.from('us_outreach_messages')
      .select('call_id, role, content, ts')
      .limit(2000)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const counts = {};
        const lastByCall = {};
        for (const row of data) {
          counts[row.call_id] = (counts[row.call_id] ?? 0) + 1;
          const prev = lastByCall[row.call_id];
          const t = new Date(row.ts ?? 0).getTime();
          if (!prev || t > prev.t) {
            lastByCall[row.call_id] = { t, role: row.role, content: row.content };
          }
        }
        setMessageCounts(counts);
        setLastMessageByCall(lastByCall);
      });

    const msgCh = sb
      .channel('realtime:us_outreach_messages:counts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'us_outreach_messages' },
        (payload) => {
          const row = payload.new;
          if (!row?.call_id) return;
          setMessageCounts((prev) => ({ ...prev, [row.call_id]: (prev[row.call_id] ?? 0) + 1 }));
          setLastMessageByCall((prev) => {
            const t = new Date(row.ts ?? 0).getTime();
            const cur = prev[row.call_id];
            if (cur && t <= cur.t) return prev;
            return { ...prev, [row.call_id]: { t, role: row.role, content: row.content } };
          });
        },
      )
      .subscribe();

    const ch = sb
      .channel('realtime:us_outreach_calls')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'us_outreach_calls' },
        (payload) => {
          setCalls((prev) => {
            const row = payload.new ?? payload.old;
            if (!row) return prev;
            if (payload.eventType === 'DELETE') {
              return prev.filter((c) => c.id !== row.id);
            }
            const idx = prev.findIndex((c) => c.id === row.id);
            if (idx >= 0) {
              const copy = prev.slice();
              copy[idx] = { ...copy[idx], ...row };
              return copy;
            }
            return [row, ...prev].slice(0, 200);
          });
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setConnected(true);
      });

    return () => {
      cancelled = true;
      sb.removeChannel(ch);
      sb.removeChannel(msgCh);
      clearInterval(totalsPoll);
      setConnected(false);
    };
  }, []);

  // Poll /api/us-outreach/sync for any non-terminal call. Pulls run status,
  // session_id, and any new messages from HR — covers the case where HR's
  // outgoing webhook isn't firing live message events.
  useEffect(() => {
    const activeIds = calls
      .filter((c) => c.status === 'triggered' || c.status === 'live')
      .map((c) => c.id);
    if (activeIds.length === 0) return;
    let cancelled = false;
    const tick = async () => {
      await Promise.all(
        activeIds.map((id) =>
          fetch(`/api/us-outreach/sync/${id}`)
            .then((r) => r.json())
            .catch(() => null),
        ),
      );
    };
    tick();
    const t = setInterval(() => {
      if (!cancelled) tick();
    }, 2500);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [calls.map((c) => `${c.id}:${c.status}`).join(',')]);

  // Drawer only opens on explicit click. Auto-open removed.

  const stats = useMemo(() => {
    const placed = dbTotals.calls || calls.length;
    const connectedCalls = calls.filter((c) => {
      const msgs = messageCounts[c.id] ?? 0;
      if (c.disposition) return true;
      if (msgs > 2) return true;
      if (c.connected_at) return true;
      return false;
    }).length;
    // Authoritative closed count from DB — never affected by in-memory state.
    const closed = dbTotals.closed;
    const earnings = closed * commission;
    return { placed, connected: connectedCalls, closed, earnings };
  }, [calls, commission, dbTotals, messageCounts]);

  const openCall = openCallId ? calls.find((c) => c.id === openCallId) : null;

  const handleTrigger = async ({ phone, name }) => {
    const res = await fetch('/api/us-outreach/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone_number: phone, contact_name: name }),
    });
    return res.json();
  };

  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        background: 'var(--bg)',
        color: 'var(--text)',
        overflow: 'auto',
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 1480,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <Header connected={connected} />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(360px, 1fr) minmax(0, 1.6fr)',
            gap: 16,
          }}
        >
          <DialerPanel onTrigger={handleTrigger} />
          <RevenueWidget
            stats={stats}
            commission={commission}
            onCommissionChange={setCommission}
          />
        </div>

        <CampaignPanel onTrigger={handleTrigger} />

        <LiveCallsPanel calls={calls} onOpen={(id) => setOpenCallId(id)} />

        <MetricsPanel
          calls={calls}
          messageCounts={messageCounts}
          commission={commission}
          dbTotals={dbTotals}
        />

        <CallTable
          calls={calls}
          loading={loading}
          commission={commission}
          messageCounts={messageCounts}
          lastMessageByCall={lastMessageByCall}
          onOpen={(id) => setOpenCallId(id)}
        />
      </div>

      <TranscriptDrawer
        call={openCall}
        onClose={() => setOpenCallId(null)}
      />
    </div>
  );
}

function Header({ connected }) {
  const [syncing, setSyncing] = React.useState(false);
  async function syncAll() {
    if (syncing) return;
    setSyncing(true);
    try {
      await fetch('/api/us-outreach/sync-all', { method: 'POST' });
    } finally {
      setTimeout(() => setSyncing(false), 800);
    }
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <Wordmark size={16} />
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--mono)', padding: '2px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
          /us-outreach
        </span>
        <h1 className="serif" style={{ fontSize: 22, letterSpacing: -0.4, fontWeight: 400, color: 'var(--text)' }}>
          US Cold Calls · Paid Online Writing Jobs
        </h1>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={syncAll}
          disabled={syncing}
          style={{
            fontSize: 11,
            padding: '5px 12px',
            background: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-sm)',
            color: syncing ? 'var(--text-tertiary)' : 'var(--text)',
            cursor: syncing ? 'default' : 'pointer',
            fontFamily: 'var(--mono)',
          }}
        >
          {syncing ? 'syncing…' : '↻ refresh'}
        </button>
        <Pill color={connected ? 'success' : 'neutral'} size="sm">
          <Dot color={connected ? 'success' : 'neutral'} pulse={connected} size={5} />
          {connected ? 'realtime' : 'connecting…'}
        </Pill>
      </div>
    </div>
  );
}
