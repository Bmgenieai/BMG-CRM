import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { fmtDate } from '../components/Badges.jsx';

export default function EmailRepliesPage() {
  const [rows, setRows] = useState(null);
  const [counts, setCounts] = useState(null);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState('unread');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [inboundReady, setInboundReady] = useState(null);

  const load = () => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (status === 'unread') params.set('unread', '1');
    const qs = params.toString() ? `?${params}` : '';
    Promise.all([
      api(`/email/replies${qs}`),
      api('/email/replies/counts'),
      api('/email/status').catch(() => null),
    ])
      .then(([list, c, st]) => {
        setRows(list);
        setCounts(c);
        setInboundReady(st?.inboundRepliesEnabled ?? null);
        setError('');
      })
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const openReply = async (row) => {
    try {
      const full = await api(`/email/replies/${row.id}`);
      setSelected(full);
      if (!full.read_at) {
        const updated = await api(`/email/replies/${row.id}/read`, {
          method: 'POST',
          body: { read: true },
        });
        setSelected(updated);
        load();
      }
    } catch {
      setSelected(row);
    }
  };

  const markUnread = async () => {
    if (!selected?.id) return;
    try {
      const updated = await api(`/email/replies/${selected.id}/read`, {
        method: 'POST',
        body: { read: false },
      });
      setSelected(updated);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  if (error) return <div className="card">{error}</div>;
  if (!rows) return <div className="card">Loading email replies…</div>;

  const body =
    selected?.body_markdown || selected?.body_text || selected?.body_html || '';

  return (
    <div>
      <h1 className="page-title">Email replies</h1>
      <p className="page-sub">
        Replies to cold emails sent from CRM (Brevo). Open a row to read the message, then follow up
        from the lead.
      </p>

      {inboundReady === false ? (
        <div className="card" style={{ marginBottom: '1rem', borderColor: 'var(--warn, #c9a227)' }}>
          <p style={{ margin: 0 }}>
            Reply <strong>bodies</strong> need Brevo Inbound Parsing. Set{' '}
            <code>BREVO_REPLY_DOMAIN</code> (e.g. <code>reply.bmgenie.ai</code>), point MX to Brevo,
            and register webhook <code>/api/email/webhooks/brevo-inbound</code>. Until then, this tab
            still lists reply notifications when Brevo fires a reply event (subject only).
          </p>
        </div>
      ) : null}

      <div className="grid grid-3" style={{ marginBottom: '1rem' }}>
        <div className="card">
          <p className="stat-label">Total</p>
          <p className="stat-value">{counts?.total ?? 0}</p>
        </div>
        <div className="card">
          <p className="stat-label">Unread</p>
          <p className="stat-value">{counts?.unread ?? 0}</p>
        </div>
        <div className="card">
          <p className="stat-label">Inbound parsing</p>
          <p className="stat-value" style={{ fontSize: '1.1rem' }}>
            {inboundReady ? 'On' : inboundReady === false ? 'Off' : '—'}
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="input"
            placeholder="Search subject, sender, lead…"
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
            <option value="unread">Unread</option>
            <option value="all">All replies</option>
          </select>
          <button type="button" className="btn btn-primary" onClick={load}>
            Search
          </button>
        </div>
      </div>

      <div className="card">
        {rows.length === 0 ? (
          <p>
            No replies yet. After BD sends cold email, inbound replies appear here. Confirm Brevo
            webhooks point to <code>/api/email/webhooks/brevo</code> (events) and{' '}
            <code>/api/email/webhooks/brevo-inbound</code> (bodies).
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Received</th>
                <th>From</th>
                <th>Lead</th>
                <th>Subject</th>
                <th>Preview</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  style={{ fontWeight: r.read_at ? 400 : 600 }}
                >
                  <td>{fmtDate(r.received_at)}</td>
                  <td>
                    {r.from_name ? `${r.from_name} ` : null}
                    {r.from_email ? (
                      <a href={`mailto:${r.from_email}`} style={{ color: 'var(--brand-primary)' }}>
                        {r.from_email}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{r.lead_name || r.lead_email || '—'}</td>
                  <td style={{ maxWidth: 200 }}>{r.subject || '—'}</td>
                  <td style={{ maxWidth: 280 }}>
                    {r.hasBody ? r.preview || '—' : (
                      <span className="stat-hint">Reply notified (body pending inbound)</span>
                    )}
                  </td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button type="button" className="btn btn-ghost" onClick={() => openReply(r)}>
                      View
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
            style={{ maxWidth: 720, maxHeight: '85vh', overflow: 'auto' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <h3 style={{ margin: 0 }}>{selected.subject || '(no subject)'}</h3>
              <button type="button" className="btn btn-ghost" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
            <p className="stat-hint">
              From {selected.from_name || selected.from_email || 'unknown'}
              {selected.from_email ? ` <${selected.from_email}>` : ''} ·{' '}
              {fmtDate(selected.received_at)}
              {selected.assigned_to_name ? ` · Owner ${selected.assigned_to_name}` : ''}
            </p>
            {selected.lead_id ? (
              <p style={{ marginTop: 8 }}>
                <Link to={`/leads?id=${selected.lead_id}`}>
                  Open lead {selected.lead_name || selected.lead_email || selected.lead_id}
                </Link>
              </p>
            ) : (
              <p className="stat-hint" style={{ marginTop: 8 }}>
                Could not match this reply to a CRM lead automatically.
              </p>
            )}

            <div
              style={{
                marginTop: '1rem',
                padding: '1rem',
                background: 'var(--surface-2, #f6f6f6)',
                borderRadius: 8,
                whiteSpace: 'pre-wrap',
                lineHeight: 1.5,
              }}
            >
              {body ? (
                selected.body_html && !selected.body_markdown && !selected.body_text ? (
                  <div dangerouslySetInnerHTML={{ __html: selected.body_html }} />
                ) : (
                  body
                )
              ) : (
                <span className="stat-hint">
                  No reply body stored yet. Enable Brevo Inbound Parsing so the full message is
                  captured.
                </span>
              )}
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {selected.from_email ? (
                <a className="btn btn-primary" href={`mailto:${selected.from_email}?subject=${encodeURIComponent(selected.subject || 'Re:')}`}>
                  Reply in email client
                </a>
              ) : null}
              {selected.read_at ? (
                <button type="button" className="btn btn-ghost" onClick={markUnread}>
                  Mark unread
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
