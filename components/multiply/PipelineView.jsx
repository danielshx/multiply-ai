'use client';
import React, { useState } from 'react';
import { Dot, Pill, Button, Avatar } from './ui';

const STAGE_META = {
  Detected:  { color: 'info',    description: 'Companies showing buying intent — not yet contacted.' },
  Engaged:   { color: 'accent',  description: 'Initial outreach sent — waiting for or tracking responses.' },
  Qualified: { color: 'warning', description: 'BANT confirmed — ready for negotiation or demo booking.' },
  Booked:    { color: 'success', description: 'Demo or discovery call scheduled with a decision maker.' },
  Closed:    { color: 'success', description: 'Deal won — contract signed or verbal commit received.' },
};

const PIPELINE_DATA = {
  Detected: [
    { id: 1,  company: 'Stripe Inc.',      contact: 'Marcus Lee',      title: 'VP Sales',        score: 78, channel: 'Email',  agent: 'Signal Hunter', lastActivity: '3m ago',  note: 'Hiring surge: +18 sales roles in 30 days' },
    { id: 2,  company: 'Notion Labs',      contact: 'Priya Nair',      title: 'Head of Growth',  score: 62, channel: 'Email',  agent: 'Signal Hunter', lastActivity: '7m ago',  note: 'Series B announced, $275M raised' },
    { id: 3,  company: 'Figma',            contact: 'David Park',      title: 'CRO',             score: 91, channel: 'Voice',  agent: 'Prospector',    lastActivity: '1m ago',  note: '3 new G2 reviews mentioning competitor switch' },
    { id: 4,  company: 'Linear',           contact: 'Anna Schmidt',    title: 'COO',             score: 55, channel: 'Chat',   agent: 'Signal Hunter', lastActivity: '14m ago', note: 'Engineering hiring spike, 12 new roles' },
    { id: 5,  company: 'Retool',           contact: 'Tom Ritter',      title: 'Dir. of Revenue', score: 67, channel: 'Email',  agent: 'Prospector',    lastActivity: '9m ago',  note: 'Salesforce + HubSpot stack detected' },
    { id: 6,  company: 'Loom',            contact: 'Jake Müller',     title: 'VP Marketing',    score: 44, channel: 'Email',  agent: 'Signal Hunter', lastActivity: '22m ago', note: 'Visited pricing page 4× this week' },
    { id: 7,  company: 'Coda',            contact: 'Elena Rossi',     title: 'CRO',             score: 58, channel: 'Email',  agent: 'Signal Hunter', lastActivity: '31m ago', note: 'Job posting for "Sales Automation Manager"' },
    { id: 8,  company: 'Height App',      contact: 'Lukas Weber',     title: 'CEO',             score: 49, channel: 'Chat',   agent: 'Prospector',    lastActivity: '44m ago', note: 'Competitor review engagement on Reddit' },
  ],
  Engaged: [
    { id: 1,  company: 'Vercel',           contact: 'Sarah Chen',      title: 'CRO',             score: 88, channel: 'Voice',  agent: 'Qualifier',     lastActivity: '2m ago',  note: 'Opener sent — referenced her DevEx QCon talk' },
    { id: 2,  company: 'Airtable',         contact: 'Ben Fox',         title: 'VP Sales',        score: 65, channel: 'Email',  agent: 'Personaliser',  lastActivity: '8m ago',  note: '2nd email in sequence — open rate 100%' },
    { id: 3,  company: 'Descript',         contact: 'Sofia Torres',    title: 'Head of Sales',   score: 72, channel: 'Email',  agent: 'Personaliser',  lastActivity: '15m ago', note: 'Clicked CTA link twice, no reply yet' },
    { id: 4,  company: 'Craft Docs',       contact: 'Mia Braun',       title: 'CRO',             score: 61, channel: 'Chat',   agent: 'Qualifier',     lastActivity: '18m ago', note: 'LinkedIn connection accepted' },
    { id: 5,  company: 'Raycast',          contact: 'Oscar Lindqvist', title: 'CEO',             score: 84, channel: 'Voice',  agent: 'Qualifier',     lastActivity: '29m ago', note: 'Warm intro via mutual connection' },
    { id: 6,  company: 'Supabase',         contact: 'Lea Dupont',      title: 'VP Revenue',      score: 70, channel: 'Email',  agent: 'Personaliser',  lastActivity: '37m ago', note: '3-email cadence started yesterday' },
  ],
  Qualified: [
    { id: 1,  company: 'Greenhouse',       contact: 'Rachel Kim',      title: 'VP Sales',        score: 85, channel: 'Voice',  agent: 'Qualifier',     lastActivity: '5m ago',  note: 'Budget confirmed Q2, authority confirmed' },
    { id: 2,  company: 'Intercom',         contact: 'Nils Petersen',   title: 'CRO',             score: 92, channel: 'Email',  agent: 'Negotiator',    lastActivity: '11m ago', note: 'Pain: existing tool too slow for outbound' },
    { id: 3,  company: 'Personio',         contact: 'Julia Becker',    title: 'Head of RevOps',  score: 79, channel: 'Chat',   agent: 'Qualifier',     lastActivity: '20m ago', note: 'Timeline: wants to move in 3 weeks' },
    { id: 4,  company: 'Pitch',            contact: 'Carlos Alves',    title: 'CRO',             score: 88, channel: 'Voice',  agent: 'Negotiator',    lastActivity: '33m ago', note: 'Shortlisted vs. 1 competitor' },
  ],
  Booked: [
    { id: 1,  company: 'Vercel',           contact: 'Sarah Chen',      title: 'CRO',             score: 93, channel: 'Voice',  agent: 'Closer',        lastActivity: '5m ago',  note: 'Demo Apr 21 14:00 — full exec team attending' },
    { id: 2,  company: 'Contentful',       contact: 'Fabian Koch',     title: 'VP Sales',        score: 81, channel: 'Email',  agent: 'Closer',        lastActivity: '1h ago',  note: 'Discovery call Apr 22 10:00' },
    { id: 3,  company: 'Miro',             contact: 'Ingrid Svensson', title: 'CRO',             score: 77, channel: 'Voice',  agent: 'Closer',        lastActivity: '2h ago',  note: 'Demo Apr 23 15:30, needs pricing deck' },
  ],
  Closed: [
    { id: 1,  company: 'Typeform',         contact: 'Hugo Ferreira',   title: 'CEO',             score: 96, channel: 'Voice',  agent: 'Closer',        lastActivity: '2h ago',  note: 'Contract signed. $48k ARR.' },
    { id: 2,  company: 'Maze',             contact: 'Nina Larsson',    title: 'VP Revenue',      score: 91, channel: 'Email',  agent: 'Closer',        lastActivity: '1d ago',  note: 'Verbal commit. Onboarding Apr 25.' },
  ],
};

function scoreColor(score) {
  if (score >= 80) return 'success';
  if (score >= 50) return 'warning';
  return 'danger';
}

const CHANNEL_ICON = { Voice: '🎙', Email: '✉', Chat: '💬' };

function CustomerCard({ company, contact, title, score, channel, agent, lastActivity, note, onImport }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: 'var(--surface)',
        border: `1px solid ${hover ? 'var(--border-strong)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-md)',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        transition: 'border-color 120ms ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 1 }}>{company}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{contact} · <span style={{ color: 'var(--text-tertiary)' }}>{title}</span></div>
        </div>
        <Pill color={scoreColor(score)} size="xs">{score}</Pill>
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{note}</p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--mono)' }}>
            {CHANNEL_ICON[channel]} {channel}
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-quaternary)', fontFamily: 'var(--mono)', letterSpacing: 0.2 }}>
            via {agent}
          </span>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-quaternary)', fontFamily: 'var(--mono)' }}>{lastActivity}</span>
      </div>
    </div>
  );
}

function ImportModal({ stage, onClose, onImport }) {
  const [company, setCompany] = useState('');
  const [contact, setContact] = useState('');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [done, setDone] = useState(false);

  const handleImport = () => {
    if (!company.trim()) return;
    setDone(true);
    setTimeout(onClose, 1200);
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        width: 440,
        boxShadow: 'var(--shadow-lg)',
        animation: 'slide-in-up 180ms ease',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Import contact</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>Add manually to <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{stage}</span></div>
          </div>
          <button onClick={onClose} style={{ fontSize: 18, color: 'var(--text-quaternary)', lineHeight: 1, padding: '2px 6px', borderRadius: 'var(--radius-sm)', transition: 'all 120ms' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-quaternary)'}
          >×</button>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <ImportField label="Company name *">
            <input value={company} onChange={e => setCompany(e.target.value)} placeholder="e.g. Acme Corp" style={inputStyle} />
          </ImportField>
          <ImportField label="Contact name">
            <input value={contact} onChange={e => setContact(e.target.value)} placeholder="e.g. Jane Smith" style={inputStyle} />
          </ImportField>
          <ImportField label="Title / role">
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. VP Sales" style={inputStyle} />
          </ImportField>
          <ImportField label="Notes">
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Context, source, reason for import…" rows={3} style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }} />
          </ImportField>
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="default" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="accent" size="sm" onClick={handleImport} disabled={!company.trim() || done}>
            {done ? '✓ Imported' : 'Import'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ImportField({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '7px 10px',
  fontSize: 13,
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-subtle)',
  color: 'var(--text)',
  outline: 'none',
  fontFamily: 'var(--sans)',
  boxSizing: 'border-box',
};

export function PipelineView({ stage }) {
  const [modalOpen, setModalOpen] = useState(false);
  const meta = STAGE_META[stage] || {};
  const leads = PIPELINE_DATA[stage] || [];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{stage}</h2>
            <Pill color={meta.color || 'neutral'} size="sm">{leads.length}</Pill>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6, maxWidth: 480 }}>
            {meta.description}
          </p>
        </div>
        <Button variant="accent" size="sm" onClick={() => setModalOpen(true)} style={{ flexShrink: 0 }}>
          + Import contact
        </Button>
      </div>

      {leads.length === 0 ? (
        <div style={{
          padding: '48px 0',
          textAlign: 'center',
          color: 'var(--text-quaternary)',
          fontSize: 13,
          border: '1px dashed var(--border)',
          borderRadius: 'var(--radius-md)',
        }}>
          No contacts in this stage yet
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          {leads.map(lead => (
            <CustomerCard key={lead.id} {...lead} />
          ))}
        </div>
      )}

      {modalOpen && <ImportModal stage={stage} onClose={() => setModalOpen(false)} />}
    </div>
  );
}
