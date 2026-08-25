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
      <p className="page-sub">Create and manage CEO / Manager / Telesales employees (Ilaan-style admin).</p>

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
                <option value="manager">Manager</option>
                <option value="telesales">Telesales</option>
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
                <td style={{ textTransform: 'capitalize' }}>{u.role}</td>
                <td>{u.is_active ? 'Active' : 'Inactive'}</td>
                <td>{fmtDate(u.created_at)}</td>
                <td>
                  <button type="button" className="btn btn-ghost" onClick={() => toggleActive(u)}>
                    {u.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
