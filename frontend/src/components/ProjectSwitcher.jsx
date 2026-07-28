import { useState, useRef, useEffect } from 'react';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';

export default function ProjectSwitcher() {
  const { projects, activeProject, setActiveProject } = useProject();
  const { hasPermission } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (p) => {
    setActiveProject(p);
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        id="project-switcher"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: activeProject ? activeProject.color + '14' : 'var(--bg3)',
          border: `1px solid ${activeProject ? activeProject.color + '44' : 'var(--border)'}`,
          borderRadius: 8, padding: '5px 10px', cursor: 'pointer',
          minWidth: 160, transition: 'all 0.15s',
        }}
      >
        <span style={{ fontSize: 16 }}>{activeProject?.icon || '📁'}</span>
        <div style={{ flex: 1, textAlign: 'left' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: activeProject ? activeProject.color : 'var(--text2)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activeProject?.name || 'Select Project'}
          </div>
          {activeProject?.code && (
            <div style={{ fontSize: 9, fontFamily: 'monospace', color: 'var(--text3)', letterSpacing: '0.05em' }}>
              {activeProject.code}
            </div>
          )}
        </div>
        <span style={{ fontSize: 10, color: 'var(--text3)', transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none' }}>▼</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '110%', left: 0, right: 0,
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 10, overflow: 'hidden', zIndex: 1000,
          boxShadow: '0 12px 32px rgba(0,0,0,0.4)', minWidth: 220,
        }}>
          <div style={{ padding: '8px 12px', fontSize: 10, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.08em', borderBottom: '1px solid var(--border)' }}>
            SWITCH REPOSITORY
          </div>
          {projects.map(p => (
            <div
              key={p.id}
              onClick={() => select(p)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', cursor: 'pointer',
                background: activeProject?.id === p.id ? p.color + '12' : 'transparent',
                borderLeft: activeProject?.id === p.id ? `2px solid ${p.color}` : '2px solid transparent',
                transition: 'all 0.1s',
              }}
            >
              <span style={{ fontSize: 18 }}>{p.icon || '📁'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>{p.name}</div>
                <div style={{ fontSize: 10, fontFamily: 'monospace', color: p.color }}>{p.code} · {p.flow_count} flows</div>
              </div>
              {activeProject?.id === p.id && <span style={{ fontSize: 10, color: p.color }}>✓</span>}
            </div>
          ))}
          {projects.length === 0 && (
            <div style={{ padding: '14px 12px', fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>
              No repositories yet
            </div>
          )}
        </div>
      )}
    </div>
  );
}
