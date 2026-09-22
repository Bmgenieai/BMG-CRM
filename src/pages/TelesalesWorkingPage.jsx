import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { fmtDate, StatusBadge } from '../components/Badges.jsx';

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
];

const ACTIVITY_LABELS = {
  call: 'Call',
  whatsapp: 'WhatsApp',
  email: 'Email',
  email_sent: 'Email sent',
  note: 'Note',
  linkedin: 'LinkedIn',
  reply: 'Reply',
  status_change: 'Status',
};

function StatCard({ label, value, hint }) {
  return (
    <div className="card">
      <p className="stat-label">{label}</p>
      <p className="stat-value" style={{ color: 'var(--brand-primary)' }}>
        {value ?? 0}
      </p>
      {hint ? <p className="stat-hint">{hint}</p> : null}
    </div>
  );
}

function PeriodChips({ value, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {PERIODS.map((p) => (
        <button
          key={p.key}
          type="button"
          className={`btn ${value === p.key ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => onChange(p.key)}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

export default function TelesalesWorkingPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const period = searchParams.get('period') || 'today';
  const userId = searchParams.get('userId') || '';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const setPeriod = (next) => {
    const p = new URLSearchParams(searchParams);
    p.set('period', next);
    setSearchParams(p, { replace: true });
  };

  const setFocusUser = (id) => {
    const p = new URLSearchParams(searchParams);
    if (id) p.set('userId', id);
    else p.delete('userId');
    setSearchParams(p, { replace: true });
  };

  useEffect(() => {
    setError('');
    setData(null);
    const q = new URLSearchParams({ period });
    if (userId) q.set('userId', userId);
    api(`/analytics/telesales-working?${q}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [period, userId]);

  if (error) return <div className="card">{error}</div>;
  if (!data) return <div className="card">Loading telesales working…</div>;

  const { totals, reps, feed, leadsCreated, focusUserId, canViewTeam, label, fromYmd, toYmd, timezone } =
    data;
  const focusRep = focusUserId ? reps.find((r) => r.id === focusUserId) : null;
  const showTeamTable = canViewTeam && reps.length > 0;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: '1rem',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <h1 className="page-title">
            {canViewTeam ? 'Telesales working' : 'My working'}
          </h1>
          <p className="page-sub">
            {label}
            {fromYmd === toYmd ? ` · ${fromYmd}` : ` · ${fromYmd} → ${toYmd}`}
            {` · ${timezone}`}
            {focusRep ? ` · ${focusRep.name}` : ''}
          </p>
        </div>
        <PeriodChips value={period} onChange={setPeriod} />
      </div>

      <div className="grid grid-4" style={{ marginBottom: '1rem' }}>
        <StatCard
          label="Leads added"
          value={totals.leadsAdded}
          hint={`${totals.leadsManual} manual · ${totals.leadsCsv} CSV`}
        />
        <StatCard label="Calls" value={totals.calls} />
        <StatCard label="Messages" value={totals.messages} hint="WhatsApp logs" />
        <StatCard label="Emails" value={totals.emails} />
      </div>

      <div className="grid grid-4" style={{ marginBottom: '1rem' }}>
        <StatCard label="Notes" value={totals.notes} />
        <StatCard label="Leads touched" value={totals.leadsTouched} />
        <StatCard label="Paid (period)" value={totals.paid} />
        <StatCard
          label="Follow-ups done"
          value={totals.followupsCompleted}
          hint={`${totals.toConversation} → conversation · ${totals.toDemo} → demo`}
        />
      </div>

      {showTeamTable ? (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <h3 style={{ margin: 0 }}>Team working</h3>
            {focusUserId ? (
              <button type="button" className="btn btn-ghost" onClick={() => setFocusUser('')}>
                Clear selection
              </button>
            ) : null}
          </div>
          <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
            <table>
              <thead>
                <tr>
                  <th>Rep</th>
                  <th>Manual</th>
                  <th>CSV</th>
                  <th>Calls</th>
                  <th>Msg</th>
                  <th>Email</th>
                  <th>Notes</th>
                  <th>Touched</th>
                  <th>Paid</th>
                  <th>FU done</th>
                  <th>Overdue FU</th>
                </tr>
              </thead>
              <tbody>
                {reps.map((r) => (
                  <tr
                    key={r.id}
                    style={{
                      cursor: 'pointer',
                      background:
                        focusUserId === r.id ? 'color-mix(in srgb, var(--brand-primary) 12%, transparent)' : undefined,
                    }}
                    onClick={() => setFocusUser(r.id)}
                  >
                    <td>
                      <strong>{r.name}</strong>
                    </td>
                    <td>{r.leadsManual}</td>
                    <td>{r.leadsCsv}</td>
                    <td>{r.calls}</td>
                    <td>{r.messages}</td>
                    <td>{r.emails}</td>
                    <td>{r.notes}</td>
                    <td>{r.leadsTouched}</td>
                    <td>{r.paid}</td>
                    <td>{r.followupsCompleted}</td>
                    <td>{r.overdueFollowups}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="stat-hint" style={{ marginBottom: 0 }}>
            Click a rep to see their activity feed and leads added in this period.
          </p>
        </div>
      ) : null}

      {focusRep || !canViewTeam ? (
        <div className="grid grid-2">
          <div className="card">
            <h3 style={{ marginTop: 0 }}>
              Activity feed
              {focusRep ? ` · ${focusRep.name}` : ''}
            </h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Type</th>
                    <th>Lead</th>
                    <th>Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {(feed || []).length ? (
                    feed.map((a) => (
                      <tr key={a.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(a.created_at)}</td>
                        <td>{ACTIVITY_LABELS[a.type] || a.type}</td>
                        <td>
                          {a.lead_id ? (
                            <Link
                              to={`/leads?id=${a.lead_id}`}
                              style={{ color: 'var(--brand-primary)', fontWeight: 600 }}
                            >
                              {a.lead_name || 'Lead'}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          {a.summary}
                          {a.outcome ? (
                            <span className="stat-hint"> · {a.outcome}</span>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="empty">
                        No logged outreach in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Leads added</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Name</th>
                    <th>How</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(leadsCreated || []).length ? (
                    leadsCreated.map((l) => (
                      <tr key={l.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(l.created_at)}</td>
                        <td>
                          <Link
                            to={`/leads?id=${l.id}`}
                            style={{ color: 'var(--brand-primary)', fontWeight: 600 }}
                          >
                            {l.name}
                          </Link>
                        </td>
                        <td>{l.addMethod === 'csv' ? 'CSV' : 'Manual'}</td>
                        <td>
                          <StatusBadge status={l.status} />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="empty">
                        No leads added in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="card">
          <p className="page-sub" style={{ margin: 0 }}>
            Select a telesales rep above to see their call comments, notes, and leads added.
          </p>
        </div>
      )}

      {user?.role === 'telesales' && !totals.totalOutreach && !totals.leadsAdded ? (
        <div className="card" style={{ marginTop: '1rem' }}>
          <p style={{ margin: 0 }}>
            Tip: log every call, WhatsApp, and email from the lead panel so your working shows here.
          </p>
        </div>
      ) : null}
    </div>
  );
}
