import { useState, useEffect } from 'react';
import Badge from '../shared/Badge';
import { api } from '../../api/client';

const TYPE_COLOR = {
  Process: '#3b82f6', Validation: '#10b981', Database: '#8b5cf6',
  API: '#f59e0b', Logic: '#06b6d4', Finance: '#ec4899',
  Decision: '#ef4444', Start: '#10b981', End: '#ef4444', Custom: '#f97316', Loop: '#f97316',
};

const TABS = ['Input', 'Validation', 'Process', 'Output', 'Logs', 'Config'];

export default function NodeInspector({ node, flowId, execLogs, onNodeUpdated }) {
  const [tab, setTab] = useState('Input');
  const [config, setConfig] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (node) {
      setConfig({
        label: node.label,
        node_type: node.node_type,
        icon: node.icon,
        input_params: JSON.stringify(node.input_params || {}, null, 2),
        validation_rules: node.validation_rules || '',
        process_logic: node.process_logic || '',
        output_template: JSON.stringify(node.output_template || {}, null, 2),
        condition_expression: node.condition_expression || '',
      });
    }
  }, [node?.id]);

  if (!node) {
    return (
      <div style={{
        width: 320, background: 'var(--bg2)', borderLeft: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text3)', fontSize: 12, flexShrink: 0,
      }}>
        Select a node to inspect
      </div>
    );
  }

  const typeCol = TYPE_COLOR[node.node_type] || '#3b82f6';
  const inputParams = node.input_params || {};
  const outputData = node.outputData;
  const inputData = node.inputData;
  const nodeLogs = execLogs.filter((l) => l.nodeId === node.id);

  async function saveConfig() {
    setSaving(true);
    try {
      let parsed = {};
      try { parsed = JSON.parse(config.input_params); } catch {}
      let outParsed = {};
      try { outParsed = JSON.parse(config.output_template); } catch {}

      await api.updateFlowNode(flowId, node.id, {
        label: config.label,
        node_type: config.node_type,
        icon: config.icon,
        input_params: parsed,
        validation_rules: config.validation_rules,
        process_logic: config.process_logic,
        output_template: outParsed,
        condition_expression: config.condition_expression || null,
      });
      onNodeUpdated();
    } catch (err) {
      alert('Save failed: ' + err.message);
    }
    setSaving(false);
  }

  return (
    <div style={{
      width: 320, background: 'var(--bg2)', borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: `${typeCol}22`, border: `1px solid ${typeCol}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
        }}>{node.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {node.label}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>
            ID: {node.id} · <span style={{ color: typeCol }}>{node.node_type}</span>
          </div>
        </div>
        <Badge status={node.status || 'waiting'} />
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', borderBottom: '1px solid var(--border)',
        padding: '0 4px', overflow: 'auto', flexShrink: 0,
      }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 8px', fontSize: 11, background: 'transparent',
            color: tab === t ? '#3b82f6' : 'var(--text3)',
            borderBottom: tab === t ? '2px solid #3b82f6' : '2px solid transparent',
            fontWeight: tab === t ? 600 : 400, whiteSpace: 'nowrap',
          }}>{t}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 14 }}>

        {tab === 'Input' && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 10, letterSpacing: '0.06em' }}>
              INPUT PARAMETERS
            </div>
            {Object.keys(inputParams).length === 0 ? (
              <div style={{ color: 'var(--text3)', fontSize: 12 }}>No input parameters defined</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr>
                    {['Name', 'Type', 'Req', 'Value'].map((h) => (
                      <th key={h} style={{
                        padding: '4px 8px', textAlign: 'left', color: 'var(--text3)',
                        fontWeight: 500, borderBottom: '1px solid var(--border)',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(inputParams).map(([name, p]) => (
                    <tr key={name} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '5px 8px', fontWeight: 600 }}>{name}</td>
                      <td style={{ padding: '5px 8px', color: '#f59e0b', fontFamily: 'var(--mono)' }}>{p.type}</td>
                      <td style={{ padding: '5px 8px' }}>
                        {p.required
                          ? <span style={{ color: '#10b981' }}>✓</span>
                          : <span style={{ color: '#f59e0b' }}>○</span>}
                      </td>
                      <td style={{ padding: '5px 8px', fontFamily: 'var(--mono)', color: '#06b6d4', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.value !== undefined ? String(p.value) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div style={{ marginTop: 16, fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 8, letterSpacing: '0.06em' }}>
              DATA PREVIEW
            </div>
            <pre style={{
              background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6,
              padding: 10, fontSize: 11, fontFamily: 'var(--mono)', color: '#10b981',
              overflow: 'auto', lineHeight: 1.6, maxHeight: 200,
            }}>
              {JSON.stringify(inputData || outputData || Object.fromEntries(
                Object.entries(inputParams).map(([k, v]) => [k, v.value])
              ), null, 2)}
            </pre>
          </>
        )}

        {tab === 'Validation' && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 10 }}>
              VALIDATION RULES
            </div>
            {node.validation_rules ? (
              <pre style={{
                background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6,
                padding: 10, fontSize: 11, fontFamily: 'var(--mono)',
                color: 'var(--text2)', lineHeight: 1.8,
              }}>{node.validation_rules}</pre>
            ) : (
              <div style={{ color: 'var(--text3)', fontSize: 12 }}>No validation rules defined</div>
            )}
            {node.node_type === 'Decision' && node.condition_expression && (
              <>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', margin: '14px 0 8px', letterSpacing: '0.06em' }}>
                  CONDITION EXPRESSION
                </div>
                <pre style={{
                  background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6,
                  padding: 10, fontSize: 12, fontFamily: 'var(--mono)', color: '#f59e0b', lineHeight: 1.6,
                }}>{node.condition_expression}</pre>
              </>
            )}
          </>
        )}

        {tab === 'Process' && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 10 }}>
              PROCESS LOGIC
            </div>
            {node.process_logic ? (
              <pre style={{
                background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6,
                padding: 10, fontSize: 11, fontFamily: 'var(--mono)', color: '#06b6d4', lineHeight: 1.8,
              }}>{node.process_logic}</pre>
            ) : (
              <div style={{ color: 'var(--text3)', fontSize: 12 }}>No process logic defined</div>
            )}
          </>
        )}

        {tab === 'Output' && (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 10 }}>
              OUTPUT DATA
            </div>
            {outputData ? (
              <pre style={{
                background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6,
                padding: 10, fontSize: 11, fontFamily: 'var(--mono)', color: '#10b981', lineHeight: 1.6,
              }}>{JSON.stringify(outputData, null, 2)}</pre>
            ) : node.output_template && Object.keys(node.output_template).length > 0 ? (
              <>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 6 }}>Template (sample output)</div>
                <pre style={{
                  background: 'var(--bg3)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 6,
                  padding: 10, fontSize: 11, fontFamily: 'var(--mono)', color: '#f59e0b', lineHeight: 1.6,
                }}>{JSON.stringify(node.output_template, null, 2)}</pre>
              </>
            ) : (
              <div style={{ color: 'var(--text3)', fontSize: 12 }}>Output not yet available</div>
            )}
          </>
        )}

        {tab === 'Logs' && (
          <div>
            {nodeLogs.length === 0 ? (
              <div style={{ color: 'var(--text3)', fontSize: 12 }}>No logs for this node yet</div>
            ) : nodeLogs.map((log, i) => (
              <div key={i} style={{
                padding: 8, background: 'var(--bg3)', borderRadius: 6,
                border: '1px solid var(--border)', marginBottom: 6,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)' }}>{log.time}</span>
                  <Badge status={log.status} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text2)' }}>{log.message}</div>
                {log.duration && (
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>Duration: {log.duration}ms</div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'Config' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              ['label', 'Node Label', 'text'],
              ['icon', 'Icon (emoji)', 'text'],
            ].map(([key, label]) => (
              <div key={key}>
                <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>{label}</label>
                <input
                  value={config[key] || ''}
                  onChange={(e) => setConfig((c) => ({ ...c, [key]: e.target.value }))}
                  style={{ width: '100%' }}
                />
              </div>
            ))}

            <div>
              <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Node Type</label>
              <select
                value={config.node_type || 'Process'}
                onChange={(e) => setConfig((c) => ({ ...c, node_type: e.target.value }))}
                style={{ width: '100%' }}
              >
                {['Process','Validation','Database','API','Logic','Finance','Decision','Custom','Start','End','Loop'].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>

            {config.node_type === 'Decision' && (
              <div>
                <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>
                  Condition Expression
                </label>
                <input
                  value={config.condition_expression || ''}
                  onChange={(e) => setConfig((c) => ({ ...c, condition_expression: e.target.value }))}
                  placeholder="e.g. auth === true"
                  style={{ width: '100%', fontFamily: 'var(--mono)', fontSize: 11 }}
                />
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>
                  JS expression evaluated against accumulated context. Use variable names from previous node outputs.
                </div>
              </div>
            )}

            <div>
              <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>
                Input Params (JSON)
              </label>
              <textarea
                value={config.input_params || '{}'}
                onChange={(e) => setConfig((c) => ({ ...c, input_params: e.target.value }))}
                rows={5}
                style={{ width: '100%', fontFamily: 'var(--mono)', fontSize: 10, resize: 'vertical' }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>
                Validation Rules
              </label>
              <textarea
                value={config.validation_rules || ''}
                onChange={(e) => setConfig((c) => ({ ...c, validation_rules: e.target.value }))}
                rows={3}
                style={{ width: '100%', fontSize: 11, resize: 'vertical' }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>
                Process Logic
              </label>
              <textarea
                value={config.process_logic || ''}
                onChange={(e) => setConfig((c) => ({ ...c, process_logic: e.target.value }))}
                rows={4}
                style={{ width: '100%', fontSize: 11, resize: 'vertical' }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>
                Output Template (JSON)
              </label>
              <textarea
                value={config.output_template || '{}'}
                onChange={(e) => setConfig((c) => ({ ...c, output_template: e.target.value }))}
                rows={4}
                style={{ width: '100%', fontFamily: 'var(--mono)', fontSize: 10, resize: 'vertical' }}
              />
            </div>

            <button
              onClick={saveConfig}
              disabled={saving}
              style={{
                padding: '8px', background: saving ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.2)',
                color: '#3b82f6', border: '1px solid rgba(59,130,246,0.4)',
                borderRadius: 6, fontSize: 12, fontWeight: 600,
              }}
            >
              {saving ? 'Saving...' : 'Save Config'}
            </button>
          </div>
        )}
      </div>

      {/* Simulation navigation */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: 'var(--text3)' }}>Speed</span>
          <input type="range" min={0.5} max={3} step={0.5} defaultValue={1}
            style={{ flex: 1, height: 3 }} />
          <span style={{ fontSize: 10, color: 'var(--text3)' }}>1×</span>
        </div>
      </div>
    </div>
  );
}
