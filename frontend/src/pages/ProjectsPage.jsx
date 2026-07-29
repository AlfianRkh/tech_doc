import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../context/ProjectContext';
import { useAuth } from '../context/AuthContext';

const PROJECT_ICONS = ['📁', '🚀', '⚡', '🔧', '🛒', '💳', '🏗', '🌐', '🔑', '📊'];
const PROJECT_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#f97316'];

export default function ProjectsPage() {
  const { projects, activeProject, setActiveProject, createProject, updateProject, deleteProject, loading } = useProject();
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', code: '', description: '', color: '#3b82f6', icon: '📁' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', code: '', description: '', color: '#3b82f6', icon: '📁' });
    setShowForm(true);
  };

  const openEdit = (p) => {
    setEditing(p.id);
    setForm({ name: p.name, code: p.code, description: p.description, color: p.color, icon: p.icon });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (editing) {
        await updateProject(editing, form);
      } else {
        const proj = await createProject(form);
        setActiveProject(proj);
      }
      setShowForm(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text1)', marginBottom: 4 }}>
            Project Repositories
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text3)' }}>
            Each repository isolates its own flows, templates, and documentation.
          </p>
        </div>
        {hasPermission('projects:write') && (
          <button onClick={openCreate} style={{ background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', border: 'none', borderRadius: 8, padding: '9px 18px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            + New Repository
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text1)', marginBottom: 16 }}>
            {editing ? 'Edit Repository' : 'Create New Repository'}
          </div>
          {error && <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 12 }}>{error}</div>}
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
            <div>
              <div style={labelStyle}>REPOSITORY NAME *</div>
              <input required value={form.name} onChange={set('name')} placeholder="E-Commerce Platform" style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}>CODE (UNIQUE) *</div>
              <input required value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="ECOMMERCE" maxLength={20} style={inputStyle} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <div style={labelStyle}>DESCRIPTION</div>
              <input value={form.description} onChange={set('description')} placeholder="Optional description..." style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}>COLOR</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {PROJECT_COLORS.map(c => (
                  <div key={c} onClick={() => setForm(f => ({ ...f, color: c }))} style={{ width: 24, height: 24, borderRadius: '50%', background: c, cursor: 'pointer', border: form.color === c ? '2px solid #fff' : '2px solid transparent', outline: form.color === c ? `2px solid ${c}` : 'none', transition: 'all 0.1s' }} />
                ))}
              </div>
            </div>
            <div>
              <div style={labelStyle}>ICON</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {PROJECT_ICONS.map(ic => (
                  <div key={ic} onClick={() => setForm(f => ({ ...f, icon: ic }))} style={{ width: 32, height: 32, borderRadius: 6, background: form.icon === ic ? form.color + '33' : 'var(--bg3)', border: form.icon === ic ? `1px solid ${form.color}` : '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16 }}>
                    {ic}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8 }}>
              <button type="submit" disabled={saving} style={{ background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', border: 'none', borderRadius: 6, padding: '9px 20px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Repository'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '9px 16px', fontSize: 13, color: 'var(--text3)', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Project Cards Grid */}
      {loading ? (
        <div style={{ color: 'var(--text3)', textAlign: 'center', padding: 48 }}>Loading repositories...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {projects.map(p => {
            const isActive = activeProject?.id === p.id;
            return (
              <div key={p.id} onClick={() => { setActiveProject(p); navigate('/flows'); }} style={{
                background: isActive ? `linear-gradient(135deg, ${p.color}14, ${p.color}08)` : 'var(--bg2)',
                border: `1px solid ${isActive ? p.color + '60' : 'var(--border)'}`,
                borderRadius: 12, padding: 20, cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: isActive ? `0 0 0 1px ${p.color}40, 0 4px 20px ${p.color}18` : 'none',
                position: 'relative',
              }}>
                {isActive && (
                  <div style={{ position: 'absolute', top: 10, right: 12, fontSize: 10, fontWeight: 700, color: p.color, background: p.color + '20', borderRadius: 4, padding: '2px 6px' }}>
                    ACTIVE
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: p.color + '22', border: `1px solid ${p.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                    {p.icon || '📁'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text1)' }}>{p.name}</div>
                    <div style={{ fontSize: 10, fontFamily: 'monospace', color: p.color, fontWeight: 600 }}>{p.code}</div>
                  </div>
                </div>
                {p.description && (
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>{p.description}</div>
                )}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                    {p.flow_count} flow{p.flow_count !== 1 ? 's' : ''}
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {hasPermission('projects:write') && (
                      <button onClick={(e) => { e.stopPropagation(); openEdit(p); }} style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 5, padding: '4px 8px', fontSize: 10, color: '#3b82f6', cursor: 'pointer' }}>Edit</button>
                    )}
                    {hasPermission('projects:delete') && (
                      <button onClick={(e) => { e.stopPropagation(); if (confirm(`Delete "${p.name}"? This also deletes all its flows.`)) deleteProject(p.id); }} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 5, padding: '4px 8px', fontSize: 10, color: '#ef4444', cursor: 'pointer' }}>Delete</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const labelStyle = { fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 5 };
const inputStyle = { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: 'var(--text1)', width: '100%', outline: 'none', boxSizing: 'border-box' };
