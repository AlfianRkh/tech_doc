import { useState, useEffect } from 'react';
import { api } from '../api/client';
import Badge from '../components/shared/Badge';

const NODE_TYPES = ['Process','Validation','Database','API','Logic','Finance','Custom','Decision','Loop'];
const TYPE_COLOR = {
  Process: '#3b82f6', Validation: '#10b981', Database: '#8b5cf6',
  API: '#f59e0b', Logic: '#06b6d4', Finance: '#ec4899',
  Custom: '#f97316', Decision: '#ef4444', Loop: '#f97316',
};

const EMPTY_FORM = {
  name: '', node_type: 'Process', description: '', icon: '⚙', color: '#3b82f6',
  default_input_params: '{}', default_validation: '',
  default_process_logic: '', default_output_template: '{}',
};

export default function NodesPage() {
  const [nodes, setNodes] = useState([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const [showForm, setShowForm] = useState(false);
  const [editNode, setEditNode] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const categories = ['All', ...NODE_TYPES];

  useEffect(() => { loadNodes(); }, []);

  async function loadNodes() {
    setLoading(true);
    try {
      const data = await api.getNodes();
      setNodes(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  const filtered = nodes.filter((n) =>
    (catFilter === 'All' || n.node_type === catFilter) &&
    (n.name.toLowerCase().includes(search.toLowerCase()) ||
     n.description.toLowerCase().includes(search.toLowerCase()))
  );

  const catCounts = categories.reduce((acc, c) => {
    acc[c] = c === 'All' ? nodes.length : nodes.filter((n) => n.node_type === c).length;
    return acc;
  }, {});

  function openNew() {
    setForm({ ...EMPTY_FORM });
    setEditNode(null);
    setShowForm(true);
  }

  function openEdit(node) {
    setForm({
      name: node.name,
      node_type: node.node_type,
      description: node.description || '',
      icon: node.icon || '⚙',
      color: node.color || '#3b82f6',
      default_input_params: JSON.stringify(node.default_input_params || {}, null, 2),
      default_validation: node.default_validation || '',
      default_process_logic: node.default_process_logic || '',
      default_output_template: JSON.stringify(node.default_output_template || {}, null, 2),
    });
    setEditNode(node);
    setShowForm(true);
  }

  async function saveNode() {
    if (!form.name.trim()) return alert('Name is required');
    setSaving(true);
    try {
      let inParams = {};
      let outTemplate = {};
      try { inParams = JSON.parse(form.default_input_params); } catch {}
      try { outTemplate = JSON.parse(form.default_output_template); } catch {}

      const payload = {
        ...form,
        default_input_params: inParams,
        default_output_template: outTemplate,
      };

      if (editNode) {
        const updated = await api.updateNode(editNode.id, payload);
        setNodes((prev) => prev.map((n) => n.id === editNode.id ? updated : n));
      } else {
        const created = await api.createNode(payload);
        setNodes((prev) => [...prev, created]);
      }
      setShowForm(false);
    } catch (err) {
      alert('Save failed: ' + err.message);
    }
    setSaving(false);
  }

  async function deleteNode(id) {
    if (!confirm('Delete this node template? It will no longer be available in flows.')) return;
    try {
      await api.deleteNode(id);
      setNodes((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Category sidebar */}
      <div style={{
        width: 160, borderRight: '1px solid var(--border)',
        padding: '16px 0', background: 'var(--bg2)', flexShrink: 0,
      }}>
        <div style={{ padding: '0 16px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text3)', letterSpacing: '0.06em' }}>
          CATEGORIES
        </div>
        {categories.map((c) => {
          const col = c === 'All' ? '#3b82f6' : (TYPE_COLOR[c] || '#3b82f6');
          return (
            <button key={c} onClick={() => setCatFilter(c)} style={{
              width: '100%', padding: '7px 16px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: catFilter === c ? 'rgba(59,130,246,0.12)' : 'transparent',
              color: catFilter === c ? col : 'var(--text2)',
              fontSize: 12,
              borderLeft: catFilter === c ? `2px solid ${col}` : '2px solid transparent',
              textAlign: 'left',
            }}>
              <span>{c}</span>
              <span style={{ fontSize: 10, opacity: 0.7 }}>{catCounts[c] || 0}</span>
            </button>
          );
        })}
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)',
            borderRadius: 6, padding: '4px 10px', fontSize: 12, color: '#3b82f6',
          }}>◉ NODES</div>
          <div style={{ color: 'var(--text3)', fontSize: 12 }}>
            Kelola reusable node templates untuk dipakai di flow canvas
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search nodes..."
            style={{ marginLeft: 'auto', width: 200 }}
          />
          <button onClick={openNew} style={{
            padding: '7px 14px', background: '#3b82f6', color: '#fff',
            borderRadius: 6, fontSize: 12, fontWeight: 600,
          }}>+ New Node</button>
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Loading...</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--bg2)', zIndex: 1 }}>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Node','Type','Description','Used In','Actions'].map((h) => (
                    <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((node, i) => {
                  const col = TYPE_COLOR[node.node_type] || '#3b82f6';
                  return (
                    <tr key={node.id}
                      style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(59,130,246,0.04)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'}
                    >
                      <td style={{ padding: '12px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: 8,
                            background: `${col}18`, border: `1px solid ${col}30`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                          }}>{node.icon}</div>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{node.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 20px' }}>
                        <span style={{
                          padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                          background: `${col}18`, color: col, border: `1px solid ${col}30`,
                        }}>{node.node_type}</span>
                      </td>
                      <td style={{ padding: '12px 20px', color: 'var(--text2)', fontSize: 12, maxWidth: 300 }}>
                        {node.description || <span style={{ color: 'var(--text3)' }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 20px', color: 'var(--text3)', fontSize: 12, fontFamily: 'var(--mono)' }}>
                        {node.used_count} flows
                      </td>
                      <td style={{ padding: '12px 20px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => openEdit(node)} style={{
                            padding: '4px 10px', background: 'rgba(59,130,246,0.12)',
                            color: '#3b82f6', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 4, fontSize: 11,
                          }}>Edit</button>
                          <button onClick={() => deleteNode(node.id)} style={{
                            padding: '4px 10px', background: 'rgba(239,68,68,0.1)',
                            color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 4, fontSize: 11,
                          }}>Del</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
                      No nodes found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
        }}>
          <div style={{
            background: 'var(--bg2)', border: '1px solid var(--border2)',
            borderRadius: 12, padding: 24, width: 520, maxHeight: '90vh', overflow: 'auto',
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>
              {editNode ? `Edit Node: ${editNode.name}` : 'New Node Template'}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Name *</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={{ width: '100%' }} placeholder="e.g. Validate Email" />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Type</label>
                <select value={form.node_type} onChange={(e) => setForm((f) => ({ ...f, node_type: e.target.value, color: TYPE_COLOR[e.target.value] || '#3b82f6' }))} style={{ width: '100%' }}>
                  {NODE_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Icon (emoji)</label>
                <input value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))} style={{ width: '100%' }} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Description</label>
                <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} style={{ width: '100%' }} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Default Input Params (JSON)</label>
                <textarea value={form.default_input_params} onChange={(e) => setForm((f) => ({ ...f, default_input_params: e.target.value }))} rows={4} style={{ width: '100%', fontFamily: 'var(--mono)', fontSize: 11, resize: 'vertical' }} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Validation Rules</label>
                <textarea value={form.default_validation} onChange={(e) => setForm((f) => ({ ...f, default_validation: e.target.value }))} rows={3} style={{ width: '100%', fontSize: 11, resize: 'vertical' }} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Process Logic</label>
                <textarea value={form.default_process_logic} onChange={(e) => setForm((f) => ({ ...f, default_process_logic: e.target.value }))} rows={4} style={{ width: '100%', fontSize: 11, resize: 'vertical' }} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Output Template (JSON)</label>
                <textarea value={form.default_output_template} onChange={(e) => setForm((f) => ({ ...f, default_output_template: e.target.value }))} rows={4} style={{ width: '100%', fontFamily: 'var(--mono)', fontSize: 11, resize: 'vertical' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: '9px', background: 'transparent', color: 'var(--text2)', border: '1px solid var(--border2)', borderRadius: 6, fontSize: 12 }}>Cancel</button>
              <button onClick={saveNode} disabled={saving} style={{ flex: 1, padding: '9px', background: '#3b82f6', color: '#fff', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                {saving ? 'Saving...' : (editNode ? 'Save Changes' : 'Create Node')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
