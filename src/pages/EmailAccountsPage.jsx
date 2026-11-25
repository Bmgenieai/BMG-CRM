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
  daily_limit: '50',
  min_delay_seconds: '60',
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

  // Global suppression list state
  const [suppressions, setSuppressions] = useState([]);
  const [suppCounts, setSuppCounts] = useState([]);
  const [suppFilter, setSuppFilter] = useState('');
  const [suppQuery, setSuppQuery] = useState('');
  const [newSuppEmail, setNewSuppEmail] = useState('');
  const [newSuppReason, setNewSuppReason] = useState('manual');
  const [newSuppNotes, setNewSuppNotes] = useState('');
  const [suppBusy, setSuppBusy] = useState(false);

  if (!can('email:manage_accounts')) return <Navigate to="/" replace />;

  const load = () =>
    api('/email/accounts')
      .then((d) => setAccounts(d.accounts || []))
      .catch((e) => setError(e.message));

  const loadSuppressions = (reason = suppFilter, q = suppQuery) => {
    const p = new URLSearchParams();
    if (reason) p.set('reason', reason);
    if (q) p.set('q', q);
    return api(`/email/suppressions?${p.toString()}`)
      .then((d) => {
        setSuppressions(d.rows || []);
        setSuppCounts(d.counts || []);
      })
      .catch(() => {});
  };

  useEffect(() => {
    load();
    loadSuppressions('', '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      daily_limit: String(a.daily_limit ?? 50),
      min_delay_seconds: String(a.min_delay_seconds ?? 60),
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
        daily_limit: Number(form.daily_limit) || 50,
        min_delay_seconds: Math.max(0, Number(form.min_delay_seconds) || 0),
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="field">
                <label className="label">Daily send cap (emails/day)</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={5000}
                  value={form.daily_limit}
                  onChange={(e) => setForm({ ...form, daily_limit: e.target.value })}
                />
              </div>
              <div className="field">
                <label className="label">Min spacing (seconds)</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={3600}
                  value={form.min_delay_seconds}
                  onChange={(e) => setForm({ ...form, min_delay_seconds: e.target.value })}
                />
              </div>
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
                    <th>Daily Cap</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => {
                    const sentToday = Number(a.sent_today || 0);
                    const cap = Number(a.daily_limit || 50);
                    const atCap = sentToday >= cap;
                    return (
                    <tr key={a.id}>
                      <td>
                        {a.label}
                        {a.is_default ? ' · default' : ''}
                      </td>
                      <td>
                        {a.name} &lt;{a.email}&gt;
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <span style={{ fontWeight: 600, color: atCap ? 'var(--danger, #dc2626)' : undefined }}>
                          {sentToday} / {cap}
                        </span>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {a.min_delay_seconds ?? 60}s spacing
                        </div>
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
                  );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Global Suppression List (Hard bounces, spam complaints, unsubscribes, manual) */}
      <div className="card" style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h3 style={{ margin: 0 }}>Global Suppression List</h3>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Hard bounces, spam complaints, and unsubscribes are automatically added here and blocked from all future cold emails.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12 }}>
            {['hard_bounce', 'spam', 'unsubscribed', 'manual'].map((r) => {
              const cnt = suppCounts.find((c) => c.reason === r)?.count || 0;
              return (
                <button
                  key={r}
                  type="button"
                  className={`btn btn-sm ${suppFilter === r ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => {
                    const next = suppFilter === r ? '' : r;
                    setSuppFilter(next);
                    loadSuppressions(next, suppQuery);
                  }}
                >
                  {r.replace('_', ' ')} ({cnt})
                </button>
              );
            })}
          </div>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newSuppEmail.trim()) return;
            setSuppBusy(true);
            setError('');
            try {
              await api('/email/suppressions', {
                method: 'POST',
                body: { email: newSuppEmail.trim(), reason: newSuppReason, notes: newSuppNotes.trim() || null },
              });
              setNewSuppEmail('');
              setNewSuppNotes('');
              await loadSuppressions(suppFilter, suppQuery);
            } catch (err) {
              setError(err.message);
            } finally {
              setSuppBusy(false);
            }
          }}
          style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12, marginBottom: 12 }}
        >
          <input
            className="input"
            type="email"
            placeholder="Block email address…"
            value={newSuppEmail}
            onChange={(e) => setNewSuppEmail(e.target.value)}
            style={{ minWidth: 220, flex: '1 1 220px' }}
          />
          <select
            className="select"
            value={newSuppReason}
            onChange={(e) => setNewSuppReason(e.target.value)}
            style={{ width: 160 }}
          >
            <option value="manual">Manual block</option>
            <option value="unsubscribed">Unsubscribed</option>
            <option value="hard_bounce">Hard bounce</option>
            <option value="spam">Spam complaint</option>
          </select>
          <input
            className="input"
            placeholder="Optional note"
            value={newSuppNotes}
            onChange={(e) => setNewSuppNotes(e.target.value)}
            style={{ minWidth: 160, flex: '1 1 160px' }}
          />
          <button type="submit" className="btn btn-primary" disabled={suppBusy || !newSuppEmail.trim()}>
            Add to suppression list
          </button>
        </form>

        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input
            className="input"
            placeholder="Search suppressed emails…"
            value={suppQuery}
            onChange={(e) => setSuppQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') loadSuppressions(suppFilter, suppQuery);
            }}
            style={{ maxWidth: 300 }}
          />
          <button type="button" className="btn btn-secondary" onClick={() => loadSuppressions(suppFilter, suppQuery)}>
            Search
          </button>
        </div>

        {!suppressions.length ? (
          <p className="empty">No suppressed addresses match this filter.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Reason</th>
                  <th>Source</th>
                  <th>Notes</th>
                  <th>Added</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {suppressions.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 500 }}>{s.email}</td>
                    <td>{String(s.reason || '').replace('_', ' ')}</td>
                    <td>{s.source || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.notes || '—'}</td>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                      {s.updated_at ? new Date(s.updated_at).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={suppBusy}
                        onClick={async () => {
                          if (!window.confirm(`Remove ${s.email} from the suppression list?`)) return;
                          setSuppBusy(true);
                          try {
                            await api(`/email/suppressions/${encodeURIComponent(s.id)}`, { method: 'DELETE' });
                            await loadSuppressions(suppFilter, suppQuery);
                          } catch (err) {
                            setError(err.message);
                          } finally {
                            setSuppBusy(false);
                          }
                        }}
                      >
                        Unblock
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
