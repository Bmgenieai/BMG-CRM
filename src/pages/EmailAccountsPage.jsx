import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

const emptyForm = {
  label: '',
  email: '',
  name: '',
  verified: false,
  is_active: true,
  is_default: false,
  imap_enabled: false,
  imap_host: '',
  imap_port: '993',
  imap_user: '',
  imap_pass: '',
};

export default function EmailAccountsPage() {
  const { can } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!can('email:manage_accounts')) return <Navigate to="/" replace />;

  const load = () =>
    api('/email/accounts')
      .then((d) => setAccounts(d.accounts || []))
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const startEdit = (a) => {
    setEditId(a.id);
    setForm({
      label: a.label || '',
      email: a.email || '',
      name: a.name || '',
      verified: Boolean(a.verified),
      is_active: Boolean(a.is_active),
      is_default: Boolean(a.is_default),
      imap_enabled: Boolean(a.imap_enabled),
      imap_host: a.imap_host || '',
      imap_port: a.imap_port != null ? String(a.imap_port) : '993',
      imap_user: a.imap_user || a.email || '',
      imap_pass: '',
    });
    setError('');
  };

  const cancelEdit = () => {
    setEditId(null);
    setForm(emptyForm);
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = {
        label: form.label,
        email: form.email,
        name: form.name,
        verified: form.verified,
        is_active: form.is_active,
        is_default: form.is_default,
        imap_enabled: form.imap_enabled,
        imap_host: form.imap_host || null,
        imap_port: form.imap_port ? Number(form.imap_port) : null,
        imap_user: form.imap_user || null,
      };
      if (form.imap_pass) body.imap_pass = form.imap_pass;
      if (editId) {
        await api(`/email/accounts/${editId}`, { method: 'PATCH', body });
      } else {
        await api('/email/accounts', { method: 'POST', body });
      }
      cancelEdit();
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (a) => {
    setBusy(true);
    setError('');
    try {
      await api(`/email/accounts/${a.id}`, {
        method: 'PATCH',
        body: { is_active: !a.is_active },
      });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const setDefault = async (a) => {
    setBusy(true);
    setError('');
    try {
      await api(`/email/accounts/${a.id}`, {
        method: 'PATCH',
        body: { is_default: true, is_active: true },
      });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">Email accounts</h1>
      {error ? <div className="login-error">{error}</div> : null}

      <div className="grid grid-2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{editId ? 'Edit account' : 'Add account'}</h3>
          <form onSubmit={save}>
            <div className="field">
              <label className="label">Label</label>
              <input
                className="input"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label className="label">From email</label>
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label className="label">From name</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="field" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={form.verified}
                  onChange={(e) => setForm({ ...form, verified: e.target.checked })}
                />
                Verified in Brevo
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                />
                Active
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={form.is_default}
                  onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                />
                Default sender
              </label>
            </div>

            <h4 style={{ marginBottom: 8 }}>Inbox (IMAP) for replies</h4>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <input
                type="checkbox"
                checked={form.imap_enabled}
                onChange={(e) => setForm({ ...form, imap_enabled: e.target.checked })}
              />
              Poll this inbox for replies
            </label>
            {form.imap_enabled ? (
              <>
                <div className="field">
                  <label className="label">IMAP host</label>
                  <input
                    className="input"
                    value={form.imap_host}
                    onChange={(e) => setForm({ ...form, imap_host: e.target.value })}
                    placeholder="imap.gmail.com"
                  />
                </div>
                <div className="field">
                  <label className="label">IMAP port</label>
                  <input
                    className="input"
                    value={form.imap_port}
                    onChange={(e) => setForm({ ...form, imap_port: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label className="label">IMAP user</label>
                  <input
                    className="input"
                    value={form.imap_user}
                    onChange={(e) => setForm({ ...form, imap_user: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label className="label">
                    IMAP password {editId ? '(leave blank to keep)' : ''}
                  </label>
                  <input
                    className="input"
                    type="password"
                    value={form.imap_pass}
                    onChange={(e) => setForm({ ...form, imap_pass: e.target.value })}
                    autoComplete="new-password"
                  />
                </div>
              </>
            ) : null}

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {editId ? 'Save' : 'Add'}
              </button>
              {editId ? (
                <button type="button" className="btn btn-secondary" onClick={cancelEdit}>
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Accounts</h3>
          {!accounts.length ? (
            <p className="empty">No accounts yet</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Label</th>
                    <th>From</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => (
                    <tr key={a.id}>
                      <td>
                        {a.label}
                        {a.is_default ? ' · default' : ''}
                      </td>
                      <td>
                        {a.name} &lt;{a.email}&gt;
                      </td>
                      <td>
                        {a.is_active ? 'Active' : 'Off'}
                        {a.verified ? ' · verified' : ''}
                        {a.imap_enabled ? ' · IMAP' : ''}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button type="button" className="btn btn-ghost" onClick={() => startEdit(a)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          disabled={busy}
                          onClick={() => toggleActive(a)}
                        >
                          {a.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        {!a.is_default ? (
                          <button
                            type="button"
                            className="btn btn-ghost"
                            disabled={busy}
                            onClick={() => setDefault(a)}
                          >
                            Make default
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
