'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Kbd } from './ui';

const ICON = {
  call: '📞', graph: '🧠', trace: '📊', pipeline: '⚡', tour: '🎬', demo: '🧪',
  cognee: '✨', slack: '💬', calendar: '📅', docs: '📘',
};

export function CommandPalette({ onAction }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      const isMeta = e.metaKey || e.ctrlKey;
      if (isMeta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const items = [
    { icon: ICON.call, title: 'Listen in on live call', hint: 'Sarah Chen · Northwind', id: 'open-call' },
    { icon: ICON.graph, title: 'Open Knowledge graph', hint: 'Cognee · 64 learnings · live recall', id: 'view-graph' },
    { icon: '🎼', title: 'Open Agent Orchestra', hint: '7 specialists · live handoffs', id: 'view-orchestra' },
    { icon: ICON.trace, title: 'Open Agent trace', hint: 'last run · 21 events', id: 'view-trace' },
    { icon: ICON.pipeline, title: 'Back to Pipeline', hint: 'dashboard', id: 'view-dashboard' },
    { icon: ICON.cognee, title: 'Seed cognee demo data', hint: 'ingest 21 learnings', id: 'seed-cognee' },
    { icon: ICON.demo, title: 'Trigger a test call', hint: 'simulate via HR', id: 'trigger-call' },
    { icon: ICON.tour, title: 'Replay onboarding tour', hint: 'show intro → deployment', id: 'replay-tour' },
    { icon: '🎬', title: 'Toggle Pitch Mode', hint: '⌘. — amplifies animations + live-demo badge', id: 'pitch-mode' },
    { icon: ICON.calendar, title: 'Book a demo meeting', hint: 'book-meeting tool', id: 'book-meeting' },
    { icon: ICON.slack, title: 'Send test Slack ping', hint: 'if webhook configured', id: 'test-slack' },
    { icon: ICON.docs, title: 'Open README', hint: 'github.com/danielshamsi', id: 'open-readme' },
  ];

  const filtered = q
    ? items.filter(i => (i.title + ' ' + i.hint).toLowerCase().includes(q.toLowerCase()))
    : items;

  if (!open) return null;

  return (
    <div
      onClick={e => e.target === e.currentTarget && setOpen(false)}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10,10,10,0.35)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 120,
        animation: 'backdrop-in 150ms ease',
      }}
    >
      <div style={{
        width: 'min(560px, 92vw)',
        background: 'var(--surface)',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-xl)',
        overflow: 'hidden',
        animation: 'slide-in-up 180ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '14px 18px',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          <span style={{ fontSize: 16, opacity: 0.7 }}>⌘</span>
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search commands, leads, agents…"
            style={{
              flex: 1,
              fontSize: 15,
              padding: 0,
              background: 'transparent',
              color: 'var(--text)',
            }}
          />
          <Kbd>Esc</Kbd>
        </div>
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
              No matches.
            </div>
          ) : filtered.map((item, i) => (
            <button
              key={item.id}
              onClick={() => { setOpen(false); onAction?.(item.id); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                padding: '12px 18px',
                textAlign: 'left',
                background: 'transparent',
                borderBottom: i < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                transition: 'background 120ms ease',
                cursor: 'pointer',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-subtle)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{item.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                  {item.title}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--mono)', marginTop: 1 }}>
                  {item.hint}
                </div>
              </div>
            </button>
          ))}
        </div>
        <div style={{
          padding: '8px 18px',
          borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 10,
          color: 'var(--text-tertiary)',
          fontFamily: 'var(--mono)',
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}>
          <span>↵ run</span>
          <span>·</span>
          <span>⌘K toggle</span>
          <span style={{ flex: 1 }} />
          <span>Multiply Command Bar</span>
        </div>
      </div>
    </div>
  );
}
