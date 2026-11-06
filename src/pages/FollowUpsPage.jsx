import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { fmtDate, StatusBadge } from '../components/Badges.jsx';
import LeadPanel from '../components/LeadPanel.jsx';

function fmtDay(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

export default function FollowUpsPage() {
  const { can } = useAuth();
  const canManage = can('followups:manage_own') || can('followups:manage_team');
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [dueFrom, setDueFrom] = useState('');
  const [dueTo, setDueTo] = useState('');
  const [error, setError] = useState('');
  const [completeId, setCompleteId] = useState(null);
  const [outcome, setOutcome] = useState('');
  const [nextDue, setNextDue] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState(null);

  const load = () => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (q.trim()) params.set('q', q.trim());
    if (dueFrom) params.set('dueFrom', dueFrom);
    if (dueTo) params.set('dueTo', dueTo);
    api(`/follow-ups?${params}`)
      .then(setRows)
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, dueFrom, dueTo]);

  const complete = async (id) => {
    try {
      await api(`/follow-ups/${id}/complete`, {
        method: 'POST',
        body: {
          outcome,
          note: outcome,
          nextDueAt: nextDue ? new Date(nextDue).toISOString() : undefined,
        },
      });
      setCompleteId(null);
      setOutcome('');
      setNextDue('');
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div>
      <h1 className="page-title">Follow-ups</h1>
      <p className="page-sub">
        Click a lead to open the side panel — complete from the table or inside the drawer.
      </p>

      {error ? <div className="login-error">{error}</div> : null}

      <div className="toolbar">
        <input
          className="input"
          placeholder="Search lead, email, company, note, assignee…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
          style={{ minWidth: 220, flex: 1 }}
        />
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="overdue">Overdue</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <input
          className="input"
          type="date"
          title="Due from"
          aria-label="Due from"
          value={dueFrom}
          onChange={(e) => setDueFrom(e.target.value)}
          style={{ maxWidth: 150 }}
        />
        <input
          className="input"
          type="date"
          title="Due to"
          aria-label="Due to"
          value={dueTo}
          onChange={(e) => setDueTo(e.target.value)}
          style={{ maxWidth: 150 }}
        />
        <button type="button" className="btn btn-secondary" onClick={load}>
          Search
        </button>
      </div>

      <div className="card table-wrap">
        <table className="leads-table">
          <thead>
            <tr>
              <th>Due</th>
              <th>Lead created</th>
              <th>Lead</th>
              <th>Assignee</th>
              <th>Status</th>
              <th>Note</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <tr
                key={f.id}
                className={`clickable-row${selectedLeadId === f.lead_id ? ' row-selected' : ''}`}
                onClick={() => setSelectedLeadId(f.lead_id)}
              >
                <td>{fmtDate(f.due_at)}</td>
                <td>{fmtDay(f.lead_created_at)}</td>
                <td>
                  <span style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>{f.lead_name}</span>
                </td>
                <td>{f.assignee_name}</td>
                <td>
                  <StatusBadge status={f.status} />
                </td>
                <td>{f.note || '—'}</td>
                <td>
                  {canManage && ['pending', 'overdue'].includes(f.status) ? (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCompleteId(f.id);
                      }}
                    >
                      Complete
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={7} className="empty">
                  No follow-ups
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {selectedLeadId ? (
        <LeadPanel
          leadId={selectedLeadId}
          onClose={() => setSelectedLeadId(null)}
          onChanged={load}
        />
      ) : null}

      {completeId ? (
        <div className="modal-backdrop" onClick={() => setCompleteId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Complete follow-up</h3>
            <div className="field">
              <label className="label">Outcome</label>
              <textarea
                className="textarea"
                rows={3}
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                placeholder="Spoke with owner — interested in Professional pack"
              />
            </div>
            <div className="field">
              <label className="label">Schedule next (optional)</label>
              <input
                className="input"
                type="datetime-local"
                value={nextDue}
                onChange={(e) => setNextDue(e.target.value)}
              />
            </div>
            <div className="row-actions">
              <button type="button" className="btn btn-primary" onClick={() => complete(completeId)}>
                Save
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setCompleteId(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
