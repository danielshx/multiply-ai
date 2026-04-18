'use client';
import React, { useState, useEffect } from 'react';
import { Dot, Button, Panel } from './ui';

const NODE_COLORS = {
  persona: { bg: 'var(--purple-soft)', fg: 'var(--purple)', bd: 'var(--purple-border)', dot: 'purple' },
  call_outcome: { bg: 'var(--success-soft)', fg: 'var(--success)', bd: 'var(--success-border)', dot: 'success' },
  rebuttal_pattern: { bg: 'var(--accent-soft)', fg: 'var(--accent-text)', bd: 'var(--accent-border)', dot: 'accent' },
  outcome: { bg: 'var(--info-soft)', fg: 'var(--info)', bd: 'var(--info-border)', dot: 'info' },
  objection: { bg: 'var(--warning-soft)', fg: 'var(--warning)', bd: 'var(--warning-border)', dot: 'warning' },
  default: { bg: 'var(--bg-subtle)', fg: 'var(--text-secondary)', bd: 'var(--border)', dot: 'neutral' },
};

export function KnowledgeGraph() {
  const [datasetId, setDatasetId] = useState(null);
  const [error, setError] = useState(null);
  const [seeding, setSeeding] = useState(false);
  const [recallQuery, setRecallQuery] = useState('contract lock-in CTO');
  const [recallResults, setRecallResults] = useState(null);
  const [recallLoading, setRecallLoading] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  const fetchGraph = async () => {
    try {
      const res = await fetch('/api/cognee/graph');
      const data = await res.json();
      setDatasetId(data.datasetId ?? null);
      setError(data.error ?? null);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    fetchGraph();
    const id = setInterval(fetchGraph, 8000);
    return () => clearInterval(id);
  }, []);

  const seed = async () => {
    setSeeding(true);
    try {
      await fetch('/api/cognee/seed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reset: false }) });
      await fetchGraph();
      setIframeKey(k => k + 1);
    } finally {
      setSeeding(false);
    }
  };

  const reset = async () => {
    setSeeding(true);
    try {
      await fetch('/api/cognee/seed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reset: true }) });
      await fetchGraph();
      setIframeKey(k => k + 1);
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

  const empty = !datasetId;

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
          subtitle={datasetId ? `dataset · cognee cloud` : 'no dataset yet'}
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
          <div style={{ height: 520, position: 'relative', overflow: 'hidden', background: '#fff' }}>
            {empty ? (
              <EmptyState onSeed={seed} seeding={seeding} />
            ) : (
              <iframe
                key={iframeKey}
                src={`/api/cognee/graph?format=html&t=${iframeKey}`}
                title="Cognee knowledge graph"
                style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              />
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

              {recallResults?.results?.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflow: 'auto' }}>
                  {recallResults.results.map((r, i) => (
                    <div key={i} style={{
                      padding: 12,
                      background: 'var(--accent-soft)',
                      border: '1px solid var(--accent-border)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 12,
                      color: 'var(--text)',
                      lineHeight: 1.55,
                    }}>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                        <Dot color="accent" size={5} pulse={i === 0} />
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--accent-text)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 1 }}>
                          {i === 0 ? 'Top answer · GRAPH_COMPLETION' : `Hit ${i + 1}`}
                        </span>
                      </div>
                      <div>{r.text}</div>
                    </div>
                  ))}
                </div>
              )}
              {recallResults && (recallResults.results?.length ?? 0) === 0 && !recallResults.error && (
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

