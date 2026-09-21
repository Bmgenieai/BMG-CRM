import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { fmtDate } from '../components/Badges.jsx';
import CohortFilter from '../components/CohortFilter.jsx';

export default function ChatsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const cohort = searchParams.get('cohort') || 'all';
  const [rows, setRows] = useState(null);
  const [counts, setCounts] = useState(null);
  const [selected, setSelected] = useState(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const setCohort = (next) => {
    const nextParams = new URLSearchParams(searchParams);
    if (!next || next === 'all') nextParams.delete('cohort');
    else nextParams.set('cohort', next);
    setSearchParams(nextParams, { replace: true });
  };

  const load = () => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (status) params.set('status', status);
    if (cohort && cohort !== 'all') params.set('cohort', cohort);
    const qs = params.toString() ? `?${params}` : '';
    const countQs =
      cohort && cohort !== 'all' ? `?cohort=${encodeURIComponent(cohort)}` : '';
    Promise.all([api(`/chats${qs}`), api(`/chats/counts${countQs}`)])
      .then(([list, c]) => {
        setRows(list);
        setCounts(c);
        setError('');
      })
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cohort, status]);

  const openChat = async (row) => {
    setNotice('');
    setReply('');
    try {
      const full = await api(`/chats/${row.id}`);
      setSelected(full);
    } catch {
      setSelected(row);
    }
  };

  const sendReply = async () => {
    if (!selected?.id || !reply.trim()) return;
    setSending(true);
    setNotice('');
    try {
      const updated = await api(`/chats/${selected.id}/reply`, {
        method: 'POST',
        body: { message: reply.trim() },
      });
      setSelected(updated);
      setReply('');
      setNotice(
        updated.deliveryNote ||
          'Reply saved in CRM. Open Tawk to deliver it to the visitor.',
      );
      load();
    } catch (e) {
      setNotice(e.message || 'Failed to save reply');
    } finally {
      setSending(false);
    }
  };

  if (error) return <div className="card">{error}</div>;
  if (!rows) return <div className="card">Loading chat support…</div>;

  const messages = selected?.combinedMessages?.length
    ? selected.combinedMessages
    : selected?.transcript || [];

  return (
    <div>
      <h1 className="page-title">Chat support</h1>
      <p className="page-sub">
        Homepage Tawk chats for telesales. View queries here, write a reply in CRM, then send the same
        message in Tawk so the visitor sees it (Tawk cannot receive CRM replies automatically).
      </p>

      <div style={{ marginBottom: '1rem' }}>
        <CohortFilter value={cohort} onChange={setCohort} />
      </div>

      <div className="grid grid-3" style={{ marginBottom: '1rem' }}>
        <div className="card">
          <p className="stat-label">Total</p>
          <p className="stat-value">{counts?.total ?? 0}</p>
        </div>
        <div className="card">
          <p className="stat-label">Open</p>
          <p className="stat-value">{counts?.open ?? 0}</p>
        </div>
        <div className="card">
          <p className="stat-label">Today</p>
          <p className="stat-value">{counts?.today ?? 0}</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="input"
            placeholder="Search visitor, email, message…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            style={{ flex: 1, minWidth: 200 }}
          />
          <select
            className="select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
          <button type="button" className="btn btn-primary" onClick={load}>
            Search
          </button>
          <a
            className="btn btn-ghost"
            href="https://dashboard.tawk.to/"
            target="_blank"
            rel="noreferrer"
          >
            Open Tawk dashboard
          </a>
        </div>
      </div>

      <div className="card">
        {rows.length === 0 ? (
          <p>
            No chats for this filter. Confirm Tawk webhooks point to{' '}
            <code>/api/ingest/tawk</code> on crm-api.
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Started</th>
                <th>Visitor</th>
                <th>Email</th>
                <th>Preview</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDate(r.started_at || r.created_at)}</td>
                  <td>{r.visitor_name || r.lead_name || '—'}</td>
                  <td>
                    {r.visitor_email ? (
                      <a href={`mailto:${r.visitor_email}`} style={{ color: 'var(--brand-primary)' }}>
                        {r.visitor_email}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td style={{ maxWidth: 280 }}>{r.preview || '—'}</td>
                  <td>{r.status}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button type="button" className="btn btn-ghost" onClick={() => openChat(r)}>
                      View / reply
                    </button>
                    {r.lead_id ? (
                      <Link className="btn btn-ghost" to={`/leads?id=${r.lead_id}`}>
                        Lead
                      </Link>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected ? (
        <div className="modal-backdrop" onClick={() => setSelected(null)} role="presentation">
          <div
            className="modal"
            style={{ maxWidth: 640, maxHeight: '85vh', overflow: 'auto' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <h3 style={{ margin: 0 }}>{selected.visitor_name || selected.lead_name || 'Chat'}</h3>
              <button type="button" className="btn btn-ghost" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
            <p className="stat-hint">
              {selected.visitor_email || 'No email'} · {selected.status} ·{' '}
              {fmtDate(selected.started_at || selected.created_at)}
            </p>
            <p style={{ marginTop: '0.75rem' }}>{selected.preview}</p>

            {messages.length > 0 ? (
              <div style={{ marginTop: '1rem' }}>
                <h4 style={{ marginBottom: '0.5rem' }}>Conversation</h4>
                <ul style={{ paddingLeft: '1.1rem', margin: 0 }}>
                  {messages.map((m, i) => (
                    <li key={m.id || i} style={{ marginBottom: 6 }}>
                      <strong>{m.n || m.t || (m.fromCrm ? 'CRM agent' : 'msg')}:</strong>{' '}
                      {m.msg || m.message || m.text || JSON.stringify(m)}
                      {m.fromCrm ? (
                        <span className="stat-hint"> · saved in CRM</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="stat-hint" style={{ marginTop: '1rem' }}>
                No transcript yet — reply below once the visitor has messaged, or open Tawk.
              </p>
            )}

            <div style={{ marginTop: '1.25rem' }}>
              <label className="stat-label" htmlFor="crm-chat-reply">
                Reply from CRM
              </label>
              <textarea
                id="crm-chat-reply"
                className="input"
                rows={4}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Type your answer for this visitor…"
                style={{ width: '100%', marginTop: 6 }}
              />
              {notice ? (
                <p className="stat-hint" style={{ marginTop: 8 }}>
                  {notice}
                </p>
              ) : null}
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={sending || !reply.trim()}
                  onClick={sendReply}
                >
                  {sending ? 'Saving…' : 'Save reply in CRM'}
                </button>
                <a
                  className="btn btn-ghost"
                  href={selected.tawkDashboardUrl || 'https://dashboard.tawk.to/'}
                  target="_blank"
                  rel="noreferrer"
                >
                  Send live in Tawk
                </a>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
