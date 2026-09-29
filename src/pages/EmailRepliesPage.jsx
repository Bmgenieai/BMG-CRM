import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { fmtDate } from '../components/Badges.jsx';

function MessageBody({ html, text, markdown, emptyHint }) {
  const body = markdown || text || '';
  if (html && !markdown && !text) {
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  }
  if (body) {
    return <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{body}</div>;
  }
  return <span className="stat-hint">{emptyHint}</span>;
}

function ThreadBlock({ title, meta, children, tone = 'reply' }) {
  const bg = tone === 'sent' ? 'rgba(37, 99, 235, 0.06)' : 'var(--surface-2, #f6f6f6)';
  const border = tone === 'sent' ? '1px solid rgba(37, 99, 235, 0.25)' : '1px solid transparent';
  return (
    <div style={{ marginTop: '1rem' }}>
      <h4 style={{ margin: '0 0 6px', fontSize: '0.95rem' }}>{title}</h4>
      {meta ? <p className="stat-hint" style={{ margin: '0 0 8px' }}>{meta}</p> : null}
      <div style={{ padding: '1rem', background: bg, border, borderRadius: 8 }}>{children}</div>
    </div>
  );
}

export default function EmailRepliesPage() {
  const { user, can } = useAuth();
  const canSeeAll = user?.role === 'ceo' || user?.role === 'manager';
  const canReply = can('leads:update_any') || can('leads:update_own');
  const [rows, setRows] = useState(null);
  const [counts, setCounts] = useState(null);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState('unread');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [inboundReady, setInboundReady] = useState(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sendOk, setSendOk] = useState('');

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
      setReplyDraft('');
      setSendError('');
      setSendOk('');
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

  const sendCrmReply = async () => {
    if (!selected?.id || !replyDraft.trim()) return;
    setSending(true);
    setSendError('');
    setSendOk('');
    try {
      const result = await api(`/email/replies/${selected.id}/reply`, {
        method: 'POST',
        body: { message: replyDraft.trim() },
      });
      setSelected(result.reply);
      setReplyDraft('');
      setSendOk('Reply sent from your Brevo mailbox.');
      load();
    } catch (e) {
      setSendError(e.message || 'Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  if (error) return <div className="card">{error}</div>;
  if (!rows) return <div className="card">Loading email replies…</div>;

  const original = selected?.originalMessage || null;
  const crmReplies = selected?.crmReplies || [];
  const recipient =
    selected?.from_email || selected?.lead_email || null;

  return (
    <div>
      <h1 className="page-title">Email replies</h1>
      <p className="page-sub">
        {canSeeAll
          ? 'All BD cold-email replies. Open a row to see what we sent and what the prospect replied.'
          : 'Replies to your cold emails. Open a row to see what you sent and what they replied.'}
        {canReply ? ' Reply from CRM through your Brevo mailbox.' : ''}
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
            placeholder={canSeeAll ? 'Search subject, sender, lead, BD…' : 'Search subject, sender, lead…'}
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
                {canSeeAll ? <th>BD / sent by</th> : null}
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
                  {canSeeAll ? (
                    <td>{r.sent_by_name || r.assigned_to_name || '—'}</td>
                  ) : null}
                  <td style={{ maxWidth: 200 }}>{r.subject || r.original_subject || '—'}</td>
                  <td style={{ maxWidth: 280 }}>
                    {r.hasBody ? r.preview || '—' : (
                      <span className="stat-hint">Reply notified (body pending inbound)</span>
                    )}
                  </td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button type="button" className="btn btn-ghost" onClick={() => openReply(r)}>
                      View thread
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
            style={{ maxWidth: 760, maxHeight: '85vh', overflow: 'auto' }}
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
              Lead {selected.lead_name || selected.lead_email || '—'}
              {selected.assigned_to_name ? ` · Owner ${selected.assigned_to_name}` : ''}
              {original?.sentByName ? ` · Sent by ${original.sentByName}` : ''}
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

            <ThreadBlock
              title="We sent"
              tone="sent"
              meta={
                original
                  ? [
                      original.subject || '(no subject)',
                      original.sentByName ? `by ${original.sentByName}` : null,
                      original.sentAt ? fmtDate(original.sentAt) : null,
                      original.toEmail ? `to ${original.toEmail}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : null
              }
            >
              {original ? (
                <MessageBody
                  html={original.htmlContent}
                  text={original.textContent}
                  emptyHint="Original email body was not stored (sent before body logging). Subject and sender are still available above."
                />
              ) : (
                <span className="stat-hint">
                  No linked outbound email found for this reply yet.
                </span>
              )}
            </ThreadBlock>

            <ThreadBlock
              title="They replied"
              tone="reply"
              meta={[
                selected.from_name || selected.from_email || 'unknown',
                selected.from_email ? `<${selected.from_email}>` : null,
                fmtDate(selected.received_at),
              ]
                .filter(Boolean)
                .join(' · ')}
            >
              <MessageBody
                html={selected.body_html}
                text={selected.body_text}
                markdown={selected.body_markdown}
                emptyHint="No reply body stored yet. Enable Brevo Inbound Parsing so the full message is captured."
              />
            </ThreadBlock>

            {crmReplies.map((cr, idx) => (
              <ThreadBlock
                key={cr.id}
                title={idx === 0 ? 'We replied from CRM' : 'CRM follow-up'}
                tone="sent"
                meta={[
                  cr.subject || null,
                  cr.sentByName ? `by ${cr.sentByName}` : null,
                  cr.sentAt ? fmtDate(cr.sentAt) : null,
                  cr.toEmail ? `to ${cr.toEmail}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              >
                <MessageBody
                  html={cr.htmlContent}
                  text={cr.textContent}
                  emptyHint="Body not stored for this send."
                />
              </ThreadBlock>
            ))}

            {canReply && selected.lead_id && recipient ? (
              <div style={{ marginTop: '1.25rem' }}>
                <h4 style={{ margin: '0 0 6px', fontSize: '0.95rem' }}>Reply from CRM</h4>
                <p className="stat-hint" style={{ margin: '0 0 8px' }}>
                  Sends from your Brevo mailbox to {recipient}. Their next reply still lands here.
                </p>
                <textarea
                  className="input"
                  rows={5}
                  placeholder="Type your reply…"
                  value={replyDraft}
                  onChange={(e) => setReplyDraft(e.target.value)}
                  disabled={sending}
                  style={{ width: '100%', resize: 'vertical' }}
                />
                {sendError ? (
                  <p style={{ color: 'var(--danger, #b91c1c)', margin: '8px 0 0' }}>{sendError}</p>
                ) : null}
                {sendOk ? (
                  <p style={{ color: 'var(--success, #15803d)', margin: '8px 0 0' }}>{sendOk}</p>
                ) : null}
                <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={sending || !replyDraft.trim()}
                    onClick={sendCrmReply}
                  >
                    {sending ? 'Sending…' : 'Send via Brevo'}
                  </button>
                </div>
              </div>
            ) : null}

            {!canReply ? (
              <p className="stat-hint" style={{ marginTop: '1rem' }}>
                Managers can view threads; BD / CEO can reply from CRM.
              </p>
            ) : null}

            <div style={{ marginTop: '1rem', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {selected.from_email ? (
                <a
                  className="btn btn-ghost"
                  href={`mailto:${selected.from_email}?subject=${encodeURIComponent(
                    selected.subject?.startsWith('Re:') ? selected.subject : `Re: ${selected.subject || ''}`,
                  )}`}
                >
                  Open in email client
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
