'use client';
import React, { useState } from 'react';
import { Pill, Dot, Panel, IconFilter } from './ui';

const TRACE = [
  { t: '14:03:11', agent: 'Signal Hunter', action: 'signal.ingested', target: 'Northwind Robotics', detail: 'TechCrunch · Series B announcement · $42M', level: 'info' },
  { t: '14:03:11', agent: 'Signal Hunter', action: 'score.computed', target: 'Northwind Robotics', detail: 'ICP=0.91 intent=0.88 recency=1.00 → 92', level: 'info' },
  { t: '14:03:12', agent: 'Prospector', action: 'account.enrich', target: 'Northwind Robotics', detail: 'firmographics ← Apollo · tech stack ← BuiltWith', level: 'info' },
  { t: '14:03:12', agent: 'Prospector', action: 'contact.find', target: 'Sarah Chen', detail: '3 decision-makers identified · primary: CTO', level: 'info' },
  { t: '14:03:13', agent: 'Researcher', action: 'dossier.build', target: 'Sarah Chen', detail: 'LinkedIn + 4 talks + 2 podcasts indexed', level: 'info' },
  { t: '14:03:14', agent: 'Researcher', action: 'insight.extracted', target: 'Sarah Chen', detail: 'values: speed, autonomy, engineering-led org', level: 'success' },
  { t: '14:03:15', agent: 'Personaliser', action: 'draft.created', target: 'sarah@northwind.ai', detail: 'subject ref: her recent DevOps Days talk', level: 'info' },
  { t: '14:03:16', agent: 'Personaliser', action: 'channel.chose', target: 'Sarah Chen', detail: 'email → phone (higher CTO match · bandit 67/33)', level: 'info' },
  { t: '14:03:22', agent: 'Qualifier', action: 'call.initiated', target: '+1 415 555 0142', detail: 'voice model v4 · warm pre-brief loaded', level: 'info' },
  { t: '14:03:28', agent: 'Qualifier', action: 'rapport.established', target: 'Sarah Chen', detail: 'positive sentiment +0.42 · 18 seconds', level: 'success' },
  { t: '14:04:51', agent: 'Qualifier', action: 'bant.extracted', target: 'Budget', detail: '"$50K–$250K" (Authority: Decision-maker)', level: 'success' },
  { t: '14:05:34', agent: 'Qualifier', action: 'bant.extracted', target: 'Timeline', detail: '"Q2 / Q3 2026" · need: pipeline tooling', level: 'success' },
  { t: '14:06:12', agent: 'Qualifier', action: 'objection.detected', target: 'contract lock-in', detail: 'classifier confidence 0.94', level: 'warning' },
  { t: '14:06:12', agent: 'Negotiator', action: 'playbook.search', target: 'lock-in · CTO · post-raise', detail: '3 patterns returned · picked "no-lock-pilot"', level: 'info' },
  { t: '14:06:14', agent: 'Negotiator', action: 'rebuttal.deployed', target: 'Sarah Chen', detail: 'pattern win-rate for persona: 73%', level: 'info' },
  { t: '14:06:58', agent: 'Negotiator', action: 'objection.resolved', target: 'contract lock-in', detail: 'positive continuation signal detected', level: 'success' },
  { t: '14:07:24', agent: 'Qualifier', action: 'intent.confirmed', target: 'Sarah Chen', detail: '"what would the first 30 days look like"', level: 'success' },
  { t: '14:07:24', agent: 'Closer', action: 'handoff.received', target: 'Northwind Robotics', detail: 'confidence 0.91 · routing to Closer', level: 'info' },
  { t: '14:07:26', agent: 'Closer', action: 'calendar.query', target: 'Sarah + VP Platform', detail: 'next week · 3 dual-availability slots', level: 'info' },
  { t: '14:08:02', agent: 'Closer', action: 'meeting.proposed', target: 'Sarah Chen', detail: 'Tue 10am, Wed 2pm, Thu 3pm (PT)', level: 'info' },
  { t: '14:08:44', agent: 'Closer', action: 'meeting.booked', target: 'Tue Apr 22 · 10:00 PT', detail: '30min · Sarah + Markus + VP Platform', level: 'success' },
];

const AGENT_COLORS = {
  'Signal Hunter': 'accent',
  'Prospector': 'info',
  'Researcher': 'purple',
  'Personaliser': 'accent',
  'Qualifier': 'success',
  'Negotiator': 'warning',
  'Closer': 'info',
};

export function AgentTrace() {
  const [filter, setFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');

  const filtered = TRACE.filter(ev => {
    if (filter !== 'all' && ev.level !== filter) return false;
    if (agentFilter !== 'all' && ev.agent !== agentFilter) return false;
    return true;
  });

  const uniqueAgents = [...new Set(TRACE.map(e => e.agent))];

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <h1 className="serif" style={{ fontSize: 28, letterSpacing: -0.6, fontWeight: 400, marginBottom: 4 }}>
          Agent trace
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Every decision your agents made on run <span className="mono" style={{ color: 'var(--text)' }}>#4821</span> · Northwind Robotics · 5m 33s end-to-end
        </p>
      </div>

      <Panel
        title="Execution log"
        subtitle={`${filtered.length} of ${TRACE.length} events`}
        action={
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <IconFilter size={12} />
            <FilterPill value="all" active={filter === 'all'} onClick={() => setFilter('all')}>All</FilterPill>
            <FilterPill value="success" active={filter === 'success'} onClick={() => setFilter('success')} tone="success">Success</FilterPill>
            <FilterPill value="warning" active={filter === 'warning'} onClick={() => setFilter('warning')} tone="warning">Warnings</FilterPill>
            <FilterPill value="info" active={filter === 'info'} onClick={() => setFilter('info')}>Info</FilterPill>
          </div>
        }
      >
        <div style={{ padding: '8px 0' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '90px 140px 170px 1fr',
            gap: 16,
            padding: '10px 20px',
            fontSize: 10,
            color: 'var(--text-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: 1,
            fontFamily: 'var(--mono)',
            fontWeight: 500,
            borderBottom: '1px solid var(--border)',
          }}>
            <div>Time</div>
            <div>Agent</div>
            <div>Action</div>
            <div>Detail</div>
          </div>

          {filtered.map((ev, i) => (
            <TraceRow key={i} event={ev} />
          ))}
        </div>
      </Panel>

      <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <AgentChip
          name="All agents"
          active={agentFilter === 'all'}
          onClick={() => setAgentFilter('all')}
          count={TRACE.length}
        />
        {uniqueAgents.map(a => (
          <AgentChip
            key={a}
            name={a}
            active={agentFilter === a}
            onClick={() => setAgentFilter(a)}
            count={TRACE.filter(e => e.agent === a).length}
            color={AGENT_COLORS[a]}
          />
        ))}
      </div>
    </div>
  );
}

function TraceRow({ event }) {
  const [hover, setHover] = useState(false);
  const levelColors = {
    success: 'success',
    warning: 'warning',
    info: 'neutral',
  };
  const agentTone = AGENT_COLORS[event.agent] || 'neutral';

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '90px 140px 170px 1fr',
        gap: 16,
        padding: '10px 20px',
        fontSize: 12,
        borderBottom: '1px solid var(--border-subtle)',
        background: hover ? 'var(--bg-subtle)' : 'transparent',
        transition: 'background 120ms ease',
        alignItems: 'center',
      }}
    >
      <div style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--mono)' }}>
        {event.t}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Dot color={agentTone === 'neutral' ? 'neutral' : agentTone} size={5} />
        <span style={{ color: 'var(--text)', fontWeight: 500 }}>{event.agent}</span>
      </div>
      <div style={{ fontFamily: 'var(--mono)', color: 'var(--text-secondary)' }}>
        {event.action}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <Pill color={levelColors[event.level]} size="xs">{event.target}</Pill>
        <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {event.detail}
        </span>
      </div>
    </div>
  );
}

function FilterPill({ children, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px',
        fontSize: 11,
        fontWeight: 500,
        background: active ? 'var(--text)' : 'var(--surface)',
        color: active ? '#fff' : 'var(--text-secondary)',
        border: `1px solid ${active ? 'var(--text)' : 'var(--border)'}`,
        borderRadius: 999,
        cursor: 'pointer',
        transition: 'all 120ms ease',
      }}
    >
      {children}
    </button>
  );
}

function AgentChip({ name, active, onClick, count, color }) {
  const tones = {
    accent: { bg: 'var(--accent-soft)', fg: 'var(--accent-text)', bd: 'var(--accent-border)' },
    info: { bg: 'var(--info-soft)', fg: 'var(--info)', bd: 'var(--info-border)' },
    purple: { bg: 'var(--purple-soft)', fg: 'var(--purple)', bd: 'var(--purple-border)' },
    success: { bg: 'var(--success-soft)', fg: 'var(--success)', bd: 'var(--success-border)' },
    warning: { bg: 'var(--warning-soft)', fg: 'var(--warning)', bd: 'var(--warning-border)' },
  };
  const c = color ? tones[color] : { bg: 'var(--bg-subtle)', fg: 'var(--text-secondary)', bd: 'var(--border)' };

  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        fontSize: 12,
        fontWeight: 500,
        background: active ? c.bg : 'var(--surface)',
        color: active ? c.fg : 'var(--text-secondary)',
        border: `1px solid ${active ? c.bd : 'var(--border)'}`,
        borderRadius: 999,
        cursor: 'pointer',
        transition: 'all 120ms ease',
      }}
    >
      {color && <Dot color={color} size={5} />}
      {name}
      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: active ? c.fg : 'var(--text-tertiary)', opacity: 0.8 }}>
        {count}
      </span>
    </button>
  );
}
