'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Dot, Pill } from './ui';

/**
 * Live visualization of all 7 agents as a breathing graph.
 * Center = coordinator, petals = specialist agents.
 * Connections pulse when agents hand off work.
 */
const AGENTS = [
  { key: 'signal',       label: 'Signal Hunter',  emoji: '📡', color: 'accent',  tasks: ['mining 12 sources', 'ICP scoring', 'stack diff watch'] },
  { key: 'prospector',   label: 'Prospector',     emoji: '🎯', color: 'info',    tasks: ['enriching firmographics', 'finding decision-makers'] },
  { key: 'researcher',   label: 'Researcher',     emoji: '🧠', color: 'purple',  tasks: ['building dossiers', 'indexing talks/posts'] },
  { key: 'personaliser', label: 'Personaliser',   emoji: '✨', color: 'accent',  tasks: ['drafting opener', 'tone calibration'] },
  { key: 'qualifier',    label: 'Qualifier',      emoji: '💬', color: 'success', tasks: ['BANT extraction', 'live call'] },
  { key: 'negotiator',   label: 'Negotiator',     emoji: '🛡', color: 'warning', tasks: ['47 rebuttal patterns', 'standby'] },
  { key: 'closer',       label: 'Closer',         emoji: '🤝', color: 'info',    tasks: ['calendar booking', 'contract prep'] },
];

export function AgentOrchestra() {
  const canvasRef = useRef(null);
  const [activePair, setActivePair] = useState(null);
  const [tick, setTick] = useState(0);
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 2200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    // Randomly light up a handoff every ~3s for live feel
    const pairs = [
      ['signal', 'prospector'], ['prospector', 'researcher'],
      ['researcher', 'personaliser'], ['personaliser', 'qualifier'],
      ['qualifier', 'negotiator'], ['qualifier', 'closer'],
      ['negotiator', 'qualifier'], ['closer', 'personaliser'],
    ];
    const id = setInterval(() => {
      const p = pairs[Math.floor(Math.random() * pairs.length)];
      setActivePair(p);
      setTimeout(() => setActivePair(null), 1600);
    }, 2800);
    return () => clearInterval(id);
  }, []);

  const size = 520;
  const center = size / 2;
  const radius = 180;

  const nodes = AGENTS.map((a, i) => {
    const angle = (i / AGENTS.length) * Math.PI * 2 - Math.PI / 2;
    return { ...a, x: center + Math.cos(angle) * radius, y: center + Math.sin(angle) * radius };
  });

  const colorMap = {
    accent:  'var(--accent)',
    info:    'var(--info)',
    purple:  'var(--purple)',
    success: 'var(--success)',
    warning: 'var(--warning)',
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <h1 className="serif" style={{ fontSize: 34, letterSpacing: -0.8, fontWeight: 400, marginBottom: 4 }}>
          Agent orchestra
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Seven specialists, one mission. Watch them hand off work in real time — every glowing edge is a live agent-to-agent dispatch.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)', gap: 16 }}>
        {/* Network visualization */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden',
          position: 'relative',
          aspectRatio: '1 / 1',
          maxHeight: 580,
        }}>
          <div style={{
            position: 'absolute', top: 14, left: 14,
            fontSize: 10, fontFamily: 'var(--mono)', letterSpacing: 1,
            textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 500,
          }}>
            LIVE · 7 agents · 24/7
          </div>

          <svg
            viewBox={`0 0 ${size} ${size}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          >
            <defs>
              <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.4" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
              </radialGradient>
              <filter id="blurLine">
                <feGaussianBlur stdDeviation="1.2" />
              </filter>
            </defs>

            {/* Dotted grid */}
            {Array.from({ length: 12 }).map((_, i) => (
              <circle
                key={i}
                cx={center}
                cy={center}
                r={25 + i * 22}
                fill="none"
                stroke="var(--border-subtle)"
                strokeWidth={0.4}
                strokeDasharray="2 6"
                opacity={0.7}
              />
            ))}

            {/* Soft center glow */}
            <circle cx={center} cy={center} r={radius} fill="url(#coreGlow)" />

            {/* Edges from center → each agent */}
            {nodes.map((n, i) => {
              const isActive = activePair?.includes(n.key) && activePair?.length === 2;
              return (
                <line
                  key={i}
                  x1={center}
                  y1={center}
                  x2={n.x}
                  y2={n.y}
                  stroke={isActive ? colorMap[n.color] : 'var(--border)'}
                  strokeWidth={isActive ? 2 : 1}
                  opacity={isActive ? 0.9 : 0.45}
                  style={{ transition: 'all 280ms ease' }}
                />
              );
            })}

            {/* Handoff pulse on active pair */}
            {activePair && (() => {
              const a = nodes.find(n => n.key === activePair[0]);
              const b = nodes.find(n => n.key === activePair[1]);
              if (!a || !b) return null;
              return (
                <line
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke={colorMap[a.color]}
                  strokeWidth={2.5}
                  opacity={0.9}
                  filter="url(#blurLine)"
                />
              );
            })()}

            {/* Center "Coordinator" */}
            <g>
              <circle cx={center} cy={center} r={30} fill="var(--surface)" stroke="var(--accent)" strokeWidth={1.5} />
              <circle cx={center} cy={center} r={30} fill="none" stroke="var(--accent)" strokeWidth={1} opacity={0.25}>
                <animate attributeName="r" from="30" to="58" dur="2.4s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.45" to="0" dur="2.4s" repeatCount="indefinite" />
              </circle>
              <text
                x={center} y={center - 2}
                textAnchor="middle" dominantBaseline="middle"
                fontSize="20"
              >
                🧬
              </text>
              <text
                x={center} y={center + 14}
                textAnchor="middle" dominantBaseline="middle"
                fontSize="9" fill="var(--text-secondary)"
                fontFamily="var(--mono)" letterSpacing="1"
              >
                ORCHESTRATOR
              </text>
            </g>

            {/* Agent petals */}
            {nodes.map((n, i) => {
              const isActive = activePair?.includes(n.key);
              const r = isActive ? 30 : 26;
              return (
                <g
                  key={n.key}
                  transform={`translate(${n.x} ${n.y})`}
                  onMouseEnter={() => setHovered(n.key)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: 'pointer' }}
                >
                  <circle
                    r={r + 6}
                    fill={colorMap[n.color]}
                    opacity={0.12}
                    style={{ transition: 'all 220ms ease' }}
                  />
                  <circle
                    r={r}
                    fill="var(--surface)"
                    stroke={colorMap[n.color]}
                    strokeWidth={isActive ? 2.2 : 1.5}
                    style={{
                      transition: 'all 220ms ease',
                      filter: isActive ? `drop-shadow(0 0 12px ${colorMap[n.color]})` : 'none',
                    }}
                  />
                  <text
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="20"
                    y={-2}
                  >
                    {n.emoji}
                  </text>
                  <text
                    textAnchor="middle"
                    y={r + 16}
                    fontSize={11}
                    fontFamily="var(--mono)"
                    fontWeight={500}
                    fill={isActive ? colorMap[n.color] : 'var(--text-secondary)'}
                    style={{ transition: 'fill 220ms ease' }}
                  >
                    {n.label}
                  </text>
                  {isActive && (
                    <circle r={r} fill="none" stroke={colorMap[n.color]} strokeWidth={1}>
                      <animate attributeName="r" from={r} to={r + 14} dur="1.2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" from="0.7" to="0" dur="1.2s" repeatCount="indefinite" />
                    </circle>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Right-side info panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            padding: 18,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-xs)',
          }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 500, marginBottom: 10 }}>
              Live handoff
            </div>
            {activePair ? (
              <div style={{ fontSize: 14, lineHeight: 1.5 }}>
                <span style={{ fontWeight: 500 }}>{AGENTS.find(a => a.key === activePair[0])?.label}</span>
                <span style={{ color: 'var(--text-tertiary)' }}> → </span>
                <span style={{ fontWeight: 500 }}>{AGENTS.find(a => a.key === activePair[1])?.label}</span>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--mono)', marginTop: 4 }}>
                  dispatched {tick % 2 === 0 ? 'context window' : 'intermediate result'}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
                Waiting for next dispatch...
              </div>
            )}
          </div>

          <div style={{
            padding: 18,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-xs)',
            flex: 1,
          }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 500, marginBottom: 12 }}>
              {hovered ? 'Agent detail' : 'All agents · current tasks'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(hovered ? AGENTS.filter(a => a.key === hovered) : AGENTS).map((a) => (
                <div key={a.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 6,
                    background: `color-mix(in srgb, ${colorMap[a.color]} 12%, transparent)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 15, flexShrink: 0,
                  }}>
                    {a.emoji}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{a.label}</span>
                      <Dot color={a.color === 'warning' ? 'warning' : a.color === 'purple' ? 'purple' : 'success'} pulse size={4} />
                    </div>
                    {a.tasks.map((t, i) => (
                      <div key={i} style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--mono)' }}>
                        › {t}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{
            padding: 14,
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            fontSize: 11,
            color: 'var(--text-tertiary)',
            fontFamily: 'var(--mono)',
            lineHeight: 1.55,
          }}>
            <span style={{ color: 'var(--accent)' }}>›</span> Each agent runs as an isolated process. Handoffs happen via the cognee
            knowledge graph — every dispatch updates the shared context window so the
            next agent starts with full situational awareness.
          </div>
        </div>
      </div>
    </div>
  );
}
