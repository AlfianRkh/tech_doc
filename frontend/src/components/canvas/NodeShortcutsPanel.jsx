import { useState } from 'react';

const TYPE_COLOR = {
  Process: '#3b82f6', Validation: '#10b981', Database: '#8b5cf6',
  API: '#f59e0b', Logic: '#06b6d4', Finance: '#ec4899',
  Custom: '#f97316', Decision: '#ef4444', Start: '#10b981', End: '#ef4444', Loop: '#f97316',
};

function NodeCard({ node, col, onAdd }) {
  const [hovered, setHovered] = useState(false);
  const [added, setAdded] = useState(false);

  function handleAdd() {
    onAdd(node);
    setAdded(true);
    setTimeout(() => setAdded(false), 900);
  }

  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData('templateId', node.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleAdd}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 8px', borderRadius: 8, cursor: 'grab',
        background: added ? `${col}20` : hovered ? 'rgba(255,255,255,0.04)' : 'transparent',
        border: `1px solid ${added ? col + '40' : hovered ? 'var(--border2)' : 'transparent'}`,
        transition: 'all 0.15s', marginBottom: 3,
        position: 'relative', userSelect: 'none',
      }}
    >
      <div style={{
        width: 30, height: 30, borderRadius: 7,
        background: `${col}18`, border: `1px solid ${col}28`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 15, flexShrink: 0,
      }}>{node.icon}</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 11, fontWeight: 600,
          color: hovered ? 'var(--text)' : 'var(--text2)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{node.name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
          <span style={{
            background: `${col}15`, color: col,
            padding: '0 5px', borderRadius: 3, fontSize: 9, fontWeight: 600,
          }}>{node.node_type}</span>
          <span style={{ fontSize: 10, color: 'var(--text3)' }}>{node.used_count}×</span>
        </div>
      </div>

      {hovered && !added && (
        <div style={{
          position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
          width: 18, height: 18, borderRadius: '50%',
          background: `${col}25`, border: `1px solid ${col}50`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, color: col, fontWeight: 700,
        }}>+</div>
      )}
      {added && (
        <div style={{
          position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
          width: 18, height: 18, borderRadius: '50%',
          background: `${col}30`, border: `1px solid ${col}70`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, color: col,
        }}>✓</div>
      )}
    </div>
  );
}

export default function NodeShortcutsPanel({ templates, onAddNode, collapsed, setCollapsed }) {
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');

  const usable = templates.filter((t) => !['Start', 'End'].includes(t.node_type));
  const categories = ['All', ...new Set(usable.map((t) => t.node_type))];

  const filtered = usable.filter((n) =>
    (catFilter === 'All' || n.node_type === catFilter) &&
    n.name.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = catFilter === 'All'
    ? Object.entries(filtered.reduce((acc, n) => {
        (acc[n.node_type] = acc[n.node_type] || []).push(n);
        return acc;
      }, {}))
    : [[catFilter, filtered]];

  if (collapsed) {
    return (
      <div style={{
        width: 36, background: 'var(--bg2)', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingTop: 12, gap: 6, flexShrink: 0,
      }}>
        <button onClick={() => setCollapsed(false)} title="Expand" style={{
          width: 28, height: 28, background: 'rgba(59,130,246,0.15)', color: '#3b82f6',
          border: '1px solid rgba(59,130,246,0.3)', borderRadius: 6, fontSize: 13,
        }}>◉</button>
        <div style={{ width: 1, height: 8, background: 'var(--border)' }} />
        {usable.slice(0, 7).map((n) => {
          const col = TYPE_COLOR[n.node_type] || '#3b82f6';
          return (
            <button key={n.id} title={n.name} onClick={() => onAddNode(n)}
              style={{
                width: 28, height: 28, background: `${col}18`,
                border: `1px solid ${col}30`, borderRadius: 6, fontSize: 14,
              }}>{n.icon}</button>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{
      width: 220, background: 'var(--bg2)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      <div style={{
        padding: '10px 12px 8px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', flex: 1 }}>
          Node Shortcuts
        </span>
        <span style={{
          fontSize: 10, color: 'var(--text3)', background: 'var(--bg4)',
          padding: '1px 6px', borderRadius: 3,
        }}>{usable.length}</span>
        <button onClick={() => setCollapsed(true)} style={{
          width: 20, height: 20, background: 'transparent',
          color: 'var(--text3)', fontSize: 14, borderRadius: 4,
        }}>‹</button>
      </div>

      <div style={{ padding: '8px 10px 6px' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍  Search nodes..."
          style={{ width: '100%', fontSize: 11, padding: '5px 8px' }}
        />
      </div>

      <div style={{ padding: '0 10px 8px', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {categories.map((c) => {
          const col = c === 'All' ? '#3b82f6' : (TYPE_COLOR[c] || '#3b82f6');
          const active = catFilter === c;
          return (
            <button key={c} onClick={() => setCatFilter(c)} style={{
              padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600,
              background: active ? `${col}25` : 'transparent',
              color: active ? col : 'var(--text3)',
              border: `1px solid ${active ? col + '50' : 'var(--border)'}`,
              transition: 'all 0.15s',
            }}>{c}</button>
          );
        })}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 10px 10px' }}>
        {grouped.map(([type, items]) => {
          if (!items.length) return null;
          const col = TYPE_COLOR[type] || '#3b82f6';
          return (
            <div key={type} style={{ marginBottom: 12 }}>
              {catFilter === 'All' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: col, letterSpacing: '0.06em' }}>
                    {type.toUpperCase()}
                  </span>
                  <div style={{ height: 1, flex: 1, background: 'var(--border)' }} />
                </div>
              )}
              {items.map((node) => (
                <NodeCard key={node.id} node={node} col={col} onAdd={onAddNode} />
              ))}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 12, paddingTop: 20 }}>
            No nodes found
          </div>
        )}
      </div>

      <div style={{
        padding: '8px 12px', borderTop: '1px solid var(--border)',
        fontSize: 10, color: 'var(--text3)',
      }}>
        Click or drag to add to canvas
      </div>
    </div>
  );
}
