import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { fmtDate, StateBadge } from '../components/Badges.jsx';

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
  // Default: Campaign replies only — Instantly warm-up lives in its own tab
  const [bucket, setBucket] = useState('campaign');
  const [status, setStatus] = useState('all');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [inboundReady, setInboundReady] = useState(null);
  const [mailboxSync, setMailboxSync] = useState(null);
  const [mailboxBusy, setMailboxBusy] = useState(false);
  const [warmupBusy, setWarmupBusy] = useState(false);
  const [replyDraft, setReplyDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sendOk, setSendOk] = useState('');

  const load = (overrides = {}) => {
    const filter = overrides.status ?? status;
    const kind = overrides.bucket ?? bucket;
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (filter === 'unread') params.set('unread', '1');
    params.set('bucket', kind);
    const qs = `?${params}`;
    Promise.all([
      api(`/email/replies${qs}`),
      api('/email/replies/counts'),
      api('/email/status').catch(() => null),
    ])
      .then(([list, c, st]) => {
        setRows(list);
        setCounts(c);
        setInboundReady(st?.inboundRepliesEnabled ?? null);
        setMailboxSync(st?.senderMailbox || null);
        setError('');
      })
      .catch((e) => setError(e.message));
  };

  const runMailboxSync = async () => {
    setMailboxBusy(true);
    setError('');
    try {
      const result = await api('/email/mailbox-sync', { method: 'POST', body: {} });
      if (result?.error) throw new Error(result.error);
      await load();
      if (result?.ingested) {
        setSendOk(`Mailbox sync: ${result.ingested} new reply(ies) imported`);
      } else {
        setSendOk('Mailbox sync complete — no new matched replies');
      }
    } catch (e) {
      setError(e.message || 'Mailbox sync failed');
    } finally {
      setMailboxBusy(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, bucket]);

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
        // Opening marks as read — switch off Unread filter so the thread stays in the list
        if (status === 'unread') {
          setStatus('all');
        } else {
          load();
        }
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

  const markAsRead = async () => {
    if (!selected?.id) return;
    try {
      const updated = await api(`/email/replies/${selected.id}/read`, {
        method: 'POST',
        body: { read: true },
      });
      setSelected(updated);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const moveThread = async (kind) => {
    if (!selected?.id) return;
    try {
      const updated = await api(`/email/replies/${selected.id}/inbox-kind`, {
        method: 'POST',
        body: { kind },
      });
      setSelected(updated);
      setSendOk(
        kind === 'warmup'
          ? 'Moved to Warm-up emails section.'
          : 'Moved to Campaign replies section.',
      );
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const markAllWarmupRead = async () => {
    setWarmupBusy(true);
    setError('');
    try {
      const result = await api('/email/replies/mark-warmup-read', {
        method: 'POST',
        body: {},
      });
      setSendOk(`Marked ${result?.marked ?? 0} warm-up message(s) as read.`);
      await load();
    } catch (e) {
      setError(e.message || 'Failed to mark warm-up as read');
    } finally {
      setWarmupBusy(false);
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
      const from = result.sender?.email || result.reply?.replySender?.email;
      setSendOk(from ? `Reply sent from ${from}.` : 'Reply sent.');
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
  const replyFrom =
    selected?.replySender?.email ||
    selected?.replySender?.name ||
    null;

  const selectedKind = selected?.inbox_kind || 'warmup';

  return (
    <div>
      <h1 className="page-title">Email replies</h1>
      <p className="page-sub" style={{ marginTop: 0 }}>
        Campaign prospect replies are separate from Instantly warm-up send/receive noise. Default view
        is <strong>Campaign replies</strong>.
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

      <div
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '0.85rem' }}
        role="tablist"
        aria-label="Reply sections"
      >
        {[
          {
            key: 'campaign',
            label: 'Campaign replies',
            count: counts?.campaign ?? 0,
            unread: counts?.campaignUnread ?? 0,
          },
          {
            key: 'warmup',
            label: 'Warm-up emails',
            count: counts?.warmup ?? 0,
            unread: counts?.warmupUnread ?? 0,
          },
          {
            key: 'all',
            label: 'All',
            count: counts?.total ?? 0,
            unread: counts?.unread ?? 0,
          },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={bucket === tab.key}
            className={`btn ${bucket === tab.key ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setBucket(tab.key)}
          >
            {tab.label}
            <span style={{ marginLeft: 6, opacity: 0.85 }}>
              {tab.count}
              {tab.unread ? ` · ${tab.unread} unread` : ''}
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-4" style={{ marginBottom: '1rem' }}>
        <div className="card">
          <p className="stat-label">Campaign replies</p>
          <p className="stat-value">{counts?.campaign ?? 0}</p>
          <p className="stat-hint" style={{ margin: '0.35rem 0 0' }}>
            {counts?.campaignUnread ?? 0} unread
          </p>
        </div>
        <div className="card">
          <p className="stat-label">Warm-up emails</p>
          <p className="stat-value">{counts?.warmup ?? 0}</p>
          <p className="stat-hint" style={{ margin: '0.35rem 0 0' }}>
            Instantly auto send/receive · {counts?.warmupUnread ?? 0} unread
          </p>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ marginTop: 8, fontSize: '0.78rem', padding: '0.25rem 0.6rem' }}
            disabled={warmupBusy || !(counts?.warmupUnread > 0)}
            onClick={markAllWarmupRead}
            title="Mark all Instantly warm-up messages as read"
          >
            {warmupBusy ? 'Marking…' : 'Mark all warm-up as read'}
          </button>
        </div>
        <div className="card">
          <p className="stat-label">Inbound parsing</p>
          <p className="stat-value" style={{ fontSize: '1.1rem' }}>
            {inboundReady ? 'On' : inboundReady === false ? 'Off' : '—'}
          </p>
          <p className="stat-hint" style={{ margin: '0.35rem 0 0', fontSize: '0.72rem' }}>
            reply.bmgenie.ai Reply-To
          </p>
        </div>
        <div className="card">
          <p className="stat-label">From-mailbox sync</p>
          <p className="stat-value" style={{ fontSize: '1.1rem' }}>
            {mailboxSync?.enabled ? 'On' : mailboxSync?.configured === false ? 'Needs setup' : 'Off'}
          </p>
          <p className="stat-hint" style={{ margin: '0.35rem 0 0', fontSize: '0.72rem' }}>
            {mailboxSync?.user || 'magic.retouching@…'}
          </p>
          {canSeeAll ? (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ marginTop: 8, fontSize: '0.78rem', padding: '0.25rem 0.6rem' }}
              disabled={mailboxBusy || !mailboxSync?.enabled}
              onClick={runMailboxSync}
              title={
                mailboxSync?.enabled
                  ? 'Pull new replies from the From mailbox now'
                  : 'Enable SENDER_MAILBOX_SYNC + App Password on the API server'
              }
            >
              {mailboxBusy ? 'Syncing…' : 'Sync now'}
            </button>
          ) : null}
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
            <option value="all">All in this section</option>
          </select>
          <button type="button" className="btn btn-primary" onClick={() => load()}>
            Search
          </button>
        </div>
      </div>

      <div className="card">
        {rows.length === 0 ? (
          <p>
            {status === 'unread' ? (
              <>
                No <strong>unread</strong> messages in this section. Switch to{' '}
                <strong>All in this section</strong> to reopen threads.
              </>
            ) : bucket === 'campaign' ? (
              <>
                No campaign replies yet. Instantly warm-up traffic is under{' '}
                <button type="button" className="table-num-btn" onClick={() => setBucket('warmup')}>
                  Warm-up emails
                </button>
                . After campaigns start sending, prospect replies appear here.
              </>
            ) : bucket === 'warmup' ? (
              <>No warm-up emails in this view right now.</>
            ) : (
              <>
                No replies yet. After BD sends cold email, inbound replies appear here. Confirm Brevo
                webhooks point to <code>/api/email/webhooks/brevo</code> (events) and{' '}
                <code>/api/email/webhooks/brevo-inbound</code> (bodies).
              </>
            )}
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Received</th>
                <th>Section</th>
                <th>From</th>
                <th>Lead</th>
                <th>State</th>
                {canSeeAll ? <th>BD / sent by</th> : null}
                <th>Subject</th>
                <th>Preview</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="clickable-row"
                  style={{ fontWeight: r.read_at ? 400 : 600, cursor: 'pointer' }}
                  onClick={() => openReply(r)}
                  title="Click to open conversation thread"
                >
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.received_at)}</td>
                  <td>
                    {r.inbox_kind === 'campaign' ? (
                      <span className="badge badge-blue" style={{ fontSize: '0.7rem' }}>
                        Campaign
                      </span>
                    ) : (
                      <span className="badge badge-amber" style={{ fontSize: '0.7rem' }}>
                        Warm-up
                      </span>
                    )}
                  </td>
                  <td>
                    {r.from_name ? <span>{r.from_name} </span> : null}
                    {r.from_email ? (
                      <span style={{ color: 'var(--brand-primary)' }}>
                        {r.from_email}
                      </span>
                    ) : (
                      '—'
                    )}
                    {r.thread_count > 1 ? (
                      <span className="badge badge-blue" style={{ marginLeft: 6, fontSize: '0.7rem' }}>
                        {r.thread_count} msgs
                      </span>
                    ) : null}
                  </td>
                  <td>
                    <span style={{ fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {r.lead_name || r.lead_email || '—'}
                      <StateBadge state={r.lead_state} />
                    </span>
                  </td>
                  <td>
                    {r.lead_state ? <StateBadge state={r.lead_state} /> : <span className="stat-hint">—</span>}
                  </td>
                  {canSeeAll ? (
                    <td>{r.sent_by_name || r.assigned_to_name || '—'}</td>
                  ) : null}
                  <td style={{ maxWidth: 220 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.subject || r.original_subject || '—'}
                    </div>
                  </td>
                  <td style={{ maxWidth: 300 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.hasBody ? r.preview || '—' : (
                        <span className="stat-hint">Reply notified (body pending inbound)</span>
                      )}
                    </div>
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

            {selected.thread && selected.thread.length > 0 ? (
              selected.thread.map((msg, idx) => (
                <ThreadBlock
                  key={msg.id || idx}
                  title={
                    msg.direction === 'sent'
                      ? `We sent · ${msg.senderName}`
                      : `They replied · ${msg.senderName}`
                  }
                  tone={msg.direction === 'sent' ? 'sent' : 'reply'}
                  meta={[
                    msg.subject || null,
                    msg.date ? fmtDate(msg.date) : null,
                    msg.toEmail ? `to ${msg.toEmail}` : null,
                    msg.fromEmail ? `from ${msg.fromEmail}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                >
                  <MessageBody
                    html={msg.htmlContent}
                    text={msg.textContent}
                    markdown={msg.markdownContent}
                    emptyHint={
                      msg.direction === 'sent'
                        ? 'Body not stored for this send.'
                        : 'No reply body stored yet. Enable Brevo Inbound Parsing so the full message is captured.'
                    }
                  />
                </ThreadBlock>
              ))
            ) : (
              <>
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
              </>
            )}

            {canReply && selected.lead_id && recipient ? (
              <div style={{ marginTop: '1.25rem' }}>
                <h4 style={{ margin: '0 0 6px', fontSize: '0.95rem' }}>Reply from CRM</h4>
                <p className="stat-hint" style={{ margin: '0 0 8px' }}>
                  Sends as a reply
                  {replyFrom ? (
                    <>
                      {' '}
                      from <strong>{replyFrom}</strong>
                    </>
                  ) : null}{' '}
                  to {recipient} (same mailbox as this thread). Their next reply still lands here.
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
              {selected.read_at ? (
                <button type="button" className="btn btn-ghost" onClick={markUnread}>
                  Mark unread
                </button>
              ) : (
                <button type="button" className="btn btn-secondary" onClick={markAsRead}>
                  Mark as read
                </button>
              )}
              {selectedKind === 'warmup' ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => moveThread('campaign')}
                >
                  Move to Campaign replies
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => moveThread('warmup')}
                >
                  Move to Warm-up
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
