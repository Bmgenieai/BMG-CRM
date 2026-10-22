import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { fmtDate } from '../components/Badges.jsx';

const emptyForm = {
  name: '',
  email: '',
  password: '',
  role: 'telesales',
  phone: '',
};

export default function AdminPage() {
  const { can } = useAuth();
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [revenueAmount, setRevenueAmount] = useState('');
  const [revenueLabel, setRevenueLabel] = useState('Manual revenue entry');
  const [pwUser, setPwUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  if (!can('admin:employees')) return <Navigate to="/" replace />;

  const load = () =>
    api('/users')
      .then(setUsers)
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const create = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api('/users', { method: 'POST', body: form });
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleActive = async (u) => {
    await api(`/users/${u.id}`, {
      method: 'PATCH',
      body: { is_active: !u.is_active },
    });
    load();
  };

  const openSetPassword = (u) => {
    setPwUser(u);
    setNewPassword('');
    setConfirmPassword('');
    setPwError('');
  };

  const closeSetPassword = () => {
    setPwUser(null);
    setNewPassword('');
    setConfirmPassword('');
    setPwError('');
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (!pwUser) return;
    setPwError('');
    if (String(newPassword).length < 8) {
      setPwError('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('Passwords do not match');
      return;
    }
    setPwSaving(true);
    try {
      await api(`/users/${pwUser.id}`, {
        method: 'PATCH',
        body: { password: newPassword },
      });
      closeSetPassword();
    } catch (err) {
      setPwError(err.message);
    } finally {
      setPwSaving(false);
    }
  };

  const recordRevenue = async (e) => {
    e.preventDefault();
    await api('/analytics/revenue', {
      method: 'POST',
      body: { amount: Number(revenueAmount), label: revenueLabel },
    });
    setRevenueAmount('');
    alert('Revenue recorded');
  };

  return (
    <div>
      <h1 className="page-title">Admin controls</h1>
      <p className="page-sub">Create and manage CEO / Manager / BD employees.</p>

      {error ? <div className="login-error">{error}</div> : null}

      <div className="grid grid-2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>New employee</h3>
          <form onSubmit={create}>
            {['name', 'email', 'phone', 'password'].map((k) => (
              <div className="field" key={k}>
                <label className="label">{k}</label>
                <input
                  className="input"
                  type={k === 'password' ? 'password' : 'text'}
                  required={k !== 'phone'}
                  value={form[k]}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                />
              </div>
            ))}
            <div className="field">
              <label className="label">role</label>
              <select
                className="select"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="ceo">CEO</option>
                <option value="manager">Manager (view team performance)</option>
                <option value="telesales">BD</option>
              </select>
            </div>
            <button className="btn btn-primary" type="submit">
              Create employee
            </button>
          </form>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Record revenue</h3>
          <form onSubmit={recordRevenue}>
            <div className="field">
              <label className="label">Amount (USD)</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={revenueAmount}
                onChange={(e) => setRevenueAmount(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label className="label">Label</label>
              <input
                className="input"
                value={revenueLabel}
                onChange={(e) => setRevenueLabel(e.target.value)}
              />
            </div>
            <button className="btn btn-secondary" type="submit">
              Save revenue event
            </button>
          </form>
        </div>
      </div>

      <div className="card table-wrap" style={{ marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Employees</h3>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.role === 'telesales' ? 'BD' : u.role === 'ceo' ? 'CEO' : u.role === 'manager' ? 'Manager' : u.role}</td>
                <td>{u.is_active ? 'Active' : 'Inactive'}</td>
                <td>{fmtDate(u.created_at)}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button type="button" className="btn btn-ghost" onClick={() => openSetPassword(u)}>
                    Set password
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => toggleActive(u)}>
                    {u.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pwUser ? (
        <div className="modal-backdrop" onClick={closeSetPassword} role="presentation">
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="set-password-title"
          >
            <h3 id="set-password-title" style={{ marginTop: 0 }}>
              Set password
            </h3>
            <p className="page-sub" style={{ marginTop: 0 }}>
              {pwUser.name} · {pwUser.email}
            </p>
            <p className="page-sub" style={{ marginTop: 0 }}>
              No current password needed. Share the new password with the employee securely.
            </p>
            <form onSubmit={savePassword}>
              <div className="field">
                <label className="label" htmlFor="admin-new-password">
                  New password
                </label>
                <input
                  id="admin-new-password"
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <div className="field">
                <label className="label" htmlFor="admin-confirm-password">
                  Confirm password
                </label>
                <input
                  id="admin-confirm-password"
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              {pwError ? <div className="login-error">{pwError}</div> : null}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                <button className="btn btn-primary" type="submit" disabled={pwSaving}>
                  {pwSaving ? 'Saving…' : 'Save password'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={closeSetPassword}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
