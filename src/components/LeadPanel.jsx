import React, { useEffect, useState } from 'react';
import { Phone, MessageSquare, CalendarPlus, X, Mail } from 'lucide-react';
import { api } from '../api.js';
import { fmtDate, money, SourceBadge, StatusBadge } from './Badges.jsx';

const STATUSES = [
  { key: 'qualified', label: 'Qualified' },
  { key: 'conversation', label: 'Conversation' },
  { key: 'demo_booked', label: 'Demo booked' },
  { key: 'trial', label: 'Trial' },
  { key: 'paid', label: 'Paid' },
  { key: 'lost', label: 'Lost' },
];

const LOST_REASONS = [
  'No response',
  'Not interested',
  'Budget / price',
  'Competitor',
  'Timing / not ready',
  'Wrong fit',
  'Unqualified',
  'Other',
];

const ACTIVITY_TYPES = [
  { value: 'call', label: 'Phone call' },
  { value: 'email', label: 'Email' },
  { value: 'linkedin', label: 'LinkedIn touch' },
  { value: 'reply', label: 'Reply' },
  { value: 'demo_shown', label: 'Demo shown' },
  { value: 'note', label: 'Comment / note' },
  { value: 'whatsapp', label: 'WhatsApp / SMS' },
];

const REPLY_OUTCOMES = [
  { value: 'positive', label: 'Positive' },
  { value: 'negative', label: 'Negative' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'no_reply', label: 'No reply' },
];

/**
 * Ilaan-style right drawer — list stays visible behind the dimmed backdrop.
 */
export default function LeadPanel({ leadId, onClose, onChanged }) {
  const [lead, setLead] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [callOutcome, setCallOutcome] = useState('');
  const [callType, setCallType] = useState('call');
  const [replyOutcome, setReplyOutcome] = useState('positive');
  const [lostReason, setLostReason] = useState('');
  const [showLostPicker, setShowLostPicker] = useState(false);
  const [fuDue, setFuDue] = useState('');
  const [fuNote, setFuNote] = useState('');
  const [emailOpen, setEmailOpen] = useState(false);
  const [brevoOk, setBrevoOk] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [emailTemplateId, setEmailTemplateId] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailHtml, setEmailHtml] = useState('');
  const [emailText, setEmailText] = useState('');
  const [emailMsg, setEmailMsg] = useState('');
  const [empForm, setEmpForm] = useState({ name: '', phone: '', email: '', job_title: '', notes: '' });
  const [editingEmpId, setEditingEmpId] = useState(null);

  const load = async () => {
    if (!leadId) return;
    setError('');
    try {
      const data = await api(`/leads/${leadId}`);
      setLead(data);
    } catch (e) {
      setLead(null);
      setError(e.message || 'Could not load lead');
    }
  };

  useEffect(() => {
    setLead(null);
    setCallOutcome('');
    setCallType('call');
    setReplyOutcome('positive');
    setLostReason('');
    setShowLostPicker(false);
    setFuDue('');
    setFuNote('');
    setEmailOpen(false);
    setEmailMsg('');
    setEmpForm({ name: '', phone: '', email: '', job_title: '', notes: '' });
    setEditingEmpId(null);
    load();
  }, [leadId]);

  useEffect(() => {
    api('/email/status')
      .then((s) => setBrevoOk(s.enabled))
      .catch(() => setBrevoOk(false));
    api('/email/templates').then((d) => setTemplates(d.templates || [])).catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Ensure no leftover body lock if a parent ever sets one
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const notifyChanged = () => {
    onChanged?.();
  };

  const setStatus = async (status, reason) => {
    if (status === 'lost' && !reason) {
      setShowLostPicker(true);
      setLostReason(lead?.lost_reason || '');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const body = { status };
      if (status === 'lost') body.lost_reason = reason;
      await api(`/leads/${leadId}`, { method: 'PATCH', body });
      setShowLostPicker(false);
      await load();
      notifyChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const logActivity = async (e) => {
    e.preventDefault();
    if (!callOutcome.trim()) return;
    setBusy(true);
    setError('');
    try {
      const body = {
        type: callType,
        summary: callOutcome.trim(),
        outcome: callType === 'reply' ? replyOutcome : callType === 'call' ? callOutcome.trim() : undefined,
      };
      await api(`/leads/${leadId}/activities`, {
        method: 'POST',
        body,
      });
      setCallOutcome('');
      await load();
      notifyChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const scheduleFu = async (e) => {
    e.preventDefault();
    if (!fuDue) return;
    setBusy(true);
    setError('');
    try {
      await api('/follow-ups', {
        method: 'POST',
        body: {
          leadId,
          dueAt: new Date(fuDue).toISOString(),
          note: fuNote || 'Follow-up scheduled',
        },
      });
      setFuDue('');
      setFuNote('');
      await load();
      notifyChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const completeFu = async (fuId) => {
    const outcome = window.prompt('Call / follow-up outcome (optional):') || 'Follow-up completed';
    setBusy(true);
    try {
      await api(`/follow-ups/${fuId}/complete`, {
        method: 'POST',
        body: { outcome, note: outcome },
      });
      await load();
      notifyChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const applyEmailTemplate = (id) => {
    setEmailTemplateId(id);
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    setEmailSubject(tpl.subject);
    setEmailHtml(tpl.htmlContent);
    setEmailText(tpl.textContent);
  };

  const sendColdEmail = async (e) => {
    e.preventDefault();
    if (!lead?.email) return;
    setBusy(true);
    setError('');
    setEmailMsg('');
    try {
      await api(`/email/leads/${leadId}/send`, {
        method: 'POST',
        body: {
          templateId: emailTemplateId || undefined,
          subject: emailSubject,
          htmlContent: emailHtml,
          textContent: emailText,
          syncToBrevo: true,
        },
      });
      setEmailMsg('Email sent via Brevo');
      setEmailOpen(false);
      await load();
      notifyChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const syncToBrevo = async () => {
    if (!lead?.email) return;
    setBusy(true);
    setError('');
    try {
      await api(`/email/leads/${leadId}/sync`, { method: 'POST', body: {} });
      setEmailMsg('Contact synced to Brevo');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const saveEmployee = async (e) => {
    e.preventDefault();
    if (!empForm.name.trim()) return;
    setBusy(true);
    setError('');
    try {
      if (editingEmpId) {
        await api(`/leads/${leadId}/employees/${editingEmpId}`, {
          method: 'PATCH',
          body: empForm,
        });
      } else {
        await api(`/leads/${leadId}/employees`, { method: 'POST', body: empForm });
      }
      setEmpForm({ name: '', phone: '', email: '', job_title: '', notes: '' });
      setEditingEmpId(null);
      await load();
      notifyChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const editEmployee = (emp) => {
    setEditingEmpId(emp.id);
    setEmpForm({
      name: emp.name || '',
      phone: emp.phone || '',
      email: emp.email || '',
      job_title: emp.job_title || '',
      notes: emp.notes || '',
    });
  };

  const deleteEmployee = async (empId) => {
    if (!window.confirm('Delete this employee?')) return;
    setBusy(true);
    setError('');
    try {
      await api(`/leads/${leadId}/employees/${empId}`, { method: 'DELETE' });
      if (editingEmpId === empId) {
        setEditingEmpId(null);
        setEmpForm({ name: '', phone: '', email: '', job_title: '', notes: '' });
      }
      await load();
      notifyChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const suggestedTemplates = lead
    ? templates.filter(
        (t) => t.sources.includes('*') || t.sources.includes(lead.source),
      )
    : templates;

  return (
    <div className="lead-drawer-root" role="dialog" aria-modal="true" aria-label="Lead details">
      <button type="button" className="lead-drawer-backdrop" aria-label="Close" onClick={onClose} />
      <aside className="lead-drawer-panel">
        <header className="lead-drawer-header">
          <div style={{ minWidth: 0, flex: 1, paddingRight: 8 }}>
            {lead ? (
              <>
                <h2 className="lead-drawer-title">{lead.name}</h2>
                <div className="lead-drawer-contact">
                  {lead.phone ? (
                    <a href={`tel:${lead.phone}`} className="lead-drawer-phone">
                      <Phone size={14} /> {lead.phone}
                    </a>
                  ) : null}
                  {lead.email ? (
                    <a href={`mailto:${lead.email}`} className="lead-drawer-phone">
                      <Mail size={14} /> {lead.email}
                    </a>
                  ) : null}
                </div>
                <div style={{ color: 'var(--muted)', fontSize: '0.82rem', marginTop: 4 }}>
                  {[
                    lead.contact_format === 'employee'
                      ? 'Employee'
                      : lead.contact_format === 'company'
                        ? 'Company'
                        : null,
                    lead.industry,
                    lead.company && lead.company !== lead.name ? lead.company : null,
                    lead.job_title,
                    lead.state || lead.country,
                  ]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </div>
              </>
            ) : (
              <h2 className="lead-drawer-title">{error ? 'Lead' : 'Loading…'}</h2>
            )}
          </div>
          <button type="button" className="lead-drawer-close" onClick={onClose} aria-label="Close panel">
            <X size={18} />
          </button>
        </header>

        <div className="lead-drawer-body">
          {error ? <div className="login-error">{error}</div> : null}

          {!lead && !error ? <p className="empty">Loading lead…</p> : null}

          {lead ? (
            <>
              <section className="lead-drawer-section">
                <div className="lead-drawer-meta-grid">
                  <div>
                    <div className="stat-label">Source</div>
                    <SourceBadge source={lead.source} createdByName={lead.created_by_name} />
                  </div>
                  <div>
                    <div className="stat-label">Est. revenue</div>
                    <strong>{money(lead.estimated_value)}</strong>
                  </div>
                  <div>
                    <div className="stat-label">Next follow-up</div>
                    <span style={{ fontSize: '0.85rem' }}>{fmtDate(lead.next_follow_up_at)}</span>
                  </div>
                  <div>
                    <div className="stat-label">Owner</div>
                    <span style={{ fontSize: '0.85rem' }}>{lead.assigned_name || 'Unassigned'}</span>
                  </div>
                </div>
                {lead.notes ? (
                  <p style={{ marginTop: 12, marginBottom: 0, fontSize: '0.88rem', color: 'var(--muted)' }}>
                    <strong>Follow-up notes:</strong> {lead.notes}
                  </p>
                ) : null}
              </section>

              <section className="lead-drawer-section">
                <h3 className="lead-drawer-h3">Employees</h3>
                <p className="stat-hint" style={{ marginTop: 0 }}>
                  {lead.contact_format === 'employee'
                    ? 'Additional people linked to this contact — add, edit, or delete.'
                    : 'People at this company/store — add, edit, or delete.'}
                </p>
                {(lead.employees || []).length ? (
                  <div className="table-wrap" style={{ marginBottom: 12 }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Contact</th>
                          <th>Title</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {lead.employees.map((emp) => (
                          <tr key={emp.id}>
                            <td>
                              <div style={{ fontWeight: 600 }}>{emp.name}</div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{emp.email || '—'}</div>
                            </td>
                            <td style={{ fontSize: '0.85rem' }}>{emp.phone || '—'}</td>
                            <td style={{ fontSize: '0.85rem' }}>{emp.job_title || '—'}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                disabled={busy}
                                onClick={() => editEmployee(emp)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                disabled={busy}
                                onClick={() => deleteEmployee(emp.id)}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="empty">No employees yet</p>
                )}
                <form onSubmit={saveEmployee}>
                  <div className="field">
                    <label className="label">{editingEmpId ? 'Edit employee' : 'Add employee'}</label>
                    <input
                      className="input"
                      placeholder="Name"
                      required
                      value={empForm.name}
                      onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <input
                      className="input"
                      placeholder="Contact"
                      value={empForm.phone}
                      onChange={(e) => setEmpForm({ ...empForm, phone: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <input
                      className="input"
                      placeholder="Email"
                      value={empForm.email}
                      onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <input
                      className="input"
                      placeholder="Job title"
                      value={empForm.job_title}
                      onChange={(e) => setEmpForm({ ...empForm, job_title: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <textarea
                      className="textarea"
                      rows={2}
                      placeholder="Notes"
                      value={empForm.notes}
                      onChange={(e) => setEmpForm({ ...empForm, notes: e.target.value })}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary" type="submit" disabled={busy}>
                      {editingEmpId ? 'Save employee' : 'Add employee'}
                    </button>
                    {editingEmpId ? (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => {
                          setEditingEmpId(null);
                          setEmpForm({ name: '', phone: '', email: '', job_title: '', notes: '' });
                        }}
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>
                </form>
              </section>

              <section className="lead-drawer-section">
                <h3 className="lead-drawer-h3">Funnel stage</h3>
                <div className="lead-status-grid">
                  {STATUSES.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      disabled={busy}
                      className={`lead-status-chip ${lead.status === s.key ? 'active' : ''}`}
                      onClick={() => setStatus(s.key)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <StatusBadge status={lead.status} />
                  {lead.status === 'lost' && lead.lost_reason ? (
                    <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                      Reason: {lead.lost_reason}
                    </span>
                  ) : null}
                </div>
                {showLostPicker ? (
                  <div style={{ marginTop: 12 }}>
                    <label className="label">Lost reason</label>
                    <select
                      className="select"
                      value={lostReason}
                      onChange={(e) => setLostReason(e.target.value)}
                    >
                      <option value="">Select reason…</option>
                      {LOST_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={busy || !lostReason}
                        onClick={() => setStatus('lost', lostReason)}
                      >
                        Mark lost
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => setShowLostPicker(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="lead-drawer-section">
                <h3 className="lead-drawer-h3">
                  <Mail size={16} /> Cold email (Brevo)
                </h3>
                {!lead.email ? (
                  <p className="empty">No email on this lead</p>
                ) : brevoOk === false ? (
                  <p className="stat-hint">Brevo not configured on API — set BREVO_ENABLED + API key</p>
                ) : (
                  <>
                    {emailMsg ? (
                      <p style={{ color: 'var(--success)', fontSize: '0.85rem', marginTop: 0 }}>{emailMsg}</p>
                    ) : null}
                    {!emailOpen ? (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={busy}
                          onClick={() => {
                            setEmailOpen(true);
                            const match = suggestedTemplates.find(
                              (t) => !t.sources.includes('*') && t.sources.includes(lead.source),
                            );
                            if (match && !emailTemplateId) applyEmailTemplate(match.id);
                          }}
                        >
                          Compose email
                        </button>
                        <button type="button" className="btn btn-secondary" disabled={busy} onClick={syncToBrevo}>
                          Sync to Brevo
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={sendColdEmail}>
                        <div className="field">
                          <label className="label">Template</label>
                          <select
                            className="select"
                            value={emailTemplateId}
                            onChange={(e) => applyEmailTemplate(e.target.value)}
                          >
                            <option value="">Custom</option>
                            {suggestedTemplates.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <label className="label">Subject</label>
                          <input
                            className="input"
                            value={emailSubject}
                            onChange={(e) => setEmailSubject(e.target.value)}
                            required
                          />
                        </div>
                        <div className="field">
                          <label className="label">Message (HTML)</label>
                          <textarea
                            className="textarea"
                            rows={5}
                            value={emailHtml}
                            onChange={(e) => setEmailHtml(e.target.value)}
                            required
                          />
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn btn-primary" type="submit" disabled={busy}>
                            Send via Brevo
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => setEmailOpen(false)}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                  </>
                )}
              </section>

              <section className="lead-drawer-section">
                <h3 className="lead-drawer-h3">
                  <MessageSquare size={16} /> Log outreach / reply
                </h3>
                <p className="stat-hint" style={{ marginTop: 0 }}>
                  Emails, LinkedIn, calls, and replies feed the Funnel dashboard rates.
                </p>
                <form onSubmit={logActivity}>
                  <div className="field">
                    <label className="label">Type</label>
                    <select className="select" value={callType} onChange={(e) => setCallType(e.target.value)}>
                      {ACTIVITY_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {callType === 'reply' ? (
                    <div className="field">
                      <label className="label">Reply outcome</label>
                      <select
                        className="select"
                        value={replyOutcome}
                        onChange={(e) => setReplyOutcome(e.target.value)}
                      >
                        {REPLY_OUTCOMES.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  <div className="field">
                    <textarea
                      className="textarea"
                      rows={3}
                      required
                      placeholder={
                        callType === 'linkedin'
                          ? 'LinkedIn touch note…'
                          : callType === 'reply'
                            ? 'What did they reply?'
                            : callType === 'demo_shown'
                              ? 'Demo notes / attendees…'
                              : 'What happened…'
                      }
                      value={callOutcome}
                      onChange={(e) => setCallOutcome(e.target.value)}
                    />
                  </div>
                  <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%' }}>
                    Save to activity log
                  </button>
                </form>
              </section>

              <section className="lead-drawer-section">
                <h3 className="lead-drawer-h3">
                  <CalendarPlus size={16} /> Schedule follow-up
                </h3>
                <form onSubmit={scheduleFu}>
                  <div className="field">
                    <label className="label">Due</label>
                    <input
                      className="input"
                      type="datetime-local"
                      value={fuDue}
                      onChange={(e) => setFuDue(e.target.value)}
                      required
                    />
                  </div>
                  <div className="field">
                    <label className="label">Reminder note</label>
                    <input
                      className="input"
                      value={fuNote}
                      onChange={(e) => setFuNote(e.target.value)}
                      placeholder="Call about Professional pack…"
                    />
                  </div>
                  <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%' }}>
                    Schedule follow-up
                  </button>
                </form>

                <div style={{ marginTop: '1rem' }}>
                  {(lead.followUps || []).map((f) => (
                    <div key={f.id} className="lead-fu-row">
                      <div>
                        <StatusBadge status={f.status} />{' '}
                        <span style={{ fontSize: '0.85rem' }}>{fmtDate(f.due_at)}</span>
                        <div style={{ color: 'var(--muted)', fontSize: '0.82rem', marginTop: 2 }}>
                          {f.note || '—'}
                        </div>
                      </div>
                      {['pending', 'overdue'].includes(f.status) ? (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                          disabled={busy}
                          onClick={() => completeFu(f.id)}
                        >
                          Mark done
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>

              <section className="lead-drawer-section">
                <h3 className="lead-drawer-h3">Activity history</h3>
                <ul className="lead-activity-list">
                  {(lead.activities || []).map((a) => (
                    <li key={a.id}>
                      <strong style={{ textTransform: 'capitalize' }}>{a.type}</strong> — {a.summary}
                      <div className="muted-line">
                        {a.user_name || 'System'} · {fmtDate(a.created_at)}
                      </div>
                    </li>
                  ))}
                  {!lead.activities?.length ? <li className="empty">No activity yet</li> : null}
                </ul>
              </section>
            </>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
