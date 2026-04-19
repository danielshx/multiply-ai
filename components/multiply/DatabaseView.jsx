'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { getBrowserSupabase } from '@/lib/supabase/client';
import { Dot, Pill } from './ui';

const TABLES = [
  { id: 'leads',                 label: 'leads',                 desc: 'Active outreach targets (sync from candidates + us_outreach + manual)', orderBy: 'created_at', icon: '👥' },
  { id: 'messages',              label: 'messages',              desc: 'Per-lead activity feed (system events, agent transcripts, lead replies)', orderBy: 'ts', icon: '💬' },
  { id: 'googlemaps_candidates', label: 'googlemaps_candidates', desc: 'Raw Google Maps research output (place_name, phone, rating, etc.)', orderBy: 'created_at', icon: '🗺' },
  { id: 'us_outreach_calls',     label: 'us_outreach_calls',     desc: 'US cold-call dashboard rows (status, hr_run_id, disposition)', orderBy: 'created_at', icon: '📞' },
  { id: 'us_outreach_logs',      label: 'us_outreach_logs',      desc: 'Per-call event log (status_queued, status_completed, etc.)', orderBy: 'ts', icon: '📋' },
  { id: 'hr_events',             label: 'hr_events',             desc: 'Raw HR webhook events (audit log)', orderBy: 'ts', icon: '🪝' },
  { id: 'learnings',             label: 'learnings',             desc: 'Patterns + triggers extracted from successful calls', orderBy: 'created_at', icon: '🧠' },
  { id: 'product_profiles',      label: 'product_profiles',      desc: 'Sales-manager-uploaded product info (value props, pricing, objections)', orderBy: 'created_at', icon: '🛍' },
];

const PAGE_SIZE = 50;

export function DatabaseView() {
  const [activeTable, setActiveTable] = useState('leads');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [counts, setCounts] = useState({});
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [columns, setColumns] = useState([]);
  const [pickedRow, setPickedRow] = useState(null);

  const config = useMemo(() => TABLES.find(t => t.id === activeTable) || TABLES[0], [activeTable]);

  // Load row counts for all tables once
  useEffect(() => {
    const sb = getBrowserSupabase();
    let cancelled = false;
    (async () => {
      const next = {};
      await Promise.all(
        TABLES.map(async (t) => {
          try {
            const { count } = await sb.from(t.id).select('*', { count: 'exact', head: true });
            next[t.id] = count ?? 0;
          } catch {
            next[t.id] = -1;
          }
        }),
      );
      if (!cancelled) setCounts(next);
    })();
    return () => { cancelled = true; };
  }, []);

  // Reset page on table change
  useEffect(() => {
    setPage(0);
    setSearch('');
  }, [activeTable]);

  // Fetch the current page of rows
  useEffect(() => {
    const sb = getBrowserSupabase();
    let cancelled = false;
    setLoading(true);
    (async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await sb
        .from(config.id)
        .select('*')
        .order(config.orderBy, { ascending: false })
        .range(from, to);
      if (cancelled) return;
      if (error) {
        console.warn(`Failed to load ${config.id}:`, error.message);
        setRows([]);
        setColumns([]);
      } else {
        setRows(data ?? []);
        setColumns(data && data.length > 0 ? Object.keys(data[0]) : []);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [config.id, config.orderBy, page]);

  const filteredRows = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      Object.values(r).some(v => v != null && String(v).toLowerCase().includes(q))
    );
  }, [rows, search]);

  const totalCount = counts[activeTable];
  const totalPages = totalCount > 0 ? Math.ceil(totalCount / PAGE_SIZE) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        padding: 14,
        border: '1px solid var(--border)',
        borderRadius: 8,
        background: 'var(--bg-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Database</span>
          <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 1 }}>
            supabase · public schema
          </span>
          <div style={{ flex: 1 }} />
          <Pill color="neutral" size="sm">
            <span style={{ fontFamily: 'var(--mono)' }}>{TABLES.length}</span> tables
          </Pill>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {TABLES.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTable(t.id)}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                background: activeTable === t.id ? 'var(--text)' : 'var(--surface)',
                color: activeTable === t.id ? 'var(--bg)' : 'var(--text-secondary)',
                border: `1px solid ${activeTable === t.id ? 'var(--text)' : 'var(--border)'}`,
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: activeTable === t.id ? 600 : 500,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
              title={t.desc}
            >
              <span>{t.icon}</span>
              <span style={{ fontFamily: 'var(--mono)' }}>{t.label}</span>
              <span style={{
                fontSize: 10,
                opacity: 0.7,
                marginLeft: 2,
                fontFamily: 'var(--mono)',
              }}>
                {counts[t.id] === undefined ? '…' : counts[t.id] === -1 ? '!' : counts[t.id].toLocaleString()}
              </span>
            </button>
          ))}
        </div>

        <div style={{
          fontSize: 11,
          color: 'var(--text-tertiary)',
          fontFamily: 'var(--mono)',
          background: 'var(--surface)',
          padding: '6px 10px',
          borderRadius: 5,
          border: '1px solid var(--border)',
        }}>
          {config.icon} <strong style={{ color: 'var(--text-secondary)' }}>{config.label}</strong> · {config.desc}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`filter ${config.label} on this page (${rows.length} rows)`}
            style={{
              flex: 1,
              minWidth: 0,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '6px 10px',
              fontSize: 12,
              color: 'var(--text)',
              outline: 'none',
              fontFamily: 'var(--mono)',
            }}
          />
          <Pagination page={page} setPage={setPage} totalPages={totalPages} />
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 80, textAlign: 'center', color: 'var(--text-tertiary)', fontFamily: 'var(--mono)', fontSize: 12 }}>
          loading {config.label}…
        </div>
      ) : filteredRows.length === 0 ? (
        <div style={{ padding: 80, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
          {search ? `no rows match "${search}" on this page` : 'no rows in this table yet'}
        </div>
      ) : (
        <DataTable
          rows={filteredRows}
          columns={columns}
          onPickRow={setPickedRow}
        />
      )}

      {pickedRow && <RowDrawer row={pickedRow} onClose={() => setPickedRow(null)} />}
    </div>
  );
}

function Pagination({ page, setPage, totalPages }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <button
        onClick={() => setPage(Math.max(0, page - 1))}
        disabled={page === 0}
        style={navBtn(page === 0)}
      >
        ← prev
      </button>
      <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-tertiary)', padding: '0 8px' }}>
        page {page + 1}{totalPages > 0 ? ` / ${totalPages}` : ''}
      </span>
      <button
        onClick={() => setPage(page + 1)}
        disabled={totalPages > 0 && page + 1 >= totalPages}
        style={navBtn(totalPages > 0 && page + 1 >= totalPages)}
      >
        next →
      </button>
    </div>
  );
}

function DataTable({ rows, columns, onPickRow }) {
  // Heuristic: hide some bulky / always-empty columns from the main table
  const HIDE = new Set(['raw', 'metadata', 'detail', 'payload', 'research', 'raw_outcome']);
  const visible = columns.filter(c => !HIDE.has(c));

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 8,
      background: 'var(--surface)',
      overflow: 'auto',
      maxWidth: '100%',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'var(--mono)' }}>
        <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-subtle)', zIndex: 1 }}>
          <tr>
            {visible.map(col => (
              <th key={col} style={{
                textAlign: 'left',
                padding: '8px 10px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                borderBottom: '1px solid var(--border)',
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: 1,
                whiteSpace: 'nowrap',
              }}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={r.id ?? i}
              onClick={() => onPickRow(r)}
              style={{
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
                transition: 'background 80ms ease',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-subtle)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {visible.map(col => (
                <td key={col} style={{
                  padding: '6px 10px',
                  color: 'var(--text-secondary)',
                  maxWidth: 240,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {formatCell(r[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RowDrawer({ row, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          maxWidth: 720,
          width: '100%',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 56px rgba(0,0,0,0.45)',
        }}
      >
        <header style={{
          padding: 14,
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>row detail</span>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', color: 'var(--text-tertiary)',
            fontSize: 18, cursor: 'pointer', padding: 4,
          }}>×</button>
        </header>
        <div style={{ padding: 14, overflow: 'auto', flex: 1 }}>
          <pre style={{
            fontFamily: 'var(--mono)',
            fontSize: 11,
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            margin: 0,
          }}>
            {JSON.stringify(row, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

function formatCell(v) {
  if (v == null) return <span style={{ color: 'var(--text-quaternary)' }}>—</span>;
  if (typeof v === 'boolean') return v ? '✓' : '✗';
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 60);
  const s = String(v);
  if (s.length > 60) return s.slice(0, 60) + '…';
  return s;
}

function navBtn(disabled) {
  return {
    padding: '4px 10px',
    fontSize: 11,
    background: 'var(--surface)',
    color: disabled ? 'var(--text-quaternary)' : 'var(--text-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 5,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'var(--mono)',
  };
}
