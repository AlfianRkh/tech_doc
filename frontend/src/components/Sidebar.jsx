import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ROLE_COLORS = { Admin: '#ef4444', Editor: '#3b82f6', Viewer: '#10b981' };

const sections = [
  {
    label: 'FLOW BUILDER',
    items: [
      { to: '/canvas', icon: '⬡', label: 'Flow Canvas', perm: 'flows:read' },
      { to: '/nodes',  icon: '◉', label: 'Nodes', perm: 'nodes:read' },
      { to: '/connections', icon: '⤷', label: 'Connections' },
      { to: '/templates', icon: '⊞', label: 'Templates' },
    ],
  },
  {
    label: 'MANAGEMENT',
    items: [
      { to: '/flows',       icon: '∿', label: 'Flows', perm: 'flows:read' },
      { to: '/projects',    icon: '📁', label: 'Projects / Repos', perm: 'projects:read' },
      { to: '/simulations', icon: '▷', label: 'Simulations', perm: 'simulations:read' },
      { to: '/versioning',  icon: '⎇', label: 'Versioning' },
      { to: '/documents',   icon: '⊟', label: 'Documents' },
    ],
  },
  {
    label: 'ANALYTICS',
    items: [
      { to: '/dashboard', icon: '◫', label: 'Dashboard' },
      { to: '/reports',   icon: '◨', label: 'Reports' },
      { to: '/metrics',   icon: '◎', label: 'Metrics' },
    ],
  },
  {
    label: 'ADMINISTRATION',
    items: [
      { to: '/admin/users-roles', icon: '🔑', label: 'Users & Roles', perm: 'users:read' },
    ],
  },
];

export default function Sidebar() {
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();

  return (
    <div style={{
      width: 200, background: 'var(--bg2)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{
        padding: '14px 16px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{
          width: 28, height: 28,
          background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
          borderRadius: 8, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff',
        }}>T</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#e8edf4' }}>TechFlow</div>
          <div style={{ fontSize: 10, color: 'var(--text3)' }}>Documentation Platform</div>
        </div>
      </div>

      {/* Nav */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
        {sections.map((sec) => {
          const visibleItems = sec.items.filter(item =>
            !item.perm || hasPermission(item.perm) || (user?.role_name === 'Admin')
          );
          if (visibleItems.length === 0) return null;
          return (
            <div key={sec.label} style={{ marginBottom: 4 }}>
              <div style={{
                padding: '8px 16px 4px', fontSize: 10, fontWeight: 600,
                color: 'var(--text3)', letterSpacing: '0.08em',
              }}>{sec.label}</div>
              {visibleItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  style={({ isActive }) => ({
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 16px', width: '100%', textDecoration: 'none',
                    background: isActive ? 'rgba(59,130,246,0.12)' : 'transparent',
                    color: isActive ? '#3b82f6' : 'var(--text2)',
                    fontSize: 12,
                    borderLeft: isActive ? '2px solid #3b82f6' : '2px solid transparent',
                    transition: 'all 0.15s',
                  })}
                >
                  <span style={{ fontSize: 14, width: 16, textAlign: 'center' }}>{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          );
        })}
      </div>

      {/* User info */}
      {user && (
        <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
              {user.name?.[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
              <div style={{ fontSize: 10, color: ROLE_COLORS[user.role_name] || '#8b5cf6', fontWeight: 600 }}>{user.role_name}</div>
            </div>
          </div>
        </div>
      )}

      {/* Status */}
      <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 8px', background: 'rgba(16,185,129,0.1)',
          borderRadius: 6, border: '1px solid rgba(16,185,129,0.2)',
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
          <span style={{ fontSize: 11, color: '#10b981', fontWeight: 500 }}>ONLINE</span>
        </div>
      </div>
    </div>
  );
}
