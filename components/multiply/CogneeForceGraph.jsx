'use client';
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

const TYPE_STYLE = {
  persona:           { color: '#7c3aed', ring: '#a78bfa', label: 'Persona' },
  rebuttal_pattern:  { color: '#4f46e5', ring: '#818cf8', label: 'Rebuttal' },
  outcome:           { color: '#059669', ring: '#34d399', label: 'Outcome' },
  objection:         { color: '#d97706', ring: '#fbbf24', label: 'Objection' },
  industry:          { color: '#0284c7', ring: '#38bdf8', label: 'Industry' },
  company_stage:     { color: '#64748b', ring: '#94a3b8', label: 'Stage' },
  region:            { color: '#0891b2', ring: '#22d3ee', label: 'Region' },
  journey:           { color: '#db2777', ring: '#f472b6', label: 'Journey' },
  temporal_pattern:  { color: '#c026d3', ring: '#e879f9', label: 'Temporal' },
};

const RELATION_COLOR = {
  raises:        'rgba(217,119,6,0.55)',
  answered_by:   'rgba(79,70,229,0.55)',
  leads_to:      'rgba(5,150,105,0.55)',
  won_by:        'rgba(124,58,237,0.55)',
  common_in:     'rgba(2,132,199,0.45)',
  buys_through:  'rgba(2,132,199,0.45)',
  common_at:     'rgba(100,116,139,0.45)',
  active_in:     'rgba(8,145,178,0.45)',
  playbook_uses: 'rgba(192,38,211,0.45)',
};

export function CogneeForceGraph({ data, height = 520, onNodeClick, highlightedIds }) {
  const fgRef = useRef(null);
  const containerRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: height });
  const [hoverNode, setHoverNode] = useState(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.max(320, r.width), h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [height]);

  const graphData = useMemo(() => {
    if (!data?.nodes) return { nodes: [], links: [] };
    return {
      nodes: data.nodes.map(n => ({ ...n })),
      links: data.edges.map(e => ({ source: e.source, target: e.target, relation: e.relation, weight: e.weight })),
    };
  }, [data]);

  useEffect(() => {
    if (!fgRef.current) return;
    const fg = fgRef.current;
    fg.d3Force('charge')?.strength(-180);
    fg.d3Force('link')?.distance(60).strength(0.6);
    setTimeout(() => fg.zoomToFit?.(400, 60), 200);
  }, [graphData]);

  const drawNode = useCallback((node, ctx, scale) => {
    const style = TYPE_STYLE[node.type] ?? TYPE_STYLE.persona;
    const radius = 4 + Math.sqrt(node.weight ?? 1) * 1.6;
    const isHovered = hoverNode?.id === node.id;
    const isHighlighted = highlightedIds?.has?.(node.id);

    ctx.beginPath();
    ctx.arc(node.x, node.y, radius + 4, 0, 2 * Math.PI);
    ctx.fillStyle = isHovered || isHighlighted ? `${style.ring}aa` : `${style.ring}55`;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
    ctx.fillStyle = style.color;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2 / scale;
    ctx.stroke();

    if (scale > 1.1 || isHovered || isHighlighted) {
      const fontSize = Math.max(10, 11 / Math.max(0.8, scale));
      ctx.font = `${isHovered || isHighlighted ? 600 : 500} ${fontSize}px ui-sans-serif, system-ui, -apple-system`;
      ctx.fillStyle = '#0a0a0a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(node.label, node.x, node.y + radius + 4);
    }
  }, [hoverNode, highlightedIds]);

  const linkColor = useCallback((link) => RELATION_COLOR[link.relation] ?? 'rgba(0,0,0,0.18)', []);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height, background: '#fff' }}>
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        width={size.w}
        height={size.h}
        backgroundColor="#ffffff"
        nodeRelSize={6}
        nodeCanvasObject={drawNode}
        nodePointerAreaPaint={(node, color, ctx) => {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x, node.y, 12, 0, 2 * Math.PI);
          ctx.fill();
        }}
        linkColor={linkColor}
        linkWidth={(l) => 0.6 + Math.log(1 + (l.weight ?? 1)) * 0.7}
        linkDirectionalParticles={2}
        linkDirectionalParticleSpeed={0.0035}
        linkDirectionalParticleWidth={(l) => 1.2 + Math.log(1 + (l.weight ?? 1)) * 0.4}
        linkDirectionalParticleColor={(l) => RELATION_COLOR[l.relation] ?? 'rgba(0,0,0,0.4)'}
        cooldownTicks={120}
        onNodeHover={setHoverNode}
        onNodeClick={(n) => onNodeClick?.(n)}
      />
      <Legend />
      {hoverNode && <HoverCard node={hoverNode} />}
    </div>
  );
}

function Legend() {
  return (
    <div style={{
      position: 'absolute', top: 10, left: 10,
      background: 'rgba(255,255,255,0.92)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: '8px 10px',
      fontSize: 10,
      fontFamily: 'var(--mono)',
      display: 'grid',
      gridTemplateColumns: 'repeat(2, auto)',
      columnGap: 12,
      rowGap: 4,
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      pointerEvents: 'none',
    }}>
      {Object.entries(TYPE_STYLE).map(([k, v]) => (
        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: v.color }} />
          <span style={{ color: 'var(--text-secondary)' }}>{v.label}</span>
        </div>
      ))}
    </div>
  );
}

function HoverCard({ node }) {
  const style = TYPE_STYLE[node.type] ?? TYPE_STYLE.persona;
  return (
    <div style={{
      position: 'absolute', bottom: 10, right: 10,
      background: 'rgba(255,255,255,0.96)',
      border: `1px solid ${style.ring}`,
      borderLeft: `3px solid ${style.color}`,
      borderRadius: 8,
      padding: '8px 12px',
      fontSize: 11,
      maxWidth: 260,
      boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
      pointerEvents: 'none',
    }}>
      <div style={{ fontSize: 9, fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: 1, color: style.color, marginBottom: 4 }}>
        {style.label}
      </div>
      <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{node.label}</div>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--mono)' }}>
        weight {node.weight}{node.meta?.stage ? ` · ${node.meta.stage}` : ''}
      </div>
    </div>
  );
}
