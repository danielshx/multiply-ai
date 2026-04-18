'use client';
import React, { useState } from 'react';
import { Panel, Field, TextInput, Button, IconPhone } from '@/components/multiply/ui';

const COUNTRIES = [
  { cc: '1',  iso: 'US', label: '🇺🇸 US',          minDigits: 10, placeholder: '555 123 4567' },
  { cc: '49', iso: 'DE', label: '🇩🇪 Germany',     minDigits: 10, placeholder: '151 23456789' },
  { cc: '44', iso: 'GB', label: '🇬🇧 UK',          minDigits: 10, placeholder: '7700 900123' },
  { cc: '43', iso: 'AT', label: '🇦🇹 Austria',     minDigits: 10, placeholder: '660 1234567' },
  { cc: '41', iso: 'CH', label: '🇨🇭 Switzerland', minDigits: 9,  placeholder: '78 123 45 67' },
  { cc: '33', iso: 'FR', label: '🇫🇷 France',      minDigits: 9,  placeholder: '6 12 34 56 78' },
];

export function DialerPanel({ onTrigger }) {
  const [name, setName] = useState('');
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const digits = phone.replace(/\D/g, '');
  const valid = digits.length >= country.minDigits;
  const e164 = `+${country.cc}${digits.replace(/^0+/, '')}`;

  async function call() {
    if (!valid || busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      const result = await onTrigger({ phone: e164, name });
      if (result.ok) {
        setFeedback({ kind: 'ok', text: `Calling ${name || phone}…` });
        setName('');
        setPhone('');
      } else {
        setFeedback({ kind: 'err', text: result.error ?? 'trigger failed' });
      }
    } catch (err) {
      setFeedback({ kind: 'err', text: err.message });
    } finally {
      setBusy(false);
      setTimeout(() => setFeedback(null), 6000);
    }
  }

  return (
    <Panel
      title="Dial"
      subtitle="HappyRobot → Twilio → friend's phone"
      style={{ minHeight: 240 }}
    >
      <div style={{ padding: 18 }}>
        <Field label="Contact name" hint="What the agent calls them on the phone.">
          <TextInput
            value={name}
            onChange={setName}
            placeholder="Mike"
            onKeyDown={(e) => e.key === 'Enter' && call()}
          />
        </Field>
        <Field
          label="Phone number"
          required
          hint={valid ? `Will dial ${e164}` : 'Pick a country, enter digits.'}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            <CountrySelect value={country} onChange={setCountry} />
            <div style={{ flex: 1 }}>
              <TextInput
                value={phone}
                onChange={setPhone}
                placeholder={country.placeholder}
                prefix={`+${country.cc}`}
                onKeyDown={(e) => e.key === 'Enter' && call()}
              />
            </div>
          </div>
        </Field>
        <Button
          onClick={call}
          disabled={!valid || busy}
          variant="accent"
          size="lg"
          fullWidth
          icon={<IconPhone size={14} />}
        >
          {busy ? 'Triggering call…' : 'Call now'}
        </Button>

        {feedback && (
          <div
            style={{
              marginTop: 14,
              padding: '8px 12px',
              fontSize: 12,
              borderRadius: 'var(--radius-sm)',
              background:
                feedback.kind === 'ok' ? 'var(--success-soft)' : 'var(--danger-soft)',
              color:
                feedback.kind === 'ok' ? 'var(--success)' : 'var(--danger)',
              border: `1px solid ${
                feedback.kind === 'ok' ? 'var(--success-border)' : 'var(--danger-border)'
              }`,
            }}
          >
            {feedback.text}
          </div>
        )}
      </div>
    </Panel>
  );
}

function CountrySelect({ value, onChange }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <div
      style={{
        position: 'relative',
        background: 'var(--surface)',
        border: `1px solid ${focus ? 'var(--accent)' : 'var(--border-strong)'}`,
        borderRadius: 'var(--radius-md)',
        boxShadow: focus ? '0 0 0 3px var(--accent-soft)' : 'none',
        transition: 'all 120ms ease',
        minWidth: 130,
      }}
    >
      <select
        value={value.iso}
        onChange={(e) => {
          const next = COUNTRIES.find((c) => c.iso === e.target.value);
          if (next) onChange(next);
        }}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          width: '100%',
          fontSize: 13,
          padding: '10px 28px 10px 12px',
          color: 'var(--text)',
          appearance: 'none',
          cursor: 'pointer',
          background: 'transparent',
        }}
      >
        {COUNTRIES.map((c) => (
          <option key={c.iso} value={c.iso}>
            {c.label} (+{c.cc})
          </option>
        ))}
      </select>
      <span
        style={{
          position: 'absolute',
          right: 10,
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--text-tertiary)',
          pointerEvents: 'none',
          fontSize: 10,
        }}
      >
        ▾
      </span>
    </div>
  );
}
