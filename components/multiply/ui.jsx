'use client';
import React, { useEffect } from 'react';

export function Logo({ size = 20, color = 'var(--text)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={{ flexShrink: 0 }}>
      <rect width="32" height="32" rx="7" fill={color}/>
      <path d="M10 10 L22 22 M22 10 L10 22" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  );
}

export function Wordmark({ size = 16 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Logo size={size + 4} />
      <span style={{ fontSize: size, fontWeight: 500, letterSpacing: -0.3, color: 'var(--text)' }}>
        Multiply
      </span>
    </div>
  );
}

export function Pill({ children, color = 'neutral', size = 'sm', style, onClick }) {
  const tones = {
    neutral: { bg: 'var(--bg-subtle)', fg: 'var(--text-secondary)', bd: 'transparent' },
    accent: { bg: 'var(--accent-soft)', fg: 'var(--accent-text)', bd: 'var(--accent-border)' },
    success: { bg: 'var(--success-soft)', fg: 'var(--success)', bd: 'var(--success-border)' },
    warning: { bg: 'var(--warning-soft)', fg: 'var(--warning)', bd: 'var(--warning-border)' },
    danger: { bg: 'var(--danger-soft)', fg: 'var(--danger)', bd: 'var(--danger-border)' },
    info: { bg: 'var(--info-soft)', fg: 'var(--info)', bd: 'var(--info-border)' },
    purple: { bg: 'var(--purple-soft)', fg: 'var(--purple)', bd: 'var(--purple-border)' },
    outline: { bg: 'transparent', fg: 'var(--text-secondary)', bd: 'var(--border)' },
  };
  const c = tones[color] || tones.neutral;
  const sizes = {
    xs: { fs: 10, pad: '1px 6px', gap: 4 },
    sm: { fs: 11, pad: '2px 8px', gap: 5 },
    md: { fs: 12, pad: '4px 10px', gap: 6 },
  };
  const s = sizes[size];
  return (
    <span
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: s.gap,
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.bd}`,
        fontSize: s.fs,
        padding: s.pad,
        borderRadius: 999,
        fontWeight: 500,
        letterSpacing: 0.1,
        whiteSpace: 'nowrap',
        cursor: onClick ? 'pointer' : 'default',
        fontFamily: 'var(--sans)',
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export function Dot({ color = 'success', pulse = false, size = 6 }) {
  const colors = {
    success: 'var(--success)',
    accent: 'var(--accent)',
    warning: 'var(--warning)',
    danger: 'var(--danger)',
    info: 'var(--info)',
    purple: 'var(--purple)',
    neutral: 'var(--text-quaternary)',
    dim: 'var(--text-quaternary)',
  };
  return (
    <span style={{
      position: 'relative',
      display: 'inline-block',
      width: size,
      height: size,
      borderRadius: '50%',
      background: colors[color] || colors.success,
      flexShrink: 0,
    }}>
      {pulse && (
        <span style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: colors[color] || colors.success,
          animation: 'pulse-ring 1.8s ease-out infinite',
        }} />
      )}
    </span>
  );
}

export function Avatar({ initials, color = 'accent', size = 32 }) {
  const colors = {
    accent: { bg: 'var(--accent-soft)', fg: 'var(--accent-text)' },
    info: { bg: 'var(--info-soft)', fg: 'var(--info)' },
    purple: { bg: 'var(--purple-soft)', fg: 'var(--purple)' },
    success: { bg: 'var(--success-soft)', fg: 'var(--success)' },
    neutral: { bg: 'var(--bg-subtle)', fg: 'var(--text-secondary)' },
  };
  const c = colors[color] || colors.accent;
  return (
    <div style={{
      width: size,
      height: size,
      minWidth: size,
      borderRadius: '50%',
      background: c.bg,
      color: c.fg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: Math.round(size * 0.38),
      fontWeight: 500,
      letterSpacing: 0.2,
      flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

export function Button({ children, onClick, variant = 'default', size = 'md', icon, iconRight, style, disabled, title, fullWidth }) {
  const variants = {
    default: { bg: 'var(--surface)', bd: 'var(--border)', fg: 'var(--text)', hover: 'var(--surface-hover)', hoverBd: 'var(--border-strong)', shadow: 'var(--shadow-xs)' },
    primary: { bg: 'var(--text)', bd: 'var(--text)', fg: '#fff', hover: '#1f1f22', hoverBd: '#1f1f22', shadow: 'var(--shadow-sm)' },
    accent: { bg: 'var(--accent)', bd: 'var(--accent)', fg: '#fff', hover: 'var(--accent-hover)', hoverBd: 'var(--accent-hover)', shadow: 'var(--shadow-sm)' },
    soft: { bg: 'var(--accent-soft)', bd: 'var(--accent-border)', fg: 'var(--accent-text)', hover: '#e0e7ff', hoverBd: 'var(--accent)', shadow: 'none' },
    danger: { bg: 'var(--surface)', bd: 'var(--danger-border)', fg: 'var(--danger)', hover: 'var(--danger-soft)', hoverBd: 'var(--danger)', shadow: 'none' },
    ghost: { bg: 'transparent', bd: 'transparent', fg: 'var(--text-secondary)', hover: 'var(--bg-subtle)', hoverBd: 'transparent', shadow: 'none' },
  };
  const sizes = {
    xs: { fs: 11, pad: '3px 8px', h: 22 },
    sm: { fs: 12, pad: '5px 10px', h: 28 },
    md: { fs: 13, pad: '7px 14px', h: 32 },
    lg: { fs: 14, pad: '9px 18px', h: 38 },
    xl: { fs: 15, pad: '12px 22px', h: 46 },
  };
  const v = variants[variant];
  const s = sizes[size];
  const [hover, setHover] = React.useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover && !disabled ? v.hover : v.bg,
        border: `1px solid ${hover && !disabled ? v.hoverBd : v.bd}`,
        color: v.fg,
        fontSize: s.fs,
        padding: s.pad,
        height: s.h,
        borderRadius: variant === 'accent' || variant === 'primary' ? 'var(--radius-md)' : 'var(--radius-sm)',
        display: fullWidth ? 'flex' : 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        fontWeight: 500,
        letterSpacing: -0.05,
        transition: 'all 120ms ease',
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'var(--sans)',
        whiteSpace: 'nowrap',
        boxShadow: v.shadow,
        width: fullWidth ? '100%' : undefined,
        ...style,
      }}
    >
      {icon}
      {children}
      {iconRight}
    </button>
  );
}

export function Card({ children, padding = 16, clickable, onClick, style, hoverLift }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: 'var(--surface)',
        border: `1px solid ${hover && clickable ? 'var(--border-strong)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-lg)',
        padding,
        boxShadow: hover && hoverLift ? 'var(--shadow-md)' : 'var(--shadow-xs)',
        transition: 'all 160ms ease',
        cursor: clickable ? 'pointer' : 'default',
        transform: hover && hoverLift ? 'translateY(-1px)' : 'translateY(0)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Panel({ title, subtitle, action, children, style, padding = 0 }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-xs)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      ...style,
    }}>
      {(title || action) && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          minHeight: 44,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            {title && <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', letterSpacing: -0.1 }}>{title}</div>}
            {subtitle && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--mono)' }}>{subtitle}</div>}
          </div>
          {action}
        </div>
      )}
      <div style={{ flex: 1, overflow: 'auto', padding }}>
        {children}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, subtitle, children, width = 440, actions }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(10, 10, 10, 0.25)',
        display: 'flex',
        justifyContent: 'flex-end',
        zIndex: 200,
        animation: 'backdrop-in 200ms ease',
      }}
    >
      <div style={{
        width,
        maxWidth: '92vw',
        background: 'var(--surface)',
        borderLeft: '1px solid var(--border)',
        boxShadow: 'var(--shadow-xl)',
        display: 'flex',
        flexDirection: 'column',
        animation: 'drawer-in 260ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexShrink: 0,
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            {title && <div style={{ fontSize: 15, fontWeight: 500, letterSpacing: -0.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>}
            {subtitle && <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</div>}
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: 'var(--radius-sm)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-tertiary)',
              transition: 'background 120ms ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-subtle)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            title="Close (Esc)"
          >
            <IconX size={14} />
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {children}
        </div>
        {actions && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)', display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0 }}>
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

export function Field({ label, children, hint, required }) {
  return (
    <div style={{ marginBottom: 18 }}>
      {label && (
        <div style={{
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--text)',
          marginBottom: 6,
          letterSpacing: -0.05,
        }}>
          {label}
          {required && <span style={{ color: 'var(--accent)', marginLeft: 3 }}>*</span>}
        </div>
      )}
      {children}
      {hint && (
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 5, lineHeight: 1.5 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

export function TextInput({ value, onChange, placeholder, onBlur, onKeyDown, type = 'text', style, autoFocus, prefix }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      background: 'var(--surface)',
      border: `1px solid ${focus ? 'var(--accent)' : 'var(--border-strong)'}`,
      borderRadius: 'var(--radius-md)',
      boxShadow: focus ? '0 0 0 3px var(--accent-soft)' : 'none',
      transition: 'all 120ms ease',
      ...style,
    }}>
      {prefix && (
        <span style={{ paddingLeft: 12, fontSize: 13, color: 'var(--text-tertiary)', fontFamily: 'var(--mono)' }}>{prefix}</span>
      )}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onFocus={() => setFocus(true)}
        onBlurCapture={() => setFocus(false)}
        style={{
          flex: 1,
          fontSize: 13,
          padding: '10px 12px',
          color: 'var(--text)',
          background: 'transparent',
        }}
      />
    </div>
  );
}

export function TextArea({ value, onChange, placeholder, rows = 3 }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={{
        width: '100%',
        fontSize: 13,
        padding: '10px 12px',
        background: 'var(--surface)',
        border: `1px solid ${focus ? 'var(--accent)' : 'var(--border-strong)'}`,
        borderRadius: 'var(--radius-md)',
        boxShadow: focus ? '0 0 0 3px var(--accent-soft)' : 'none',
        color: 'var(--text)',
        resize: 'vertical',
        fontFamily: 'var(--sans)',
        lineHeight: 1.5,
        transition: 'all 120ms ease',
      }}
    />
  );
}

export function Select({ value, onChange, options }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <div style={{
      position: 'relative',
      background: 'var(--surface)',
      border: `1px solid ${focus ? 'var(--accent)' : 'var(--border-strong)'}`,
      borderRadius: 'var(--radius-md)',
      boxShadow: focus ? '0 0 0 3px var(--accent-soft)' : 'none',
      transition: 'all 120ms ease',
    }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          width: '100%',
          fontSize: 13,
          padding: '10px 32px 10px 12px',
          color: 'var(--text)',
          appearance: 'none',
          cursor: 'pointer',
          background: 'transparent',
        }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }}>
        <IconChevronDown size={12} />
      </span>
    </div>
  );
}

export function RadioGroup({ value, onChange, options }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map(o => {
        const selected = value === o.value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              padding: '8px 14px',
              fontSize: 13,
              fontWeight: 500,
              background: selected ? 'var(--text)' : 'var(--surface)',
              color: selected ? '#fff' : 'var(--text-secondary)',
              border: `1px solid ${selected ? 'var(--text)' : 'var(--border-strong)'}`,
              borderRadius: 'var(--radius-md)',
              transition: 'all 120ms ease',
              boxShadow: selected ? 'var(--shadow-sm)' : 'none',
              cursor: 'pointer',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function MultiChipSelect({ values, onChange, options }) {
  const toggle = (v) => {
    if (values.includes(v)) onChange(values.filter(x => x !== v));
    else onChange([...values, v]);
  };
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {options.map(o => {
        const selected = values.includes(o.value);
        return (
          <button
            key={o.value}
            onClick={() => toggle(o.value)}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 500,
              background: selected ? 'var(--accent-soft)' : 'var(--surface)',
              color: selected ? 'var(--accent-text)' : 'var(--text-secondary)',
              border: `1px solid ${selected ? 'var(--accent-border)' : 'var(--border-strong)'}`,
              borderRadius: 999,
              transition: 'all 120ms ease',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              cursor: 'pointer',
            }}
          >
            {selected && <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent)' }} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Kbd({ children, style }) {
  return (
    <kbd style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 18,
      height: 18,
      padding: '0 5px',
      fontFamily: 'var(--mono)',
      fontSize: 10,
      fontWeight: 500,
      color: 'var(--text-secondary)',
      background: 'var(--surface)',
      border: '1px solid var(--border-strong)',
      borderRadius: 3,
      boxShadow: '0 1px 0 var(--border-strong)',
      ...style,
    }}>
      {children}
    </kbd>
  );
}

export function IconX({ size = 12 }) { return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>; }
export function IconCheck({ size = 12 }) { return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8l3.5 3.5L13 5"/></svg>; }
export function IconArrow({ size = 11 }) { return <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6h8M6 2l4 4-4 4"/></svg>; }
export function IconChevronDown({ size = 12 }) { return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6l4 4 4-4"/></svg>; }
export function IconChevronRight({ size = 12 }) { return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4l4 4-4 4"/></svg>; }
export function IconPhone({ size = 12 }) { return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2.5c0-.3.2-.5.5-.5H6l1.5 3L5.8 6.3a8 8 0 0 0 4 4l1.3-1.7 3 1.5v2.5a.5.5 0 0 1-.5.5C7.6 13 3 8.4 3 2.5Z"/></svg>; }
export function IconMail({ size = 12 }) { return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="12" height="10" rx="1"/><path d="M2 5l6 4 6-4"/></svg>; }
export function IconMic({ size = 12 }) { return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="2" width="4" height="8" rx="2"/><path d="M3 8a5 5 0 0 0 10 0M8 13v2"/></svg>; }
export function IconPause({ size = 11 }) { return <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor"><rect x="4" y="3" width="3" height="10" rx="0.5"/><rect x="9" y="3" width="3" height="10" rx="0.5"/></svg>; }
export function IconPlay({ size = 11 }) { return <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor"><path d="M4 3l9 5-9 5V3z"/></svg>; }
export function IconStop({ size = 11 }) { return <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="3" width="10" height="10" rx="1"/></svg>; }
export function IconHand({ size = 12 }) { return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3v5M9 3v6M12 5v4M6 8v2a3 3 0 0 0 6 0"/></svg>; }
export function IconWhisper({ size = 12 }) { return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6c0-2 2-3 3-3s3 1 3 3M2 10h8M4 8h6M12 6c1 0 2 1 2 2.5s-1 2.5-2 2.5"/></svg>; }
export function IconBolt({ size = 12 }) { return <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor"><path d="M9 1L3 9h4l-1 6 6-8H8l1-6z"/></svg>; }
export function IconSearch({ size = 13 }) { return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></svg>; }
export function IconFilter({ size = 14 }) { return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h12M4 8h8M6 13h4"/></svg>; }
export function IconRefresh({ size = 14 }) { return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4v4h4M14 12v-4h-4"/><path d="M3 8a5 5 0 0 1 9-2M13 8a5 5 0 0 1-9 2"/></svg>; }
export function IconCalendar({ size = 14 }) { return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="12" height="11" rx="1"/><path d="M2 7h12M6 2v3M10 2v3"/></svg>; }
export function IconTarget({ size = 14 }) { return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="3"/><circle cx="8" cy="8" r="0.5" fill="currentColor"/></svg>; }
export function IconGlobe({ size = 14 }) { return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6"/><path d="M2 8h12M8 2c2 2 2 10 0 12M8 2c-2 2-2 10 0 12"/></svg>; }
export function IconUsers({ size = 14 }) { return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="6" cy="6" r="2.5"/><path d="M2 13c0-2 2-3.5 4-3.5s4 1.5 4 3.5M11 4a2 2 0 0 1 0 4M11 9.5c1.5.2 3 1.2 3 3"/></svg>; }
export function IconBrain({ size = 14 }) { return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M8 2a3 3 0 0 0-3 3v1a2 2 0 0 0 0 4v1a3 3 0 0 0 3 3M8 2a3 3 0 0 1 3 3v1a2 2 0 0 1 0 4v1a3 3 0 0 1-3 3M8 2v12"/></svg>; }
export function IconSparkle({ size = 14 }) { return <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor"><path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5L8 1z"/></svg>; }
export function IconRadar({ size = 14 }) { return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="3"/><path d="M8 8L13 4" strokeLinecap="round"/></svg>; }
export function IconHandshake({ size = 14 }) { return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 7l2-2 3 1 2-2 4 3v3l-3 3-2-2-2 1-4-2V7z"/></svg>; }
export function IconMessage({ size = 14 }) { return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4h12v8H9l-3 2v-2H2V4z"/></svg>; }
export function IconShield({ size = 14 }) { return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2l5 2v4c0 3-2 5-5 6-3-1-5-3-5-6V4l5-2z"/></svg>; }
export function IconLink({ size = 12 }) { return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M7 9L5 11a2.5 2.5 0 1 1-3.5-3.5L4 5M9 7l2-2a2.5 2.5 0 1 1 3.5 3.5L12 11M6 10l4-4"/></svg>; }
export function IconExternal({ size = 11 }) { return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M10 3h3v3M13 3L8 8M7 4H4a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V9"/></svg>; }
export function IconCommand({ size = 12 }) { return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 3a2 2 0 1 0 0 4h6a2 2 0 1 0 0-4M5 9a2 2 0 1 0 0 4h6a2 2 0 1 0 0-4M5 7v2M11 7v2"/></svg>; }
