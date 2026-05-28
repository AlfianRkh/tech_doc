import { useState } from 'react';
import Badge from '../shared/Badge';

export default function ExecutionLogs({ logs, onViewData }) {
  const [filter, setFilter] = useState('all');

  const filters = ['all', 'success', 'running', 'waiting', 'skipped', 'error'];
  const filtered = filter === 'all' ? logs : logs.filter((l) => l.status === filter);

  return (
    <div style={{
      height: 220, borderTop: '1px solid var(--border)',
      background: 'var(--bg2)', display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      <div style={{
        padding: '8px 16px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
      }}>
        <span style={{ fontWeight: 600, fontSize: 12 }}>Execution Logs</span>
        <span style={{ color: 'var(--text3)', fontSize: 11 }}>{logs.length} entries</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {filters.map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '2px 10px',
              background: filter === f ? 'rgba(59,130,246,0.2)' : 'transparent',
              color: filter === f ? '#3b82f6' : 'var(--text3)',
              border: `1px solid ${filter === f ? 'rgba(59,130,246,0.4)' : 'var(--border)'}`,
              borderRadius: 4, fontSize: 11,
            }}>{f}</button>
          ))}
        </div>
      </div>

      <div style={{ overflow: 'auto', flex: 1 }}>
        {filtered.length === 0 ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', color: 'var(--text3)', fontSize: 12,
          }}>
            {logs.length === 0 ? 'Run a simulation to see logs' : 'No logs match filter'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Time', 'Node', 'Type', 'Status', 'Message', 'Duration', 'Data'].map((h) => (
                  <th key={h} style={{
                    padding: '5px 14px', textAlign: 'left',
                    fontSize: 10, fontWeight: 600, color: 'var(--text3)',
                    whiteSpace: 'nowrap', position: 'sticky', top: 0,
                    background: 'var(--bg2)', zIndex: 1,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((log, i) => (
                <tr key={i}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(59,130,246,0.06)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'}
                >
                  <td style={{ padding: '5px 14px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>{log.time}</td>
                  <td style={{ padding: '5px 14px', fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap' }}>{log.nodeLabel}</td>
                  <td style={{ padding: '5px 14px', fontSize: 10, color: 'var(--text3)' }}>{log.nodeType}</td>
                  <td style={{ padding: '5px 14px' }}><Badge status={log.status} /></td>
                  <td style={{ padding: '5px 14px', fontSize: 11, color: 'var(--text2)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.message}</td>
                  <td style={{ padding: '5px 14px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text3)' }}>
                    {log.duration ? `${log.duration}ms` : '—'}
                  </td>
                  <td style={{ padding: '5px 14px' }}>
                    {log.outputData ? (
                      <button
                        onClick={() => onViewData(log)}
                        style={{
                          padding: '2px 8px', background: 'rgba(59,130,246,0.15)',
                          color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)',
                          borderRadius: 4, fontSize: 10,
                        }}
                      >📄 view</button>
                    ) : <span style={{ color: 'var(--text3)' }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
