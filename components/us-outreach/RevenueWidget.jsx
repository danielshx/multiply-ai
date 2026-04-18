'use client';
import React from 'react';
import { Panel } from '@/components/multiply/ui';

export function RevenueWidget({ stats, commission, onCommissionChange }) {
  return (
    <Panel
      title="Revenue"
      subtitle="commission × closes"
      style={{ minHeight: 240 }}
    >
      <div
        style={{
          padding: 18,
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
        }}
      >
        <Stat label="Calls placed" value={stats.placed} />
        <Stat label="Connected" value={stats.connected} />
        <Stat label="Closed" value={stats.closed} accent="success" />
        <Stat
          label="Earnings"
          value={`$${stats.earnings.toFixed(2)}`}
          accent="accent"
          mono
        />
      </div>

      <div
        style={{
          padding: '0 18px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: 14,
          marginTop: 4,
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: 'var(--text-tertiary)',
            letterSpacing: 0.3,
            textTransform: 'uppercase',
          }}
        >
          commission per close
        </span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: 'var(--surface)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-sm)',
            padding: '4px 8px',
            gap: 4,
          }}
        >
          <span style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--mono)' }}>$</span>
          <input
            type="number"
            value={commission}
            min={0}
            step={1}
            onChange={(e) => onCommissionChange(Number(e.target.value) || 0)}
            style={{
              width: 56,
              fontSize: 13,
              fontFamily: 'var(--mono)',
              color: 'var(--text)',
              background: 'transparent',
            }}
          />
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          ($1 trial → $47/mo · ClickBank ~50%)
        </span>
      </div>
    </Panel>
  );
}

function Stat({ label, value, accent = 'neutral', mono }) {
  const colors = {
    neutral: 'var(--text)',
    accent: 'var(--accent)',
    success: 'var(--success)',
  };
  return (
    <div
      style={{
        background: 'var(--bg-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: 'var(--text-tertiary)',
          letterSpacing: 0.4,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 24,
          fontWeight: 500,
          letterSpacing: -0.6,
          color: colors[accent],
          fontFamily: mono ? 'var(--mono)' : 'var(--sans)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
    </div>
  );
}
