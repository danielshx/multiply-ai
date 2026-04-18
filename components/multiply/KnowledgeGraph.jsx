'use client';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Pill, Dot, Button, Panel } from './ui';

const NODE_COLORS = {
  persona: { bg: 'var(--purple-soft)', fg: 'var(--purple)', bd: 'var(--purple-border)', dot: 'purple' },
  call_outcome: { bg: 'var(--success-soft)', fg: 'var(--success)', bd: 'var(--success-border)', dot: 'success' },
  rebuttal_pattern: { bg: 'var(--accent-soft)', fg: 'var(--accent-text)', bd: 'var(--accent-border)', dot: 'accent' },
  outcome: { bg: 'var(--info-soft)', fg: 'var(--info)', bd: 'var(--info-border)', dot: 'info' },
  objection: { bg: 'var(--warning-soft)', fg: 'var(--warning)', bd: 'var(--warning-border)', dot: 'warning' },
  default: { bg: 'var(--bg-subtle)', fg: 'var(--text-secondary)', bd: 'var(--border)', dot: 'neutral' },
};

export function KnowledgeGraph() {
  const [graph, setGraph] = useState({ nodes: [], edges: [] });
  const [error, setError] = useState(null);
  const [seeding, setSeeding] = useState(false);
  const [recallQuery, setRecallQuery] = useState('contract lock-in CTO');
  const [recallResults, setRecallResults] = useState(null);
  const [recallLoading, setRecallLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);

  const fetchGraph = async () => {
    try {
      const res = await fetch('/api/cognee/graph');
      const data = await res.json();
      setGraph(data.graph ?? { nodes: [], edges: [] });
      setError(data.error ?? null);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    fetchGraph();
    const id = setInterval(fetchGraph, 5000);
    return () => clearInterval(id);
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
    try {
      const res = await fetch('/api/cognee/recall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: recallQuery, topK: 5 }),
      });
      const data = await res.json();
      setRecallResults(data);
    } catch (e) {
      setRecallResults({ error: e.message });
    } finally {
      setRecallLoading(false);
    }
  };

  const empty = (graph.nodes?.length ?? 0) === 0;

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

      {error && (
        <div style={{
          padding: '10px 14px',
          background: 'var(--warning-soft)',
          border: '1px solid var(--warning-border)',
          borderRadius: 'var(--radius-md)',
          fontSize: 12,
          color: 'var(--warning)',
          fontFamily: 'var(--mono)',
        }}>
          Cognee unreachable — start it with <code>docker compose -f docker-compose.cognee.yml up -d</code>. ({error})
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 16 }}>
        <Panel
          title="Live graph"
          subtitle={`${graph.nodes?.length ?? 0} nodes · ${graph.edges?.length ?? 0} edges · polling 5s`}
          action={
            <div style={{ display: 'flex', gap: 6 }}>
              <Button size="xs" variant="default" onClick={seed} disabled={seeding}>
                {seeding ? 'Seeding…' : 'Seed demo data'}
              </Button>
              <Button size="xs" variant="ghost" onClick={reset} disabled={seeding}>
                Reset
              </Button>
            </div>
          }
        >
          <div style={{ height: 480, position: 'relative', overflow: 'hidden' }}>
            {empty ? (
              <EmptyState onSeed={seed} seeding={seeding} />
            ) : (
              <ForceGraph graph={graph} onNodeClick={setSelectedNode} selectedId={selectedNode?.id} />
            )}
          </div>
        </Panel>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Panel
            title="Recall test"
            subtitle="what the Negotiator sees"
          >
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

              {recallResults?.error && (
                <div style={{ fontSize: 11, color: 'var(--danger)', fontFamily: 'var(--mono)' }}>
                  {recallResults.error}
                </div>
              )}

              {recallResults?.results && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflow: 'auto' }}>
                  {recallResults.results.map((r, i) => {
                    const type = r.metadata?.node_type ?? 'default';
                    const c = NODE_COLORS[type] ?? NODE_COLORS.default;
                    return (
                      <div key={i} style={{
                        padding: 10,
                        background: c.bg,
                        border: `1px solid ${c.bd}`,
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 11,
                        color: 'var(--text-secondary)',
                        lineHeight: 1.5,
                      }}>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'center' }}>
                          <Dot color={c.dot} size={5} />
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: c.fg, fontWeight: 500, textTransform: 'uppercase', letterSpacing: 1 }}>
                            {type}
                          </span>
                          {r.score && (
                            <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-tertiary)' }}>
                              {(r.score * 100).toFixed(0)}%
                            </span>
                          )}
                        </div>
                        <div>{r.text?.slice(0, 240)}{r.text?.length > 240 && '…'}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Panel>

          {selectedNode && (
            <Panel title={selectedNode.label || selectedNode.id} subtitle={selectedNode.type ?? 'node'}>
              <div style={{ padding: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 10 }}>
                  {selectedNode.text ?? 'No text payload.'}
                </div>
                <Button size="xs" variant="ghost" onClick={() => setSelectedNode(null)}>Close</Button>
              </div>
            </Panel>
          )}
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
        Seed 21 demo learnings (5 personas, 8 prior calls, 7 rebuttal patterns) so the Negotiator has something to recall during the demo.
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

function ForceGraph({ graph, onNodeClick, selectedId }) {
  const ref = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 480 });
  const [positions, setPositions] = useState({});

  useEffect(() => {
    if (!ref.current) return;
    const obs = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ w: r.width, h: r.height });
    });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const nodes = graph.nodes ?? [];
  const edges = graph.edges ?? [];

  const initial = useMemo(() => {
    const out = {};
    nodes.forEach((n, i) => {
      const angle = (i / Math.max(nodes.length, 1)) * Math.PI * 2;
      const radius = Math.min(size.w, size.h) * 0.32;
      out[n.id] = {
        x: size.w / 2 + Math.cos(angle) * radius,
        y: size.h / 2 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
      };
    });
    return out;
  }, [nodes, size.w, size.h]);

  useEffect(() => {
    setPositions(initial);
  }, [initial]);

  useEffect(() => {
    if (nodes.length === 0) return;
    let raf;
    const step = () => {
      setPositions((prev) => {
        const next = { ...prev };
        const center = { x: size.w / 2, y: size.h / 2 };

        for (const n of nodes) {
          if (!next[n.id]) continue;
          const p = { ...next[n.id] };

          for (const m of nodes) {
            if (m.id === n.id || !next[m.id]) continue;
            const dx = p.x - next[m.id].x;
            const dy = p.y - next[m.id].y;
            const d2 = dx * dx + dy * dy + 1;
            const f = 800 / d2;
            p.vx += (dx / Math.sqrt(d2)) * f;
            p.vy += (dy / Math.sqrt(d2)) * f;
          }

          p.vx += (center.x - p.x) * 0.005;
          p.vy += (center.y - p.y) * 0.005;

          p.vx *= 0.82;
          p.vy *= 0.82;
          p.x += p.vx * 0.02;
          p.y += p.vy * 0.02;

          p.x = Math.max(40, Math.min(size.w - 40, p.x));
          p.y = Math.max(40, Math.min(size.h - 40, p.y));

          next[n.id] = p;
        }

        for (const e of edges) {
          const a = next[e.source];
          const b = next[e.target];
          if (!a || !b) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.sqrt(dx * dx + dy * dy) + 0.001;
          const target = 120;
          const f = (d - target) * 0.0015;
          a.vx += (dx / d) * f;
          a.vy += (dy / d) * f;
          b.vx -= (dx / d) * f;
          b.vy -= (dy / d) * f;
        }

        return next;
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [nodes, edges, size.w, size.h]);

  return (
    <div ref={ref} style={{ position: 'absolute', inset: 0 }}>
      <svg width={size.w} height={size.h} style={{ display: 'block' }}>
        {edges.map((e, i) => {
          const a = positions[e.source];
          const b = positions[e.target];
          if (!a || !b) return null;
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="var(--border-strong)"
              strokeWidth={1}
              opacity={0.5}
            />
          );
        })}
        {nodes.map((n) => {
          const p = positions[n.id];
          if (!p) return null;
          const c = NODE_COLORS[n.type] ?? NODE_COLORS.default;
          const selected = selectedId === n.id;
          const r = selected ? 12 : 8;
          return (
            <g key={n.id} transform={`translate(${p.x},${p.y})`} onClick={() => onNodeClick(n)} style={{ cursor: 'pointer' }}>
              <circle r={r + 4} fill={c.bg} opacity={0.6} />
              <circle r={r} fill={c.fg} stroke="white" strokeWidth={2} />
              <text
                y={r + 14}
                textAnchor="middle"
                fontSize={10}
                fontFamily="var(--mono)"
                fill="var(--text-secondary)"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {(n.label ?? n.id ?? '').slice(0, 22)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
