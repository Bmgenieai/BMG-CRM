import React, { useEffect, useState } from 'react';
import { Phone, Plus, Search, Pencil, Trash2, X } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { CALL_OUTCOMES, formatCallOutcome } from '../lib/callOutcomes.js';

function nowLocalInput() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isoToLocalInput(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function outcomeBadgeClass(key) {
  if (key === 'demo_booked' || key === 'connected_interested') return 'badge badge-green';
  if (key === 'connected_callback' || key === 'busy_callback') return 'badge badge-amber';
  if (key === 'wrong_number' || key === 'connected_not_interested') return 'badge badge-red';
  return 'badge badge-grey';
}

const emptyForm = () => ({
  contact_name: '',
  company: '',
  phone: '',
  call_date: nowLocalInput(),
  call_outcome: 'no_answer',
  follow_up_date: '',
  follow_up_notes: '',
});

export default function ColdCallsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ceo' || user?.role === 'manager';

  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    today: 0,
    connected: 0,
    callbacks: 0,
    interested: 0,
    demosBooked: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [followUpOnly, setFollowUpOnly] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setError('');
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (outcomeFilter) params.set('outcome', outcomeFilter);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (followUpOnly) params.set('followUpOnly', '1');
    api(`/cold-calls?${params.toString()}`)
      .then((d) => {
        setItems(d.items || []);
        setStats(
          d.stats || {
            total: 0,
            today: 0,
            connected: 0,
            callbacks: 0,
            interested: 0,
            demosBooked: 0,
          },
        );
      })
      .catch((e) => setError(e.message || 'Failed to load cold calls'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcomeFilter, dateFrom, dateTo, followUpOnly]);

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm());
    setShowModal(true);
    setError('');
  };

  const openEdit = (row) => {
    setEditId(row.id);
    setForm({
      contact_name: row.contact_name || '',
      company: row.company || '',
      phone: row.phone || '',
      call_date: isoToLocalInput(row.call_date) || nowLocalInput(),
      call_outcome: row.call_outcome || 'no_answer',
      follow_up_date: isoToLocalInput(row.follow_up_date),
      follow_up_notes: row.follow_up_notes || '',
    });
    setShowModal(true);
    setError('');
  };

  const saveRecord = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        contact_name: form.contact_name.trim(),
        company: form.company.trim() || null,
        phone: form.phone.trim(),
        call_date: form.call_date ? new Date(form.call_date).toISOString() : new Date().toISOString(),
        call_outcome: form.call_outcome,
        follow_up_date: form.follow_up_date ? new Date(form.follow_up_date).toISOString() : null,
        follow_up_notes: form.follow_up_notes.trim() || null,
      };
      if (editId) {
        await api(`/cold-calls/${editId}`, { method: 'PATCH', body: payload });
      } else {
        await api('/cold-calls', { method: 'POST', body: payload });
      }
      setShowModal(false);
      setEditId(null);
      load();
    } catch (err) {
      setError(err.message || 'Failed to save cold call');
    } finally {
      setSaving(false);
    }
  };

  const deleteRecord = async (row) => {
    if (!window.confirm(`Delete cold call log for ${row.contact_name}?`)) return;
    setError('');
    try {
      await api(`/cold-calls/${row.id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err.message || 'Failed to delete record');
    }
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 12,
        }}
      >
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>
            Calling Work Session · Cold Calls
          </h1>
          <p className="stat-hint" style={{ margin: 0 }}>
            Personal cold-calling activity log — kept separate from the BD &amp; SDR lead-generation sections.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          <Plus size={16} /> Log Cold Call
        </button>
      </div>

      {error ? <div className="login-error">{error}</div> : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 10,
          marginBottom: 14,
        }}
      >
        {[
          { label: 'Total Calls', value: stats.total },
          { label: 'Today', value: stats.today },
          { label: 'Connected', value: stats.connected },
          { label: 'Follow-ups / Callbacks', value: stats.callbacks },
          { label: 'Interested', value: stats.interested },
          { label: 'Demos Booked', value: stats.demosBooked },
        ].map((card) => (
          <div key={card.label} className="card" style={{ margin: 0, padding: '0.7rem 0.85rem' }}>
            <div className="stat-label" style={{ margin: 0 }}>
              {card.label}
            </div>
            <div className="stat-value" style={{ margin: '4px 0 0', fontSize: '1.35rem' }}>
              {card.value}
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6, flex: '1 1 220px' }}>
            <input
              className="input"
              placeholder="Search contact, company, phone, or notes…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') load();
              }}
            />
            <button type="button" className="btn btn-secondary" onClick={load}>
              <Search size={15} />
            </button>
          </div>
          <select
            className="select"
            value={outcomeFilter}
            onChange={(e) => setOutcomeFilter(e.target.value)}
            style={{ width: 210 }}
          >
            <option value="">All call outcomes</option>
            {CALL_OUTCOMES.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="input"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{ width: 145 }}
            title="Call date from"
          />
          <input
            type="date"
            className="input"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={{ width: 145 }}
            title="Call date to"
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={followUpOnly}
              onChange={(e) => setFollowUpOnly(e.target.checked)}
            />
            Has follow-up
          </label>
          {(q || outcomeFilter || dateFrom || dateTo || followUpOnly) ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setQ('');
                setOutcomeFilter('');
                setDateFrom('');
                setDateTo('');
                setFollowUpOnly(false);
              }}
            >
              Reset
            </button>
          ) : null}
        </div>
      </div>

      <div className="card">
        {loading ? (
          <p className="empty">Loading cold calls…</p>
        ) : !items.length ? (
          <p className="empty">
            No cold call records yet. Click <strong>Log Cold Call</strong> to record your first call.
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Company</th>
                  <th>Phone</th>
                  <th>Call Date</th>
                  <th>Outcome</th>
                  <th>Follow-up</th>
                  <th>Notes</th>
                  {isAdmin ? <th>Caller</th> : null}
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td style={{ fontWeight: 600 }}>{row.contact_name}</td>
                    <td>{row.company || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <a
                        href={`tel:${row.phone}`}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        <Phone size={13} /> {row.phone}
                      </a>
                    </td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                      {fmtDateTime(row.call_date)}
                    </td>
                    <td>
                      <span className={outcomeBadgeClass(row.call_outcome)}>
                        {formatCallOutcome(row.call_outcome)}
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                      {row.follow_up_date ? fmtDateTime(row.follow_up_date) : '—'}
                    </td>
                    <td style={{ maxWidth: 280, fontSize: 13, color: 'var(--text-muted)' }}>
                      {row.follow_up_notes || '—'}
                    </td>
                    {isAdmin ? <td style={{ fontSize: 12 }}>{row.user_name || '—'}</td> : null}
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        title="Edit"
                        onClick={() => openEdit(row)}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        title="Delete"
                        style={{ color: 'var(--danger, #dc2626)' }}
                        onClick={() => deleteRecord(row)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal ? (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="card"
            style={{ width: '100%', maxWidth: 520, margin: 0, maxHeight: '90vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>{editId ? 'Edit Cold Call' : 'Log Cold Call'}</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={saveRecord}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="field">
                  <label className="label">Contact Name *</label>
                  <input
                    className="input"
                    required
                    value={form.contact_name}
                    onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                    placeholder="John Smith"
                  />
                </div>
                <div className="field">
                  <label className="label">Company</label>
                  <input
                    className="input"
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                    placeholder="Acme Media"
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="field">
                  <label className="label">Phone Number *</label>
                  <input
                    className="input"
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
                <div className="field">
                  <label className="label">Call Date &amp; Time *</label>
                  <input
                    type="datetime-local"
                    className="input"
                    required
                    value={form.call_date}
                    onChange={(e) => setForm({ ...form, call_date: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="field">
                  <label className="label">Call Outcome *</label>
                  <select
                    className="select"
                    value={form.call_outcome}
                    onChange={(e) => setForm({ ...form, call_outcome: e.target.value })}
                  >
                    {CALL_OUTCOMES.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label className="label">Follow-up Date (optional)</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={form.follow_up_date}
                    onChange={(e) => setForm({ ...form, follow_up_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="field">
                <label className="label">Follow-up Notes</label>
                <textarea
                  className="textarea"
                  rows={4}
                  value={form.follow_up_notes}
                  onChange={(e) => setForm({ ...form, follow_up_notes: e.target.value })}
                  placeholder="Call summary, next steps, callback details…"
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : editId ? 'Save Changes' : 'Log Call'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
