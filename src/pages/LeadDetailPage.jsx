import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Phone, MessageSquare, CalendarPlus, ArrowLeft } from 'lucide-react';
import { api } from '../api.js';
import { fmtDate, money, SourceBadge, StatusBadge } from '../components/Badges.jsx';

const STATUSES = [
  { key: 'new', label: 'New' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'follow_up_scheduled', label: 'Follow-up scheduled' },
  { key: 'converted', label: 'Converted (won)' },
  { key: 'lost', label: 'Lost' },
];

export default function LeadDetailPage() {
  const { id } = useParams();
  const [lead, setLead] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Call / comment
  const [callOutcome, setCallOutcome] = useState('');
  const [callType, setCallType] = useState('call');

  // Follow-up
  const [fuDue, setFuDue] = useState('');
  const [fuNote, setFuNote] = useState('');

  const load = async () => {
    setError('');
    try {
      const data = await api(`/leads/${id}`);
      setLead(data);
    } catch (e) {
      setLead(null);
      setError(e.message || 'Could not load lead');
    }
  };

  useEffect(() => {
    setLead(null);
    load();
  }, [id]);

  const setStatus = async (status) => {
    setBusy(true);
    setError('');
    try {
      await api(`/leads/${id}`, { method: 'PATCH', body: { status } });
      await load();
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
      await api(`/leads/${id}/activities`, {
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
          leadId: id,
          dueAt: new Date(fuDue).toISOString(),
          note: fuNote || 'Follow-up scheduled',
        },
      });
      setFuDue('');
      setFuNote('');
      await load();
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
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (error && !lead) {
    return (
      <div className="card">
        <p style={{ color: 'var(--danger)', marginTop: 0 }}>{error}</p>
        <Link to="/leads" className="btn btn-secondary">
          ← Back to leads
        </Link>
      </div>
    );
  }

  if (!lead) {
    return <div className="card">Loading lead…</div>;
  }

  return (
    <div>
      <p style={{ marginBottom: '0.5rem' }}>
        <Link to="/leads" style={{ color: 'var(--brand-primary)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={16} /> Back to my leads
        </Link>
      </p>

      <h1 className="page-title">{lead.name}</h1>
      <p className="page-sub">
        {[lead.email, lead.phone, lead.company, lead.country].filter(Boolean).join(' · ') || 'No contact details'}
      </p>

      {error ? <div className="login-error">{error}</div> : null}

      {/* Status pipeline — primary telesales action */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <p className="stat-label" style={{ marginBottom: '0.65rem' }}>
          Lead status — tap to update
        </p>
        <div className="row-actions">
          {STATUSES.map((s) => (
            <button
              key={s.key}
              type="button"
              disabled={busy}
              className={`btn ${lead.status === s.key ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setStatus(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div style={{ marginTop: '0.85rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          <StatusBadge status={lead.status} />
          <SourceBadge source={lead.source} />
          <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
            Owner: {lead.assigned_name || 'Unassigned'} · Est. {money(lead.estimated_value)}
          </span>
        </div>
      </div>

      <div className="grid grid-2">
        {/* Call / comment */}
        <div className="card">
          <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Phone size={18} color="var(--brand-primary)" /> Log call or comment
          </h3>
          <p style={{ marginTop: 0, color: 'var(--muted)', fontSize: '0.88rem' }}>
            After every call, write what happened. Logging a call on a New lead moves it to Contacted.
          </p>
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
              <label className="label">
                <MessageSquare size={14} style={{ verticalAlign: 'middle' }} /> What happened?
              </label>
              <textarea
                className="textarea"
                rows={4}
                required
                placeholder="e.g. Spoke with Mia — interested in Professional pack, asked for pricing email"
                value={callOutcome}
                onChange={(e) => setCallOutcome(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              Save to activity log
            </button>
          </form>

          <h4 style={{ marginTop: '1.5rem', marginBottom: '0.5rem' }}>Activity history</h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {(lead.activities || []).map((a) => (
              <li
                key={a.id}
                style={{
                  padding: '0.65rem 0',
                  borderBottom: '1px solid var(--border)',
                  fontSize: '0.9rem',
                }}
              >
                <strong style={{ textTransform: 'capitalize' }}>{a.type}</strong> — {a.summary}
                <div style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>
                  {a.user_name || 'System'} · {fmtDate(a.created_at)}
                </div>
              </li>
            ))}
            {!lead.activities?.length ? (
              <li className="empty" style={{ padding: '1rem 0' }}>
                No activity yet — log your first call above
              </li>
            ) : null}
          </ul>
        </div>

        {/* Follow-ups */}
        <div className="card">
          <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarPlus size={18} color="var(--brand-primary)" /> Schedule follow-up
          </h3>
          <p style={{ marginTop: 0, color: 'var(--muted)', fontSize: '0.88rem' }}>
            Set when you will call again. It appears on Follow-ups and the working tree.
          </p>
          <form onSubmit={scheduleFu}>
            <div className="field">
              <label className="label">Next call date & time</label>
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
                placeholder="Call about Professional pack / send demo link"
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              Schedule follow-up
            </button>
          </form>

          <h4 style={{ marginTop: '1.5rem', marginBottom: '0.5rem' }}>
            Follow-ups on this lead
            {lead.next_follow_up_at ? (
              <span style={{ fontWeight: 500, color: 'var(--muted)', fontSize: '0.85rem' }}>
                {' '}
                · next {fmtDate(lead.next_follow_up_at)}
              </span>
            ) : null}
          </h4>
          <div>
            {(lead.followUps || []).map((f) => (
              <div
                key={f.id}
                style={{
                  padding: '0.75rem 0',
                  borderBottom: '1px solid var(--border)',
                  fontSize: '0.9rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <StatusBadge status={f.status} /> {fmtDate(f.due_at)}
                  <div style={{ color: 'var(--muted)', marginTop: 4 }}>{f.note || '—'}</div>
                </div>
                {['pending', 'overdue'].includes(f.status) ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busy}
                    onClick={() => completeFu(f.id)}
                  >
                    Mark done
                  </button>
                ) : null}
              </div>
            ))}
            {!lead.followUps?.length ? (
              <p className="empty" style={{ padding: '1rem 0' }}>
                No follow-ups yet
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
