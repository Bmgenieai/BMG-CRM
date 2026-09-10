import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { SourceBadge, StatusBadge } from '../components/Badges.jsx';
import LeadPanel from '../components/LeadPanel.jsx';

export default function WorkingTreePage() {
  const { user, can } = useAuth();
  const [tree, setTree] = useState(null);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // { title, leads, loading }
  const [selectedLeadId, setSelectedLeadId] = useState(null);

  const loadTree = () => {
    api('/working-tree')
      .then(setTree)
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    loadTree();
  }, []);

  const openBucket = async ({ bucket, userId, titleHint }) => {
    setModal({ title: titleHint || bucket, leads: [], loading: true });
    try {
      const params = new URLSearchParams({ bucket });
      if (userId) params.set('userId', userId);
      const data = await api(`/working-tree/leads?${params}`);
      setModal({
        title: data.title || titleHint || bucket,
        leads: data.leads || [],
        loading: false,
        bucket,
        userId: userId || null,
      });
    } catch (e) {
      setModal({ title: 'Error', leads: [], loading: false, error: e.message });
    }
  };

  if (error) return <div className="card">{error}</div>;
  if (!tree) return <div className="card">Loading working tree…</div>;

  return (
    <div>
      <h1 className="page-title">Working tree</h1>
      <p className="page-sub">
        {user.role === 'ceo'
          ? 'Click any number to open that lead list. Pick a lead to work it in the side panel.'
          : user.role === 'manager'
            ? 'Click bucket counts to drill into team leads.'
            : 'Click your bucket counts to see matching leads.'}
      </p>

      <div className="grid grid-4" style={{ marginBottom: '1rem' }}>
        <div className="card">
          <p className="stat-label">People in scope</p>
          <p className="stat-value">{tree.summary.people}</p>
        </div>
        <button
          type="button"
          className="card tree-stat-click"
          onClick={() => openBucket({ bucket: 'open', titleHint: 'Open leads' })}
        >
          <p className="stat-label">Open leads</p>
          <p className="stat-value">{tree.summary.openLeads}</p>
          <p className="stat-hint">Click to view list</p>
        </button>
        <button
          type="button"
          className="card tree-stat-click"
          onClick={() => openBucket({ bucket: 'followups_overdue', titleHint: 'Overdue follow-ups' })}
        >
          <p className="stat-label">Overdue follow-ups</p>
          <p className="stat-value">{tree.summary.overdueFollowUps}</p>
          <p className="stat-hint">Click to view list</p>
        </button>
        <button
          type="button"
          className="card tree-stat-click"
          onClick={() => openBucket({ bucket: 'unassigned', titleHint: 'Unassigned pool' })}
          disabled={!can('leads:assign') && user.role === 'telesales'}
        >
          <p className="stat-label">Unassigned pool</p>
          <p className="stat-value">{tree.unassignedPool}</p>
          {can('leads:assign') ? (
            <p className="stat-hint">Click to view · distribute from Distribution</p>
          ) : (
            <p className="stat-hint">Visible to managers / CEO</p>
          )}
        </button>
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
            <div style={{ fontSize: '0.85rem', color: 'var(--muted)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="tree-inline-link"
                onClick={() => openBucket({ bucket: 'open', userId: p.user.id, titleHint: `${p.user.name} · open` })}
              >
                Open {p.totals.open}
              </button>
              <button
                type="button"
                className="tree-inline-link"
                onClick={() =>
                  openBucket({
                    bucket: 'followups_overdue',
                    userId: p.user.id,
                    titleHint: `${p.user.name} · overdue FU`,
                  })
                }
              >
                Overdue FU {p.totals.overdue}
              </button>
              <button
                type="button"
                className="tree-inline-link"
                onClick={() =>
                  openBucket({
                    bucket: 'followups_today',
                    userId: p.user.id,
                    titleHint: `${p.user.name} · due today`,
                  })
                }
              >
                Due today {p.totals.today}
              </button>
            </div>
          </div>
          <div className="tree-buckets">
            {p.buckets
              .filter((b) => b.count > 0)
              .map((b) => (
                <button
                  key={b.key}
                  type="button"
                  className={`tree-bucket tone-${b.tone} tree-bucket-btn`}
                  onClick={() =>
                    openBucket({
                      bucket: b.key,
                      userId: p.user.id,
                      titleHint: `${p.user.name} · ${b.label}`,
                    })
                  }
                >
                  {b.count}
                  <small>{b.label}</small>
                </button>
              ))}
            {!p.buckets.some((b) => b.count > 0) ? (
              <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>No pending buckets</span>
            ) : null}
          </div>
        </div>
      ))}

      {modal && !selectedLeadId ? (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal tree-leads-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: 0 }}>{modal.title}</h3>
                <p style={{ margin: '0.35rem 0 0', color: 'var(--muted)', fontSize: '0.85rem' }}>
                  {modal.loading ? 'Loading…' : `${modal.leads?.length || 0} lead(s) — click a row to open`}
                </p>
              </div>
              <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>
                Close
              </button>
            </div>

            {modal.error ? <div className="login-error" style={{ marginTop: '0.75rem' }}>{modal.error}</div> : null}

            {!modal.loading && !modal.error ? (
              <div className="table-wrap" style={{ marginTop: '0.85rem', maxHeight: '55vh', overflow: 'auto' }}>
                <table className="leads-table">
                  <thead>
                    <tr>
                      <th>Lead</th>
                      <th>Status</th>
                      <th>Source</th>
                      <th>Owner</th>
                      <th>Country</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(modal.leads || []).map((l) => (
                      <tr
                        key={l.id + (l.follow_up_id || '')}
                        className="clickable-row"
                        onClick={() => {
                          setSelectedLeadId(l.id);
                        }}
                      >
                        <td>
                          <div style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>{l.name}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{l.email}</div>
                        </td>
                        <td>
                          <StatusBadge status={l.status} />
                        </td>
                        <td>
                          <SourceBadge source={l.source} />
                        </td>
                        <td>{l.assigned_name || '—'}</td>
                        <td>{l.country || '—'}</td>
                      </tr>
                    ))}
                    {!modal.leads?.length ? (
                      <tr>
                        <td colSpan={5} className="empty">
                          No leads in this bucket
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {selectedLeadId ? (
        <LeadPanel
          leadId={selectedLeadId}
          onClose={() => {
            setSelectedLeadId(null);
            // refresh modal + tree after edits
            if (modal?.bucket) {
              openBucket({
                bucket: modal.bucket,
                userId: modal.userId,
                titleHint: modal.title,
              });
            }
            loadTree();
          }}
          onChanged={() => {
            loadTree();
            if (modal?.bucket) {
              openBucket({
                bucket: modal.bucket,
                userId: modal.userId,
                titleHint: modal.title,
              });
            }
          }}
        />
      ) : null}
    </div>
  );
}
