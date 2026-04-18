'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Panel, TextArea, Button, IconPhone } from '@/components/multiply/ui';

/**
 * CampaignPanel — dead-simple queue drain.
 *
 *   Left box (PENDING)                Right box (CALLED)
 *   Paste numbers, one per line       Auto-filled as they're dialed
 *
 * Every <interval> seconds while running:
 *   1. take the first line from PENDING
 *   2. trigger the call
 *   3. move the line to CALLED
 *   4. repeat
 *
 * No batches, no persistence, no resume-after-reload. Deliberately stupid.
 */
export function CampaignPanel({ onTrigger }) {
  const [pending, setPending] = useState('');
  const [called, setCalled] = useState('');
  const [intervalSec, setIntervalSec] = useState(10);
  const [defaultCC, setDefaultCC] = useState('1');
  const [running, setRunning] = useState(false);
  const [nextAt, setNextAt] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [errorsCount, setErrorsCount] = useState(0);
  const timerRef = useRef(null);

  const pendingLines = pending.split('\n').filter((l) => l.trim());
  const calledLines = called.split('\n').filter((l) => l.trim());

  // Keep `now` ticking for countdown display
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  // Main interval loop — ONE call per tick
  useEffect(() => {
    if (!running) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setNextAt(null);
      return;
    }
    // Schedule next tick
    const fireAt = Date.now() + intervalSec * 1000;
    setNextAt(fireAt);

    timerRef.current = setTimeout(async () => {
      // Pick up the CURRENT pending list at fire time (not a stale closure)
      setPending((currentPending) => {
        const lines = currentPending.split('\n').filter((l) => l.trim());
        if (lines.length === 0) {
          setRunning(false);
          return currentPending;
        }
        const [nextLine, ...rest] = lines;
        const parsed = parseLine(nextLine, defaultCC);
        if (!parsed) {
          // unparseable line — skip it but still move on
          setCalled((prev) => appendLine(prev, `${nextLine} [unparseable]`));
          return rest.join('\n');
        }
        // Fire the call (async, don't block the tick)
        onTrigger({ phone: parsed.phone, name: parsed.name || 'Friend' })
          .then((r) => {
            if (r.ok) {
              setCalled((prev) => appendLine(prev, `✓ ${parsed.phone}${parsed.name ? ` · ${parsed.name}` : ''}`));
            } else {
              setErrorsCount((e) => e + 1);
              setCalled((prev) => appendLine(prev, `✗ ${parsed.phone} — ${r.error ?? 'failed'}`));
            }
          })
          .catch((err) => {
            setErrorsCount((e) => e + 1);
            setCalled((prev) => appendLine(prev, `✗ ${parsed.phone} — ${err.message}`));
          });
        return rest.join('\n');
      });
    }, intervalSec * 1000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // Re-run whenever running toggles, interval changes, OR the pending count
    // changes (so the next scheduled tick sees fresh state).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, intervalSec, pendingLines.length]);

  const secToNext = nextAt ? Math.max(0, Math.round((nextAt - now) / 1000)) : null;

  return (
    <Panel
      title="Campaign"
      subtitle="one call every N seconds · paste → dial → history"
      action={
        <div style={{ display: 'flex', gap: 6 }}>
          {!running && pendingLines.length > 0 && (
            <button
              onClick={() => setRunning(true)}
              style={btnStyle('accent')}
              title="Start firing"
            >
              ▶ Start
            </button>
          )}
          {running && (
            <button onClick={() => setRunning(false)} style={btnStyle('warn')}>
              ⏸ Pause
            </button>
          )}
          <button
            onClick={() => {
              if (!confirm('Clear both boxes?')) return;
              setPending('');
              setCalled('');
              setErrorsCount(0);
              setRunning(false);
            }}
            style={btnStyle('danger')}
          >
            Clear
          </button>
        </div>
      }
    >
      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Controls strip */}
        <div
          style={{
            display: 'flex',
            gap: 14,
            alignItems: 'center',
            fontSize: 12,
            fontFamily: 'var(--mono)',
          }}
        >
          <Label>interval</Label>
          <NumInput value={intervalSec} onChange={setIntervalSec} min={2} max={3600} suffix="s" />
          <Label>default cc</Label>
          <CcInput value={defaultCC} onChange={setDefaultCC} />
          <div style={{ flex: 1 }} />
          <Stat label="pending" value={pendingLines.length} color="info" />
          <Stat label="called" value={calledLines.length} color="success" />
          {errorsCount > 0 && <Stat label="err" value={errorsCount} color="danger" />}
          {running && (
            <Stat
              label="next in"
              value={secToNext != null ? `${secToNext}s` : '…'}
              color="accent"
            />
          )}
        </div>

        {/* Two-box layout */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 14,
          }}
        >
          <div>
            <BoxLabel>Pending numbers (paste here)</BoxLabel>
            <TextArea
              value={pending}
              onChange={setPending}
              placeholder={'+15551234567\n+4915123456789\nMike, +447700900123'}
              rows={14}
            />
          </div>
          <div>
            <BoxLabel>Called (filled as dialed)</BoxLabel>
            <TextArea
              value={called}
              onChange={setCalled}
              placeholder="— auto-fills as the queue runs —"
              rows={14}
            />
          </div>
        </div>

        {/* Bottom help */}
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
          Paste one number per line (name comma-separated is optional). Hit <b>▶ Start</b>. Every <b>{intervalSec}s</b> the top line gets dialed and moved to the right box. Numbers without a <code>+</code> get prefixed with <code>+{defaultCC}</code>.
        </div>
      </div>
    </Panel>
  );
}

// ---------- helpers ----------

function appendLine(s, line) {
  if (!s || !s.trim()) return line;
  return s + '\n' + line;
}

function parseLine(line, defaultCC) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const plusMatch = trimmed.match(/(\+\d[\d\s\-()]{7,})/);
  if (plusMatch) {
    const phone = plusMatch[1].replace(/[\s\-()]/g, '');
    const rest = trimmed.replace(plusMatch[1], '').replace(/[,;]/g, '').trim();
    return { name: rest, phone };
  }
  const digitsMatch = trimmed.match(/([\d\s\-()]{7,})/);
  if (!digitsMatch) return null;
  const digits = digitsMatch[1].replace(/[\s\-()]/g, '');
  if (digits.length < 7) return null;
  const rest = trimmed.replace(digitsMatch[1], '').replace(/[,;]/g, '').trim();
  return { name: rest, phone: `+${defaultCC}${digits.replace(/^0+/, '')}` };
}

function btnStyle(variant) {
  const map = {
    accent: { bg: 'var(--accent)', fg: '#fff', bd: 'var(--accent)' },
    warn: { bg: 'var(--warning-soft)', fg: 'var(--warning)', bd: 'var(--warning-border)' },
    danger: { bg: 'var(--surface)', fg: 'var(--danger)', bd: 'var(--danger-border)' },
  };
  const s = map[variant];
  return {
    fontSize: 11,
    fontFamily: 'var(--mono)',
    padding: '4px 10px',
    background: s.bg,
    color: s.fg,
    border: `1px solid ${s.bd}`,
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
  };
}

function Label({ children }) {
  return (
    <span style={{ color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 0.4, fontSize: 10 }}>
      {children}
    </span>
  );
}

function Stat({ label, value, color = 'neutral' }) {
  const colors = {
    neutral: 'var(--text)',
    accent: 'var(--accent)',
    success: 'var(--success)',
    info: 'var(--info)',
    danger: 'var(--danger)',
  };
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontFamily: 'var(--mono)',
        fontSize: 12,
      }}
    >
      <span style={{ color: 'var(--text-tertiary)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
      </span>
      <span style={{ color: colors[color], fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
    </span>
  );
}

function NumInput({ value, onChange, min, max, suffix }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: 'var(--surface)',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius-sm)',
        padding: '3px 8px',
      }}
    >
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (!Number.isNaN(v)) onChange(Math.min(Math.max(v, min ?? 0), max ?? Infinity));
        }}
        style={{
          width: 52,
          fontSize: 12,
          fontFamily: 'var(--mono)',
          background: 'transparent',
          color: 'var(--text)',
          textAlign: 'right',
        }}
      />
      {suffix && <span style={{ color: 'var(--text-tertiary)', fontSize: 11, marginLeft: 2 }}>{suffix}</span>}
    </span>
  );
}

function CcInput({ value, onChange }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: 'var(--surface)',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius-sm)',
        padding: '3px 8px',
      }}
    >
      <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>+</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        style={{
          width: 34,
          fontSize: 12,
          fontFamily: 'var(--mono)',
          background: 'transparent',
          color: 'var(--text)',
        }}
      />
    </span>
  );
}

function BoxLabel({ children }) {
  return (
    <div
      style={{
        fontSize: 11,
        color: 'var(--text-tertiary)',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        marginBottom: 6,
        fontFamily: 'var(--mono)',
      }}
    >
      {children}
    </div>
  );
}
