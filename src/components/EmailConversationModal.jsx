import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { fmtDate, StateBadge } from './Badges.jsx';

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

/**
 * Full email conversation modal — same UX as Email replies inbox.
 * @param {{ conversation: object, onClose: () => void, onChanged?: () => void, hideOpenLead?: boolean }} props
 */
export default function EmailConversationModal({
  conversation,
  onClose,
  onChanged,
  hideOpenLead = false,
}) {
  const { can } = useAuth();
  const canReply = can('leads:update_any') || can('leads:update_own');
  const [selected, setSelected] = useState(conversation);
  const [replyDraft, setReplyDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sendOk, setSendOk] = useState('');

  if (!selected) return null;

  const original = selected.originalMessage || null;
  const crmReplies = selected.crmReplies || [];
  const recipient = selected.from_email || selected.lead_email || null;
  const canReplyNow = canReply && selected.id && selected.lead_id && recipient;

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
      onChanged?.();
    } catch (e) {
      setSendError(e.message || 'Failed to send reply');
    } finally {
      setSending(false);
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
      onChanged?.();
    } catch (e) {
      setSendError(e.message);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="presentation"
      style={{ zIndex: 120 }}
    >
      <div
        className="modal"
        style={{ maxWidth: 760, maxHeight: '85vh', overflow: 'auto' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Email conversation"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <h3 style={{ margin: 0 }}>{selected.subject || 'Conversation'}</h3>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="stat-hint">
          Lead {selected.lead_name || selected.lead_email || '—'}
          {selected.lead_state ? (
            <>
              {' · '}
              <StateBadge state={selected.lead_state} />
            </>
          ) : null}
          {selected.assigned_to_name ? ` · Owner ${selected.assigned_to_name}` : ''}
          {original?.sentByName ? ` · Sent by ${original.sentByName}` : ''}
          {selected.messageCount
            ? ` · ${selected.messageCount} message${selected.messageCount === 1 ? '' : 's'}`
            : null}
        </p>
        {!hideOpenLead && selected.lead_id ? (
          <p style={{ marginTop: 8 }}>
            <Link to={`/leads?id=${selected.lead_id}`}>
              Open lead {selected.lead_name || selected.lead_email || selected.lead_id}
            </Link>
          </p>
        ) : null}

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
                <span className="stat-hint">No outbound email found for this lead yet.</span>
              )}
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

        {canReplyNow ? (
          <div style={{ marginTop: '1.25rem' }}>
            <h4 style={{ margin: '0 0 6px', fontSize: '0.95rem' }}>Reply from CRM</h4>
            <p className="stat-hint" style={{ margin: '0 0 8px' }}>
              Sends from your Brevo mailbox to {recipient}. Their next reply still lands in Email replies.
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
        ) : canReply && selected.lead_id && !selected.id ? (
          <p className="stat-hint" style={{ marginTop: '1rem' }}>
            No inbound reply yet — use <strong>Compose email</strong> for the next outreach. Once they
            reply, you can answer from this conversation.
          </p>
        ) : null}

        <div style={{ marginTop: '1rem', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {selected.id && selected.read_at ? (
            <button type="button" className="btn btn-ghost" onClick={markUnread}>
              Mark unread
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
