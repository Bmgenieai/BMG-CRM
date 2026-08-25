import React, { useEffect, useState } from 'react';
import { Phone, MessageSquare, CalendarPlus, X, Mail } from 'lucide-react';
import { api } from '../api.js';
import { fmtDate, money, SourceBadge, StatusBadge } from './Badges.jsx';

const STATUSES = [
  { key: 'new', label: 'New' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'follow_up_scheduled', label: 'Follow-up' },
  { key: 'converted', label: 'Won' },
  { key: 'lost', label: 'Lost' },
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
  const [fuDue, setFuDue] = useState('');
  const [fuNote, setFuNote] = useState('');

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
    setFuDue('');
    setFuNote('');
    load();
  }, [leadId]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const notifyChanged = () => {
    onChanged?.();
  };

  const setStatus = async (status) => {
    setBusy(true);
    setError('');
    try {
      await api(`/leads/${leadId}`, { method: 'PATCH', body: { status } });
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
      const nextStatus =
        callType === 'call' && lead?.status === 'new' ? 'contacted' : undefined;
      await api(`/leads/${leadId}/activities`, {
        method: 'POST',
        body: {
          type: callType,
          summary: callOutcome.trim(),
          outcome: callType === 'call' ? callOutcome.trim() : undefined,
          status: nextStatus,
        },
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
                  {[lead.company, lead.country].filter(Boolean).join(' · ') || '—'}
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
                    <SourceBadge source={lead.source} />
                  </div>
                  <div>
                    <div className="stat-label">Est. value</div>
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
              </section>

              <section className="lead-drawer-section">
                <h3 className="lead-drawer-h3">Update status</h3>
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
                <div style={{ marginTop: 8 }}>
                  <StatusBadge status={lead.status} />
                </div>
              </section>

              <section className="lead-drawer-section">
                <h3 className="lead-drawer-h3">
                  <MessageSquare size={16} /> Add comment / call note
                </h3>
                <form onSubmit={logActivity}>
                  <div className="field">
                    <label className="label">Type</label>
                    <select className="select" value={callType} onChange={(e) => setCallType(e.target.value)}>
                      <option value="call">Phone call</option>
                      <option value="note">Comment / note</option>
                      <option value="email">Email</option>
                      <option value="whatsapp">WhatsApp / SMS</option>
                    </select>
                  </div>
                  <div className="field">
                    <textarea
                      className="textarea"
                      rows={3}
                      required
                      placeholder="What happened on this call? Any feedback from client…"
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
