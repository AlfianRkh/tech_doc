import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useProject } from '../context/ProjectContext';

const TYPE_COLOR = {
  Process: '#3b82f6', Validation: '#10b981', Database: '#8b5cf6',
  API: '#f59e0b', Logic: '#06b6d4', Finance: '#ec4899',
  Custom: '#f97316', Decision: '#ef4444', Loop: '#f97316',
  Start: '#10b981', End: '#ef4444',
};

function NodeChip({ label, type, icon, color }) {
  const c = color || TYPE_COLOR[type] || '#6b7280';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: c + '18', border: `1px solid ${c}44`,
      borderRadius: 6, padding: '3px 9px',
      fontSize: 12, fontWeight: 600, color: c,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ fontSize: 14 }}>{icon || '⚙'}</span>
      {label}
      {type && (
        <span style={{
          fontSize: 9, fontWeight: 700, color: c + 'cc',
          background: c + '22', borderRadius: 3, padding: '1px 4px',
          letterSpacing: '0.04em',
        }}>{type}</span>
      )}
    </span>
  );
}

function FlowGroup({ flowName, flowStatus, flowVersion, project, connections, navigate }) {
  const [collapsed, setCollapsed] = useState(false);
  const pc = project?.project_color || '#6b7280';
  const statusColor = { active: '#10b981', draft: '#f59e0b', archived: '#6b7280' }[flowStatus] || '#6b7280';

  return (
    <div style={{
      background: 'var(--bg2)', border: '1px solid var(--border)',
      borderRadius: 12, overflow: 'hidden', marginBottom: 16,
    }}>
      {/* Group header */}
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 18px', cursor: 'pointer',
          background: 'var(--bg2)',
          borderBottom: collapsed ? 'none' : '1px solid var(--border)',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.05)'}
        onMouseLeave={e => e.currentTarget.style.background = 'var(--bg2)'}
      >
        {/* Collapse caret */}
        <span style={{
          fontSize: 11, color: 'var(--text3)', transition: 'transform 0.2s',
          display: 'inline-block', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
        }}>▾</span>

        {/* Flow name */}
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text1)' }}>
          {flowName}
        </span>

        {/* Flow version */}
        <span style={{
          fontSize: 10, fontWeight: 700, color: '#8b5cf6',
          background: 'rgba(139,92,246,0.15)', borderRadius: 4, padding: '1px 6px',
          border: '1px solid rgba(139,92,246,0.3)',
        }}>{flowVersion}</span>

        {/* Flow status */}
        <span style={{
          fontSize: 10, fontWeight: 700, color: statusColor,
          background: statusColor + '18', borderRadius: 4, padding: '1px 6px',
          border: `1px solid ${statusColor}44`, textTransform: 'uppercase',
        }}>{flowStatus}</span>

        {/* Project badge */}
        {project?.project_name && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 10, fontWeight: 700, color: pc,
            background: pc + '18', borderRadius: 4, padding: '1px 7px',
            border: `1px solid ${pc}33`,
          }}>
            {project.project_icon || '📁'} {project.project_name}
          </span>
        )}

        {/* Connection count */}
        <span style={{
          marginLeft: 'auto', fontSize: 11, color: 'var(--text3)',
          background: 'var(--bg3)', borderRadius: 4, padding: '2px 8px',
          border: '1px solid var(--border)',
        }}>
          {connections.length} connection{connections.length !== 1 ? 's' : ''}
        </span>

        {/* Open flow button */}
        <button
          onClick={e => { e.stopPropagation(); navigate(`/canvas/${connections[0].flow_id}`); }}
          title="Open Flow Canvas"
          style={{
            background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.25)',
            borderRadius: 5, padding: '3px 9px', fontSize: 10, fontWeight: 600,
            color: '#06b6d4', cursor: 'pointer',
          }}
        >
          ↗ Canvas
        </button>
      </div>

      {/* Connection rows */}
      {!collapsed && (
        <div>
          {connections.map((conn, i) => (
            <div
              key={conn.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 20px',
                borderBottom: i < connections.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
              }}
            >
              {/* Row number */}
              <span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'monospace', minWidth: 20, textAlign: 'right' }}>
                {i + 1}
              </span>

              {/* Source node */}
              <NodeChip
                label={conn.source_label}
                type={conn.source_type}
                icon={conn.source_icon}
                color={conn.source_color}
              />

              {/* Arrow + branch label */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <span style={{ color: 'var(--text3)', fontSize: 18, lineHeight: 1 }}>→</span>
                {conn.branch_label && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, color: '#f59e0b',
                    background: 'rgba(245,158,11,0.15)', borderRadius: 3, padding: '1px 5px',
                    border: '1px solid rgba(245,158,11,0.3)', whiteSpace: 'nowrap',
                  }}>
                    {conn.branch_label}
                  </span>
                )}
              </div>

              {/* Target node */}
              <NodeChip
                label={conn.target_label}
                type={conn.target_type}
                icon={conn.target_icon}
                color={conn.target_color}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ConnectionsPage() {
  const navigate = useNavigate();
  const { activeProject } = useProject();
  const [connections, setConnections] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [projectFilter, setProjectFilter] = useState('');

  useEffect(() => {
    setProjectFilter(activeProject?.id ? String(activeProject.id) : '');
  }, [activeProject?.id]);

  useEffect(() => {
    load();
  }, [projectFilter]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await api.getConnections(projectFilter || null, null, null);
      setConnections(data);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  // Local search filter (client-side, fast)
  const filtered = useMemo(() => {
    if (!search.trim()) return connections;
    const q = search.toLowerCase();
    return connections.filter(c =>
      c.source_label.toLowerCase().includes(q) ||
      c.target_label.toLowerCase().includes(q) ||
      c.flow_name.toLowerCase().includes(q) ||
      (c.branch_label || '').toLowerCase().includes(q) ||
      (c.project_name || '').toLowerCase().includes(q)
    );
  }, [connections, search]);

  // Group by flow_id
  const groups = useMemo(() => {
    const map = new Map();
    for (const conn of filtered) {
      if (!map.has(conn.flow_id)) {
        map.set(conn.flow_id, {
          flowId: conn.flow_id,
          flowName: conn.flow_name,
          flowStatus: conn.flow_status,
          flowVersion: conn.flow_version,
          project: {
            project_id: conn.project_id,
            project_name: conn.project_name,
            project_code: conn.project_code,
            project_color: conn.project_color,
            project_icon: conn.project_icon,
          },
          connections: [],
        });
      }
      map.get(conn.flow_id).connections.push(conn);
    }
    return Array.from(map.values());
  }, [filtered]);

  // Stats
  const totalFlows = groups.length;
  const totalConns = filtered.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        {/* Tag */}
        <div style={{
          background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)',
          borderRadius: 6, padding: '4px 10px', fontSize: 12, color: '#818cf8', fontWeight: 600,
        }}>⤷ CONNECTIONS</div>

        <div style={{ fontSize: 12, color: 'var(--text3)' }}>
          Peta koneksi antar node dalam setiap flow
        </div>

        {/* Active project badge */}
        {activeProject && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: activeProject.color + '18', border: `1px solid ${activeProject.color}44`,
            borderRadius: 6, padding: '3px 9px', fontSize: 11, color: activeProject.color, fontWeight: 600,
          }}>
            <span>{activeProject.icon || '📁'}</span>
            <span>{activeProject.name}</span>
          </div>
        )}

        {/* Stats */}
        <div style={{
          display: 'inline-flex', gap: 16, marginLeft: 4,
          background: 'var(--bg3)', borderRadius: 8, padding: '4px 12px',
          border: '1px solid var(--border)', fontSize: 11, color: 'var(--text2)',
        }}>
          <span><span style={{ fontWeight: 700, color: '#818cf8' }}>{totalFlows}</span> flows</span>
          <span style={{ color: 'var(--border)' }}>|</span>
          <span><span style={{ fontWeight: 700, color: '#06b6d4' }}>{totalConns}</span> connections</span>
        </div>

        {/* Search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by node, flow, branch..."
          style={{ marginLeft: 'auto', width: 240 }}
        />

        {/* Refresh */}
        <button
          onClick={load}
          style={{
            padding: '7px 12px', background: 'var(--bg3)', color: 'var(--text2)',
            border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, cursor: 'pointer',
          }}
          title="Refresh"
        >↻</button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text3)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⤷</div>
            Loading connections...
          </div>
        ) : error ? (
          <div style={{
            textAlign: 'center', padding: 60, color: '#ef4444',
            background: 'rgba(239,68,68,0.06)', borderRadius: 12, border: '1px solid rgba(239,68,68,0.18)',
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠</div>
            {error}
          </div>
        ) : groups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 80, color: 'var(--text3)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⤷</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text2)', marginBottom: 8 }}>
              {search ? 'No connections match your search' : 'No connections yet'}
            </div>
            <div style={{ fontSize: 13 }}>
              {search
                ? 'Try a different search term'
                : 'Create flows and draw connections between nodes on the canvas.'}
            </div>
          </div>
        ) : (
          groups.map(group => (
            <FlowGroup
              key={group.flowId}
              flowName={group.flowName}
              flowStatus={group.flowStatus}
              flowVersion={group.flowVersion}
              project={group.project}
              connections={group.connections}
              navigate={navigate}
            />
          ))
        )}
      </div>
    </div>
  );
}
