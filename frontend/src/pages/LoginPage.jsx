import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@techflow.com');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/canvas', { replace: true });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.bg1} />
      <div style={styles.bg2} />
      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logoRow}>
          <div style={styles.logoIcon}>T</div>
          <div>
            <div style={styles.logoTitle}>TechFlow</div>
            <div style={styles.logoSub}>Documentation Platform</div>
          </div>
        </div>

        <h1 style={styles.heading}>Welcome back</h1>
        <p style={styles.subHeading}>Sign in to your workspace</p>

        {error && <div style={styles.errorBox}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>Email Address</label>
          <input
            id="login-email"
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={styles.input}
            placeholder="you@company.com"
          />

          <label style={styles.label}>Password</label>
          <input
            id="login-password"
            type="password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={styles.input}
            placeholder="••••••••"
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
            <Link to="/forgot-password" style={styles.link}>Forgot password?</Link>
          </div>

          <button id="login-submit" type="submit" disabled={loading} style={styles.btn}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={styles.divider}>
          <span style={styles.dividerText}>Don't have an account?</span>
        </div>
        <Link to="/register" style={styles.linkBtn}>Create an account</Link>

        <div style={styles.demoHint}>
          <span style={{ color: 'var(--text3)', fontSize: 11 }}>Demo: </span>
          <span style={{ color: '#10b981', fontSize: 11 }}>admin@techflow.com / admin123</span>
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'var(--bg1)', position: 'relative', overflow: 'hidden',
  },
  bg1: {
    position: 'absolute', top: '-20%', left: '-10%',
    width: 600, height: 600, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  bg2: {
    position: 'absolute', bottom: '-20%', right: '-10%',
    width: 500, height: 500, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  card: {
    width: 420, background: 'var(--bg2)', border: '1px solid var(--border)',
    borderRadius: 16, padding: '40px 36px',
    backdropFilter: 'blur(20px)', position: 'relative', zIndex: 1,
    boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
  },
  logoRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 },
  logoIcon: {
    width: 36, height: 36, borderRadius: 10,
    background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 16, fontWeight: 700, color: '#fff',
  },
  logoTitle: { fontWeight: 700, fontSize: 15, color: '#e8edf4' },
  logoSub: { fontSize: 10, color: 'var(--text3)' },
  heading: { fontSize: 24, fontWeight: 700, color: '#e8edf4', marginBottom: 6 },
  subHeading: { fontSize: 13, color: 'var(--text3)', marginBottom: 28 },
  errorBox: {
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 8, padding: '10px 14px', marginBottom: 16,
    color: '#ef4444', fontSize: 13,
  },
  form: { display: 'flex', flexDirection: 'column' },
  label: { fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 },
  input: {
    background: 'var(--bg3)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '10px 14px', color: 'var(--text1)',
    fontSize: 13, marginBottom: 16, outline: 'none',
    transition: 'border-color 0.15s',
  },
  btn: {
    background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
    border: 'none', borderRadius: 8, padding: '12px',
    color: '#fff', fontSize: 14, fontWeight: 600,
    cursor: 'pointer', width: '100%', transition: 'opacity 0.15s',
  },
  divider: { textAlign: 'center', margin: '20px 0 12px', color: 'var(--text3)', fontSize: 12 },
  dividerText: {},
  link: { fontSize: 12, color: '#3b82f6', textDecoration: 'none' },
  linkBtn: {
    display: 'block', textAlign: 'center', padding: '10px',
    border: '1px solid var(--border)', borderRadius: 8,
    color: 'var(--text2)', fontSize: 13, textDecoration: 'none',
    transition: 'all 0.15s',
  },
  demoHint: { textAlign: 'center', marginTop: 16, padding: '8px', background: 'rgba(16,185,129,0.05)', borderRadius: 6, border: '1px solid rgba(16,185,129,0.15)' },
};
