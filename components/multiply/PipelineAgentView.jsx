'use client';
import React, { useState } from 'react';
import { Dot, Pill, Button } from './ui';

const STAGE_AGENT_DATA = {
  Detected: {
    agents: [
      {
        name: 'Candidate Finder',
        count: 1,
        instances: [
          { target: 'Google Maps Research', task: 'Searching LinkedIn for local Bike stores', started: 7, status: 'active', score: 82 },
        ],
      },
      {
        name: 'Signal Hunter',
        count: 3,
        instances: [
          { target: 'Stripe Inc.',   task: 'Scanning LinkedIn job postings for "CRM" and "sales enablement" keywords', started: 3,  status: 'active', score: 78 },
          { target: 'Figma',         task: 'Watching G2 review activity — 3 new reviews mentioning competitor',          started: 1,  status: 'active', score: 91 },
          { target: 'Linear',        task: 'Tracking hiring spike: +12 engineering roles in 30 days',                    started: 14, status: 'active', score: 55 },
        ],
      },
      {
        name: 'Prospector',
        count: 2,
        instances: [
          { target: 'Retool',        task: 'Pulling technographic stack — detected Salesforce + HubSpot usage',          started: 5,  status: 'active', score: 71 },
          { target: 'Height App',    task: 'Enriching org chart — identified 2 VP-level contacts',                       started: 9,  status: 'active', score: 49 },
        ],
      },
    ],
  },
  Engaged: {
    agents: [
      {
        name: 'Personaliser',
        count: 4,
        instances: [
          { target: 'Sarah Chen · Vercel',   task: 'Drafting opener referencing her DevEx talk at QCon London',              started: 2,  status: 'active', score: 88 },
          { target: 'Marcus Lee · Stripe',   task: 'Generating 3 email variants A/B tested on tone',                        started: 6,  status: 'active', score: 78 },
          { target: 'Sofia Torres · Descript', task: 'Personalising follow-up for SaaS growth pain point',                  started: 11, status: 'active', score: 72 },
          { target: 'Mia Braun · Craft Docs', task: 'Writing LinkedIn DM based on product announcement',                    started: 19, status: 'active', score: 61 },
        ],
      },
      {
        name: 'Qualifier',
        count: 2,
        instances: [
          { target: 'Priya Nair · Notion',  task: 'Email thread — awaiting reply to budget question (sent 18 min ago)',   started: 18, status: 'waiting', score: 74 },
          { target: 'Oscar Lindqvist · Raycast', task: 'Warm intro follow-up — timeline and authority call scheduled',    started: 29, status: 'active',  score: 84 },
        ],
      },
    ],
  },
  Qualified: {
    agents: [
      {
        name: 'Qualifier',
        count: 3,
        instances: [
          { target: 'David Park · Linear',  task: 'Voice call in progress — discussing timeline and decision process',    started: 3,  status: 'active', score: 66 },
          { target: 'Rachel Kim · Greenhouse', task: 'Budget confirmed Q2, authority confirmed — passing to Negotiator',  started: 5,  status: 'active', score: 85 },
          { target: 'Julia Becker · Personio', task: 'Validating need score — 3 pain points identified',                 started: 20, status: 'active', score: 79 },
        ],
      },
      {
        name: 'Negotiator',
        count: 1,
        instances: [
          { target: 'Nils Petersen · Intercom', task: 'Handling pricing objection — preparing 15% discount offer',       started: 11, status: 'active', score: 92 },
        ],
      },
    ],
  },
  Booked: {
    agents: [
      {
        name: 'Closer',
        count: 2,
        instances: [
          { target: 'Vercel',        task: 'Demo confirmed Apr 21 14:00 — sending calendar invite + prep deck',           started: 5,  status: 'active', score: 93 },
          { target: 'Contentful',    task: 'Discovery call Apr 22 10:00 — syncing contact to HubSpot',                   started: 60, status: 'active', score: 81 },
        ],
      },
    ],
  },
  Closed: {
    agents: [
      {
        name: 'Closer',
        count: 1,
        instances: [
          { target: 'Typeform',      task: 'Contract signed — triggering onboarding sequence and Slack notification',     started: 120, status: 'active', score: 96 },
        ],
      },
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
  if (status === 'active')  return { dot: 'success', pulse: true,  text: 'Running' };
  if (status === 'waiting') return { dot: 'warning', pulse: false, text: 'Waiting' };
  return { dot: 'neutral', pulse: false, text: 'Queued' };
}

function InstanceRow({ target, task, started, status, score }) {
  const s = statusLabel(status);
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '10px 0',
      borderBottom: '1px solid var(--border-subtle)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, paddingTop: 2, flexShrink: 0 }}>
        <Dot color={s.dot} pulse={s.pulse} size={5} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{target}</span>
          <Pill color={scoreColor(score)} size="xs">{score}</Pill>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{s.text}</span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>{task}</p>
      </div>
      <span style={{ fontSize: 11, color: 'var(--text-quaternary)', fontFamily: 'var(--mono)', flexShrink: 0, paddingTop: 2 }}>
        {started}m ago
      </span>
    </div>
  );
}

function SpawnModal({ agentName, stage, onClose }) {
  const [name, setName] = useState(`${agentName} #${Math.floor(Math.random() * 3) + 2}`);
  const [goal, setGoal] = useState('');
  const [channel, setChannel] = useState('Voice');
  const [industry, setIndustry] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState('');

  const isFinder = agentName === 'Candidate Finder';
  const isDetected = stage === 'Detected' && isFinder;

  const handleSpawn = async () => {
    if (isDetected) {
      const task = [goal.trim(), industry.trim() && `Target industry: ${industry.trim()}`]
        .filter(Boolean)
        .join('. ') || `Research potential leads${industry ? ` in ${industry}` : ''}`;

      setStatus('loading');
      try {
        const res = await fetch('/api/research/maps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        setStatus('success');
        setTimeout(onClose, 1600);
      } catch (err) {
        setErrorMsg(err.message);
        setStatus('error');
      }
    } else {
      setStatus('success');
      setTimeout(onClose, 1300);
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', width: 460,
        boxShadow: 'var(--shadow-lg)', animation: 'slide-in-up 180ms ease', overflow: 'hidden',
      }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Spawn new agent</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
              Type: {agentName}{isFinder && <span style={{ marginLeft: 6, color: 'var(--accent)', fontWeight: 500 }}>· triggers Google Maps research</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ fontSize: 18, color: 'var(--text-quaternary)', lineHeight: 1, padding: '2px 6px', borderRadius: 'var(--radius-sm)', transition: 'all 120ms' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-quaternary)'}
          >×</button>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Agent name">
            <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
          </Field>
          <Field label="Goal / instructions">
            <textarea value={goal} onChange={e => setGoal(e.target.value)} placeholder="Describe what this agent should focus on…" rows={3} style={{ ...inputStyle, resize: 'none', lineHeight: 1.5 }} />
          </Field>
          <Field label="Channel">
            <div style={{ display: 'flex', gap: 6 }}>
              {CHANNELS.map(c => (
                <button key={c} onClick={() => setChannel(c)} style={{
                  padding: '5px 14px', fontSize: 12, borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${channel === c ? 'var(--accent)' : 'var(--border)'}`,
                  background: channel === c ? 'var(--accent-soft)' : 'transparent',
                  color: channel === c ? 'var(--accent-text)' : 'var(--text-secondary)',
                  fontWeight: channel === c ? 500 : 400, cursor: 'pointer', transition: 'all 120ms',
                }}>{c}</button>
              ))}
            </div>
          </Field>
          <Field label="Target industry (optional)">
            <input value={industry} onChange={e => setIndustry(e.target.value)} placeholder="e.g. SaaS, Fintech, Healthcare…" style={inputStyle} />
          </Field>
        </div>

        {status === 'error' && (
          <div style={{ padding: '8px 20px', background: 'var(--danger-soft)', borderTop: '1px solid var(--danger-border)', fontSize: 12, color: 'var(--danger)' }}>
            {errorMsg}
          </div>
        )}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="default" size="sm" onClick={onClose} disabled={status === 'loading'}>Cancel</Button>
          <Button variant="accent" size="sm" onClick={handleSpawn} disabled={status === 'loading' || status === 'success'}>
            {status === 'loading' ? 'Starting…' : status === 'success' ? '✓ Launched' : isDetected ? 'Spawn + research' : 'Spawn agent'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '7px 10px', fontSize: 13,
  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-subtle)', color: 'var(--text)', outline: 'none',
  fontFamily: 'var(--sans)', boxSizing: 'border-box',
};

function AgentCard({ agent, stage }) {
  const [spawnModal, setSpawnModal] = useState(false);

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)', overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '13px 16px', borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', margin: 0 }}>{agent.name}</h3>
          <Pill color="success" size="sm">
            <Dot color="success" pulse size={5} />
            {agent.count} running
          </Pill>
        </div>
        <Button variant="accent" size="sm" onClick={() => setSpawnModal(true)}>+ Spawn</Button>
      </div>

      <div style={{ padding: '0 16px' }}>
        {agent.instances.map((inst, i) => (
          <InstanceRow key={i} {...inst} />
        ))}
      </div>

      {spawnModal && <SpawnModal agentName={agent.name} stage={stage} onClose={() => setSpawnModal(false)} />}
    </div>
  );
}

export function PipelineAgentView({ stage }) {
  const data = STAGE_AGENT_DATA[stage];
  const totalAgents = data?.agents.reduce((s, a) => s + a.count, 0) ?? 0;

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
            Agents · {stage}
          </h2>
          <Pill color="success" size="sm">
            <Dot color="success" pulse size={5} />
            {totalAgents} active
          </Pill>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
          Live agent instances currently working contacts in the <strong>{stage}</strong> stage.
        </p>
      </div>

      {!data || data.agents.length === 0 ? (
        <div style={{
          padding: '48px 0', textAlign: 'center',
          color: 'var(--text-quaternary)', fontSize: 13,
          border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)',
        }}>
          No agents active in this stage
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {data.agents.map(agent => (
            <AgentCard key={agent.name} agent={agent} stage={stage} />
          ))}
        </div>
      )}
    </div>
  );
}
