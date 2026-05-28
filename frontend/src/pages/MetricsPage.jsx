import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function MetricsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMetrics()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text3)' }}>Loading metrics...</div>;
  }

  const totals = data?.totals || {};
  const errors = data?.error_breakdown || [];
  const topFlows = data?.top_flows || [];
  const timeSeries = data?.exec_time_series || [];

  const metricCards = [
    { label: 'Total Executions', value: totals.total_executions ?? 0, col: '#3b82f6' },
    { label: 'Failed Executions', value: totals.failed_executions ?? 0, col: '#ef4444' },
    { label: 'Avg Execution Time', value: totals.avg_duration_ms ? `${(totals.avg_duration_ms / 1000).toFixed(1)}s` : '—', col: '#10b981' },
    { label: 'Throughput', value: totals.throughput_per_min ? `${totals.throughput_per_min}/min` : '—', col: '#f59e0b' },
  ];

  const maxTime = Math.max(...timeSeries.map((t) => t.avg_ms || 0), 1);

  return (
    <div style={{ padding: 20, overflow: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Metrics</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Pantau metrik performa proses secara detail</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {metricCards.map((m) => (
          <div key={m.label} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>{m.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: m.col }}>{m.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Execution time chart */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Execution Time (avg ms)</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 12 }}>per hour</div>
          {timeSeries.length === 0 ? (
            <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 12 }}>No execution data yet</div>
          ) : (
            <div style={{ height: 160, position: 'relative' }}>
              <svg width="100%" height="160" viewBox="0 0 400 160" preserveAspectRatio="none">
                {[0, 53, 106, 160].map((y) => (
                  <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="#1e2a3a" strokeWidth="0.5" />
                ))}
                <defs>
                  <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {timeSeries.length > 1 && (
                  <>
                    <path
                      d={`M0,${160 - (timeSeries[0].avg_ms / maxTime) * 140} ` +
                        timeSeries.map((t, i) => `L${(i / (timeSeries.length - 1)) * 400},${160 - (t.avg_ms / maxTime) * 140}`).join(' ') +
                        ' L400,160 L0,160 Z'}
                      fill="url(#area-grad)"
                    />
                    <path
                      d={`M0,${160 - (timeSeries[0].avg_ms / maxTime) * 140} ` +
                        timeSeries.map((t, i) => `L${(i / (timeSeries.length - 1)) * 400},${160 - (t.avg_ms / maxTime) * 140}`).join(' ')}
                      fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round"
                    />
                  </>
                )}
              </svg>
            </div>
          )}
        </div>

        {/* Top flows */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Top Flows by Executions</div>
          {topFlows.length === 0 ? (
            <div style={{ color: 'var(--text3)', fontSize: 12 }}>No data yet</div>
          ) : topFlows.map((f) => (
            <div key={f.name} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{f.name}</span>
                <span style={{ fontSize: 12, color: '#3b82f6', fontWeight: 600, fontFamily: 'var(--mono)' }}>{f.execution_count}</span>
              </div>
              <div style={{ height: 6, background: 'var(--bg4)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${f.pct}%`, height: '100%', background: 'linear-gradient(90deg,#1d4ed8,#3b82f6)', borderRadius: 3, transition: 'width 0.6s ease' }} />
              </div>
            </div>
          ))}
        </div>

        {/* Error breakdown */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Error Breakdown</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Node Type','Count','Flow','Last Occurred'].map((h) => (
                  <th key={h} style={{ padding: '5px 8px', textAlign: 'left', color: 'var(--text3)', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {errors.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '16px 8px', textAlign: 'center', color: 'var(--text3)' }}>
                    No errors recorded 🎉
                  </td>
                </tr>
              ) : errors.map((e, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '7px 8px' }}>
                    <span style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600 }}>{e.node_type}</span>
                  </td>
                  <td style={{ padding: '7px 8px', fontFamily: 'var(--mono)', color: '#ef4444' }}>{e.error_count}</td>
                  <td style={{ padding: '7px 8px', color: 'var(--text2)' }}>{e.flow_name}</td>
                  <td style={{ padding: '7px 8px', color: 'var(--text3)' }}>
                    {e.last_occurred ? new Date(e.last_occurred).toLocaleString('id-ID') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* System health (static display) */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>System Health</div>
          {[
            { label: 'Active Flows', value: data?.active_flows ?? 0, max: 50, col: '#10b981', unit: ' flows' },
            { label: 'Simulations (7d)', value: totals.total_executions ?? 0, max: Math.max(totals.total_executions ?? 1, 100), col: '#3b82f6', unit: '' },
            { label: 'Error Rate', value: totals.total_executions > 0 ? Math.round((totals.failed_executions / totals.total_executions) * 100) : 0, max: 100, col: '#ef4444', unit: '%' },
          ].map((h) => (
            <div key={h.label} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--text2)' }}>{h.label}</span>
                <span style={{ fontSize: 12, color: h.col, fontWeight: 600 }}>{h.value}{h.unit}</span>
              </div>
              <div style={{ height: 5, background: 'var(--bg4)', borderRadius: 3 }}>
                <div style={{ width: `${Math.min((h.value / h.max) * 100, 100)}%`, height: '100%', background: h.col, borderRadius: 3, opacity: 0.8 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
