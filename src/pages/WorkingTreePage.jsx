import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

export default function WorkingTreePage() {
  const { user, can } = useAuth();
  const [tree, setTree] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/working-tree')
      .then(setTree)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="card">{error}</div>;
  if (!tree) return <div className="card">Loading working tree…</div>;

  return (
    <div>
      <h1 className="page-title">Working tree</h1>
      <p className="page-sub">
        {user.role === 'ceo'
          ? 'CEO view — pending work across managers and telesales.'
          : user.role === 'manager'
            ? 'Team pending work and follow-up pressure.'
            : 'Your open pipeline and due follow-ups.'}
      </p>

      <div className="grid grid-4" style={{ marginBottom: '1rem' }}>
        <div className="card">
          <p className="stat-label">People in scope</p>
          <p className="stat-value">{tree.summary.people}</p>
        </div>
        <div className="card">
          <p className="stat-label">Open leads</p>
          <p className="stat-value">{tree.summary.openLeads}</p>
        </div>
        <div className="card">
          <p className="stat-label">Overdue follow-ups</p>
          <p className="stat-value">{tree.summary.overdueFollowUps}</p>
        </div>
        <div className="card">
          <p className="stat-label">Unassigned pool</p>
          <p className="stat-value">{tree.unassignedPool}</p>
          {can('leads:assign') ? (
            <p className="stat-hint">Distribute from Distribution screen</p>
          ) : null}
        </div>
      </div>

      {tree.people.map((p) => (
        <div key={p.user.id} className="card tree-person">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <strong>{p.user.name}</strong>
              <div style={{ color: 'var(--muted)', fontSize: '0.85rem', textTransform: 'capitalize' }}>
                {p.user.role} · {p.user.email}
              </div>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
              Open {p.totals.open} · Overdue FU {p.totals.overdue} · Due today {p.totals.today}
            </div>
          </div>
          <div className="tree-buckets">
            {p.buckets
              .filter((b) => b.count > 0)
              .map((b) => (
                <div key={b.key} className={`tree-bucket tone-${b.tone}`}>
                  {b.count}
                  <small>{b.label}</small>
                </div>
              ))}
            {!p.buckets.some((b) => b.count > 0) ? (
              <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>No pending buckets</span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
