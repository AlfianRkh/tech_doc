import { useState, useEffect } from 'react';
import { api } from '../api/client';
import Badge from '../components/shared/Badge';

function StatCard({ label, value, delta, color, unit = '' }) {
  const isPos = String(delta).startsWith('+');
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}{unit}</div>
      {delta && (
        <div style={{ fontSize: 11, color: isPos ? '#10b981' : '#f59e0b', marginTop: 4 }}>
          {delta} vs last week
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDashboard()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text3)' }}>
        Loading dashboard...
      </div>
    );
  }

  const stats = data?.stats || {};
  const weekly = data?.weekly_simulations || [];
  const activity = data?.recent_activity || [];
  const maxWeekly = Math.max(...weekly.map((w) => w.count), 1);

  const statCards = [
    { label: 'Total Flows', value: stats.total_flows ?? 0, delta: null, color: '#3b82f6' },
    { label: 'Total Simulations', value: stats.total_simulations ?? 0, delta: null, color: '#8b5cf6' },
    { label: 'Success Rate', value: stats.success_rate ?? 0, unit: '%', delta: null, color: '#10b981' },
    { label: 'Avg Duration', value: stats.avg_duration_ms ? Math.round(stats.avg_duration_ms / 1000) : 0, unit: 's', delta: null, color: '#f59e0b' },
  ];

  return (
    <div style={{ padding: 20, overflow: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Dashboard Overview</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Ringkasan aktivitas dan performa sistem</div>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        {statCards.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Bar chart */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Simulations Per Day (Last 7 Days)</div>
          {weekly.length === 0 ? (
            <div style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 12 }}>No simulation data yet</div>
          ) : (
            <div style={{ height: 150, display: 'flex', alignItems: 'flex-end', gap: 8, padding: '0 8px' }}>
              {weekly.map((w, i) => {
                const label = new Date(w.day).toLocaleDateString('id-ID', { weekday: 'short' });
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ fontSize: 9, color: 'var(--text3)' }}>{w.count}</div>
                    <div style={{
                      width: '100%', borderRadius: '3px 3px 0 0',
                      background: 'linear-gradient(180deg,#3b82f6,#1d4ed8)',
                      height: `${(w.count / maxWeekly) * 110}px`, minHeight: 4,
                      transition: 'height 0.3s',
                    }} />
                    <div style={{ fontSize: 10, color: 'var(--text3)' }}>{label}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Donut chart */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Success Rate</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <div style={{ position: 'relative', width: 140, height: 140, flexShrink: 0 }}>
              <svg width="140" height="140" viewBox="0 0 140 140">
                <circle cx="70" cy="70" r="56" fill="none" stroke="rgba(239,68,68,0.3)" strokeWidth="12" />
                <circle cx="70" cy="70" r="56" fill="none" stroke="#10b981" strokeWidth="12"
                  strokeDasharray={`${2 * Math.PI * 56 * (stats.success_rate || 0) / 100} ${2 * Math.PI * 56}`}
                  strokeDashoffset={2 * Math.PI * 56 * 0.25}
                  strokeLinecap="round" />
                <text x="70" y="70" textAnchor="middle" dominantBaseline="middle"
                  fill="#10b981" fontSize="18" fontWeight="700" fontFamily="Space Grotesk">
                  {stats.success_rate ?? 0}%
                </text>
              </svg>
            </div>
            <div>
              {[
                { label: 'Success', count: stats.completed_simulations ?? 0, col: '#10b981' },
                { label: 'Failed', count: stats.failed_simulations ?? 0, col: '#ef4444' },
              ].map((item) => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.col }} />
                  <span style={{ fontSize: 12, color: 'var(--text2)' }}>{item.label}</span>
                  <span style={{ fontSize: 12, color: item.col, fontWeight: 600, marginLeft: 'auto', minWidth: 40, textAlign: 'right' }}>{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent activity table */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, gridColumn: '1/-1' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Recent Flow Activity</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Flow','Status','Executions','Success Rate','Last Run'].map((h) => (
                  <th key={h} style={{ padding: '6px 12px', textAlign: 'left', color: 'var(--text3)', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activity.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '20px 12px', textAlign: 'center', color: 'var(--text3)' }}>
                    No activity yet
                  </td>
                </tr>
              ) : activity.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 500 }}>{r.flow_name}</td>
                  <td style={{ padding: '8px 12px' }}><Badge status={r.status} /></td>
                  <td style={{ padding: '8px 12px', fontFamily: 'var(--mono)', color: '#3b82f6' }}>{r.executions}</td>
                  <td style={{ padding: '8px 12px', color: '#10b981', fontWeight: 600 }}>
                    {r.success_rate ? `${r.success_rate}%` : '—'}
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--text3)' }}>
                    {r.last_run ? new Date(r.last_run).toLocaleString('id-ID') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
