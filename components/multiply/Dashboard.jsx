'use client';
import React, { useState, useEffect } from 'react';
import { Pill, Dot, Button, Panel, Avatar, Drawer, Card, IconArrow, IconPhone, IconExternal, IconLink } from './ui';
import { INITIAL_SIGNALS, INCOMING_SIGNALS, PIPELINE, AGENT_LOOP, KPIS } from './mockData';

export function Dashboard({ openCall, showToast, agentsPaused, signalCount, setView, companyData }) {
  const [signals, setSignals] = useState(INITIAL_SIGNALS);
  const [, setIncomingIdx] = useState(0);
  const [signalDrawer, setSignalDrawer] = useState(null);
  const [leadDrawer, setLeadDrawer] = useState(null);
  const [kpiExpanded, setKpiExpanded] = useState(null);

  useEffect(() => {
    if (agentsPaused) return;
    const id = setInterval(() => {
      setIncomingIdx(i => {
        if (i >= INCOMING_SIGNALS.length) return i;
        const next = INCOMING_SIGNALS[i];
        setSignals(prev => [{ ...next, id: `new_${Date.now()}`, time: 0, fresh: true }, ...prev].slice(0, 8));
        return i + 1;
      });
    }, 7000);
    return () => clearInterval(id);
  }, [agentsPaused]);

  useEffect(() => {
    if (agentsPaused) return;
    let cancelled = false;
    const pull = async () => {
      try {
        const res = await fetch('/api/news?q=funding');
        const data = await res.json();
        if (cancelled || !data?.signals?.length) return;
        const pick = data.signals[Math.floor(Math.random() * Math.min(5, data.signals.length))];
        if (!pick) return;
        setSignals(prev => {
          if (prev.some(s => s.url === pick.url)) return prev;
          return [{ ...pick, fresh: true }, ...prev].slice(0, 10);
        });
      } catch {}
    };
    const id = setInterval(pull, 18000);
    pull();
    return () => { cancelled = true; clearInterval(id); };
  }, [agentsPaused]);

  useEffect(() => {
    const id = setInterval(() => {
      setSignals(prev => prev.map(s => ({ ...s, time: s.time + 1, fresh: false })));
    }, 60000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1100, margin: '0 auto' }}>
        <Header />
        <HeroStrip openCall={openCall} />
        <KpiRow signalCount={signalCount} expanded={kpiExpanded} setExpanded={setKpiExpanded} />
        <SignalFeed signals={signals} onSignalClick={setSignalDrawer} openCall={openCall} />
      </div>

      <SignalDrawer signal={signalDrawer} onClose={() => setSignalDrawer(null)} openCall={openCall} showToast={showToast} />
      <LeadDrawer card={leadDrawer} onClose={() => setLeadDrawer(null)} showToast={showToast} />
    </>
  );
}

function Header() {
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  return (
    <div style={{ marginBottom: 0 }}>
      <h1 className="serif" style={{ fontSize: 32, letterSpacing: -0.8, fontWeight: 400, lineHeight: 1.1 }}>
        {greeting}.
      </h1>
    </div>
  );
}

function HeroStrip({ openCall }) {
  return (
    <Card padding={0} style={{ overflow: 'hidden', position: 'relative', borderColor: 'var(--accent-border)', boxShadow: '0 0 0 0 rgba(79,70,229,0.25), var(--shadow-md)', animation: 'heroGlow 2.4s ease-in-out infinite' }}>
      <style>{`
        @keyframes heroGlow {
          0%,100% { box-shadow: 0 0 0 0 rgba(79,70,229,0.0), var(--shadow-md); }
          50%     { box-shadow: 0 0 0 4px rgba(79,70,229,0.18), var(--shadow-md); }
        }
        @keyframes waveBars {
          0%,100% { transform: scaleY(0.35); }
          50%     { transform: scaleY(1); }
        }
      `}</style>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(1000px 200px at 80% 50%, rgba(79,70,229,0.22) 0%, transparent 60%), linear-gradient(90deg, transparent 0%, var(--accent-soft) 100%)',
        opacity: 0.9,
        pointerEvents: 'none',
      }} />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 26px', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flex: 1, minWidth: 0 }}>
          <div style={{ position: 'relative' }}>
            <Avatar initials="SC" size={48} />
            <div style={{
              position: 'absolute', inset: -5,
              borderRadius: '50%',
              border: '2px solid var(--danger)',
              opacity: 0.4,
              animation: 'pulse-ring 1.8s ease-out infinite',
            }} />
            <div style={{
              position: 'absolute', bottom: -2, right: -2,
              width: 14, height: 14, borderRadius: '50%',
              background: 'var(--danger)',
              border: '2px solid var(--surface)',
            }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className="serif" style={{ fontSize: 20, fontWeight: 400, letterSpacing: -0.4 }}>Sarah Chen</span>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>· CTO, Northwind Robotics · Munich</span>
              <Pill color="danger" size="sm">
                <Dot color="danger" pulse size={5} />
                Live · 4:12
              </Pill>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Qualifier agent is handling the call. Objection resolved at 01:58. Close confidence <span style={{ color: 'var(--success)', fontWeight: 600 }}>78%</span> and climbing.
            </div>
          </div>
          <HeroWave />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="primary" size="lg" onClick={openCall} icon={<IconPhone size={13} />}>
            Listen in
          </Button>
        </div>
      </div>
    </Card>
  );
}

function HeroWave() {
  const bars = 14;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 30, marginRight: 12 }}>
      {Array.from({ length: bars }).map((_, i) => (
        <span key={i} style={{
          display: 'inline-block',
          width: 3,
          height: 30,
          background: `linear-gradient(180deg, var(--accent) 0%, var(--accent-hover) 100%)`,
          borderRadius: 2,
          transformOrigin: 'center',
          animation: `waveBars 0.9s ease-in-out ${i * 0.07}s infinite`,
          opacity: 0.85,
        }} />
      ))}
    </div>
  );
}

function KpiRow({ signalCount }) {
  const kpis = [
    { ...KPIS[0], value: signalCount, key: 'signals' },
    { ...KPIS[1], key: 'leads' },
    { ...KPIS[2], key: 'meetings' },
    { ...KPIS[3], key: 'reply' },
  ];
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-xs)',
      overflow: 'hidden',
    }}>
      {kpis.map((k, i) => (
        <div
          key={k.key}
          style={{
            padding: '18px 20px',
            borderRight: i < kpis.length - 1 ? '1px solid var(--border-subtle)' : 'none',
          }}
        >
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'var(--mono)', marginBottom: 6 }}>
            {k.label}
          </div>
          <div className="serif" style={{ fontSize: 28, fontWeight: 400, letterSpacing: -0.8, lineHeight: 1, marginBottom: 4 }}>
            {typeof k.value === 'number' ? <CountUp to={k.value} /> : k.value}
          </div>
          <div style={{ fontSize: 11, color: 'var(--success)' }}>
            ↗ {k.delta}
          </div>
        </div>
      ))}
    </div>
  );
}

function CountUp({ to }) {
  const [v, setV] = useState(to);
  useEffect(() => {
    let raf;
    const step = () => {
      setV(curr => {
        if (curr === to) return curr;
        const diff = to - curr;
        const jump = Math.sign(diff) * Math.max(1, Math.round(Math.abs(diff) * 0.14));
        return Math.abs(diff) < Math.abs(jump) ? to : curr + jump;
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{v.toLocaleString()}</span>;
}

function MiniSparkline({ kpiKey }) {
  const data = {
    signals: [40, 55, 48, 62, 70, 58, 75, 82, 78, 88, 95, 100],
    leads: [20, 25, 22, 30, 35, 40, 38, 45, 50, 55, 60, 65],
    meetings: [5, 8, 12, 15, 10, 18, 20, 25, 22, 30, 35, 37],
    reply: [18, 19, 20, 22, 21, 23, 25, 24, 26, 27, 28, 28.4],
  }[kpiKey] || [];
  const max = Math.max(...data);
  const points = data.map((v, i) => `${(i / (data.length - 1)) * 100},${30 - (v / max) * 28}`).join(' ');
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" style={{ width: '100%', height: 20, marginTop: 8, display: 'block' }}>
      <polyline
        points={points}
        fill="none"
        stroke="var(--success)"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function SignalFeed({ signals, onSignalClick, openCall }) {
  return (
    <Panel
      title="Live signal feed"
      subtitle="web intelligence · every 2s"
      action={
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Dot color="accent" pulse />
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: 1 }}>streaming</span>
        </div>
      }
    >
      <div style={{ padding: '2px 0' }}>
        {signals.map((s) => (
          <SignalRow
            key={s.id}
            signal={s}
            fresh={s.fresh}
            onClick={() => s.company === 'Northwind Robotics' ? openCall() : onSignalClick(s)}
          />
        ))}
      </div>
    </Panel>
  );
}

function SignalRow({ signal, fresh, onClick }) {
  const [hover, setHover] = useState(false);
  const scoreTone = signal.score >= 85 ? 'accent' : signal.score >= 75 ? 'warning' : 'neutral';
  const iconTones = {
    accent: { bg: 'var(--accent-soft)', fg: 'var(--accent-text)', bd: 'var(--accent-border)' },
    warning: { bg: 'var(--warning-soft)', fg: 'var(--warning)', bd: 'var(--warning-border)' },
    purple: { bg: 'var(--purple-soft)', fg: 'var(--purple)', bd: 'var(--purple-border)' },
    success: { bg: 'var(--success-soft)', fg: 'var(--success)', bd: 'var(--success-border)' },
    info: { bg: 'var(--info-soft)', fg: 'var(--info)', bd: 'var(--info-border)' },
  };
  const tone = iconTones[signal.color];

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      style={{
        display: 'flex',
        gap: 14,
        padding: '14px 16px',
        borderBottom: '1px solid var(--border-subtle)',
        cursor: 'pointer',
        background: hover ? 'var(--bg-subtle)' : 'transparent',
        transition: 'background 120ms ease',
        animation: fresh ? 'slide-in-right 400ms ease' : 'none',
      }}
    >
      <div style={{
        width: 30, height: 30, borderRadius: 'var(--radius-sm)',
        background: tone.bg, color: tone.fg,
        border: `1px solid ${tone.bd}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 600, flexShrink: 0,
        fontFamily: 'var(--mono)',
      }}>
        {signal.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 14, fontWeight: 500, letterSpacing: -0.1 }}>{signal.company}</span>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>
            {fresh ? 'just now' : `${signal.time}m ago`}
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.5 }}>{signal.desc}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {signal.tags.map(t => <Pill key={t} color="neutral" size="xs">{t}</Pill>)}
          <Pill color={scoreTone} size="xs">Score {signal.score}</Pill>
          {signal.source && (
            <span style={{ fontSize: 10, color: 'var(--text-quaternary)', fontFamily: 'var(--mono)' }}>
              via {signal.source}
            </span>
          )}
          {hover && (
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
              Open <IconArrow size={10} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function AgentLoopPanel({ openCall, setView }) {
  return (
    <Panel
      title="Agent loop"
      subtitle="Northwind · run #4821"
      action={
        <Button size="xs" variant="ghost" onClick={() => setView('trace')}>
          Full trace <IconArrow size={10} />
        </Button>
      }
    >
      <div style={{ padding: 16 }}>
        {AGENT_LOOP.map((step, i) => (
          <AgentStep key={i} step={step} isLast={i === AGENT_LOOP.length - 1} onLiveClick={openCall} />
        ))}
      </div>
    </Panel>
  );
}

function AgentStep({ step, isLast, onLiveClick }) {
  const isLive = step.status === 'live';
  const isDone = step.status === 'done';
  const isQueued = step.status === 'queued';

  return (
    <div style={{ display: 'flex', gap: 12, position: 'relative', paddingBottom: isLast ? 0 : 12 }}>
      <div style={{ flexShrink: 0, position: 'relative' }}>
        <div style={{
          width: 22, height: 22, borderRadius: '50%',
          background: isLive ? 'var(--accent)' : isDone ? 'var(--success)' : 'var(--bg-subtle)',
          border: `1px solid ${isLive ? 'var(--accent)' : isDone ? 'var(--success)' : 'var(--border-strong)'}`,
          color: isLive || isDone ? '#fff' : 'var(--text-tertiary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 600, fontFamily: 'var(--mono)',
          position: 'relative', zIndex: 1,
        }}>
          {isDone ? '✓' : step.num}
        </div>
        {!isLast && <div style={{ position: 'absolute', left: 10, top: 22, bottom: -12, width: 1, background: 'var(--border)' }} />}
      </div>
      <div
        onClick={isLive ? onLiveClick : undefined}
        style={{ flex: 1, cursor: isLive ? 'pointer' : 'default' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: isQueued ? 'var(--text-tertiary)' : 'var(--text)' }}>
            {step.name}
          </span>
          <Pill color={isLive ? 'accent' : isDone ? 'success' : 'neutral'} size="xs">
            {isLive && <Dot color="accent" pulse size={4} />}
            {step.status} · {step.time}
          </Pill>
        </div>
        <div style={{ fontSize: 12, color: isQueued ? 'var(--text-quaternary)' : 'var(--text-secondary)', lineHeight: 1.5 }}>
          {step.desc}
        </div>
      </div>
    </div>
  );
}

const PIPELINE_STATS = [
  {
    key: 'Detected',
    count: 82,
    convLabel: 'entry',
    conv: null,
    avgScore: 61,
    movedIn: 14,
    avgDays: 0.4,
    accentColor: 'var(--info)',
    accentSoft: 'var(--info-soft)',
    accentBorder: 'var(--info-border)',
  },
  {
    key: 'Engaged',
    count: 54,
    conv: 66,
    convLabel: 'from Detected',
    avgScore: 72,
    movedIn: 8,
    avgDays: 1.2,
    accentColor: 'var(--accent)',
    accentSoft: 'var(--accent-soft)',
    accentBorder: 'var(--accent-border)',
  },
  {
    key: 'Qualified',
    count: 31,
    conv: 57,
    convLabel: 'from Engaged',
    avgScore: 84,
    movedIn: 5,
    avgDays: 2.8,
    accentColor: 'var(--warning)',
    accentSoft: 'var(--warning-soft)',
    accentBorder: 'var(--warning-border)',
  },
  {
    key: 'Booked',
    count: 17,
    conv: 55,
    convLabel: 'from Qualified',
    avgScore: 89,
    movedIn: 3,
    avgDays: 1.1,
    accentColor: 'var(--success)',
    accentSoft: 'var(--success-soft)',
    accentBorder: 'var(--success-border)',
  },
  {
    key: 'Closed',
    count: 8,
    conv: 47,
    convLabel: 'from Booked',
    avgScore: 94,
    movedIn: 2,
    avgDays: 4.3,
    accentColor: 'var(--success)',
    accentSoft: 'var(--success-soft)',
    accentBorder: 'var(--success-border)',
  },
];

const TOTAL_DETECTED = 82;

const STAGE_AGENTS = {
  Detected:  [{ name: 'Signal Hunter', count: 3 }, { name: 'Prospector', count: 2 }],
  Engaged:   [{ name: 'Personaliser', count: 4 }, { name: 'Qualifier', count: 2 }],
  Qualified: [{ name: 'Qualifier', count: 3 }, { name: 'Negotiator', count: 1 }],
  Booked:    [{ name: 'Closer', count: 2 }],
  Closed:    [{ name: 'Closer', count: 1 }],
};

function PipelinePanel({ setView }) {
  return (
    <Panel
      title="Pipeline"
      subtitle="agents move contacts in real time"
      action={
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: 1 }}>
          <Dot color="accent" pulse size={5} />
          live
        </div>
      }
    >
      <div style={{ padding: '12px 16px 16px' }}>
        {/* Funnel bar */}
        <div style={{ display: 'flex', gap: 3, marginBottom: 16, height: 6, borderRadius: 4, overflow: 'hidden' }}>
          {PIPELINE_STATS.map((s) => (
            <div
              key={s.key}
              style={{
                flex: s.count,
                background: s.accentColor,
                opacity: 0.7,
                transition: 'flex 400ms ease',
              }}
            />
          ))}
        </div>

        {/* Stage columns */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          {PIPELINE_STATS.map((s) => (
            <PipelineStageCard key={s.key} stage={s} setView={setView} />
          ))}
        </div>
      </div>
    </Panel>
  );
}

function PipelineStageCard({ stage, setView }) {
  const [hover, setHover] = useState(false);
  const fillPct = Math.round((stage.count / TOTAL_DETECTED) * 100);

  return (
    <div
      onClick={() => setView('pipeline_' + stage.key)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? stage.accentSoft : 'var(--bg-subtle)',
        border: `1px solid ${hover ? stage.accentBorder : 'var(--border)'}`,
        borderRadius: 'var(--radius-md)',
        padding: '14px 14px 12px',
        cursor: 'pointer',
        transition: 'all 140ms ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{
          fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: 1.1, color: 'var(--text-tertiary)', fontFamily: 'var(--mono)',
        }}>
          {stage.key}
        </span>
        {stage.conv !== null && (
          <span style={{ fontSize: 10, color: 'var(--text-quaternary)', fontFamily: 'var(--mono)' }}>
            {stage.conv}%
          </span>
        )}
      </div>

      <div className="serif" style={{ fontSize: 36, fontWeight: 400, letterSpacing: -1.5, color: 'var(--text)', lineHeight: 1, marginBottom: 6 }}>
        {stage.count}
      </div>

      {stage.conv !== null && (
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 10 }}>
          {stage.conv}% {stage.convLabel}
        </div>
      )}
      {stage.conv === null && (
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 10 }}>
          pipeline entry point
        </div>
      )}

      {/* Mini progress bar */}
      <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, marginBottom: 12 }}>
        <div style={{
          height: '100%', width: `${fillPct}%`,
          background: stage.accentColor,
          borderRadius: 2,
          opacity: 0.8,
        }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
        <StatLine label="Avg score" value={stage.avgScore} mono />
        <StatLine label="Moved in (1h)" value={`+${stage.movedIn}`} mono />
        <StatLine label="Avg time" value={`${stage.avgDays}d`} mono />
      </div>

      <AgentBox agents={STAGE_AGENTS[stage.key] || []} onClick={(e) => { e.stopPropagation(); setView('agents_pipeline_' + stage.key); }} />
    </div>
  );
}

function AgentBox({ agents, onClick }) {
  const [hover, setHover] = React.useState(false);
  const total = agents.reduce((s, a) => s + a.count, 0);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        marginTop: 2,
        padding: '7px 9px',
        borderRadius: 'var(--radius-sm)',
        border: `1px solid ${hover ? 'var(--border-strong)' : 'var(--border)'}`,
        background: hover ? 'var(--surface)' : 'var(--bg)',
        cursor: 'pointer',
        transition: 'all 120ms ease',
      }}
    >
      <div style={{ fontSize: 10, color: 'var(--text-quaternary)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 5 }}>
        {total} agent{total !== 1 ? 's' : ''} active
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {agents.map(a => (
          <div key={a.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Dot color="success" pulse size={4} />
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{a.name}</span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-quaternary)', fontFamily: 'var(--mono)' }}>×{a.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatLine({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{label}</span>
      <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: mono ? 'var(--mono)' : undefined, fontWeight: 500 }}>
        {value}
      </span>
    </div>
  );
}

function SignalDrawer({ signal, onClose, showToast }) {
  if (!signal) return null;
  return (
    <Drawer
      open={!!signal}
      onClose={onClose}
      title={signal.company}
      subtitle={`Signal · ${signal.type} · score ${signal.score}`}
      actions={
        <>
          <Button variant="default" onClick={onClose}>Close</Button>
          <Button variant="primary" onClick={() => { onClose(); showToast(`Prospector agent opening ${signal.company}`, 'success'); }}>
            Open lead
          </Button>
        </>
      }
    >
      <DrawerSection label="Signal detail">
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {signal.desc}
        </div>
      </DrawerSection>

      <DrawerSection label="Tags">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {signal.tags.map(t => <Pill key={t} color="neutral" size="sm">{t}</Pill>)}
        </div>
      </DrawerSection>

      <DrawerSection label="Source">
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: 12,
          background: 'var(--bg-subtle)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
        }}>
          <IconLink size={13} />
          <span style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {signal.url ? (new URL(signal.url).hostname) :
             signal.type === 'funding' ? 'techcrunch.com/2026/04/northwind-series-b' :
             signal.type === 'hiring' ? 'linkedin.com/jobs/vantage-biotech' :
             signal.type === 'social' ? 'linkedin.com/posts/meridian-vp-ops' :
             signal.type === 'stack' ? 'builtwith.com/acmefintech.com' :
             'reuters.com/philips-acquires-orbital-health'}
          </span>
          {signal.url ? (
            <a href={signal.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', display: 'flex' }}>
              <IconExternal size={12} />
            </a>
          ) : (
            <button style={{ color: 'var(--text-tertiary)' }} onClick={() => showToast('Opening source in new tab', 'info')}>
              <IconExternal size={12} />
            </button>
          )}
        </div>
      </DrawerSection>

      <DrawerSection label="Agent enrichment">
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          <div style={{ padding: 10, background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--mono)', marginBottom: 6 }}>
            <span style={{ color: 'var(--success)' }}>✓</span> Prospector · enriched firmographics
          </div>
          <div style={{ padding: 10, background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--mono)', marginBottom: 6 }}>
            <span style={{ color: 'var(--success)' }}>✓</span> Researcher · identified 3 decision-makers
          </div>
          <div style={{ padding: 10, background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--mono)' }}>
            <span style={{ color: 'var(--accent)' }}>›</span> Personaliser · drafting outbound
          </div>
        </div>
      </DrawerSection>

      <DrawerSection label="Lead score breakdown">
        <ScoreBar label="ICP fit" value={91} />
        <ScoreBar label="Intent strength" value={88} />
        <ScoreBar label="Recency" value={100} />
        <ScoreBar label="Team access" value={signal.score >= 85 ? 85 : 60} />
      </DrawerSection>
    </Drawer>
  );
}

function LeadDrawer({ card, onClose, showToast }) {
  if (!card) return null;
  return (
    <Drawer
      open={!!card}
      onClose={onClose}
      title={card.company}
      subtitle={`Lead · score ${card.score} · updated ${card.time}`}
      actions={
        <>
          <Button variant="default" onClick={onClose}>Close</Button>
          <Button variant="primary" onClick={() => { showToast(`Opening conversation with ${card.company}`, 'info'); }}>
            View conversation
          </Button>
        </>
      }
    >
      <DrawerSection label="Decision-maker">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'var(--bg-subtle)', borderRadius: 'var(--radius-md)' }}>
          <Avatar initials={card.company.slice(0, 2).toUpperCase()} size={36} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>Contact enriched</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Decision-maker identified via LinkedIn + Apollo</div>
          </div>
        </div>
      </DrawerSection>

      <DrawerSection label="BANT">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { l: 'Budget', v: '$50K–$250K' },
            { l: 'Authority', v: 'Decision-maker' },
            { l: 'Need', v: 'Pipeline tooling' },
            { l: 'Timeline', v: 'Q2 / Q3 2026' },
          ].map((b, i) => (
            <div key={i} style={{ padding: 12, background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3, fontFamily: 'var(--mono)' }}>
                {b.l}
              </div>
              <div style={{ fontSize: 12, fontWeight: 500 }}>{b.v}</div>
            </div>
          ))}
        </div>
      </DrawerSection>

      <DrawerSection label="Activity timeline">
        <TimelineItem time="2m ago" channel="Signal" text="Detected via signal feed" />
        <TimelineItem time="1m ago" channel="Email" text="Outbound sent by Personaliser" />
        <TimelineItem time="32s ago" channel="Open" text="Email opened from company HQ" />
        <TimelineItem time="now" channel="Queue" text="Follow-up SMS queued for tomorrow 10am" dim />
      </DrawerSection>

      <DrawerSection label="Queued actions">
        <QueuedAction text="Send follow-up SMS · tomorrow 10am" channel="SMS" />
        <QueuedAction text="Propose 3 meeting slots" channel="Calendar" />
        <QueuedAction text="Sync to HubSpot · stage: Engaged" channel="CRM" />
      </DrawerSection>
    </Drawer>
  );
}

function DrawerSection({ label, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{
        fontSize: 10, color: 'var(--text-tertiary)',
        textTransform: 'uppercase', letterSpacing: 1.2,
        marginBottom: 10, fontFamily: 'var(--mono)', fontWeight: 500,
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function ScoreBar({ label, value }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text)', fontWeight: 500 }}>{value}</span>
      </div>
      <div style={{ height: 4, background: 'var(--bg-subtle)', borderRadius: 2 }}>
        <div style={{
          height: '100%',
          width: `${value}%`,
          background: value >= 85 ? 'var(--success)' : value >= 70 ? 'var(--accent)' : 'var(--warning)',
          borderRadius: 2,
          transition: 'width 400ms ease',
        }} />
      </div>
    </div>
  );
}

function TimelineItem({ time, channel, text, dim }) {
  return (
    <div style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border-subtle)', opacity: dim ? 0.6 : 1 }}>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--mono)', width: 56, flexShrink: 0 }}>{time}</div>
      <Pill size="xs" color="neutral">{channel}</Pill>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1 }}>{text}</div>
    </div>
  );
}

function QueuedAction({ text, channel }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', marginBottom: 6 }}>
      <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--border-strong)' }} />
      <span style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)' }}>{text}</span>
      <Pill size="xs" color="neutral">{channel}</Pill>
    </div>
  );
}
