import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ForgotPasswordPage() {
  const { forgotPassword, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);
    try {
      const data = await forgotPassword(email);
      setResult(data);
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
        <h1 style={styles.heading}>Forgot password</h1>
        <p style={styles.subHeading}>Enter your email to get a reset token</p>

        {error && <div style={styles.errorBox}>{error}</div>}

        {result ? (
          <div style={styles.successBox}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>✅</div>
            <div style={{ fontWeight: 600, color: '#10b981', marginBottom: 8 }}>Reset Token Generated</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>{result.message}</div>
            {result.resetToken && (
              <div style={styles.tokenBox}>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Your Reset Token:</div>
                <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#f59e0b', wordBreak: 'break-all' }}>
                  {result.resetToken}
                </div>
              </div>
            )}
            <Link to="/reset-password" style={styles.btn}>Proceed to Reset Password →</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={styles.form}>
            <label style={styles.label}>Email Address</label>
            <input
              id="forgot-email"
              type="email" required
              value={email} onChange={e => setEmail(e.target.value)}
              style={styles.input}
              placeholder="you@company.com"
            />
            <button id="forgot-submit" type="submit" disabled={loading} style={styles.btn}>
              {loading ? 'Generating...' : 'Send Reset Token'}
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
  successBox: { textAlign: 'center', padding: '20px', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, marginBottom: 16 },
  tokenBox: { background: 'var(--bg3)', borderRadius: 6, padding: '10px', marginBottom: 16, textAlign: 'left' },
  form: { display: 'flex', flexDirection: 'column' },
  label: { fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 },
  input: { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--text1)', fontSize: 13, marginBottom: 16, outline: 'none' },
  btn: { display: 'block', background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', border: 'none', borderRadius: 8, padding: '12px', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%', textDecoration: 'none', textAlign: 'center' },
  footer: { textAlign: 'center', marginTop: 20, fontSize: 13 },
  link: { color: '#3b82f6', textDecoration: 'none' },
};
