const COLOR = {
  SUCCESS: '#10b981', success: '#10b981', completed: '#10b981', active: '#10b981',
  RUNNING: '#3b82f6',  running: '#3b82f6',
  WAITING: '#f59e0b',  waiting: '#f59e0b',  pending: '#f59e0b', draft: '#f59e0b',
  ERROR:   '#ef4444',  error: '#ef4444',   failed: '#ef4444',
  SKIPPED: '#5a7090',  skipped: '#5a7090', archived: '#5a7090',
};

export default function Badge({ status }) {
  const col = COLOR[status] || '#5a7090';
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 4,
      fontSize: 11, fontWeight: 600,
      background: col + '22', color: col, border: `1px solid ${col}44`,
    }}>
      {status?.toUpperCase()}
    </span>
  );
}
