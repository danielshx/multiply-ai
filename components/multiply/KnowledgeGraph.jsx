'use client';
import React, { useState, useEffect } from 'react';
import { Dot, Button, Panel } from './ui';
import { CogneeIntelligence } from './CogneeIntelligence';
import { CogneeForceGraph } from './CogneeForceGraph';

const NODE_COLORS = {
  persona: { bg: 'var(--purple-soft)', fg: 'var(--purple)', bd: 'var(--purple-border)', dot: 'purple' },
  call_outcome: { bg: 'var(--success-soft)', fg: 'var(--success)', bd: 'var(--success-border)', dot: 'success' },
  rebuttal_pattern: { bg: 'var(--accent-soft)', fg: 'var(--accent-text)', bd: 'var(--accent-border)', dot: 'accent' },
  outcome: { bg: 'var(--info-soft)', fg: 'var(--info)', bd: 'var(--info-border)', dot: 'info' },
  objection: { bg: 'var(--warning-soft)', fg: 'var(--warning)', bd: 'var(--warning-border)', dot: 'warning' },
  default: { bg: 'var(--bg-subtle)', fg: 'var(--text-secondary)', bd: 'var(--border)', dot: 'neutral' },
};

export function KnowledgeGraph() {
  const [graph, setGraph] = useState(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [recallQuery, setRecallQuery] = useState('contract lock-in CTO');
  const [recallResults, setRecallResults] = useState(null);
  const [recallLoading, setRecallLoading] = useState(false);
  const [highlight, setHighlight] = useState(null);

  const fetchGraph = async () => {
    try {
      const res = await fetch('/api/cognee/graph-data', { cache: 'no-store' });
      const data = await res.json();
      setGraph(data);
    } catch (e) {
      console.warn('graph-data failed', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraph();
  }, []);

  const seed = async () => {
    setSeeding(true);
    try {
      await fetch('/api/cognee/seed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reset: false }) });
      await fetchGraph();
    } finally {
      setSeeding(false);
    }
  };

  const reset = async () => {
    setSeeding(true);
    try {
      await fetch('/api/cognee/seed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reset: true }) });
      await fetchGraph();
    } finally {
      setSeeding(false);
    }
  };

  const recall = async () => {
    if (!recallQuery.trim()) return;
    setRecallLoading(true);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch('/api/cognee/recall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: recallQuery, topK: 5, searchType: 'CHUNKS' }),
        signal: ctrl.signal,
      });
      const data = await res.json();
      setRecallResults(data);
      const ids = matchHighlights(graph, recallQuery);
      setHighlight(ids);
    } catch (e) {
      const local = localFallbackRecall(graph, recallQuery, 5);
      setRecallResults({
        results: local,
        fallback: true,
        error: e.name === 'AbortError' ? 'cognee timed out — showing local seed-derived hits' : e.message,
      });
      setHighlight(matchHighlights(graph, recallQuery));
    } finally {
      clearTimeout(timer);
      setRecallLoading(false);
    }
  };

  const sourceBadge = graph?.source === 'cognee'
    ? { color: 'success', label: 'cognee · live' }
    : graph?.source === 'fallback'
    ? { color: 'warning', label: 'cognee unreachable · derived snapshot' }
    : { color: 'accent', label: 'derived from 64 seed-learnings' };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 className="serif" style={{ fontSize: 28, letterSpacing: -0.6, fontWeight: 400, marginBottom: 4 }}>
          Knowledge graph
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Cognee-backed memory. Every call, dossier, and rebuttal pattern connects here. The Negotiator queries this graph live before each turn.
        </p>
      </div>

      <CogneeIntelligence onResultsHighlight={(q) => setHighlight(matchHighlights(graph, q))} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 16 }}>
        <Panel
          title="Live graph"
          subtitle={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Dot color={sourceBadge.color} size={5} pulse={graph?.source === 'cognee'} />
              {sourceBadge.label}
              {graph?.stats && (
                <span style={{ color: 'var(--text-tertiary)' }}>· {graph.stats.totalNodes} nodes · {graph.stats.totalEdges} edges</span>
              )}
            </span>
          }
          action={
            <div style={{ display: 'flex', gap: 6 }}>
              <Button size="xs" variant="ghost" onClick={fetchGraph} disabled={loading}>
                {loading ? '…' : 'Refresh'}
              </Button>
              <Button size="xs" variant="default" onClick={seed} disabled={seeding}>
                {seeding ? 'Seeding…' : 'Seed cognee'}
              </Button>
              <Button size="xs" variant="ghost" onClick={reset} disabled={seeding}>
                Reset
              </Button>
            </div>
          }
        >
          <div style={{ height: 520, position: 'relative', overflow: 'hidden', background: '#fff' }}>
            {loading ? (
              <LoadingState />
            ) : !graph?.nodes?.length ? (
              <EmptyState onSeed={seed} seeding={seeding} />
            ) : (
              <CogneeForceGraph
                data={graph}
                height={520}
                highlightedIds={highlight}
                onNodeClick={(n) => {
                  const next = new Set([n.id]);
                  for (const e of graph.edges) {
                    if (e.source === n.id || e.target === n.id) {
                      next.add(typeof e.source === 'string' ? e.source : e.source.id);
                      next.add(typeof e.target === 'string' ? e.target : e.target.id);
                    }
                  }
                  setHighlight(next);
                }}
              />
            )}
          </div>
        </Panel>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Panel title="Recall test" subtitle="what the Negotiator sees">
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                <input
                  value={recallQuery}
                  onChange={(e) => setRecallQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && recall()}
                  placeholder="e.g. contract lock-in CTO post-Series-B"
                  style={{
                    flex: 1, fontSize: 12, padding: '8px 10px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border-strong)',
                    borderRadius: 'var(--radius-sm)',
                    fontFamily: 'var(--mono)',
                  }}
                />
                <Button size="sm" variant="primary" onClick={recall} disabled={recallLoading}>
                  {recallLoading ? '…' : 'Recall'}
                </Button>
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
                {[
                  'contract lock-in CTO',
                  'GDPR data residency FinTech',
                  'frozen budget Q1',
                  'vendor fatigue late-stage',
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => setRecallQuery(q)}
                    style={{
                      fontSize: 10, padding: '3px 8px',
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

              {recallResults?.fallback && (
                <div style={{ fontSize: 10, color: 'var(--warning)', fontFamily: 'var(--mono)', marginBottom: 8 }}>
                  ⚠ {recallResults.error}
                </div>
              )}

              {recallResults?.results?.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflow: 'auto' }}>
                  {recallResults.results.map((r, i) => {
                    const meta = r?.metadata ?? {};
                    const chipKeys = ['node_type', 'persona_role', 'industry', 'rebuttal_pattern', 'outcome', 'region'];
                    const chips = chipKeys.filter((k) => typeof meta[k] === 'string').slice(0, 5);
                    return (
                      <div key={r.node_id ?? i} style={{
                        padding: 12,
                        background: i === 0 ? 'var(--accent-soft)' : 'var(--bg-subtle)',
                        border: `1px solid ${i === 0 ? 'var(--accent-border)' : 'var(--border-subtle)'}`,
                        borderRadius: 'var(--radius-md)',
                        fontSize: 12,
                        color: 'var(--text)',
                        lineHeight: 1.55,
                      }}>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          <Dot color="accent" size={5} pulse={i === 0} />
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: i === 0 ? 'var(--accent-text)' : 'var(--text-tertiary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 1 }}>
                            {i === 0 ? 'Top hit' : `Hit ${i + 1}`}
                          </span>
                          {chips.map((k) => (
                            <span key={k} style={{
                              fontSize: 9, fontFamily: 'var(--mono)',
                              padding: '1px 6px', borderRadius: 999,
                              background: 'var(--surface)', border: '1px solid var(--border)',
                              color: 'var(--text-secondary)',
                            }}>
                              {k === 'node_type' ? String(meta[k]).replace(/_/g, ' ') : `${k.replace(/_/g, ' ')}: ${meta[k]}`}
                            </span>
                          ))}
                        </div>
                        <div style={{ whiteSpace: 'pre-wrap' }}>{r.text}</div>
                      </div>
                    );
                  })}
                </div>
              )}
              {recallResults && !recallResults.fallback && (recallResults.results?.length ?? 0) === 0 && !recallResults.error && (
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--mono)' }}>
                  No hits — graph may still be cognifying. Try again in 30-60s.
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>

      <Panel title="What this enables" subtitle="cognee differentiator">
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <Bullet
            tone="purple"
            label="Persona-aware rebuttals"
            body="Negotiator picks a rebuttal pattern weighted by win-rate for the actual persona on the line, not a generic playbook."
          />
          <Bullet
            tone="success"
            label="Cross-call learning"
            body="Every booked / lost call updates the graph. After 100 calls the system knows what works; after 1000 it's a moat."
          />
          <Bullet
            tone="accent"
            label="Researcher cache"
            body="No re-scraping LinkedIn. Dossiers, prior touches, and stack changes are recalled in milliseconds."
          />
        </div>
      </Panel>
    </div>
  );
}

function matchHighlights(graph, query) {
  if (!graph?.nodes || !query) return null;
  const q = query.toLowerCase();
  const tokens = q.split(/[^a-z0-9]+/).filter(t => t.length > 2);
  if (!tokens.length) return null;
  const ids = new Set();
  for (const n of graph.nodes) {
    const hay = `${n.label} ${n.id} ${n.type}`.toLowerCase();
    if (tokens.some(t => hay.includes(t))) ids.add(n.id);
  }
  return ids.size ? ids : null;
}

function localFallbackRecall(graph, query, topK = 5) {
  if (!query) return [];
  const q = query.toLowerCase();
  const tokens = q.split(/[^a-z0-9]+/).filter(t => t.length > 2);
  if (!tokens.length || !graph?.nodes) return [];
  const scored = graph.nodes.map(n => {
    const hay = `${n.label} ${n.id} ${n.type}`.toLowerCase();
    const score = tokens.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0);
    return { n, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, topK);
  return scored.map(({ n }) => ({ text: `${n.type.replace('_', ' ')} · ${n.label} (weight ${n.weight})` }));
}

function LoadingState() {
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
      <Dot color="accent" pulse size={6} />
      <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-tertiary)' }}>
        building graph…
      </span>
    </div>
  );
}

function EmptyState({ onSeed, seeding }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 12, padding: 24,
    }}>
      <div className="serif" style={{ fontSize: 22, color: 'var(--text-tertiary)', letterSpacing: -0.4 }}>
        Empty graph.
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center', maxWidth: 360, lineHeight: 1.55 }}>
        Seed 64 demo learnings (12 personas, 20 prior calls, 15 rebuttal patterns) so the Negotiator has something to recall during the demo.
      </div>
      <Button size="sm" variant="primary" onClick={onSeed} disabled={seeding}>
        {seeding ? 'Seeding…' : 'Seed demo data'}
      </Button>
    </div>
  );
}

function Bullet({ tone, label, body }) {
  const c = NODE_COLORS[tone === 'purple' ? 'persona' : tone === 'success' ? 'call_outcome' : 'rebuttal_pattern'];
  return (
    <div style={{
      padding: 14,
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
    }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
        <Dot color={c.dot} size={6} />
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{label}</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{body}</div>
    </div>
  );
}
