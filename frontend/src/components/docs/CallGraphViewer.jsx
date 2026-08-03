/**
 * CallGraphViewer.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * SVG-based interactive call graph.
 * Nodes: function (🔵), library (🟣), helper (🟢), DB table (🔴), API (🟡)
 * Edges: directed arrows with optional branch labels
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useMemo, useState } from 'react';

const NODE_COLORS = {
  function: { bg: '#1e3a5f', border: '#3b82f6', text: '#93c5fd', icon: '⚙' },
  library:  { bg: '#2e1f5e', border: '#8b5cf6', text: '#c4b5fd', icon: '📦' },
  helper:   { bg: '#14362a', border: '#10b981', text: '#6ee7b7', icon: '🔧' },
  db:       { bg: '#2d1b4e', border: '#a855f7', text: '#d8b4fe', icon: '🗄' },
  api:      { bg: '#3b2000', border: '#f59e0b', text: '#fcd34d', icon: '🌐' },
};

const W = 160;  // node width
const H = 42;   // node height
const PAD_X = 30;
const PAD_Y = 20;

/**
 * Simple DAG layout: rank by BFS depth then space evenly.
 */
function layoutGraph(nodes, edges) {
  if (nodes.length === 0) return { positions: {}, width: 0, height: 0 };

  // Build adjacency
  const adj = {};
  const inDeg = {};
  nodes.forEach((n) => { adj[n.id] = []; inDeg[n.id] = 0; });
  edges.forEach((e) => {
    if (adj[e.from] !== undefined && adj[e.to] !== undefined) {
      adj[e.from].push(e.to);
      inDeg[e.to]++;
    }
  });

  // BFS rank
  const ranks = {};
  const queue = nodes.filter((n) => inDeg[n.id] === 0).map((n) => n.id);
  queue.forEach((id) => { ranks[id] = 0; });

  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    for (const nb of adj[cur]) {
      ranks[nb] = Math.max(ranks[nb] || 0, (ranks[cur] || 0) + 1);
      queue.push(nb);
    }
  }

  // Assign unranked nodes
  nodes.forEach((n) => { if (ranks[n.id] === undefined) ranks[n.id] = 0; });

  // Group by rank
  const cols = {};
  nodes.forEach((n) => {
    const r = ranks[n.id];
    if (!cols[r]) cols[r] = [];
    cols[r].push(n.id);
  });

  const HGAP = W + 80;
  const VGAP = H + 30;
  const positions = {};

  Object.entries(cols).forEach(([rankStr, ids]) => {
    const col = parseInt(rankStr);
    const total = (ids.length - 1) * VGAP;
    ids.forEach((id, i) => {
      positions[id] = {
        x: PAD_X + col * HGAP,
        y: PAD_Y + i * VGAP,
      };
    });
    return total; // suppress lint warning
  });

  const allX = Object.values(positions).map((p) => p.x);
  const allY = Object.values(positions).map((p) => p.y);
  const maxX = Math.max(...allX) + W + PAD_X;
  const maxY = Math.max(...allY) + H + PAD_Y;

  return { positions, width: maxX, height: maxY };
}

/**
 * Draws an arrow path from node edge to node edge.
 */
function ArrowPath({ from, to, label, positions }) {
  const src = positions[from];
  const dst = positions[to];
  if (!src || !dst) return null;

  const x1 = src.x + W;
  const y1 = src.y + H / 2;
  const x2 = dst.x;
  const y2 = dst.y + H / 2;

  // Curved bezier
  const cx1 = x1 + (x2 - x1) * 0.5;
  const cy1 = y1;
  const cx2 = x1 + (x2 - x1) * 0.5;
  const cy2 = y2;

  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  return (
    <g>
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#4b5563" />
        </marker>
      </defs>
      <path
        d={`M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`}
        fill="none"
        stroke="#4b5563"
        strokeWidth="1.5"
        markerEnd="url(#arrowhead)"
        opacity={0.8}
      />
      {label && (
        <text
          x={midX}
          y={midY - 6}
          textAnchor="middle"
          fontSize={9}
          fill="#9ca3af"
          fontFamily="monospace"
        >
          {label}
        </text>
      )}
    </g>
  );
}

function NodeRect({ node, pos, onClick, selected }) {
  const cfg = NODE_COLORS[node.kind] || NODE_COLORS.function;
  const isSelected = selected === node.id;

  return (
    <g
      style={{ cursor: 'pointer' }}
      onClick={() => onClick(node.id)}
      transform={`translate(${pos.x},${pos.y})`}
    >
      <rect
        width={W}
        height={H}
        rx={7}
        fill={cfg.bg}
        stroke={isSelected ? '#fff' : cfg.border}
        strokeWidth={isSelected ? 2 : 1.5}
        opacity={0.95}
      />
      <text x={8} y={16} fontSize={12} fill={cfg.text} fontFamily="monospace">
        {cfg.icon}
      </text>
      <text
        x={26}
        y={16}
        fontSize={10}
        fontWeight={600}
        fill={cfg.text}
        fontFamily="monospace"
      >
        {node.label.length > 18 ? node.label.slice(0, 17) + '…' : node.label}
      </text>
      {node.subtitle && (
        <text x={8} y={32} fontSize={9} fill={cfg.text} opacity={0.6} fontFamily="sans-serif">
          {node.subtitle.length > 24 ? node.subtitle.slice(0, 23) + '…' : node.subtitle}
        </text>
      )}
    </g>
  );
}

export default function CallGraphViewer({ analysis }) {
  const [selected, setSelected] = useState(null);

  const { graphNodes, graphEdges } = useMemo(() => {
    if (!analysis || !analysis.functions) return { graphNodes: [], graphEdges: [] };

    const nodes = [];
    const edges = [];
    const seen = new Set();

    const add = (id, label, kind, subtitle = '') => {
      if (!seen.has(id)) {
        seen.add(id);
        nodes.push({ id, label, kind, subtitle });
      }
    };

    for (const fn of analysis.functions) {
      const fnId = fn.class ? `${fn.class}::${fn.name}` : fn.name;
      add(fnId, fn.name, 'function', fn.class || '');

      for (const c of fn.calls_functions || []) {
        add(c, c, 'function', '');
        edges.push({ from: fnId, to: c, label: 'calls' });
      }
      for (const c of fn.calls_libraries || []) {
        const libId = `lib::${c}`;
        add(libId, c.split('/').pop(), 'library', c);
        edges.push({ from: fnId, to: libId, label: 'library' });
      }
      for (const c of fn.calls_helpers || []) {
        const hId = `helper::${c}`;
        add(hId, c, 'helper', 'helper');
        edges.push({ from: fnId, to: hId, label: 'helper' });
      }
      for (const db of fn.db_operations || []) {
        const dbId = `db::${db.table}`;
        add(dbId, db.table, 'db', db.type);
        edges.push({ from: fnId, to: dbId, label: db.type });
      }
      for (const api of fn.api_calls || []) {
        const apiId = `api::${api.endpoint}`;
        add(apiId, api.endpoint.length > 20 ? api.endpoint.slice(0, 18) + '…' : api.endpoint, 'api', api.method);
        edges.push({ from: fnId, to: apiId, label: api.method });
      }
    }

    return { graphNodes: nodes, graphEdges: edges };
  }, [analysis]);

  const { positions, width, height } = useMemo(
    () => layoutGraph(graphNodes, graphEdges),
    [graphNodes, graphEdges]
  );

  const selectedNode = graphNodes.find((n) => n.id === selected);

  if (!analysis || !analysis.functions || analysis.functions.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 40, fontSize: 13 }}>
        No functions detected to graph.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, padding: '8px 12px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        {Object.entries(NODE_COLORS).map(([kind, cfg]) => (
          <div key={kind} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: cfg.text }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: cfg.border, display: 'inline-block' }} />
            {cfg.icon} {kind.charAt(0).toUpperCase() + kind.slice(1)}
          </div>
        ))}
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* SVG Canvas */}
        <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg1)' }}>
          <svg
            width={Math.max(width, 500)}
            height={Math.max(height, 300)}
            style={{ display: 'block', minWidth: '100%' }}
          >
            {/* Render edges first (behind nodes) */}
            {graphEdges.map((e, i) => (
              <ArrowPath
                key={i}
                from={e.from}
                to={e.to}
                label={e.label}
                positions={positions}
              />
            ))}
            {/* Render nodes */}
            {graphNodes.map((node) => (
              <NodeRect
                key={node.id}
                node={node}
                pos={positions[node.id] || { x: 0, y: 0 }}
                onClick={(id) => setSelected(id === selected ? null : id)}
                selected={selected}
              />
            ))}
          </svg>
        </div>

        {/* Detail panel on node click */}
        {selectedNode && (
          <div style={{
            width: 220, flexShrink: 0, borderLeft: '1px solid var(--border)',
            background: 'var(--bg2)', padding: 14, fontSize: 11, overflowY: 'auto',
          }}>
            <div style={{ fontWeight: 700, color: 'var(--text1)', marginBottom: 8, fontSize: 12 }}>
              {NODE_COLORS[selectedNode.kind]?.icon} {selectedNode.label}
            </div>
            <div style={{ color: 'var(--text3)', marginBottom: 6 }}>
              Type: <span style={{ color: NODE_COLORS[selectedNode.kind]?.text }}>
                {selectedNode.kind}
              </span>
            </div>
            {selectedNode.subtitle && (
              <div style={{ color: 'var(--text3)', wordBreak: 'break-all' }}>
                {selectedNode.subtitle}
              </div>
            )}

            {/* Outgoing edges */}
            {(() => {
              const out = graphEdges.filter((e) => e.from === selectedNode.id);
              return out.length > 0 ? (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>Calls:</div>
                  {out.map((e, i) => (
                    <div key={i} style={{ color: 'var(--text3)', padding: '2px 0', display: 'flex', gap: 6 }}>
                      <span style={{ color: '#6b7280' }}>→</span>
                      <span style={{ fontFamily: 'monospace', fontSize: 10 }}>{e.to.split('::').pop()}</span>
                      <span style={{ color: '#374151', fontSize: 9 }}>({e.label})</span>
                    </div>
                  ))}
                </div>
              ) : null;
            })()}

            {/* Incoming edges */}
            {(() => {
              const inc = graphEdges.filter((e) => e.to === selectedNode.id);
              return inc.length > 0 ? (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>Called by:</div>
                  {inc.map((e, i) => (
                    <div key={i} style={{ color: 'var(--text3)', padding: '2px 0', display: 'flex', gap: 6 }}>
                      <span style={{ color: '#6b7280' }}>←</span>
                      <span style={{ fontFamily: 'monospace', fontSize: 10 }}>{e.from.split('::').pop()}</span>
                    </div>
                  ))}
                </div>
              ) : null;
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
