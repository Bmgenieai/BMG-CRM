import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function LoginPage() {
  const { user, login, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('ceo@bmgenie.ai');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div
            className="brand-mark"
            style={{ width: 52, height: 52, margin: '0 auto 0.85rem', fontSize: '1rem' }}
          >
            bm
          </div>
          <h1 style={{ margin: 0, fontSize: '1.55rem', letterSpacing: '-0.03em' }}>
            <span style={{ color: 'var(--brand-primary)' }}>bmgenie</span>.ai CRM
          </h1>
          <p style={{ margin: '0.4rem 0 0', color: 'var(--muted)', fontSize: '0.92rem' }}>
            Sales ops for US & Europe photographer accounts
          </p>
        </div>

        {error ? <div className="login-error">{error}</div> : null}

        <form onSubmit={onSubmit}>
          <div className="field">
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              className="input"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy} type="submit">
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p style={{ marginTop: '1.25rem', fontSize: '0.78rem', color: 'var(--muted)', textAlign: 'center' }}>
          Demo: ceo / manager / sales1 @bmgenie.ai · password123
        </p>
      </div>
    </div>
  );
}
