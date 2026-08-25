import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { fmtDate, StatusBadge } from '../components/Badges.jsx';

export default function FollowUpsPage() {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [completeId, setCompleteId] = useState(null);
  const [outcome, setOutcome] = useState('');
  const [nextDue, setNextDue] = useState('');

  const load = () => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    api(`/follow-ups?${params}`)
      .then(setRows)
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    load();
  }, [status]);

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
      <p className="page-sub">Structured reminders — overdue, due today, and next actions on each lead.</p>

      {error ? <div className="login-error">{error}</div> : null}

      <div className="toolbar">
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="overdue">Overdue</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Due</th>
              <th>Lead</th>
              <th>Assignee</th>
              <th>Status</th>
              <th>Note</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <tr key={f.id}>
                <td>{fmtDate(f.due_at)}</td>
                <td>
                  <Link to={`/leads?id=${f.lead_id}`} style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>
                    {f.lead_name}
                  </Link>
                </td>
                <td>{f.assignee_name}</td>
                <td>
                  <StatusBadge status={f.status} />
                </td>
                <td>{f.note || '—'}</td>
                <td>
                  {['pending', 'overdue'].includes(f.status) ? (
                    <button type="button" className="btn btn-secondary" onClick={() => setCompleteId(f.id)}>
                      Complete
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={6} className="empty">
                  No follow-ups
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

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
