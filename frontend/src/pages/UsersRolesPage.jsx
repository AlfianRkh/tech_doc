import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

// ─── Helpers ────────────────────────────────────────────────────────────────

function Badge({ children, color = '#3b82f6' }) {
  return (
    <span style={{
      background: color + '1a', border: `1px solid ${color}44`,
      borderRadius: 4, padding: '2px 8px', fontSize: 10,
      fontWeight: 600, color, letterSpacing: '0.05em',
    }}>
      {children}
    </span>
  );
}

function Tab({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: 'none', border: 'none', padding: '10px 18px',
      fontSize: 13, fontWeight: active ? 600 : 400,
      color: active ? '#3b82f6' : 'var(--text3)',
      borderBottom: active ? '2px solid #3b82f6' : '2px solid transparent',
      cursor: 'pointer', transition: 'all 0.15s',
    }}>
      {label}
    </button>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
      {children}
    </div>
  );
}

const ROLE_COLORS = { Admin: '#ef4444', Editor: '#3b82f6', Viewer: '#10b981' };
const roleColor = (name) => ROLE_COLORS[name] || '#8b5cf6';

// ─── Tab 1: Users ───────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([api.getUsers(), api.getRoles()]);
      setUsers(u); setRoles(r);
    } catch (err) {
      setMsg('Failed to load users: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const changeRole = async (userId, roleId) => {
    setSaving(s => ({ ...s, [userId]: true }));
    try {
      await api.updateUserRole(userId, parseInt(roleId));
      setMsg('Role updated successfully');
      setTimeout(() => setMsg(''), 2500);
      load();
    } catch (err) {
      setMsg('Error: ' + err.message);
    } finally {
      setSaving(s => ({ ...s, [userId]: false }));
    }
  };

  const deleteUser = async (userId) => {
    if (!confirm('Delete this user account?')) return;
    await api.deleteUser(userId);
    load();
  };

  if (loading) return <div style={{ color: 'var(--text3)', padding: 24 }}>Loading users...</div>;

  return (
    <div>
      {msg && (
        <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, padding: '8px 14px', marginBottom: 16, fontSize: 13, color: '#10b981' }}>
          {msg}
        </div>
      )}
      <SectionTitle>User Accounts ({users.length})</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {users.map(u => (
          <div key={u.id} style={{
            background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10,
            padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
              {u.name?.[0]?.toUpperCase() || '?'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text1)' }}>{u.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{u.email}</div>
            </div>
            <Badge color={roleColor(u.role_name)}>{u.role_name || 'No Role'}</Badge>
            <select
              value={u.role_id || ''}
              onChange={e => changeRole(u.id, e.target.value)}
              disabled={saving[u.id]}
              style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', fontSize: 12, color: 'var(--text2)', cursor: 'pointer' }}
            >
              <option value="">-- Assign Role --</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <button onClick={() => deleteUser(u.id)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '5px 10px', fontSize: 11, color: '#ef4444', cursor: 'pointer' }}>
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab 2: Role-Permission Matrix ──────────────────────────────────────────

function RoleMatrix() {
  const [roles, setRoles] = useState([]);
  const [allPerms, setAllPerms] = useState([]);
  const [matrix, setMatrix] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [newRole, setNewRole] = useState({ name: '', description: '' });
  const [showNewRole, setShowNewRole] = useState(false);

  const buildMatrix = (roles, perms) => {
    const m = {};
    roles.forEach(r => {
      m[r.id] = {};
      perms.forEach(p => {
        m[r.id][p.id] = r.permissions?.some(rp => rp.id === p.id) || false;
      });
    });
    return m;
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, p] = await Promise.all([api.getRoles(), api.getPermissions()]);
      setRoles(r);
      setAllPerms(p.permissions || []);
      setMatrix(buildMatrix(r, p.permissions || []));
    } catch (err) {
      setMsg('Failed to load matrix: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = (roleId, permId) => {
    setMatrix(m => ({
      ...m,
      [roleId]: { ...m[roleId], [permId]: !m[roleId][permId] }
    }));
  };

  const saveMatrix = async () => {
    setSaving(true);
    try {
      for (const role of roles) {
        const permIds = allPerms
          .filter(p => matrix[role.id]?.[p.id])
          .map(p => p.id);
        await api.updateRole(role.id, { permission_ids: permIds });
      }
      setMsg('Permission matrix saved!');
      setTimeout(() => setMsg(''), 2500);
    } catch (err) {
      setMsg('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const addRole = async () => {
    if (!newRole.name) return;
    await api.createRole({ name: newRole.name, description: newRole.description, permission_ids: [] });
    setNewRole({ name: '', description: '' });
    setShowNewRole(false);
    load();
  };

  const deleteRole = async (role) => {
    if (role.is_system) return alert('Cannot delete system roles');
    if (!confirm(`Delete role "${role.name}"?`)) return;
    await api.deleteRole(role.id);
    load();
  };

  const modules = [...new Set(allPerms.map(p => p.module))].sort();

  if (loading) return <div style={{ color: 'var(--text3)', padding: 24 }}>Loading matrix...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <SectionTitle>Role × Permission Matrix</SectionTitle>
        <div style={{ display: 'flex', gap: 8 }}>
          {msg && <span style={{ fontSize: 12, color: '#10b981' }}>{msg}</span>}
          <button onClick={() => setShowNewRole(!showNewRole)} style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 6, padding: '6px 12px', fontSize: 12, color: '#8b5cf6', cursor: 'pointer' }}>
            + New Role
          </button>
          <button onClick={saveMatrix} disabled={saving} style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, color: '#3b82f6', cursor: 'pointer' }}>
            {saving ? 'Saving...' : '💾 Save Matrix'}
          </button>
        </div>
      </div>

      {showNewRole && (
        <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: 16, marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 4 }}>ROLE NAME</div>
            <input value={newRole.name} onChange={e => setNewRole(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Developer" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', fontSize: 12, color: 'var(--text1)', width: '100%', outline: 'none' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 4 }}>DESCRIPTION</div>
            <input value={newRole.description} onChange={e => setNewRole(f => ({ ...f, description: e.target.value }))} placeholder="Optional" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px', fontSize: 12, color: 'var(--text1)', width: '100%', outline: 'none' }} />
          </div>
          <button onClick={addRole} style={{ background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>
            Create Role
          </button>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text3)', fontWeight: 600, fontSize: 11, borderBottom: '1px solid var(--border)', minWidth: 200 }}>
                PERMISSION
              </th>
              {roles.map(r => (
                <th key={r.id} style={{ textAlign: 'center', padding: '8px 12px', color: 'var(--text2)', fontWeight: 600, fontSize: 11, borderBottom: '1px solid var(--border)', minWidth: 90 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <Badge color={roleColor(r.name)}>{r.name}</Badge>
                    {!r.is_system && (
                      <button onClick={() => deleteRole(r)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 10, padding: 0 }}>× del</button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {modules.map(mod => (
              <>
                <tr key={`mod-${mod}`}>
                  <td colSpan={roles.length + 1} style={{ padding: '10px 12px 4px', fontSize: 10, fontWeight: 700, color: '#3b82f6', letterSpacing: '0.1em', background: 'rgba(59,130,246,0.04)' }}>
                    {mod.toUpperCase()}
                  </td>
                </tr>
                {allPerms.filter(p => p.module === mod).map(perm => (
                  <tr key={perm.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px', color: 'var(--text2)' }}>
                      <div style={{ fontWeight: 500 }}>{perm.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'monospace' }}>{perm.key}</div>
                    </td>
                    {roles.map(r => (
                      <td key={r.id} style={{ textAlign: 'center', padding: '8px' }}>
                        <input
                          type="checkbox"
                          checked={matrix[r.id]?.[perm.id] || false}
                          onChange={() => toggle(r.id, perm.id)}
                          style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#3b82f6' }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tab 3: Feature Permission Registry ─────────────────────────────────────

function PermissionsRegistry() {
  const [perms, setPerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ key: '', name: '', module: '', description: '' });
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getPermissions();
      setPerms(data.permissions || []);
    } catch (err) {
      setMsg('Failed to load permissions: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.updatePermission(editing, form);
        setMsg('Permission updated!');
      } else {
        await api.createPermission(form);
        setMsg('Permission created!');
      }
      setForm({ key: '', name: '', module: '', description: '' });
      setEditing(null);
      load();
      setTimeout(() => setMsg(''), 2500);
    } catch (err) {
      setMsg('Error: ' + err.message);
    }
  };

  const startEdit = (p) => {
    setEditing(p.id);
    setForm({ key: p.key, name: p.name, module: p.module, description: p.description || '' });
  };

  const deletePerm = async (id) => {
    if (!confirm('Delete this permission? This will remove it from all roles.')) return;
    await api.deletePermission(id);
    load();
  };

  const modules = [...new Set(perms.map(p => p.module))].sort();

  return (
    <div>
      {/* Form */}
      <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, marginBottom: 24 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text2)', marginBottom: 14 }}>
          {editing ? '✏️ Edit Permission' : '＋ Register New Feature Permission'}
        </div>
        {msg && <div style={{ fontSize: 12, color: editing ? '#f59e0b' : '#10b981', marginBottom: 10 }}>{msg}</div>}
        <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 4 }}>PERMISSION KEY *</div>
            <input required value={form.key} onChange={set('key')} placeholder="e.g. reports:export" style={inputStyle} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 4 }}>NAME *</div>
            <input required value={form.name} onChange={set('name')} placeholder="Export Reports" style={inputStyle} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 4 }}>MODULE</div>
            <input value={form.module} onChange={set('module')} placeholder="e.g. Reports" style={inputStyle} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 4 }}>DESCRIPTION</div>
            <input value={form.description} onChange={set('description')} placeholder="Optional" style={inputStyle} />
          </div>
          <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8 }}>
            <button type="submit" style={{ background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', border: 'none', borderRadius: 6, padding: '8px 20px', fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer' }}>
              {editing ? 'Update Permission' : 'Register Permission'}
            </button>
            {editing && (
              <button type="button" onClick={() => { setEditing(null); setForm({ key: '', name: '', module: '', description: '' }); }} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 16px', fontSize: 12, color: 'var(--text3)', cursor: 'pointer' }}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Permission list grouped by module */}
      <SectionTitle>Registered Permissions ({perms.length})</SectionTitle>
      {loading ? <div style={{ color: 'var(--text3)' }}>Loading...</div> : (
        modules.map(mod => (
          <div key={mod} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', letterSpacing: '0.1em', marginBottom: 8 }}>
              {mod.toUpperCase()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {perms.filter(p => p.module === mod).map(p => (
                <div key={p.id} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#f59e0b', marginRight: 8 }}>{p.key}</span>
                    <span style={{ fontSize: 12, color: 'var(--text2)' }}>{p.name}</span>
                    {p.description && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{p.description}</div>}
                  </div>
                  <button onClick={() => startEdit(p)} style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: '#3b82f6', cursor: 'pointer' }}>Edit</button>
                  <button onClick={() => deletePerm(p.id)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: '#ef4444', cursor: 'pointer' }}>Delete</button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

const inputStyle = {
  background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6,
  padding: '8px 10px', fontSize: 12, color: 'var(--text1)', width: '100%',
  outline: 'none', boxSizing: 'border-box',
};

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function UsersRolesPage() {
  const [tab, setTab] = useState('users');
  const { hasPermission } = useAuth();

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text1)', marginBottom: 4 }}>
          Users & Permission Roles
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text3)' }}>
          Manage team members, define roles, and configure feature permissions without code changes.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 24, gap: 2 }}>
        <Tab label="👤 Users" active={tab === 'users'} onClick={() => setTab('users')} />
        <Tab label="🔑 Role × Permission Matrix" active={tab === 'matrix'} onClick={() => setTab('matrix')} />
        {hasPermission('permissions:manage') && (
          <Tab label="🗂 Feature Permission Registry" active={tab === 'registry'} onClick={() => setTab('registry')} />
        )}
      </div>

      {/* Tab Content */}
      {tab === 'users' && <UsersTab />}
      {tab === 'matrix' && <RoleMatrix />}
      {tab === 'registry' && <PermissionsRegistry />}
    </div>
  );
}
