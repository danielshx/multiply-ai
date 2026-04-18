'use client';
import React, { useState } from 'react';
import { Button, Field, TextInput, TextArea, Select, RadioGroup, MultiChipSelect, Wordmark, Avatar, Pill, IconArrow, IconCheck, IconCalendar, IconFilter, IconRefresh } from './ui';

export function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    website: '',
    product: 'B2B SaaS',
    teamSize: '6–20',
    motion: 'Outbound',
    channels: ['Email', 'Phone', 'LinkedIn'],
    goal: 'book',
    icp: '',
    acv: '50k-250k',
  });

  const update = (key, value) => setData(d => ({ ...d, [key]: value }));

  const steps = [
    <StepCompany key="company" data={data} update={update} onNext={() => setStep(1)} />,
    <StepTeam key="team" data={data} update={update} onNext={() => setStep(2)} onBack={() => setStep(0)} />,
    <StepGoal key="goal" data={data} update={update} onNext={() => onComplete(data)} onBack={() => setStep(1)} />,
  ];

  return (
    <div style={{ height: '100vh', overflow: 'auto', background: 'var(--bg)' }}>
      <OnboardingHeader step={step} total={steps.length} />
      <div key={step} className="fade-in">
        {steps[step]}
      </div>
    </div>
  );
}

function OnboardingHeader({ step, total }) {
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--mono)' }}>
          Step {step + 1} of {total}
        </span>
        <div style={{ width: 160, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            width: `${((step + 1) / total) * 100}%`,
            height: '100%',
            background: 'var(--text)',
            borderRadius: 2,
            transition: 'width 400ms cubic-bezier(0.16, 1, 0.3, 1)',
          }} />
        </div>
      </div>
    </div>
  );
}

function StepShell({ label, title, subtitle, children, onNext, onBack, nextLabel = 'Continue', nextDisabled }) {
  return (
    <div style={{ padding: '64px 32px 80px', maxWidth: 640, margin: '0 auto' }}>
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12, fontFamily: 'var(--mono)' }}>
          {label}
        </div>
        <h2 className="serif" style={{ fontSize: 40, lineHeight: 1.1, letterSpacing: -1, fontWeight: 400, marginBottom: 12 }}>
          {title}
        </h2>
        {subtitle && (
          <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            {subtitle}
          </p>
        )}
      </div>

      <div className="slide-up" style={{ marginBottom: 40 }}>
        {children}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        {onBack ? <Button variant="ghost" onClick={onBack} size="lg">← Back</Button> : <div />}
        <Button variant="primary" onClick={onNext} size="lg" disabled={nextDisabled} iconRight={<IconArrow size={12} />}>
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}

function StepCompany({ data, update, onNext }) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  const onWebsiteBlur = () => {
    if (!data.website || preview) return;
    setLoading(true);
    setTimeout(() => {
      setPreview({
        name: deriveName(data.website),
        industry: 'B2B SaaS · DevTools',
        employees: '50–200',
        location: 'San Francisco, CA',
      });
      setLoading(false);
    }, 1200);
  };

  return (
    <StepShell
      label="Step 1 · About your company"
      title="Let's start with your website."
      subtitle="We'll read your site and auto-configure your agents with your voice, product, and positioning."
      onNext={onNext}
      nextDisabled={!data.website}
    >
      <Field label="Company website" required>
        <TextInput
          value={data.website}
          onChange={v => { update('website', v); setPreview(null); }}
          onBlur={onWebsiteBlur}
          placeholder="acme.com"
          prefix="https://"
          autoFocus
        />
      </Field>

      {(loading || preview) && (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: 20,
          marginTop: -6,
          marginBottom: 18,
          boxShadow: 'var(--shadow-xs)',
          animation: 'slide-in-up 300ms ease',
        }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 8 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ width: 140, height: 14, marginBottom: 6 }} />
                <div className="skeleton" style={{ width: 200, height: 10 }} />
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <Avatar initials={preview.name.slice(0, 2).toUpperCase()} size={40} color="accent" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{preview.name}</span>
                  <Pill size="xs" color="success"><IconCheck size={9} /> Verified</Pill>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', gap: 10 }}>
                  <span>{preview.industry}</span>
                  <span>·</span>
                  <span>{preview.employees}</span>
                  <span>·</span>
                  <span>{preview.location}</span>
                </div>
              </div>
              <Pill size="sm" color="accent">Ready to train</Pill>
            </div>
          )}
        </div>
      )}

      <Field label="What do you sell?" hint="This helps our Personaliser agent speak your language.">
        <TextInput
          value={data.product}
          onChange={v => update('product', v)}
          placeholder="e.g. B2B SaaS, developer tools, fintech"
        />
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          {['B2B SaaS', 'Developer tools', 'Fintech', 'Hardware', 'Consulting', 'E-commerce'].map(p => (
            <button
              key={p}
              onClick={() => update('product', p)}
              style={{
                padding: '5px 10px',
                fontSize: 11,
                background: data.product === p ? 'var(--accent-soft)' : 'var(--surface)',
                color: data.product === p ? 'var(--accent-text)' : 'var(--text-secondary)',
                border: `1px solid ${data.product === p ? 'var(--accent-border)' : 'var(--border)'}`,
                borderRadius: 999,
                cursor: 'pointer',
                transition: 'all 120ms ease',
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </Field>
    </StepShell>
  );
}

function deriveName(url) {
  const clean = url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split('.')[0];
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function StepTeam({ data, update, onNext, onBack }) {
  return (
    <StepShell
      label="Step 2 · Your sales team"
      title="Tell us how you sell today."
      subtitle="We'll configure which agents to activate and which channels they should use."
      onNext={onNext}
      onBack={onBack}
    >
      <Field label="How big is your sales team?">
        <RadioGroup
          value={data.teamSize}
          onChange={v => update('teamSize', v)}
          options={[
            { value: 'just-me', label: 'Just me' },
            { value: '2-5', label: '2 – 5' },
            { value: '6–20', label: '6 – 20' },
            { value: '20+', label: '20+' },
          ]}
        />
      </Field>

      <Field label="Primary sales motion">
        <RadioGroup
          value={data.motion}
          onChange={v => update('motion', v)}
          options={[
            { value: 'Outbound', label: 'Outbound' },
            { value: 'Inbound', label: 'Inbound' },
            { value: 'Both', label: 'Both' },
          ]}
        />
      </Field>

      <Field label="Which channels do you use?" hint="Your agents will match your team's existing channel mix.">
        <MultiChipSelect
          values={data.channels}
          onChange={v => update('channels', v)}
          options={[
            { value: 'Email', label: 'Email' },
            { value: 'Phone', label: 'Phone' },
            { value: 'LinkedIn', label: 'LinkedIn' },
            { value: 'SMS', label: 'SMS' },
            { value: 'WhatsApp', label: 'WhatsApp' },
            { value: 'Chat widget', label: 'Chat widget' },
          ]}
        />
      </Field>
    </StepShell>
  );
}

function StepGoal({ data, update, onNext, onBack }) {
  const goals = [
    { value: 'book', icon: IconCalendar, title: 'Book more meetings', desc: 'Turn inbound traffic and cold outreach into qualified meetings on your calendar.' },
    { value: 'qualify', icon: IconFilter, title: 'Qualify inbound faster', desc: 'Route every lead through BANT extraction before they hit your reps.' },
    { value: 'reengage', icon: IconRefresh, title: 'Re-engage cold pipeline', desc: 'Wake up dormant leads with personalized, signal-driven outreach.' },
  ];

  return (
    <StepShell
      label="Step 3 · Your goal"
      title="What should Multiply do first?"
      subtitle="We'll prioritize your agents around this outcome. You can change it anytime."
      onNext={onNext}
      onBack={onBack}
      nextLabel="Deploy my agents"
    >
      <Field label="Primary goal">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {goals.map(g => {
            const Icon = g.icon;
            const selected = data.goal === g.value;
            return (
              <button
                key={g.value}
                onClick={() => update('goal', g.value)}
                style={{
                  textAlign: 'left',
                  padding: 18,
                  background: selected ? 'var(--accent-soft)' : 'var(--surface)',
                  border: `1px solid ${selected ? 'var(--accent)' : 'var(--border-strong)'}`,
                  borderRadius: 'var(--radius-md)',
                  boxShadow: selected ? '0 0 0 3px var(--accent-soft)' : 'var(--shadow-xs)',
                  transition: 'all 160ms ease',
                  cursor: 'pointer',
                  position: 'relative',
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 'var(--radius-sm)',
                  background: selected ? 'var(--accent)' : 'var(--bg-subtle)',
                  color: selected ? '#fff' : 'var(--text-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 12,
                  transition: 'all 120ms ease',
                }}>
                  <Icon size={16} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 4, letterSpacing: -0.1 }}>
                  {g.title}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {g.desc}
                </div>
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Your ideal customer profile" hint="One sentence describing who you want to sell to.">
        <TextArea
          value={data.icp}
          onChange={v => update('icp', v)}
          placeholder="e.g. Series B+ SaaS companies, 50–500 employees, engineering-led, EU/US"
        />
      </Field>

      <Field label="Target deal size">
        <Select
          value={data.acv}
          onChange={v => update('acv', v)}
          options={[
            { value: 'under-10k', label: 'Under $10K ACV' },
            { value: '10k-50k', label: '$10K – $50K' },
            { value: '50k-250k', label: '$50K – $250K' },
            { value: '250k+', label: '$250K+' },
          ]}
        />
      </Field>
    </StepShell>
  );
}
