import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ResetPasswordPage() {
  const { resetPassword, loading } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ token: params.get('token') || '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) return setError('Passwords do not match');
    if (form.password.length < 6) return setError('Password must be at least 6 characters');
    try {
      await resetPassword(form.token, form.password);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.bg1} /><div style={styles.bg2} />
      <div style={styles.card}>
        <div style={styles.logoRow}>
          <div style={styles.logoIcon}>T</div>
          <div>
            <div style={styles.logoTitle}>TechFlow</div>
            <div style={styles.logoSub}>Documentation Platform</div>
          </div>
        </div>
        <h1 style={styles.heading}>Reset password</h1>
        <p style={styles.subHeading}>Enter your reset token and new password</p>
        {error && <div style={styles.errorBox}>{error}</div>}
        {success ? (
          <div style={styles.successBox}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🎉</div>
            <div style={{ fontWeight: 600, color: '#10b981' }}>Password reset successfully!</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>Redirecting to login...</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={styles.form}>
            <label style={styles.label}>Reset Token</label>
            <input id="reset-token" type="text" required value={form.token} onChange={set('token')} style={styles.input} placeholder="Paste your reset token here" />
            <label style={styles.label}>New Password</label>
            <input id="reset-password" type="password" required value={form.password} onChange={set('password')} style={styles.input} placeholder="Min 6 characters" />
            <label style={styles.label}>Confirm New Password</label>
            <input id="reset-confirm" type="password" required value={form.confirm} onChange={set('confirm')} style={styles.input} placeholder="Repeat new password" />
            <button id="reset-submit" type="submit" disabled={loading} style={styles.btn}>
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}
        <div style={styles.footer}>
          <Link to="/login" style={styles.link}>← Back to Sign In</Link>
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrapper: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg1)', position: 'relative', overflow: 'hidden' },
  bg1: { position: 'absolute', top: '-20%', left: '-10%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)', pointerEvents: 'none' },
  bg2: { position: 'absolute', bottom: '-20%', right: '-10%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)', pointerEvents: 'none' },
  card: { width: 420, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, padding: '40px 36px', backdropFilter: 'blur(20px)', position: 'relative', zIndex: 1, boxShadow: '0 24px 48px rgba(0,0,0,0.4)' },
  logoRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 },
  logoIcon: { width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#fff' },
  logoTitle: { fontWeight: 700, fontSize: 15, color: '#e8edf4' },
  logoSub: { fontSize: 10, color: 'var(--text3)' },
  heading: { fontSize: 22, fontWeight: 700, color: '#e8edf4', marginBottom: 6 },
  subHeading: { fontSize: 13, color: 'var(--text3)', marginBottom: 24 },
  errorBox: { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#ef4444', fontSize: 13 },
  successBox: { textAlign: 'center', padding: '24px', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, marginBottom: 16 },
  form: { display: 'flex', flexDirection: 'column' },
  label: { fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 },
  input: { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--text1)', fontSize: 13, marginBottom: 14, outline: 'none' },
  btn: { background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', border: 'none', borderRadius: 8, padding: '12px', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%', marginTop: 4 },
  footer: { textAlign: 'center', marginTop: 20, fontSize: 13 },
  link: { color: '#3b82f6', textDecoration: 'none' },
};
