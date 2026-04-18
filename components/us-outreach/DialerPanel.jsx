'use client';
import React, { useState } from 'react';
import { Panel, Field, TextInput, TextArea, Button, IconPhone } from '@/components/multiply/ui';

const COUNTRIES = [
  { cc: '1',  iso: 'US', label: '🇺🇸 US',          minDigits: 10, placeholder: '555 123 4567' },
  { cc: '49', iso: 'DE', label: '🇩🇪 Germany',     minDigits: 10, placeholder: '151 23456789' },
  { cc: '44', iso: 'GB', label: '🇬🇧 UK',          minDigits: 10, placeholder: '7700 900123' },
  { cc: '43', iso: 'AT', label: '🇦🇹 Austria',     minDigits: 10, placeholder: '660 1234567' },
  { cc: '41', iso: 'CH', label: '🇨🇭 Switzerland', minDigits: 9,  placeholder: '78 123 45 67' },
  { cc: '33', iso: 'FR', label: '🇫🇷 France',      minDigits: 9,  placeholder: '6 12 34 56 78' },
];

// Parse one line of bulk input. Accepts:
//   +491234567890
//   Name, +491234567890
//   Name,+491234567890
//   Name +491234567890
// Returns { name, phone } or null if no phone detected.
function parseLine(line, defaultCountry) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  // Find a phone-like token (starts with + or has many digits)
  const plusMatch = trimmed.match(/(\+\d[\d\s\-()]{7,})/);
  if (plusMatch) {
    const phone = plusMatch[1].replace(/[\s\-()]/g, '');
    const rest = trimmed.replace(plusMatch[1], '').replace(/[,;]/g, '').trim();
    return { name: rest, phone };
  }
  // No +: assume digits + optional name
  const digitsMatch = trimmed.match(/([\d\s\-()]{7,})/);
  if (!digitsMatch) return null;
  const digits = digitsMatch[1].replace(/[\s\-()]/g, '');
  if (digits.length < 7) return null;
  const rest = trimmed.replace(digitsMatch[1], '').replace(/[,;]/g, '').trim();
  const phone = `+${defaultCountry.cc}${digits.replace(/^0+/, '')}`;
  return { name: rest, phone };
}

export function DialerPanel({ onTrigger }) {
  const [mode, setMode] = useState('single');
  const [name, setName] = useState('');
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [phone, setPhone] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [progress, setProgress] = useState(null);

  const digits = phone.replace(/\D/g, '');
  const singleValid = digits.length >= country.minDigits;
  const e164 = `+${country.cc}${digits.replace(/^0+/, '')}`;

  const bulkLines = bulkText
    .split('\n')
    .map((l) => parseLine(l, country))
    .filter((x) => x && x.phone);
  const bulkValid = bulkLines.length > 0;

  async function callSingle() {
    if (!singleValid || busy) return;
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

  async function callBulk() {
    if (!bulkValid || busy) return;
    setBusy(true);
    setFeedback(null);
    setProgress({ done: 0, total: bulkLines.length, ok: 0, failed: 0 });
    let ok = 0;
    let failed = 0;
    const results = await Promise.all(
      bulkLines.map(async (line) => {
        try {
          const r = await onTrigger({ phone: line.phone, name: line.name || 'Friend' });
          if (r.ok) {
            ok++;
          } else {
            failed++;
          }
          setProgress((p) => (p ? { ...p, done: p.done + 1, ok, failed } : p));
          return r;
        } catch {
          failed++;
          setProgress((p) => (p ? { ...p, done: p.done + 1, ok, failed } : p));
          return { ok: false };
        }
      }),
    );
    setBusy(false);
    setFeedback({
      kind: ok > 0 ? 'ok' : 'err',
      text: `Fired ${ok} call${ok === 1 ? '' : 's'}${failed > 0 ? `, ${failed} failed` : ''}`,
    });
    if (ok === bulkLines.length) setBulkText('');
    setTimeout(() => {
      setFeedback(null);
      setProgress(null);
    }, 8000);
  }

  return (
    <Panel
      title="Dial"
      subtitle={mode === 'single' ? 'HappyRobot → Twilio → friend\'s phone' : 'Bulk — fires in parallel'}
      style={{ minHeight: 240 }}
      action={<ModeToggle mode={mode} setMode={setMode} />}
    >
      <div style={{ padding: 18 }}>
        {mode === 'single' ? (
          <>
            <Field label="Contact name" hint="What the agent calls them on the phone.">
              <TextInput
                value={name}
                onChange={setName}
                placeholder="Mike"
                onKeyDown={(e) => e.key === 'Enter' && callSingle()}
              />
            </Field>
            <Field
              label="Phone number"
              required
              hint={singleValid ? `Will dial ${e164}` : 'Pick a country, enter digits.'}
            >
              <div style={{ display: 'flex', gap: 8 }}>
                <CountrySelect value={country} onChange={setCountry} />
                <div style={{ flex: 1 }}>
                  <TextInput
                    value={phone}
                    onChange={setPhone}
                    placeholder={country.placeholder}
                    prefix={`+${country.cc}`}
                    onKeyDown={(e) => e.key === 'Enter' && callSingle()}
                  />
                </div>
              </div>
            </Field>
            <Button
              onClick={callSingle}
              disabled={!singleValid || busy}
              variant="accent"
              size="lg"
              fullWidth
              icon={<IconPhone size={14} />}
            >
              {busy ? 'Triggering call…' : 'Call now'}
            </Button>
          </>
        ) : (
          <>
            <Field
              label={`Phone numbers${bulkValid ? ` · ${bulkLines.length} parsed` : ''}`}
              required
              hint={
                bulkValid
                  ? `Will dial ${bulkLines.length} in parallel. Default country: ${country.label}.`
                  : 'One per line. Format: "Name, +491234567890" or just "+491234567890". Local digits → prefixed with selected country.'
              }
            >
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <CountrySelect value={country} onChange={setCountry} />
                <div style={{ flex: 1, fontSize: 11, color: 'var(--text-tertiary)', alignSelf: 'center', paddingLeft: 4 }}>
                  fallback country for unprefixed numbers
                </div>
              </div>
              <TextArea
                value={bulkText}
                onChange={setBulkText}
                placeholder={'Mike, +15551234567\nSarah, +4915123456789\n+447700900123'}
                rows={7}
              />
            </Field>
            {bulkValid && (
              <div
                style={{
                  marginBottom: 12,
                  padding: 10,
                  background: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  maxHeight: 120,
                  overflow: 'auto',
                }}
              >
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>
                  preview
                </div>
                {bulkLines.map((l, i) => (
                  <div key={i} style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {l.name ? `${l.name} — ` : ''}{l.phone}
                  </div>
                ))}
              </div>
            )}
            <Button
              onClick={callBulk}
              disabled={!bulkValid || busy}
              variant="accent"
              size="lg"
              fullWidth
              icon={<IconPhone size={14} />}
            >
              {busy
                ? `Firing… ${progress?.done ?? 0}/${progress?.total ?? 0}`
                : bulkValid
                  ? `Call all ${bulkLines.length} in parallel`
                  : 'Call all'}
            </Button>
          </>
        )}

        {progress && (
          <div style={{ marginTop: 12, display: 'flex', gap: 10, fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--mono)' }}>
            <span>done: {progress.done}/{progress.total}</span>
            <span style={{ color: 'var(--success)' }}>✓ {progress.ok}</span>
            {progress.failed > 0 && <span style={{ color: 'var(--danger)' }}>✗ {progress.failed}</span>}
          </div>
        )}

        {feedback && (
          <div
            style={{
              marginTop: 14,
              padding: '8px 12px',
              fontSize: 12,
              borderRadius: 'var(--radius-sm)',
              background: feedback.kind === 'ok' ? 'var(--success-soft)' : 'var(--danger-soft)',
              color: feedback.kind === 'ok' ? 'var(--success)' : 'var(--danger)',
              border: `1px solid ${feedback.kind === 'ok' ? 'var(--success-border)' : 'var(--danger-border)'}`,
            }}
          >
            {feedback.text}
          </div>
        )}
      </div>
    </Panel>
  );
}

function ModeToggle({ mode, setMode }) {
  const opts = [
    { v: 'single', label: 'Single' },
    { v: 'bulk', label: 'Bulk' },
  ];
  return (
    <div
      style={{
        display: 'flex',
        background: 'var(--bg-subtle)',
        padding: 2,
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border)',
      }}
    >
      {opts.map((o) => {
        const active = mode === o.v;
        return (
          <button
            key={o.v}
            onClick={() => setMode(o.v)}
            style={{
              padding: '3px 10px',
              fontSize: 11,
              fontFamily: 'var(--mono)',
              fontWeight: 500,
              background: active ? 'var(--surface)' : 'transparent',
              color: active ? 'var(--text)' : 'var(--text-tertiary)',
              border: active ? '1px solid var(--border-strong)' : '1px solid transparent',
              borderRadius: 'var(--radius-xs)',
              cursor: 'pointer',
              boxShadow: active ? 'var(--shadow-xs)' : 'none',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
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
