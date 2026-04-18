'use client';
import React, { useEffect, useState } from 'react';
import { Dot, Pill, Button } from './ui';

export function CogneeIntelligence({ onResultsHighlight }) {
  const [stats, setStats] = useState(null);
  const [askQuery, setAskQuery] = useState('');
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [seeding, setSeeding] = useState(false);

  const loadStats = async () => {
    try {
      const res = await fetch('/api/cognee/stats', { cache: 'no-store' });
      const d = await res.json();
      setStats(d);
    } catch {}
  };

  useEffect(() => { loadStats(); }, []);

  const ask = async (q) => {
    const query = q ?? askQuery;
    if (!query?.trim()) return;
    setAsking(true);
    setAnswer(null);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8_000);
    try {
      const res = await fetch('/api/cognee/recall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, topK: 3, searchType: 'CHUNKS' }),
        signal: ctrl.signal,
      });
      const data = await res.json();
      if (!data?.results?.length) {
        const fallback = await deriveFallback(query);
        setAnswer({ ...fallback, fallback: true, reason: 'cognee returned no hits — showing seed-derived answer' });
      } else {
        setAnswer(data);
      }
      onResultsHighlight?.(query);
    } catch (e) {
      const fallback = await deriveFallback(query);
      setAnswer({
        ...fallback,
        fallback: true,
        reason: e.name === 'AbortError'
          ? 'cognee timed out — showing seed-derived answer'
          : `cognee error: ${e.message}`,
      });
      onResultsHighlight?.(query);
    } finally {
      clearTimeout(timer);
      setAsking(false);
    }
  };

  const forceReseed = async () => {
    setSeeding(true);
    try {
      await fetch('/api/cognee/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: true }),
      });
      await loadStats();
    } finally {
      setSeeding(false);
    }
  };

  const presetQueries = [
    'Sarah Chen Northwind contract lock-in CTO',
    'GDPR data residency FinTech objection',
    'Q1 frozen budget how to close',
    'how to approach HealthTech compliance officer',
    'post-Series-B CTO best opener',
    'vendor fatigue test-fatigued buyer',
    'procurement 90 days workaround',
    'multi-call journey examples',
  ];

  const dist = stats?.distribution ?? {};

  return (
    <div style={{
      background: 'linear-gradient(135deg, var(--surface) 0%, var(--accent-soft) 180%)',
      border: '1px solid var(--accent-border)',
      borderRadius: 'var(--radius-lg)',
      padding: 20,
      boxShadow: 'var(--shadow-sm)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute',
        top: -40, right: -40,
        width: 200, height: 200,
        background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)',
        opacity: 0.08,
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 20 }}>🧠</span>
            <h3 className="serif" style={{ fontSize: 22, letterSpacing: -0.4, fontWeight: 400 }}>
              Cognee Intelligence
            </h3>
            <Pill size="xs" color="purple">Knowledge Graph</Pill>
            {stats && (
              <Pill size="xs" color={stats.cogneeReachable ? 'success' : 'warning'}>
                {stats.cogneeReachable ? 'cognee live' : 'cognee offline'}
              </Pill>
            )}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Every call, dossier, and rebuttal pattern lives here. The graph grows with each conversation — ask it anything.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Button size="xs" variant="default" onClick={loadStats}>Refresh</Button>
          <Button size="xs" variant="ghost" onClick={forceReseed} disabled={seeding}>
            {seeding ? 'Reseeding…' : 'Reset + reseed'}
          </Button>
        </div>
      </div>

      {stats && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 6,
          marginBottom: 16,
          position: 'relative',
        }}>
          <StatBadge label="Prior calls"  value={dist.prior_calls ?? 0}        color="success" />
          <StatBadge label="Personas"     value={dist.personas ?? 0}           color="purple" />
          <StatBadge label="Rebuttals"    value={dist.rebuttal_patterns ?? 0}  color="accent" />
          <StatBadge label="Industries"   value={dist.industry_playbooks ?? 0} color="info" />
          <StatBadge label="Temporal"     value={dist.temporal_patterns ?? 0}  color="warning" />
          <StatBadge label="Journeys"     value={dist.journeys ?? 0}           color="accent" />
          <StatBadge label="Total"        value={stats.total ?? 0}             color="neutral" emphasis />
        </div>
      )}

      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius-md)',
        padding: 14,
        position: 'relative',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <Dot color="accent" pulse size={5} />
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 500 }}>
            Ask the graph · live recall
          </span>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <input
            value={askQuery}
            onChange={(e) => setAskQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && ask()}
            placeholder="How do I handle a post-raise CTO who raises contract lock-in?"
            style={{
              flex: 1,
              fontSize: 13,
              padding: '10px 12px',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--sans)',
            }}
          />
          <Button variant="primary" size="md" onClick={() => ask()} disabled={asking || !askQuery.trim()}>
            {asking ? 'Thinking…' : 'Ask →'}
          </Button>
        </div>

        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
          {presetQueries.map((q) => (
            <button
              key={q}
              onClick={() => { setAskQuery(q); ask(q); }}
              style={{
                fontSize: 10,
                padding: '3px 8px',
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border)',
                borderRadius: 999,
                color: 'var(--text-secondary)',
                fontFamily: 'var(--mono)',
                cursor: 'pointer',
              }}
            >
              {q}
            </button>
          ))}
        </div>

        {answer && (
          <div style={{ marginTop: 10 }}>
            {answer.fallback && (
              <div style={{
                padding: 8, fontSize: 10, color: 'var(--warning)',
                background: 'var(--warning-soft)', border: '1px solid var(--warning-border)',
                borderRadius: 'var(--radius-sm)', fontFamily: 'var(--mono)', marginBottom: 8,
              }}>
                ⚠ {answer.reason}
              </div>
            )}
            {answer.results?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {answer.results.slice(0, 3).map((r, i) => (
                  <div key={i} style={{
                    padding: 12,
                    background: i === 0 ? 'var(--accent-soft)' : 'var(--bg-subtle)',
                    border: `1px solid ${i === 0 ? 'var(--accent-border)' : 'var(--border-subtle)'}`,
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 13,
                    lineHeight: 1.55,
                  }}>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                      <span style={{
                        fontSize: 9, fontFamily: 'var(--mono)',
                        color: i === 0 ? 'var(--accent-text)' : 'var(--text-tertiary)',
                        textTransform: 'uppercase', letterSpacing: 1, fontWeight: 500,
                      }}>
                        {i === 0 ? '✨ Top answer' : `Supporting hit ${i + 1}`}
                      </span>
                    </div>
                    {r.text}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: 10, fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--mono)' }}>
                No matches — try a broader query.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

async function deriveFallback(query) {
  try {
    const res = await fetch('/api/cognee/graph-data?source=derived', { cache: 'no-store' });
    const g = await res.json();
    const tokens = query.toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 2);
    if (!tokens.length || !g?.nodes) return { results: [] };
    const scored = g.nodes.map(n => {
      const hay = `${n.label} ${n.id} ${n.type}`.toLowerCase();
      const score = tokens.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0);
      return { n, score };
    }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
    return {
      results: scored.map(({ n }) => ({
        text: `${n.type.replace('_', ' ')} · ${n.label} (graph weight ${n.weight}). Connected to ${countConnections(g, n.id)} other nodes.`,
      })),
    };
  } catch {
    return { results: [] };
  }
}

function countConnections(g, id) {
  let c = 0;
  for (const e of g.edges) {
    if (e.source === id || e.target === id) c++;
  }
  return c;
}

function StatBadge({ label, value, color, emphasis }) {
  const bg = {
    success: 'var(--success-soft)',
    purple: 'var(--purple-soft)',
    accent: 'var(--accent-soft)',
    info: 'var(--info-soft)',
    warning: 'var(--warning-soft)',
    neutral: 'var(--bg-subtle)',
  }[color] ?? 'var(--bg-subtle)';
  const fg = {
    success: 'var(--success)',
    purple: 'var(--purple)',
    accent: 'var(--accent-text)',
    info: 'var(--info)',
    warning: 'var(--warning)',
    neutral: 'var(--text)',
  }[color] ?? 'var(--text)';

  return (
    <div style={{
      padding: emphasis ? '8px 10px' : '6px 8px',
      background: emphasis ? 'var(--text)' : bg,
      border: `1px solid ${emphasis ? 'var(--text)' : 'transparent'}`,
      color: emphasis ? '#fff' : fg,
      borderRadius: 'var(--radius-sm)',
      textAlign: 'center',
    }}>
      <div className="serif" style={{ fontSize: 20, letterSpacing: -0.5, fontWeight: 400, lineHeight: 1, marginBottom: 2 }}>
        {value}
      </div>
      <div style={{
        fontSize: 9, fontFamily: 'var(--mono)', textTransform: 'uppercase',
        letterSpacing: 0.5, opacity: emphasis ? 1 : 0.85,
      }}>
        {label}
      </div>
    </div>
  );
}
