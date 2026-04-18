'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Button, Logo, IconCheck, IconArrow, IconRadar, IconTarget, IconBrain, IconSparkle, IconMessage, IconShield, IconHandshake } from './ui';

const AGENTS = [
  { id: 'signal', icon: IconRadar, name: 'Signal Hunter', role: 'Mining the web for buying intent across your ICP', steps: ['Connecting to 12 data sources', 'Calibrating ICP filters', 'Starting live signal feed'], duration: 2400, tone: 'accent' },
  { id: 'prospector', icon: IconTarget, name: 'Prospector', role: 'Enriching accounts with firmographics and funding data', steps: ['Loading enrichment providers', 'Indexing your TAM'], duration: 1800, tone: 'info' },
  { id: 'researcher', icon: IconBrain, name: 'Researcher', role: 'Building dossiers on every decision-maker', steps: ['Loading dossier templates', 'Connecting to LinkedIn'], duration: 1800, tone: 'purple' },
  { id: 'personaliser', icon: IconSparkle, name: 'Personaliser', role: 'Trained on your website, voice, and case studies', steps: ['Reading your website', 'Extracting tone and positioning', 'Loading message templates'], duration: 2600, tone: 'accent' },
  { id: 'qualifier', icon: IconMessage, name: 'Qualifier', role: 'Running voice, email, and chat conversations', steps: ['Loading voice model v4', 'Connecting phone and email gateways', 'Training on BANT extraction'], duration: 2600, tone: 'success' },
  { id: 'negotiator', icon: IconShield, name: 'Negotiator', role: 'Loaded with 47 objection patterns', steps: ['Loading objection playbook', 'Initializing A/B bandit'], duration: 1800, tone: 'warning' },
  { id: 'closer', icon: IconHandshake, name: 'Closer', role: 'Booking meetings and syncing to your CRM', steps: ['Connecting calendar', 'Connecting HubSpot', 'Loading contract templates'], duration: 2400, tone: 'info' },
];

export function AgentDeployment({ onComplete, companyData }) {
  const [statuses, setStatuses] = useState(() => AGENTS.map(() => 'queued'));
  const [currentStep, setCurrentStep] = useState(() => AGENTS.map(() => 0));
  const [allReady, setAllReady] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let cumulative = 400;
    AGENTS.forEach((agent, i) => {
      setTimeout(() => {
        setStatuses(s => { const n = [...s]; n[i] = 'provisioning'; return n; });

        const stepDuration = agent.duration / agent.steps.length;
        agent.steps.forEach((_, stepIdx) => {
          setTimeout(() => {
            setCurrentStep(cs => { const n = [...cs]; n[i] = stepIdx; return n; });
          }, stepIdx * stepDuration);
        });

        setTimeout(() => {
          setStatuses(s => { const n = [...s]; n[i] = 'ready'; return n; });
        }, agent.duration);
      }, cumulative);
      cumulative += agent.duration + 200;
    });

    setTimeout(() => setAllReady(true), cumulative + 300);
  }, []);

  const readyCount = statuses.filter(s => s === 'ready').length;

  return (
    <div style={{ height: '100vh', overflow: 'auto', background: 'var(--bg)', position: 'relative' }}>
      <div className="grid-bg" style={{ position: 'absolute', inset: 0, opacity: 0.5, pointerEvents: 'none' }} />

      <div style={{
        position: 'relative',
        maxWidth: 820,
        margin: '0 auto',
        padding: '64px 32px 80px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <div style={{ position: 'relative' }}>
              <Logo size={48} />
              {!allReady && (
                <div style={{
                  position: 'absolute',
                  inset: -6,
                  borderRadius: 14,
                  border: '2px solid var(--accent)',
                  opacity: 0.3,
                  animation: 'pulse-ring 2s ease-out infinite',
                }} />
              )}
            </div>
          </div>

          {allReady ? (
            <>
              <div className="slide-up" style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 14px',
                background: 'var(--success-soft)',
                color: 'var(--success)',
                border: '1px solid var(--success-border)',
                borderRadius: 999,
                marginBottom: 20,
                fontSize: 12,
                fontWeight: 500,
              }}>
                <IconCheck size={12} /> All 7 agents live
              </div>
              <h1 className="serif slide-up-lg" style={{ fontSize: 48, lineHeight: 1.05, letterSpacing: -1, fontWeight: 400, marginBottom: 12 }}>
                Your sales team is live.
              </h1>
              <p className="slide-up-lg" style={{ fontSize: 15, color: 'var(--text-secondary)', maxWidth: 460, margin: '0 auto 32px', animationDelay: '100ms', animationFillMode: 'both' }}>
                Agents are already mining signals and opening leads. Time to step into mission control.
              </p>
              <Button
                variant="primary"
                size="xl"
                onClick={onComplete}
                iconRight={<IconArrow size={12} />}
                style={{ animation: 'slide-in-up-lg 500ms ease 200ms both' }}
              >
                Open mission control
              </Button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16, fontFamily: 'var(--mono)' }}>
                Deploying your team
              </div>
              <h1 className="serif" style={{ fontSize: 44, lineHeight: 1.05, letterSpacing: -1, fontWeight: 400, marginBottom: 10 }}>
                Setting up your agents.
              </h1>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                Training on <span style={{ color: 'var(--text)', fontWeight: 500 }}>{companyData?.website || 'your website'}</span> · this usually takes 14 seconds
              </p>
            </>
          )}
        </div>

        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Agents
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text-secondary)' }}>
              {readyCount}/{AGENTS.length}
            </div>
            <div style={{ width: 120, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                width: `${(readyCount / AGENTS.length) * 100}%`,
                height: '100%',
                background: allReady ? 'var(--success)' : 'var(--text)',
                transition: 'width 400ms cubic-bezier(0.16, 1, 0.3, 1)',
              }} />
            </div>
          </div>
        </div>

        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
        }}>
          {AGENTS.map((agent, i) => (
            <AgentRow
              key={agent.id}
              agent={agent}
              status={statuses[i]}
              currentStep={currentStep[i]}
              isLast={i === AGENTS.length - 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function AgentRow({ agent, status, currentStep, isLast }) {
  const Icon = agent.icon;
  const tones = {
    accent: { bg: 'var(--accent-soft)', fg: 'var(--accent-text)', bd: 'var(--accent-border)' },
    info: { bg: 'var(--info-soft)', fg: 'var(--info)', bd: 'var(--info-border)' },
    purple: { bg: 'var(--purple-soft)', fg: 'var(--purple)', bd: 'var(--purple-border)' },
    success: { bg: 'var(--success-soft)', fg: 'var(--success)', bd: 'var(--success-border)' },
    warning: { bg: 'var(--warning-soft)', fg: 'var(--warning)', bd: 'var(--warning-border)' },
  };
  const tone = tones[agent.tone];

  const isQueued = status === 'queued';
  const isProvisioning = status === 'provisioning';
  const isReady = status === 'ready';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '18px 20px',
      borderBottom: isLast ? 'none' : '1px solid var(--border-subtle)',
      opacity: isQueued ? 0.5 : 1,
      transition: 'opacity 300ms ease, background 300ms ease',
      background: isReady ? 'var(--bg-subtle)' : 'transparent',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {isProvisioning && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 2,
          background: 'var(--border)',
          overflow: 'hidden',
        }}>
          <div style={{
            width: '40%',
            height: '100%',
            background: 'var(--accent)',
            animation: 'progress-indeterminate 1.2s ease-in-out infinite',
          }} />
        </div>
      )}

      <div style={{
        width: 40, height: 40, borderRadius: 'var(--radius-md)',
        background: isReady ? tone.bg : 'var(--bg-subtle)',
        color: isReady ? tone.fg : 'var(--text-tertiary)',
        border: `1px solid ${isReady ? tone.bd : 'var(--border)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        transition: 'all 300ms ease',
      }}>
        <Icon size={18} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 500, letterSpacing: -0.1 }}>{agent.name}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {isProvisioning && agent.steps[currentStep] ? (
            <span key={currentStep} style={{ animation: 'fade-in 200ms ease', fontFamily: 'var(--mono)', color: 'var(--text-secondary)' }}>
              › {agent.steps[currentStep]}
              <span className="blink">_</span>
            </span>
          ) : (
            <span style={{ color: 'var(--text-tertiary)' }}>{agent.role}</span>
          )}
        </div>
      </div>

      <div style={{ flexShrink: 0 }}>
        <StatusBadge status={status} />
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  if (status === 'queued') {
    return (
      <div style={{ fontSize: 11, color: 'var(--text-quaternary)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: 1 }}>
        Queued
      </div>
    );
  }
  if (status === 'provisioning') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: 1 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1s ease-in-out infinite' }} />
        Deploying
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--success)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: 1, animation: 'fade-in 300ms ease' }}>
      <IconCheck size={11} />
      Ready
    </div>
  );
}
