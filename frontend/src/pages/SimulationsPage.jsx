import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useProject } from '../context/ProjectContext';
import { getApiBaseUrl } from '../config';

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   color: '#6b7280', bg: 'rgba(107,114,128,0.12)', border: 'rgba(107,114,128,0.3)', icon: '⏳' },
  running:   { label: 'Running',   color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.3)',  icon: '◌' },
  completed: { label: 'Completed', color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)', icon: '✅' },
  failed:    { label: 'Failed',    color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)',   icon: '✕' },
};

const NODE_STATUS_CONFIG = {
  waiting: { label: 'Waiting', color: '#6b7280', icon: '○' },
  running: { label: 'Running', color: '#3b82f6', icon: '◌' },
  success: { label: 'Success', color: '#10b981', icon: '●' },
  skipped: { label: 'Skipped', color: '#9ca3af', icon: '⊘' },
  error:   { label: 'Error',   color: '#ef4444', icon: '✕' },
};

const NODE_TYPE_COLOR = {
  Process: '#3b82f6', Validation: '#10b981', Database: '#8b5cf6',
  API: '#f59e0b', Logic: '#06b6d4', Finance: '#ec4899',
  Decision: '#ef4444', Loop: '#f97316', Start: '#10b981', End: '#ef4444',
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 8px', borderRadius: 5, fontSize: 11, fontWeight: 700,
      color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
      textTransform: 'capitalize',
    }}>
      <span className={status === 'running' ? 'animate-spin' : ''} style={{ display: 'inline-block' }}>
        {cfg.icon}
      </span>
      {cfg.label}
    </span>
  );
}

function JsonBlock({ title, data }) {
  const [open, setOpen] = useState(false);
  if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
    return null;
  }
  const jsonStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

  return (
    <div style={{ marginTop: 6, fontSize: 11 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'var(--bg3)', border: '1px solid var(--border)',
          borderRadius: 4, padding: '2px 7px', fontSize: 10, color: 'var(--text2)',
          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
        }}
      >
        <span>{open ? '▾' : '▸'}</span>
        <span>{title}</span>
        <span style={{ color: 'var(--text3)', fontFamily: 'monospace' }}>({jsonStr.length} B)</span>
      </button>
      {open && (
        <pre style={{
          marginTop: 6, padding: 8, background: '#090d16', border: '1px solid var(--border)',
          borderRadius: 6, color: '#38bdf8', fontSize: 11, fontFamily: 'monospace',
          maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        }}>
          {jsonStr}
        </pre>
      )}
    </div>
  );
}

export default function SimulationsPage() {
  const navigate = useNavigate();
  const { activeProject } = useProject();

  const [simulations, setSimulations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null); // { simulation, logs: [] }
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showRunModal, setShowRunModal] = useState(false);

  // Run modal state
  const [flows, setFlows] = useState([]);
  const [selectedFlowId, setSelectedFlowId] = useState('');
  const [inputJson, setInputJson] = useState('{\n  "order_id": "ORD-1001",\n  "amount": 250000,\n  "customer_tier": "VIP"\n}');
  const [jsonError, setJsonError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const eventSourceRef = useRef(null);

  // Load simulations list on mount or active project change
  useEffect(() => {
    loadSimulations();
  }, [activeProject?.id]);

  async function loadSimulations() {
    setLoading(true);
    try {
      const data = await api.getSimulations(activeProject?.id || null);
      setSimulations(data);
      if (data.length > 0 && !selectedId) {
        setSelectedId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load simulations:', err);
    }
    setLoading(false);
  }

  // Load simulation detail when selectedId changes
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    loadDetail(selectedId);
  }, [selectedId]);

  async function loadDetail(id) {
    setDetailLoading(true);
    try {
      const res = await api.getSimulation(id);
      setDetail(res);

      // If running, subscribe to SSE
      if (res.simulation.status === 'running') {
        connectSSE(id);
      } else {
        closeSSE();
      }
    } catch (err) {
      console.error('Failed to load simulation detail:', err);
    }
    setDetailLoading(false);
  }

  function closeSSE() {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }

  function connectSSE(simId) {
    closeSSE();
    const baseUrl = getApiBaseUrl() || 'http://localhost:3001/api';
    const es = new EventSource(`${baseUrl}/simulations/${simId}/stream`);
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        if (event.type === 'node_update') {
          setDetail((prev) => {
            if (!prev || prev.simulation.id !== simId) return prev;
            const logs = [...prev.logs];
            const idx = logs.findIndex((l) => l.flow_node_id === event.nodeId);
            const updatedLog = {
              flow_node_id: event.nodeId,
              node_label: event.label,
              node_type: event.nodeType,
              status: event.status,
              message: event.message,
              input_data: event.inputData,
              output_data: event.outputData,
              duration_ms: event.duration,
            };
            if (idx >= 0) {
              logs[idx] = { ...logs[idx], ...updatedLog };
            } else {
              logs.push(updatedLog);
            }
            return { ...prev, logs };
          });
        } else if (event.type === 'complete') {
          setDetail((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              simulation: {
                ...prev.simulation,
                status: 'completed',
                total_duration_ms: event.totalDuration,
              },
            };
          });
          loadSimulations();
          closeSSE();
        } else if (event.type === 'error') {
          setDetail((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              simulation: { ...prev.simulation, status: 'failed' },
            };
          });
          loadSimulations();
          closeSSE();
        }
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    };

    es.onerror = () => {
      closeSSE();
    };
  }

  useEffect(() => {
    return () => closeSSE();
  }, []);

  // Filtered simulations
  const filteredSimulations = useMemo(() => {
    if (!search.trim()) return simulations;
    const q = search.toLowerCase();
    return simulations.filter((s) =>
      s.flow_name?.toLowerCase().includes(q) ||
      s.project_name?.toLowerCase().includes(q) ||
      String(s.id).includes(q) ||
      s.status?.toLowerCase().includes(q)
    );
  }, [simulations, search]);

  // Open modal & load available flows
  async function openRunModal() {
    setShowRunModal(true);
    setJsonError('');
    try {
      const data = await api.getFlows(activeProject?.id || null);
      setFlows(data);
      if (data.length > 0) {
        setSelectedFlowId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load flows for simulation modal:', err);
    }
  }

  // Submit new simulation
  async function handleStartSimulation() {
    if (!selectedFlowId) return;
    setJsonError('');
    let parsedInput = {};
    if (inputJson.trim()) {
      try {
        parsedInput = JSON.parse(inputJson);
      } catch (err) {
        setJsonError('Invalid JSON format: ' + err.message);
        return;
      }
    }

    setSubmitting(true);
    try {
      const newSim = await api.createSimulation(selectedFlowId, parsedInput);
      setShowRunModal(false);
      await loadSimulations();
      setSelectedId(newSim.id);
    } catch (err) {
      setJsonError(err.message);
    }
    setSubmitting(false);
  }

  // Delete simulation
  async function handleDelete(simId, e) {
    e?.stopPropagation();
    if (!window.confirm(`Delete simulation #${simId}?`)) return;
    try {
      await api.deleteSimulation(simId);
      if (selectedId === simId) {
        setSelectedId(null);
      }
      loadSimulations();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top Bar / Header */}
      <div style={{
        padding: '14px 20px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{
          background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)',
          borderRadius: 6, padding: '4px 10px', fontSize: 12, color: '#3b82f6', fontWeight: 600,
        }}>▷ SIMULATIONS</div>

        <div style={{ fontSize: 12, color: 'var(--text3)' }}>
          Uji jalan flow secara virtual & pantau eksekusi per node real-time
        </div>

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

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search simulations..."
            style={{ width: 220, fontSize: 12 }}
          />

          <button
            onClick={openRunModal}
            style={{
              padding: '7px 14px', background: '#3b82f6', color: '#fff',
              border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span>▷</span> Run New Simulation
          </button>
        </div>
      </div>

      {/* Main Split Layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Panel: Simulations List */}
        <div style={{
          width: 360, minWidth: 320, borderRight: '1px solid var(--border)',
          background: 'var(--bg2)', display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            padding: '10px 14px', borderBottom: '1px solid var(--border)',
            fontSize: 11, fontWeight: 600, color: 'var(--text3)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span>SIMULATION RUNS ({filteredSimulations.length})</span>
            <button
              onClick={loadSimulations}
              style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 12 }}
              title="Refresh"
            >↻</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)', fontSize: 12 }}>
                Loading simulations...
              </div>
            ) : filteredSimulations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>▷</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>No simulations found</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>Run a new simulation to test your flows.</div>
              </div>
            ) : (
              filteredSimulations.map((sim) => {
                const isSelected = sim.id === selectedId;
                const pc = sim.project_color || '#6b7280';
                return (
                  <div
                    key={sim.id}
                    onClick={() => setSelectedId(sim.id)}
                    style={{
                      padding: '12px 14px', borderRadius: 8, marginBottom: 6,
                      background: isSelected ? 'rgba(59,130,246,0.12)' : 'var(--bg1)',
                      border: isSelected ? '1px solid #3b82f6' : '1px solid var(--border)',
                      cursor: 'pointer', transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text1)' }}>
                          #{sim.id}
                        </span>
                        <StatusBadge status={sim.status} />
                      </div>
                      <button
                        onClick={(e) => handleDelete(sim.id, e)}
                        style={{
                          background: 'none', border: 'none', color: 'var(--text3)',
                          cursor: 'pointer', fontSize: 12, padding: '2px 4px',
                        }}
                        title="Delete simulation"
                      >✕</button>
                    </div>

                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)', marginBottom: 4 }}>
                      {sim.flow_name} <span style={{ fontSize: 10, color: '#8b5cf6' }}>{sim.flow_version}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)' }}>
                      {sim.project_name ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          color: pc, fontWeight: 600, fontSize: 10,
                        }}>
                          {sim.project_icon || '📁'} {sim.project_name}
                        </span>
                      ) : (
                        <span>No Project</span>
                      )}

                      <span>
                        {sim.total_duration_ms ? `${(sim.total_duration_ms / 1000).toFixed(2)}s` : '—'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Panel: Detail & Execution Log */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg1)', overflow: 'hidden' }}>
          {!selectedId ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>▷</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text2)' }}>Select a Simulation</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Choose a simulation run from the left panel to inspect execution details.</div>
            </div>
          ) : detailLoading && !detail ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13 }}>
              Loading simulation detail...
            </div>
          ) : detail ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Detail Header */}
              <div style={{
                padding: '16px 20px', borderBottom: '1px solid var(--border)',
                background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyBetween: 'space-between',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text1)' }}>
                      Simulation #{detail.simulation.id}
                    </span>
                    <StatusBadge status={detail.simulation.status} />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: 'var(--text2)' }}>
                    <span>Flow: <strong style={{ color: 'var(--text1)' }}>{detail.simulation.flow_name || `Flow #${detail.simulation.flow_id}`}</strong></span>
                    <span>•</span>
                    <span>Duration: <strong>{detail.simulation.total_duration_ms ? `${(detail.simulation.total_duration_ms / 1000).toFixed(2)}s` : 'In progress...'}</strong></span>
                    <span>•</span>
                    <span>Executed: <strong>{new Date(detail.simulation.created_at).toLocaleString()}</strong></span>
                  </div>
                </div>

                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={() => navigate(`/canvas/${detail.simulation.flow_id}`)}
                    style={{
                      padding: '6px 12px', background: 'rgba(6,182,212,0.12)',
                      border: '1px solid rgba(6,182,212,0.3)', borderRadius: 6,
                      fontSize: 11, fontWeight: 600, color: '#06b6d4', cursor: 'pointer',
                    }}
                  >
                    ↗ Open Canvas
                  </button>
                </div>
              </div>

              {/* Detail Content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                {/* Initial Input Data Card */}
                <div style={{
                  background: 'var(--bg2)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: 14, marginBottom: 20,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>
                    INITIAL INPUT DATA
                  </div>
                  <JsonBlock title="View Input JSON" data={detail.simulation.input_data} />
                </div>

                {/* Execution Timeline */}
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text1)', marginBottom: 12 }}>
                  EXECUTION TIMELINE ({detail.logs.length} Steps)
                </div>

                {detail.logs.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontSize: 12, background: 'var(--bg2)', borderRadius: 8 }}>
                    Waiting for execution steps...
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {detail.logs.map((log, index) => {
                      const nodeColor = NODE_TYPE_COLOR[log.node_type] || '#3b82f6';
                      const nodeStatusCfg = NODE_STATUS_CONFIG[log.status] || NODE_STATUS_CONFIG.waiting;

                      return (
                        <div
                          key={log.id || index}
                          style={{
                            background: 'var(--bg2)', border: '1px solid var(--border)',
                            borderRadius: 10, padding: '12px 16px',
                            borderLeft: `4px solid ${nodeStatusCfg.color}`,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text3)', minWidth: 20 }}>
                                #{index + 1}
                              </span>

                              <span style={{
                                fontSize: 10, fontWeight: 700, color: nodeColor,
                                background: nodeColor + '18', border: `1px solid ${nodeColor}33`,
                                borderRadius: 4, padding: '2px 6px',
                              }}>
                                {log.node_type || 'Node'}
                              </span>

                              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text1)' }}>
                                {log.node_label}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              {log.duration_ms !== null && log.duration_ms !== undefined && (
                                <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'monospace' }}>
                                  {log.duration_ms} ms
                                </span>
                              )}

                              <span style={{
                                fontSize: 11, fontWeight: 700, color: nodeStatusCfg.color,
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                              }}>
                                <span>{nodeStatusCfg.icon}</span>
                                <span style={{ textTransform: 'capitalize' }}>{log.status}</span>
                              </span>
                            </div>
                          </div>

                          {log.message && (
                            <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 6, marginLeft: 30 }}>
                              {log.message}
                            </div>
                          )}

                          {log.error_message && (
                            <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4, marginLeft: 30 }}>
                              ⚠️ {log.error_message}
                            </div>
                          )}

                          {/* Expandable JSON Data */}
                          <div style={{ marginLeft: 30, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                            <JsonBlock title="Input Context" data={log.input_data} />
                            <JsonBlock title="Output Data" data={log.output_data} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Run Simulation Modal */}
      {showRunModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 12, padding: 24, width: 480, maxWidth: '90vw',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text1)', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>▷ Run Simulation</span>
              <button
                onClick={() => setShowRunModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 14 }}
              >✕</button>
            </div>

            {jsonError && (
              <div style={{
                padding: '8px 12px', background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6,
                color: '#ef4444', fontSize: 12, marginBottom: 14,
              }}>
                {jsonError}
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Select Flow *</label>
              <select
                value={selectedFlowId}
                onChange={(e) => setSelectedFlowId(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', fontSize: 12 }}
              >
                {flows.length === 0 ? (
                  <option value="">No flows available</option>
                ) : (
                  flows.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.version || 'v1.0'}) {f.project_name ? `[${f.project_name}]` : ''}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Initial Input Data (JSON)</label>
              <textarea
                rows={6}
                value={inputJson}
                onChange={(e) => setInputJson(e.target.value)}
                style={{
                  width: '100%', padding: '10px', fontSize: 12, fontFamily: 'monospace',
                  background: '#090d16', border: '1px solid var(--border)', borderRadius: 6,
                  color: '#38bdf8', resize: 'vertical',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowRunModal(false)}
                style={{
                  flex: 1, padding: '9px', background: 'transparent',
                  color: 'var(--text2)', border: '1px solid var(--border)',
                  borderRadius: 6, fontSize: 12, cursor: 'pointer',
                }}
              >
                Cancel
              </button>

              <button
                onClick={handleStartSimulation}
                disabled={submitting || !selectedFlowId}
                style={{
                  flex: 1, padding: '9px', background: '#3b82f6',
                  color: '#fff', border: 'none', borderRadius: 6,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  opacity: submitting || !selectedFlowId ? 0.6 : 1,
                }}
              >
                {submitting ? 'Starting...' : '▷ Start Simulation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
