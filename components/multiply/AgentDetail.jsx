'use client';
import React, { useState } from 'react';
import { Dot, Pill, Button, Avatar } from './ui';

const AGENT_DATA = {
  'Signal Hunter': {
    description: 'Continuously mines the web, LinkedIn, and industry feeds for companies showing buying intent.',
    running: [
      { id: 1, target: 'Stripe Inc.', task: 'Scanning LinkedIn job postings for "CRM" and "sales enablement" keywords', started: 3, status: 'active', score: 78 },
      { id: 2, target: 'Notion Labs', task: 'Monitoring TechCrunch for Series B funding announcement triggers', started: 7, status: 'active', score: 62 },
      { id: 3, target: 'Figma', task: 'Watching G2 review activity — 3 new reviews mentioning competitor', started: 1, status: 'active', score: 91 },
      { id: 4, target: 'Linear', task: 'Tracking hiring spike: +12 engineering roles in 30 days', started: 14, status: 'active', score: 55 },
    ],
    completed: [
      { id: 5, target: 'Vercel', task: 'Detected $150M Series C announcement. Passed to Prospector.', ago: 22, score: 88 },
      { id: 6, target: 'Planetscale', task: 'No intent signals found. Archived.', ago: 45, score: 12 },
    ],
  },
  'Prospector': {
    description: 'Enriches detected accounts with firmographics, technographics, and decision-maker mapping.',
    running: [
      { id: 1, target: 'Vercel', task: 'Enriching org chart — identified 3 VP-level decision makers', started: 2, status: 'active', score: 88 },
      { id: 2, target: 'Retool', task: 'Pulling technographic stack — detected Salesforce + HubSpot usage', started: 5, status: 'active', score: 71 },
    ],
    completed: [
      { id: 3, target: 'Stripe Inc.', task: 'Enrichment complete — 47 fields populated. Passed to Researcher.', ago: 8, score: 78 },
      { id: 4, target: 'Airtable', task: 'Firmographics complete. 2 decision makers identified.', ago: 31, score: 65 },
    ],
  },
  'Researcher': {
    description: 'Builds deep dossiers on decision-makers — recent posts, pain points, conversation triggers.',
    running: [
      { id: 1, target: 'Sarah Chen · Vercel', task: 'Reading last 90 days of LinkedIn activity and public conference talks', started: 4, status: 'active', score: 88 },
      { id: 2, target: 'Tom Ritter · Retool', task: 'Cross-referencing GitHub activity and engineering blog posts', started: 9, status: 'active', score: 71 },
    ],
    completed: [
      { id: 3, target: 'Marcus Lee · Stripe', task: 'Dossier complete. 3 conversation hooks identified. Passed to Personaliser.', ago: 15, score: 78 },
    ],
  },
  'Personaliser': {
    description: 'Trains on your company voice and tailors outreach for each decision-maker\'s context.',
    running: [
      { id: 1, target: 'Sarah Chen · Vercel', task: 'Drafting cold opener referencing her DevEx talk at QCon London', started: 2, status: 'active', score: 88 },
      { id: 2, target: 'Marcus Lee · Stripe', task: 'Generating 3 email variants A/B tested on tone (formal / casual / punchy)', started: 6, status: 'active', score: 78 },
    ],
    completed: [
      { id: 3, target: 'Priya Nair · Notion', task: 'Personalised sequence ready. Approved for launch.', ago: 9, score: 74 },
    ],
  },
  'Qualifier': {
    description: 'Engages prospects via voice, email, or chat to extract BANT signals and qualify intent.',
    running: [
      { id: 1, target: 'Priya Nair · Notion', task: 'Email thread — awaiting reply to budget question (sent 18 min ago)', started: 18, status: 'waiting', score: 74 },
      { id: 2, target: 'David Park · Linear', task: 'Voice call in progress — discussing timeline and decision process', started: 3, status: 'active', score: 66 },
    ],
    completed: [
      { id: 3, target: 'Sarah Chen · Vercel', task: 'Qualified HOT — budget confirmed, authority confirmed. Passed to Negotiator.', ago: 12, score: 93 },
      { id: 4, target: 'Ben Fox · Airtable', task: 'Disqualified — no budget this quarter. Nurture sequence activated.', ago: 55, score: 18 },
    ],
  },
  'Negotiator': {
    description: 'Handles objections using 47 trained patterns. Adjusts positioning in real-time.',
    running: [],
    completed: [
      { id: 1, target: 'Sarah Chen · Vercel', task: 'Pricing objection handled. 15 % discount offered. Closing stage reached.', ago: 6, score: 93 },
    ],
  },
  'Closer': {
    description: 'Books the meeting, syncs to CRM, and hands off to the sales team with full context.',
    running: [],
    completed: [
      { id: 1, target: 'Sarah Chen · Vercel', task: 'Demo booked for Apr 21, 14:00. CRM updated. Slack notification sent.', ago: 5, score: 93 },
    ],
  },
};

const CHANNELS = ['Voice', 'Email', 'Chat'];

function scoreColor(score) {
  if (score >= 80) return 'success';
  if (score >= 50) return 'warning';
  return 'danger';
}

function statusLabel(status) {
  if (status === 'active') return { dot: 'success', pulse: true, text: 'Running' };
  if (status === 'waiting') return { dot: 'warning', pulse: false, text: 'Waiting' };
  return { dot: 'neutral', pulse: false, text: 'Queued' };
}

function InstanceCard({ target, task, started, status, score }) {
  const s = statusLabel(status);
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{target}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <Pill color={scoreColor(score)} size="xs">{score}</Pill>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Dot color={s.dot} pulse={s.pulse} size={5} />
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{s.text}</span>
          </div>
        </div>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{task}</p>
      <span style={{ fontSize: 11, color: 'var(--text-quaternary)', fontFamily: 'var(--mono)' }}>
        {started}m ago
      </span>
    </div>
  );
}

function CompletedRow({ target, task, ago, score }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      padding: '10px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      <Dot color="neutral" size={5} style={{ marginTop: 4, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>{target}</span>
          <Pill color={scoreColor(score)} size="xs">{score}</Pill>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: 0, lineHeight: 1.5 }}>{task}</p>
      </div>
      <span style={{ fontSize: 11, color: 'var(--text-quaternary)', fontFamily: 'var(--mono)', flexShrink: 0 }}>
        {ago}m ago
      </span>
    </div>
  );
}

function SetupModal({ agentName, onClose }) {
  const [name, setName] = useState(`${agentName} #2`);
  const [goal, setGoal] = useState('');
  const [channel, setChannel] = useState('Voice');
  const [industry, setIndustry] = useState('');
  const [deployed, setDeployed] = useState(false);

  const handleDeploy = () => {
    setDeployed(true);
    setTimeout(onClose, 1400);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.18)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        width: 460,
        boxShadow: 'var(--shadow-lg)',
        animation: 'slide-in-up 180ms ease',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '18px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Set up new agent</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>Type: {agentName}</div>
          </div>
          <button onClick={onClose} style={{
            fontSize: 18, color: 'var(--text-quaternary)', lineHeight: 1,
            padding: '2px 6px', borderRadius: 'var(--radius-sm)',
            transition: 'all 120ms',
          }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-quaternary)'}
          >×</button>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field label="Agent name">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="Goal / instructions">
            <textarea
              value={goal}
              onChange={e => setGoal(e.target.value)}
              placeholder="Describe what this agent should focus on…"
              rows={3}
              style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }}
            />
          </Field>
          <Field label="Channel">
            <div style={{ display: 'flex', gap: 6 }}>
              {CHANNELS.map(c => (
                <button key={c} onClick={() => setChannel(c)} style={{
                  padding: '5px 14px',
                  fontSize: 12,
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${channel === c ? 'var(--accent)' : 'var(--border)'}`,
                  background: channel === c ? 'var(--accent-soft)' : 'transparent',
                  color: channel === c ? 'var(--accent-text)' : 'var(--text-secondary)',
                  fontWeight: channel === c ? 500 : 400,
                  cursor: 'pointer',
                  transition: 'all 120ms',
                }}>{c}</button>
              ))}
            </div>
          </Field>
          <Field label="Target industry (optional)">
            <input
              value={industry}
              onChange={e => setIndustry(e.target.value)}
              placeholder="e.g. SaaS, Fintech, Healthcare…"
              style={inputStyle}
            />
          </Field>
        </div>

        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'flex-end', gap: 8,
        }}>
          <Button variant="default" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="accent" size="sm" onClick={handleDeploy} disabled={deployed}>
            {deployed ? '✓ Deploying…' : 'Deploy agent'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
        {label}
      </label>
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

export function AgentDetail({ agentName }) {
  const [modalOpen, setModalOpen] = useState(false);
  const data = AGENT_DATA[agentName];
  if (!data) return null;

  const totalRunning = data.running.length;
  const isStandby = totalRunning === 0;

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        marginBottom: 28, gap: 16,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{agentName}</h2>
            <Pill color={isStandby ? 'neutral' : 'success'} size="sm">
              <Dot color={isStandby ? 'neutral' : 'success'} pulse={!isStandby} size={5} />
              {isStandby ? 'Standby' : `${totalRunning} running`}
            </Pill>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, maxWidth: 480, lineHeight: 1.6 }}>
            {data.description}
          </p>
        </div>
        <Button variant="accent" size="sm" onClick={() => setModalOpen(true)} style={{ flexShrink: 0 }}>
          + New agent
        </Button>
      </div>

      {/* Running instances */}
      <Section label={`Active instances · ${totalRunning}`}>
        {totalRunning === 0 ? (
          <div style={{
            padding: '32px 0',
            textAlign: 'center',
            color: 'var(--text-quaternary)',
            fontSize: 13,
            border: '1px dashed var(--border)',
            borderRadius: 'var(--radius-md)',
          }}>
            No active instances — agent is on standby
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {data.running.map(inst => (
              <InstanceCard key={inst.id} {...inst} />
            ))}
          </div>
        )}
      </Section>

      {/* Completed today */}
      {data.completed.length > 0 && (
        <Section label={`Completed today · ${data.completed.length}`} style={{ marginTop: 28 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '0 16px' }}>
            {data.completed.map((inst, i) => (
              <CompletedRow key={inst.id} {...inst} style={i === data.completed.length - 1 ? { borderBottom: 'none' } : {}} />
            ))}
          </div>
        </Section>
      )}

      {modalOpen && <SetupModal agentName={agentName} onClose={() => setModalOpen(false)} />}
    </div>
  );
}

function Section({ label, children, style }) {
  return (
    <div style={style}>
      <div style={{
        fontSize: 10,
        color: 'var(--text-quaternary)',
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        fontFamily: 'var(--mono)',
        fontWeight: 500,
        marginBottom: 10,
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}
