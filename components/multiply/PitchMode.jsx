'use client';
import React, { useEffect, useState } from 'react';

/**
 * Pitch Mode — when active, amplifies every animation, shows a subtle
 * "LIVE DEMO" watermark, accelerates tickers, adds a camera-ready vignette.
 * Toggle: ⌘. (cmd+period) or via Command Palette.
 *
 * State is persisted to localStorage so it survives refreshes during the pitch.
 */
const STORAGE_KEY = 'multiply_pitch_mode';

let globalSetter = null;

export function getPitchMode() {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY) === '1';
}

export function setPitchMode(on) {
  if (typeof window === 'undefined') return;
  if (on) localStorage.setItem(STORAGE_KEY, '1');
  else localStorage.removeItem(STORAGE_KEY);
  globalSetter?.(on);
  document.documentElement.dataset.pitchMode = on ? '1' : '0';
}

export function PitchModeOverlay() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(getPitchMode());
    globalSetter = setOn;
    document.documentElement.dataset.pitchMode = getPitchMode() ? '1' : '0';

    const onKey = (e) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === '.') {
        e.preventDefault();
        setPitchMode(!getPitchMode());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      globalSetter = null;
    };
  }, []);

  if (!on) return null;

  return (
    <>
      {/* Subtle vignette */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 500,
          background:
            'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.1) 100%)',
        }}
      />
      {/* Live-demo badge */}
      <div
        style={{
          position: 'fixed',
          top: 64,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(220, 38, 38, 0.95)',
          color: '#fff',
          padding: '5px 14px',
          borderRadius: 999,
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: 2,
          fontFamily: 'var(--mono)',
          textTransform: 'uppercase',
          zIndex: 1500,
          boxShadow: '0 8px 24px rgba(220, 38, 38, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          animation: 'pulse 2s ease-in-out infinite',
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#fff',
          }}
        />
        PITCH MODE · LIVE DEMO
      </div>

      <style>{`
        html[data-pitch-mode="1"] * {
          scroll-behavior: smooth;
        }
        html[data-pitch-mode="1"] .serif {
          letter-spacing: -0.02em;
        }
      `}</style>
    </>
  );
}
