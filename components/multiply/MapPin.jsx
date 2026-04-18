'use client';
import React from 'react';

/**
 * Google Maps embed showing the lead's company HQ.
 * Uses Maps Embed API (free, no billing required for basic use).
 * Requires NEXT_PUBLIC_GOOGLE_MAPS_API_KEY env var with "Maps Embed API" enabled.
 * If the key is missing, shows a styled placeholder.
 */
export function MapPin({ company, address, localTime }) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const query = encodeURIComponent(address ?? company ?? '');

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
      background: 'var(--surface)',
      boxShadow: 'var(--shadow-xs)',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 12px',
        borderBottom: '1px solid var(--border-subtle)',
        fontSize: 11,
        fontFamily: 'var(--mono)',
      }}>
        <span style={{ color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 500 }}>
          HQ · {company}
        </span>
        {localTime && (
          <span style={{ color: 'var(--text-secondary)' }}>
            {localTime}
          </span>
        )}
      </div>

      <div style={{ height: 180, position: 'relative', background: 'var(--bg-subtle)' }}>
        {apiKey ? (
          <iframe
            title={`Map · ${company}`}
            src={`https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${query}&zoom=13`}
            style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 6, padding: 16, textAlign: 'center',
            background: 'linear-gradient(135deg, #f0f4f8 0%, #e1e8f0 100%)',
          }}>
            <div style={{ fontSize: 32 }}>📍</div>
            <div style={{ fontSize: 12, fontWeight: 500 }}>{company}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{address ?? 'location'}</div>
            <div style={{ fontSize: 10, color: 'var(--text-quaternary)', fontFamily: 'var(--mono)', marginTop: 4 }}>
              Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY for live map
            </div>
          </div>
        )}
      </div>

      {address && (
        <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg-subtle)' }}>
          {address}
        </div>
      )}
    </div>
  );
}
