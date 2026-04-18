'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Intro } from './Intro';
import { Onboarding } from './Onboarding';
import { AgentDeployment } from './AgentDeployment';
import { Dashboard } from './Dashboard';
import { LiveCall } from './LiveCall';
import { AgentTrace } from './AgentTrace';
import { KnowledgeGraph } from './KnowledgeGraph';
import { LiveActivityIndicator } from './LiveActivity';
import { Wordmark, Dot, Button, Kbd, IconSearch } from './ui';
import { AgentDetail } from './AgentDetail';
import { PipelineView } from './PipelineView';
import { PipelineAgentView } from './PipelineAgentView';
import { SystemStatusBar } from './SystemStatusBar';
import { RevenueTicker } from './RevenueTicker';
import { CommandPalette } from './CommandPalette';
import { AgentOrchestra } from './AgentOrchestra';
import { ParticleField } from './ParticleField';
import { PitchModeOverlay, setPitchMode, getPitchMode } from './PitchMode';

const STAGE = { INTRO: 'intro', ONBOARDING: 'onboarding', DEPLOYING: 'deploying', APP: 'app' };

const DEFAULT_COMPANY = { website: 'multiply.ai', product: 'B2B SaaS · Developer tools', teamSize: '6–20' };

export default function App() {
  const [hydrated, setHydrated] = useState(false);
  const [stage, setStage] = useState(STAGE.APP);
  const [companyData, setCompanyData] = useState(DEFAULT_COMPANY);
  const [view, setView] = useState('dashboard');
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [callOpen, setCallOpen] = useState(false);
  const [agentsPaused, setAgentsPaused] = useState(false);
  const [takeover, setTakeover] = useState(false);
  const [toast, setToast] = useState(null);
  const [signalCount, setSignalCount] = useState(2847);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    setHydrated(true);
    try {
      const tourWanted = typeof window !== 'undefined' && window.location.search.includes('tour=1');
      const hasSeenTour = typeof window !== 'undefined' && localStorage.getItem('multiply_stage') === STAGE.APP;
      if (tourWanted || (!hasSeenTour && typeof window !== 'undefined' && window.location.search.includes('intro=1'))) {
        setStage(STAGE.INTRO);
      }
      const company = JSON.parse(localStorage.getItem('multiply_company') || 'null');
      if (company) setCompanyData({ ...DEFAULT_COMPANY, ...company });
      // mark tour as seen so subsequent visits go straight to dashboard
      localStorage.setItem('multiply_stage', STAGE.APP);
    } catch {}
  }, []);

  useEffect(() => {
    if (stage !== STAGE.APP) return;
    const id = setInterval(() => {
      setCurrentTime(new Date());
      if (Math.random() > 0.55 && !agentsPaused) {
        setSignalCount(n => n + Math.floor(Math.random() * 3) + 1);
      }
    }, 2000);
    return () => clearInterval(id);
  }, [agentsPaused, stage]);

  const showToast = useCallback((text, kind = 'info') => {
    setToast({ text, kind, id: Date.now() });
    setTimeout(() => setToast(t => t?.text === text ? null : t), 3200);
  }, []);

  const onTakeover = () => {
    setTakeover(true);
    showToast('Agent paused. You are now driving the conversation.', 'warning');
  };

  const onResumeAgent = () => {
    setTakeover(false);
    showToast('Agent resumed. Welcome back.', 'success');
  };

  const onTogglePause = () => {
    setAgentsPaused(p => {
      showToast(p ? 'All agents resumed.' : 'All 7 agents paused.', p ? 'success' : 'warning');
      return !p;
    });
  };

  const handleIntroComplete = () => setStage(STAGE.ONBOARDING);

  const handleOnboardingComplete = (data) => {
    setCompanyData(data);
    try { localStorage.setItem('multiply_company', JSON.stringify(data)); } catch {}
    setStage(STAGE.DEPLOYING);
  };

  const handleDeploymentComplete = () => {
    try { localStorage.setItem('multiply_stage', STAGE.APP); } catch {}
    setStage(STAGE.APP);
    setTimeout(() => showToast('Welcome to Multiply. Your agents are already working.', 'success'), 800);
  };

  const resetDemo = () => {
    try {
      localStorage.removeItem('multiply_stage');
      localStorage.removeItem('multiply_company');
    } catch {}
    setStage(STAGE.INTRO);
    setCompanyData(DEFAULT_COMPANY);
  };

  const replayTour = () => setStage(STAGE.INTRO);

  if (!hydrated) return <div style={{ height: '100vh', background: 'var(--bg)' }} />;
  if (stage === STAGE.INTRO) return <Intro onStart={handleIntroComplete} />;
  if (stage === STAGE.ONBOARDING) return <Onboarding onComplete={handleOnboardingComplete} />;
  if (stage === STAGE.DEPLOYING) return <AgentDeployment companyData={companyData} onComplete={handleDeploymentComplete} />;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', position: 'relative' }}>
      <ParticleField opacity={0.08} density={0.00003} />
      <TopBar
        view={view}
        setView={setView}
        agentsPaused={agentsPaused}
        onTogglePause={onTogglePause}
        signalCount={signalCount}
        currentTime={currentTime}
        companyData={companyData}
      />
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', position: 'relative', zIndex: 5 }}>
        <Sidebar view={view} setView={setView} agentsPaused={agentsPaused} resetDemo={resetDemo} selectedAgent={selectedAgent} setSelectedAgent={setSelectedAgent} />
        <main style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {view === 'dashboard' && (
            <Dashboard
              openCall={() => setCallOpen(true)}
              showToast={showToast}
              agentsPaused={agentsPaused}
              signalCount={signalCount}
              setView={setView}
              companyData={companyData}
            />
          )}
          {view === 'trace' && <AgentTrace />}
          {view === 'graph' && <KnowledgeGraph />}
          {view === 'orchestra' && <AgentOrchestra />}
          {view === 'agent' && <AgentDetail agentName={selectedAgent} />}
          {view.startsWith('pipeline_') && !view.startsWith('pipeline_agents_') && <PipelineView stage={view.replace('pipeline_', '')} />}
          {view.startsWith('agents_pipeline_') && <PipelineAgentView stage={view.replace('agents_pipeline_', '')} />}
        </main>
      </div>

      {callOpen && (
        <LiveCall
          onClose={() => { setCallOpen(false); setTakeover(false); }}
          takeover={takeover}
          onTakeover={onTakeover}
          onResumeAgent={onResumeAgent}
          showToast={showToast}
        />
      )}

      <CommandPalette
        onAction={(id) => {
          switch (id) {
            case 'open-call':     return setCallOpen(true);
            case 'view-graph':    return setView('graph');
            case 'view-orchestra':return setView('orchestra');
            case 'view-trace':    return setView('trace');
            case 'view-dashboard':return setView('dashboard');
            case 'replay-tour':   return replayTour();
            case 'pitch-mode':
              setPitchMode(!getPitchMode());
              showToast(getPitchMode() ? 'Pitch Mode ON · live demo styling' : 'Pitch Mode OFF', getPitchMode() ? 'success' : 'info');
              return;
            case 'seed-cognee':
              fetch('/api/cognee/seed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
                .then(() => showToast('Cognee seed started · graph rebuilding', 'info'));
              return;
            case 'trigger-call':
              showToast('Triggering HR workflow run...', 'info');
              fetch('/api/hr-trigger', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
                .then(r => r.json())
                .then(d => {
                  if (d.ok && d.queued_run_ids) {
                    showToast(`HR run queued · ${d.queued_run_ids[0].slice(0, 8)}`, 'success');
                  } else {
                    showToast(`HR trigger failed: ${d.error ?? 'unknown'}`, 'warning');
                  }
                });
              setCallOpen(true);
              return;
            case 'book-meeting':
              fetch('/api/tools/book-meeting', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ company: 'Command Palette Demo', attendee_email: 'demo@multiply.ai', proposed_slots: [new Date(Date.now() + 86400000).toISOString()] }) })
                .then(() => showToast('Meeting booked via command palette', 'success'));
              return;
            case 'test-slack':
              showToast('Slack test fires on next booking — setup SLACK_WEBHOOK_URL to enable', 'info');
              return;
            case 'open-readme':
              window.open('https://github.com/danielshamsi/Multiply', '_blank');
              return;
            default: return;
          }
        }}
      />

      {toast && <Toast key={toast.id} text={toast.text} kind={toast.kind} />}
      <PitchModeOverlay />
    </div>
  );
}

function TopBar({ view, setView, agentsPaused, onTogglePause }) {
  return (
    <div style={{
      height: 48,
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      gap: 16,
      background: 'var(--surface)',
      flexShrink: 0,
      position: 'relative',
      zIndex: 10,
    }}>
      <Wordmark size={14} />

      <div style={{ height: 18, width: 1, background: 'var(--border)', marginLeft: 4 }} />

      <div style={{ display: 'flex', gap: 1 }}>
        <TabButton active={view === 'dashboard'} onClick={() => setView('dashboard')}>Pipeline</TabButton>
        <TabButton active={view === 'orchestra'} onClick={() => setView('orchestra')}>Orchestra</TabButton>
        <TabButton active={view === 'graph'} onClick={() => setView('graph')}>Knowledge</TabButton>
        <TabButton active={view === 'trace'} onClick={() => setView('trace')}>Trace</TabButton>
      </div>

      <div style={{ flex: 1 }} />

      <button
        onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
        title="Search, commands, quick actions"
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '4px 10px',
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 12, color: 'var(--text-tertiary)',
          cursor: 'pointer',
          transition: 'all 120ms ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-tertiary)'; }}
      >
        <IconSearch size={11} />
        <Kbd>⌘K</Kbd>
      </button>

      <LiveActivityIndicator />

      <button
        onClick={onTogglePause}
        title={agentsPaused ? 'Resume all 7 agents' : 'Pause all 7 agents'}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '5px 10px',
          background: agentsPaused ? 'var(--warning-soft)' : 'transparent',
          border: `1px solid ${agentsPaused ? 'var(--warning-border)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-sm)',
          fontSize: 12,
          color: agentsPaused ? 'var(--warning)' : 'var(--text-secondary)',
          cursor: 'pointer',
          fontWeight: 500,
          transition: 'all 120ms ease',
        }}
      >
        <Dot color={agentsPaused ? 'warning' : 'success'} pulse={!agentsPaused} size={5} />
        <span>{agentsPaused ? '7 paused' : '7 live'}</span>
      </button>
    </div>
  );
}

function TabButton({ children, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 12px',
      fontSize: 13,
      color: active ? 'var(--text)' : 'var(--text-tertiary)',
      background: active ? 'var(--bg-subtle)' : 'transparent',
      borderRadius: 'var(--radius-sm)',
      fontWeight: active ? 500 : 450,
      transition: 'all 120ms ease',
      cursor: 'pointer',
    }}>
      {children}
    </button>
  );
}

function Sidebar({ agentsPaused, resetDemo, view, setView, selectedAgent, setSelectedAgent }) {
  const onAgentClick = (label) => {
    setSelectedAgent(label);
    setView('agent');
  };

  const onPipelineClick = (label) => setView('pipeline_' + label);

  const items = [
    { section: 'Pipeline', rows: [
      { label: 'Detected', count: 82, onClick: onPipelineClick, active: view === 'pipeline_Detected' },
      { label: 'Engaged', count: 54, onClick: onPipelineClick, active: view === 'pipeline_Engaged' },
      { label: 'Qualified', count: 31, onClick: onPipelineClick, active: view === 'pipeline_Qualified' },
      { label: 'Booked', count: 17, onClick: onPipelineClick, active: view === 'pipeline_Booked' },
      { label: 'Closed', count: 8, onClick: onPipelineClick, active: view === 'pipeline_Closed' },
    ]},
  ];

  return (
    <aside style={{
      width: 184,
      borderRight: '1px solid var(--border)',
      padding: '20px 10px 12px',
      overflow: 'auto',
      flexShrink: 0,
      background: 'transparent',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ flex: 1 }}>
        {items.map((group, i) => (
          <div key={i} style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 10,
              color: 'var(--text-quaternary)',
              textTransform: 'uppercase',
              letterSpacing: 1.2,
              padding: '0 10px 8px',
              fontFamily: 'var(--mono)',
              fontWeight: 500,
            }}>
              {group.section}
            </div>
            {group.rows.map((row, j) => (
              <SidebarRow key={j} {...row} />
            ))}
          </div>
        ))}
      </div>
      <button
        onClick={resetDemo}
        style={{
          fontSize: 11,
          color: 'var(--text-quaternary)',
          padding: '8px 10px',
          textAlign: 'left',
          borderRadius: 'var(--radius-sm)',
          transition: 'all 120ms ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'var(--bg-subtle)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-quaternary)'; e.currentTarget.style.background = 'transparent'; }}
      >
        ↺ Reset demo
      </button>
    </aside>
  );
}

function SidebarRow({ label, count, status, onClick, active }) {
  const [hover, setHover] = React.useState(false);
  const statusColor = { live: 'success', standby: 'dim', paused: 'warning' }[status];
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onClick?.(label)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 10px',
        borderRadius: 'var(--radius-sm)',
        background: active ? 'var(--accent-soft)' : hover ? 'var(--bg-subtle)' : 'transparent',
        cursor: onClick ? 'pointer' : 'default',
        fontSize: 13,
        color: active ? 'var(--accent-text)' : 'var(--text-secondary)',
        transition: 'all 120ms ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {status && <Dot color={statusColor} pulse={status === 'live'} size={5} />}
        <span>{label}</span>
      </div>
      {count !== undefined && (
        <span style={{ fontSize: 11, color: 'var(--text-quaternary)', fontFamily: 'var(--mono)' }}>
          {count}
        </span>
      )}
    </div>
  );
}

function Toast({ text, kind }) {
  const tones = {
    success: { bg: 'var(--success-soft)', bd: 'var(--success-border)', fg: 'var(--success)' },
    warning: { bg: 'var(--warning-soft)', bd: 'var(--warning-border)', fg: 'var(--warning)' },
    danger: { bg: 'var(--danger-soft)', bd: 'var(--danger-border)', fg: 'var(--danger)' },
    info: { bg: 'var(--info-soft)', bd: 'var(--info-border)', fg: 'var(--info)' },
  };
  const c = tones[kind] || tones.info;
  return (
    <div style={{
      position: 'absolute',
      bottom: 24,
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'var(--surface)',
      border: `1px solid ${c.bd}`,
      color: c.fg,
      padding: '10px 18px',
      borderRadius: 'var(--radius-md)',
      fontSize: 13,
      fontWeight: 500,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      animation: 'slide-in-up 200ms ease',
      zIndex: 1000,
      boxShadow: 'var(--shadow-lg)',
    }}>
      <Dot color={kind} />
      {text}
    </div>
  );
}
