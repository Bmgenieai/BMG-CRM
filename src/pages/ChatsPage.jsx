import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { fmtDate } from '../components/Badges.jsx';
import CohortFilter from '../components/CohortFilter.jsx';

function roleLabel(m) {
  const role = m.role || m.t;
  if (role === 'ai' || m.n === 'AI') return 'AI';
  if (role === 'agent' || m.fromCrm) return m.n || m.agentName || 'Human';
  if (role === 'visitor') return 'Visitor';
  if (role === 'system') return 'System';
  return m.n || m.t || 'msg';
}

function statusPriority(status) {
  if (status === 'waiting_human') return 0;
  if (status === 'human_active') return 1;
  if (status === 'open') return 2;
  return 3;
}

export default function ChatsPage() {
  const { can } = useAuth();
  const canReply = can('leads:update_any') || can('leads:update_own');
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
  const prevWaitingRef = useRef(null);

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
        const sorted = Array.isArray(list)
          ? [...list].sort((a, b) => {
              const p = statusPriority(a.status) - statusPriority(b.status);
              if (p !== 0) return p;
              return String(b.started_at || b.created_at || '').localeCompare(
                String(a.started_at || a.created_at || ''),
              );
            })
          : list;
        setRows(sorted);
        setCounts(c);
        setError('');

        const waiting = Number(c?.waitingHuman || 0);
        const prev = prevWaitingRef.current;
        if (prev != null && waiting > prev) {
          try {
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              new Notification('BMGenie chat — human requested', {
                body: `${waiting} visitor(s) waiting for a reply in Chat support.`,
              });
            }
          } catch {
            /* ignore */
          }
        }
        prevWaitingRef.current = waiting;
      })
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cohort, status]);

  useEffect(() => {
    if (!selected?.id) return undefined;
    const timer = setInterval(() => {
      api(`/chats/${selected.id}`)
        .then((full) => setSelected(full))
        .catch(() => {});
    }, 4000);
    return () => clearInterval(timer);
  }, [selected?.id]);

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
      setNotice(updated.deliveryNote || 'Reply sent.');
      load();
    } catch (e) {
      setNotice(e.message || 'Failed to send reply');
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
        Website AI chats and human handoffs. AI answers first; when a visitor asks for a human,
        reply here and they see it in the same chat on bmgenie.ai.
      </p>

      {Number(counts?.waitingHuman || 0) > 0 ? (
        <div
          className="card"
          style={{
            marginBottom: '1rem',
            border: '2px solid #dc2626',
            background: 'rgba(220,38,38,0.08)',
          }}
        >
          <p style={{ margin: 0, fontWeight: 700, color: '#991b1b' }}>
            {counts.waitingHuman} visitor{counts.waitingHuman === 1 ? '' : 's'} waiting for a human
          </p>
          <p className="stat-hint" style={{ margin: '6px 0 0' }}>
            Open the row with status <strong>waiting_human</strong>, type your reply, click{' '}
            <strong>Send to visitor</strong>. They see it in the same website chat.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: 10 }}
            onClick={() => setStatus('waiting_human')}
          >
            Show needs-human only
          </button>
        </div>
      ) : null}

      <div style={{ marginBottom: '1rem' }}>
        <CohortFilter value={cohort} onChange={setCohort} />
      </div>

      <div className="grid grid-3" style={{ marginBottom: '1rem' }}>
        <div className="card">
          <p className="stat-label">Total</p>
          <p className="stat-value">{counts?.total ?? 0}</p>
        </div>
        <div
          className="card"
          style={
            Number(counts?.waitingHuman || 0) > 0
              ? { border: '2px solid #dc2626', background: 'rgba(220,38,38,0.06)' }
              : undefined
          }
        >
          <p className="stat-label">Needs human</p>
          <p className="stat-value" style={{ color: Number(counts?.waitingHuman || 0) > 0 ? '#dc2626' : undefined }}>
            {counts?.waitingHuman ?? 0}
          </p>
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
            placeholder="Search visitor, email, city, message…"
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
            <option value="open">AI open</option>
            <option value="waiting_human">Needs human</option>
            <option value="human_active">Human active</option>
            <option value="closed">Closed</option>
          </select>
          <button type="button" className="btn btn-primary" onClick={load}>
            Search
          </button>
        </div>
      </div>

      <div className="card">
        {rows.length === 0 ? (
          <p>No chats for this filter yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Started</th>
                <th>Visitor</th>
                <th>Location</th>
                <th>Mode</th>
                <th>Preview</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  style={
                    r.status === 'waiting_human'
                      ? { background: 'rgba(220,38,38,0.08)' }
                      : undefined
                  }
                >
                  <td>{fmtDate(r.started_at || r.created_at)}</td>
                  <td>
                    <div>{r.visitor_name || r.lead_name || '—'}</div>
                    <div className="stat-hint">{r.visitor_email || '—'}</div>
                  </td>
                  <td className="stat-hint">
                    {[r.visitor_city, r.visitor_country].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td>{r.mode === 'human' ? 'Human' : 'AI'}</td>
                  <td style={{ maxWidth: 240 }}>{r.preview || '—'}</td>
                  <td>
                    {r.status === 'waiting_human' ? (
                      <strong style={{ color: '#dc2626' }}>Needs human</strong>
                    ) : (
                      r.status
                    )}
                  </td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className={r.status === 'waiting_human' ? 'btn btn-primary' : 'btn btn-ghost'}
                      onClick={() => openChat(r)}
                    >
                      {r.status === 'waiting_human' ? 'Reply now' : 'Open'}
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
              {selected.visitor_email || 'No email'}
              {selected.visitor_city || selected.visitor_country
                ? ` · ${[selected.visitor_city, selected.visitor_country].filter(Boolean).join(', ')}`
                : ''}
              {' · '}
              {selected.mode === 'human' ? 'Human' : 'AI'} · {selected.status} ·{' '}
              {fmtDate(selected.started_at || selected.created_at)}
            </p>

            {messages.length > 0 ? (
              <div style={{ marginTop: '1rem' }}>
                <h4 style={{ marginBottom: '0.5rem' }}>Conversation</h4>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {messages.map((m, i) => (
                    <li
                      key={m.id || i}
                      style={{
                        marginBottom: 10,
                        padding: '8px 10px',
                        borderRadius: 8,
                        background:
                          m.role === 'agent' || m.fromCrm
                            ? 'rgba(37,99,235,0.08)'
                            : m.role === 'ai'
                              ? 'rgba(16,185,129,0.08)'
                              : 'rgba(0,0,0,0.04)',
                      }}
                    >
                      <strong>{roleLabel(m)}</strong>
                      <span className="stat-hint">
                        {m.at ? ` · ${fmtDate(m.at)}` : ''}
                      </span>
                      <div style={{ marginTop: 4 }}>{m.msg || m.message || m.text || '—'}</div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="stat-hint" style={{ marginTop: '1rem' }}>
                No messages yet.
              </p>
            )}

            <div style={{ marginTop: '1.25rem' }}>
              {canReply ? (
                <>
                  <label className="stat-label" htmlFor="crm-chat-reply">
                    Reply to visitor (same website chat)
                  </label>
                  <textarea
                    id="crm-chat-reply"
                    className="input"
                    rows={4}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Type your answer — visitor sees it live on bmgenie.ai…"
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
                      {sending ? 'Sending…' : 'Send to visitor'}
                    </button>
                  </div>
                </>
              ) : (
                <p className="stat-hint">View only — ask a CEO or BD account to reply.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
