'use client';
import React, { useState } from 'react';
import { Button, Wordmark, IconArrow, IconRadar, IconBrain, IconMessage, IconHandshake, IconSparkle, IconTarget, IconShield } from './ui';

export function Intro({ onStart }) {
  const [screen, setScreen] = useState(0);

  const screens = [
    <HeroScreen key="hero" onNext={() => setScreen(1)} onSkip={onStart} />,
    <HowItWorksScreen key="how" onNext={() => setScreen(2)} onBack={() => setScreen(0)} />,
    <AgentsScreen key="agents" onNext={() => setScreen(3)} onBack={() => setScreen(1)} />,
    <ResultsScreen key="results" onStart={onStart} onBack={() => setScreen(2)} />,
  ];

  return (
    <div style={{ height: '100vh', overflow: 'auto', background: 'var(--bg)' }}>
      <IntroHeader screen={screen} total={screens.length} onSkip={onStart} />
      <div key={screen} className="fade-in" style={{ animation: 'fade-in 400ms ease' }}>
        {screens[screen]}
      </div>
    </div>
  );
}

function IntroHeader({ screen, total, onSkip }) {
  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 10,
      background: 'rgba(250, 250, 250, 0.85)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border-subtle)',
      padding: '14px 32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <Wordmark size={16} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} style={{
              width: i === screen ? 20 : 6,
              height: 6,
              borderRadius: 3,
              background: i === screen ? 'var(--text)' : i < screen ? 'var(--text-tertiary)' : 'var(--border-strong)',
              transition: 'all 300ms cubic-bezier(0.16, 1, 0.3, 1)',
            }} />
          ))}
        </div>
        <button
          onClick={onSkip}
          style={{
            fontSize: 12,
            color: 'var(--text-tertiary)',
            padding: '6px 10px',
            borderRadius: 'var(--radius-sm)',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}
        >
          Skip intro →
        </button>
      </div>
    </div>
  );
}

function HeroScreen({ onNext, onSkip }) {
  return (
    <div style={{
      minHeight: 'calc(100vh - 60px)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '60px 32px 80px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 720,
        height: 720,
        background: 'radial-gradient(circle, var(--accent-soft) 0%, transparent 65%)',
        opacity: 0.7,
        animation: 'hero-glow 6s ease-in-out infinite',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      <div className="dots-bg" style={{ position: 'absolute', inset: 0, opacity: 0.4, pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 760 }}>
        <div className="slide-up" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 14px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 999,
          marginBottom: 32,
          fontSize: 12,
          color: 'var(--text-secondary)',
          boxShadow: 'var(--shadow-xs)',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', animation: 'pulse 2s ease-in-out infinite' }} />
          Introducing Multiply · autonomous sales agents
        </div>

        <h1 className="serif slide-up-lg" style={{
          fontSize: 72,
          lineHeight: 1,
          letterSpacing: -2,
          fontWeight: 400,
          marginBottom: 24,
          color: 'var(--text)',
        }}>
          Your sales team,<br />
          <span style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>multiplied.</span>
        </h1>

        <p className="slide-up-lg" style={{
          fontSize: 18,
          lineHeight: 1.5,
          color: 'var(--text-secondary)',
          maxWidth: 560,
          margin: '0 auto 40px',
          animationDelay: '100ms',
          animationFillMode: 'both',
        }}>
          Seven AI agents that find leads, qualify them across phone, email,
          and chat, handle objections, and book meetings — while you sleep.
        </p>

        <div className="slide-up-lg" style={{
          display: 'flex',
          gap: 10,
          justifyContent: 'center',
          animationDelay: '200ms',
          animationFillMode: 'both',
        }}>
          <Button variant="primary" size="xl" onClick={onNext} iconRight={<IconArrow size={12} />}>
            See how it works
          </Button>
          <Button variant="default" size="xl" onClick={onSkip}>
            Skip to setup
          </Button>
        </div>

        <div style={{ marginTop: 64, display: 'flex', gap: 48, justifyContent: 'center', flexWrap: 'wrap', animation: 'fade-in 1200ms ease 400ms both' }}>
          <Stat value="2,847" label="signals mined daily" />
          <Stat value="28.4%" label="avg reply rate" />
          <Stat value="73%" label="objection win rate" />
          <Stat value="11s" label="from signal to first touch" />
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div className="serif" style={{ fontSize: 28, color: 'var(--text)', letterSpacing: -1, marginBottom: 2 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'var(--mono)' }}>
        {label}
      </div>
    </div>
  );
}

function HowItWorksScreen({ onNext, onBack }) {
  const steps = [
    { n: '01', title: 'We listen to the web', body: 'Our Signal Hunter monitors funding announcements, hiring spikes, tech-stack changes, and buying intent across 12 sources — every 2 seconds.', highlight: 'Signals ingested today: 2,847' },
    { n: '02', title: 'Leads open themselves', body: 'The moment a company matches your ICP, Multiply enriches the account, finds the decision-maker, and drafts a personalized first touch.', highlight: 'Average time to first touch: 11 seconds' },
    { n: '03', title: 'Agents run real conversations', body: 'Voice calls, emails, SMS, WhatsApp. Our agents qualify leads, handle objections in real time, and book meetings — all on autopilot.', highlight: 'Reply rate: 28.4% · Meetings booked: 37 this week' },
    { n: '04', title: 'You stay in control', body: 'Listen in on any call. Whisper a nudge to the agent privately. Take over the conversation when it matters. Pause everything with one click.', highlight: 'Full observability. Full control. Zero surprises.' },
  ];

  return (
    <div style={{ padding: '80px 32px 100px', maxWidth: 1080, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 72 }}>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16, fontFamily: 'var(--mono)' }}>
          How it works
        </div>
        <h2 className="serif" style={{ fontSize: 52, lineHeight: 1.05, letterSpacing: -1.2, fontWeight: 400 }}>
          Four steps. <span style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>Zero manual work.</span>
        </h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        {steps.map((step, i) => (
          <div key={i} style={{
            background: 'var(--surface)',
            padding: '36px 40px',
            display: 'grid',
            gridTemplateColumns: '80px 1fr 1fr',
            gap: 32,
            alignItems: 'start',
          }}>
            <div className="mono" style={{ fontSize: 13, color: 'var(--text-tertiary)', letterSpacing: 1, fontWeight: 500 }}>
              {step.n}
            </div>
            <div>
              <h3 className="serif" style={{ fontSize: 26, letterSpacing: -0.6, marginBottom: 10, fontWeight: 400 }}>
                {step.title}
              </h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 460 }}>
                {step.body}
              </p>
            </div>
            <div style={{
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '16px 18px',
              fontSize: 12,
              color: 'var(--text-secondary)',
              fontFamily: 'var(--mono)',
              alignSelf: 'center',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}>
              <span style={{ color: 'var(--success)' }}>›</span>
              {step.highlight}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 48 }}>
        <Button variant="ghost" onClick={onBack} size="lg">← Back</Button>
        <Button variant="primary" onClick={onNext} size="lg" iconRight={<IconArrow size={12} />}>
          Meet your agents
        </Button>
      </div>
    </div>
  );
}

function AgentsScreen({ onNext, onBack }) {
  const agents = [
    { icon: IconRadar, name: 'Signal Hunter', desc: 'Monitors 12 data sources for buying intent across your ICP', color: 'accent' },
    { icon: IconTarget, name: 'Prospector', desc: 'Enriches accounts with firmographics, funding, headcount', color: 'info' },
    { icon: IconBrain, name: 'Researcher', desc: 'Builds dossiers on every decision-maker before first contact', color: 'purple' },
    { icon: IconSparkle, name: 'Personaliser', desc: 'Crafts outreach trained on your voice, website, and case studies', color: 'accent' },
    { icon: IconMessage, name: 'Qualifier', desc: 'Runs voice, email, and chat conversations to extract BANT', color: 'success' },
    { icon: IconShield, name: 'Negotiator', desc: '47 objection patterns, routed by a real-time classifier', color: 'warning' },
    { icon: IconHandshake, name: 'Closer', desc: 'Books meetings, sends contracts, syncs to your CRM', color: 'info' },
  ];

  return (
    <div style={{ padding: '80px 32px 100px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 72 }}>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16, fontFamily: 'var(--mono)' }}>
          The team
        </div>
        <h2 className="serif" style={{ fontSize: 52, lineHeight: 1.05, letterSpacing: -1.2, fontWeight: 400, marginBottom: 16 }}>
          Seven specialists. <span style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>One mission.</span>
        </h2>
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', maxWidth: 540, margin: '0 auto' }}>
          Each agent owns one job and hands off to the next — like a real sales team, but faster and always on.
        </p>
      </div>

      <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {agents.map((a, i) => {
          const Icon = a.icon;
          const tones = {
            accent: { bg: 'var(--accent-soft)', fg: 'var(--accent-text)', bd: 'var(--accent-border)' },
            info: { bg: 'var(--info-soft)', fg: 'var(--info)', bd: 'var(--info-border)' },
            purple: { bg: 'var(--purple-soft)', fg: 'var(--purple)', bd: 'var(--purple-border)' },
            success: { bg: 'var(--success-soft)', fg: 'var(--success)', bd: 'var(--success-border)' },
            warning: { bg: 'var(--warning-soft)', fg: 'var(--warning)', bd: 'var(--warning-border)' },
          };
          const tone = tones[a.color];

          return (
            <div key={i} style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: 24,
              boxShadow: 'var(--shadow-xs)',
              transition: 'all 200ms ease',
              cursor: 'default',
            }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-xs)'; e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 'var(--radius-md)',
                background: tone.bg, color: tone.fg,
                border: `1px solid ${tone.bd}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 16,
              }}>
                <Icon size={20} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 500, letterSpacing: -0.2, marginBottom: 6 }}>
                {a.name}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                {a.desc}
              </div>
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--mono)' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--success)' }} />
                Online · learns continuously
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 56 }}>
        <Button variant="ghost" onClick={onBack} size="lg">← Back</Button>
        <Button variant="primary" onClick={onNext} size="lg" iconRight={<IconArrow size={12} />}>
          See the results
        </Button>
      </div>
    </div>
  );
}

function ResultsScreen({ onStart, onBack }) {
  return (
    <div style={{ padding: '80px 32px 100px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 72 }}>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16, fontFamily: 'var(--mono)' }}>
          The difference
        </div>
        <h2 className="serif" style={{ fontSize: 52, lineHeight: 1.05, letterSpacing: -1.2, fontWeight: 400 }}>
          Before vs. <span style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>after.</span>
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 56 }}>
        <ComparisonCard
          title="Without Multiply"
          tone="before"
          items={[
            { label: 'Time to first touch', value: '2–5 days', bad: true },
            { label: 'Reply rate', value: '6–9%', bad: true },
            { label: 'Meetings per SDR / week', value: '3–5', bad: true },
            { label: 'Leads qualified per week', value: '20', bad: true },
            { label: 'Hours spent on admin', value: '15 hrs', bad: true },
            { label: 'Cold pipeline re-engaged', value: '0%', bad: true },
          ]}
        />
        <ComparisonCard
          title="With Multiply"
          tone="after"
          items={[
            { label: 'Time to first touch', value: '11 seconds' },
            { label: 'Reply rate', value: '28.4%' },
            { label: 'Meetings per SDR / week', value: '24' },
            { label: 'Leads qualified per week', value: '184' },
            { label: 'Hours spent on admin', value: '0 hrs' },
            { label: 'Cold pipeline re-engaged', value: '100%' },
          ]}
        />
      </div>

      <div style={{
        background: 'var(--text)',
        color: '#fff',
        borderRadius: 'var(--radius-xl)',
        padding: '48px 56px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 40,
        flexWrap: 'wrap',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          top: -80,
          right: -80,
          width: 240,
          height: 240,
          borderRadius: '50%',
          background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)',
          opacity: 0.5,
          pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative', zIndex: 1, flex: 1, minWidth: 280 }}>
          <h3 className="serif" style={{ fontSize: 36, letterSpacing: -0.8, fontWeight: 400, marginBottom: 12, lineHeight: 1.1 }}>
            Ready in under a minute.
          </h3>
          <p style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.55, maxWidth: 480 }}>
            Tell us your website, your sales motion, and your goal. We'll deploy all 7 agents, trained on your data, and they'll start working immediately.
          </p>
        </div>
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 10 }}>
          <button
            onClick={onStart}
            style={{
              padding: '14px 28px',
              fontSize: 15,
              fontWeight: 500,
              background: '#fff',
              color: 'var(--text)',
              borderRadius: 'var(--radius-md)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 120ms ease',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            Get started <IconArrow size={12} />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 48 }}>
        <Button variant="ghost" onClick={onBack} size="lg">← Back</Button>
      </div>
    </div>
  );
}

function ComparisonCard({ title, items, tone }) {
  const isBefore = tone === 'before';
  return (
    <div style={{
      background: 'var(--surface)',
      border: isBefore ? '1px solid var(--border)' : '1px solid var(--text)',
      borderRadius: 'var(--radius-lg)',
      padding: 28,
      boxShadow: isBefore ? 'var(--shadow-xs)' : 'var(--shadow-md)',
      position: 'relative',
    }}>
      {!isBefore && (
        <div style={{
          position: 'absolute',
          top: -11,
          left: 24,
          background: 'var(--text)',
          color: '#fff',
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: 1,
          padding: '4px 10px',
          borderRadius: 999,
          fontFamily: 'var(--mono)',
          textTransform: 'uppercase',
        }}>
          Multiply
        </div>
      )}
      <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 20, fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: 1 }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {items.map((item, i) => (
          <div key={i} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            padding: '14px 0',
            borderBottom: i < items.length - 1 ? '1px solid var(--border-subtle)' : 'none',
          }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {item.label}
            </div>
            <div className="serif" style={{
              fontSize: 22,
              letterSpacing: -0.4,
              color: item.bad ? 'var(--text-tertiary)' : 'var(--text)',
              textDecoration: item.bad ? 'line-through' : 'none',
              textDecorationColor: 'var(--text-quaternary)',
            }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
