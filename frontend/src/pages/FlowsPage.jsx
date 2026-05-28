import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import Badge from '../components/shared/Badge';

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const FULL_TEMPLATE_EXAMPLE = `Flow: E-Commerce Checkout Process
Description: Flow lengkap untuk proses checkout barang dan kalkulasi diskon otomatis

[Node: Start]
Input: {
    "trigger": { "desc": "trigger action", "type": "string", "value": "user_action", "required": true },
    "channel": { "desc": "channel action", "type": "string", "value": "mobile_app", "required": true }
}
Output: { "status": "started", "session_id": "123" }

[Node: Validate Cart]
Input: {
    "user_id": { "desc": "id user", "type": "integer", "value": 123, "required": true },
    "cart_items": { "desc": "item yang dibeli", "type": "array", "value": "[{\\"id\\": 1,\\"qty\\": 2}]", "required": true }
}
Validation: user_id must exist in database, cart must not be empty
Logic: 1. Fetch user cart from DB\\n2. Check stock availability for each item
Output: { "cart_valid": true, "total_price": 50000 }

[Node: Apply Promo]
Input: {
    "total_price": { "desc": "total tagihan", "type": "numeric", "value": 50000, "required": true },
    "promo_code": { "desc": "kode promo", "type": "string", "value": "DISC10", "required": false }
}
Validation: promo_code must be valid and not expired
Logic: 1. Query promo code rules\\n2. Calculate discount\\n3. Return final price
Output: { "discount": 5000, "final_price": 45000 }

[Node: End]
Output: { "status": "completed" }

Connections:
Start -> Validate Cart -> Apply Promo -> End`;

const LOOP_TEMPLATE_EXAMPLE = `Flow: Loop Simulation Flow
Description: Flow untuk simulasi perulangan item menggunakan Loop Node

[Node: Start]
Output: {
  "items": [
    { "sku": "SKU-001", "name": "Item A", "qty": 2, "price": 10000 },
    { "sku": "SKU-002", "name": "Item B", "qty": 1, "price": 25000 },
    { "sku": "SKU-003", "name": "Item C", "qty": 3, "price": 5000 }
  ]
}

[Node: Item Loop]
Input: {
  "loop_over": { "desc": "Context array to loop over", "type": "string", "value": "items", "required": true },
  "item_var": { "desc": "Variable name for single item", "type": "string", "value": "item", "required": true }
}
Output: {
  "loop_completed": true
}

[Node: Process Item]
Input: {
  "item": { "desc": "Current loop item", "type": "object", "value": "{}", "required": true }
}
Output: {
  "item_processed": true
}

[Node: Summarize Order]
Input: {
  "loop_completed": { "desc": "Loop status", "type": "boolean", "value": true, "required": true }
}
Output: {
  "total_price": 60000,
  "status": "Ready"
}

[Node: End]
Output: {
  "status": "completed"
}

Connections:
Start -> Item Loop
Item Loop --body--> Process Item
Item Loop --next--> Summarize Order
Summarize Order -> End`;

export default function FlowsPage() {
  const [flows, setFlows] = useState([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [creating, setCreating] = useState(false);
  const [showTextForm, setShowTextForm] = useState(false);
  const [textPrompt, setTextPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => { loadFlows(); }, []);

  async function loadFlows() {
    setLoading(true);
    try {
      setFlows(await api.getFlows());
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  const filtered = flows.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    (f.description || '').toLowerCase().includes(search.toLowerCase())
  );

  async function createFlow() {
    if (!form.name.trim()) return alert('Name is required');
    setCreating(true);
    try {
      await api.createFlow(form);
      await loadFlows();
      setShowForm(false);
      setForm({ name: '', description: '' });
    } catch (err) {
      alert('Create failed: ' + err.message);
    }
    setCreating(false);
  }

  async function generateTextFlow() {
    if (!textPrompt.trim()) return alert('Text prompt is required');
    setGenerating(true);
    try {
      const res = await api.generateFlowByText(textPrompt);
      await loadFlows();
      setShowTextForm(false);
      setTextPrompt('');
      navigate(`/canvas/${res.id}`);
    } catch (err) {
      alert('Generate failed: ' + err.message);
    }
    setGenerating(false);
  }

  async function deleteFlow(id) {
    if (!confirm('Delete this flow and all its nodes/simulations?')) return;
    try {
      await api.deleteFlow(id);
      setFlows((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{
          background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)',
          borderRadius: 6, padding: '4px 10px', fontSize: 12, color: '#06b6d4',
        }}>∿ FLOWS</div>
        <div style={{ color: 'var(--text3)', fontSize: 12 }}>Kelola semua flow proses bisnis</div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search flows..."
          style={{ marginLeft: 'auto', width: 200 }}
        />
        <button onClick={() => setShowTextForm(true)} style={{
          padding: '7px 14px', background: '#10b981', color: '#fff',
          borderRadius: 6, fontSize: 12, fontWeight: 600,
        }}>✨ Generate by Text</button>
        <button onClick={() => setShowForm(true)} style={{
          padding: '7px 14px', background: '#3b82f6', color: '#fff',
          borderRadius: 6, fontSize: 12, fontWeight: 600,
        }}>+ New Flow</button>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Loading...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg2)', zIndex: 1 }}>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Name','Description','Nodes','Simulations','Version','Updated','Status','Actions'].map((h) => (
                  <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text3)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((flow, i) => (
                <tr key={flow.id}
                  style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)', cursor: 'pointer' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(59,130,246,0.04)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'}
                  onClick={() => navigate(`/canvas/${flow.id}`)}
                >
                  <td style={{ padding: '12px 20px' }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{flow.name}</div>
                  </td>
                  <td style={{ padding: '12px 20px', color: 'var(--text2)', fontSize: 12, maxWidth: 240 }}>
                    {flow.description || <span style={{ color: 'var(--text3)' }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 20px', fontFamily: 'var(--mono)', fontSize: 12, color: '#3b82f6' }}>
                    {flow.node_count ?? '—'}
                  </td>
                  <td style={{ padding: '12px 20px', fontFamily: 'var(--mono)', fontSize: 12, color: '#8b5cf6' }}>
                    {flow.sim_count ?? 0}
                  </td>
                  <td style={{ padding: '12px 20px' }}>
                    <span style={{
                      padding: '2px 8px', background: 'rgba(139,92,246,0.15)',
                      color: '#8b5cf6', borderRadius: 4, fontSize: 11,
                      border: '1px solid rgba(139,92,246,0.3)',
                    }}>{flow.version}</span>
                  </td>
                  <td style={{ padding: '12px 20px', color: 'var(--text3)', fontSize: 12 }}>
                    {timeAgo(flow.updated_at)}
                  </td>
                  <td style={{ padding: '12px 20px' }}><Badge status={flow.status} /></td>
                  <td style={{ padding: '12px 20px' }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => navigate(`/canvas/${flow.id}`)}
                        title="Open Canvas"
                        style={{
                          width: 28, height: 28, background: 'rgba(16,185,129,0.1)',
                          color: '#10b981', border: '1px solid rgba(16,185,129,0.2)',
                          borderRadius: 4, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>▶</button>
                      <button
                        onClick={() => deleteFlow(flow.id)}
                        title="Delete"
                        style={{
                          width: 28, height: 28, background: 'rgba(239,68,68,0.08)',
                          color: '#ef4444', border: '1px solid rgba(239,68,68,0.15)',
                          borderRadius: 4, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>×</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
                    {flows.length === 0 ? 'No flows yet. Create your first flow!' : 'No flows match search'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Create modal */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
        }}>
          <div style={{
            background: 'var(--bg2)', border: '1px solid var(--border2)',
            borderRadius: 12, padding: 24, width: 440,
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>New Flow</div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Flow Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                style={{ width: '100%' }}
                placeholder="e.g. Order Processing Flow"
                autoFocus
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Description</label>
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                style={{ width: '100%' }}
                placeholder="What does this flow do?"
              />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 16 }}>
              A Start and End node will be automatically created.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: '9px', background: 'transparent', color: 'var(--text2)', border: '1px solid var(--border2)', borderRadius: 6, fontSize: 12 }}>Cancel</button>
              <button onClick={createFlow} disabled={creating} style={{ flex: 1, padding: '9px', background: '#3b82f6', color: '#fff', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                {creating ? 'Creating...' : 'Create Flow'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate via Text Modal */}
      {showTextForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200,
        }}>
          <div style={{
            background: 'var(--bg2)', border: '1px solid var(--border2)',
            borderRadius: 12, padding: 24, width: 600,
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>Generate Flow by Text</div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8, gap: 12 }}>
                <label style={{ fontSize: 11, color: 'var(--text3)', flex: 1 }}>
                  Masukkan format teks. Gunakan "{"->"}" untuk menyambungkan antar node.
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button 
                    onClick={() => setTextPrompt(FULL_TEMPLATE_EXAMPLE)}
                    style={{ 
                      padding: '4px 8px', background: 'rgba(59, 130, 246, 0.1)', 
                      color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)', 
                      borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: 'pointer'
                    }}
                  >
                    Load E-Commerce
                  </button>
                  <button 
                    onClick={() => setTextPrompt(LOOP_TEMPLATE_EXAMPLE)}
                    style={{ 
                      padding: '4px 8px', background: 'rgba(249, 115, 22, 0.1)', 
                      color: '#f97316', border: '1px solid rgba(249, 115, 22, 0.2)', 
                      borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: 'pointer'
                    }}
                  >
                    Load Loop Example
                  </button>
                </div>
              </div>
              <textarea
                value={textPrompt}
                onChange={(e) => setTextPrompt(e.target.value)}
                style={{
                  width: '100%', height: 180, padding: 12, borderRadius: 6,
                  border: '1px solid var(--border2)', background: 'var(--bg1)',
                  color: 'var(--text1)', fontFamily: 'var(--mono)', fontSize: 13,
                  resize: 'vertical'
                }}
                placeholder={`Flow: Order Processing Flow\nDescription: Automasi Order\n\ncheck_stock -> validate_item -> create_order`}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button onClick={() => setShowTextForm(false)} style={{ flex: 1, padding: '9px', background: 'transparent', color: 'var(--text2)', border: '1px solid var(--border2)', borderRadius: 6, fontSize: 12 }}>Cancel</button>
              <button onClick={generateTextFlow} disabled={generating} style={{ flex: 1, padding: '9px', background: '#10b981', color: '#fff', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                {generating ? 'Generating...' : 'Generate Flow'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
