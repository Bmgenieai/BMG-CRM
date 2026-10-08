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
  call_attempted: 'Call attempted',
  call_connected: 'Call connected',
  whatsapp: 'WhatsApp',
  email: 'Email',
  email_sent: 'Email sent',
  email_followup: 'Email follow-up',
  note: 'Note',
  linkedin: 'LinkedIn',
  linkedin_connection_sent: 'LI connection sent',
  linkedin_connection_accepted: 'LI accepted',
  linkedin_message: 'LI message',
  linkedin_reply: 'LI reply',
  linkedin_followup: 'LI follow-up',
  meeting_scheduled: 'Meeting scheduled',
  reply: 'Reply',
  status_change: 'Stage change',
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
  if (!data) return <div className="card">Loading BD working…</div>;

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
          <h1 className="page-title">{canViewTeam ? 'BD working (CEO view)' : 'My working'}</h1>
          <p className="page-sub">
            {label}
            {fromYmd === toYmd ? ` · ${fromYmd}` : ` · ${fromYmd} → ${toYmd}`}
            {` · ${timezone}`}
            {focusRep ? ` · ${focusRep.name}` : ''}
          </p>
          {canViewTeam ? (
            <p className="stat-hint" style={{ margin: '0.35rem 0 0' }}>
              Left side = activity volume (emails, LinkedIn, calls). Right side = unique leads that moved stages.
            </p>
          ) : null}
        </div>
        <PeriodChips value={period} onChange={setPeriod} />
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>1. What BDs did (activities)</h3>
        <p className="stat-hint" style={{ marginTop: 0 }}>
          Raw work counts — one lead can have many emails / LinkedIn touches.
        </p>
        <div className="grid grid-4">
          <StatCard
            label="Leads added"
            value={totals.leadsAdded}
            hint={`${totals.leadsManual} manual · ${totals.leadsCsv} CSV`}
          />
          <StatCard
            label="Emails sent"
            value={(totals.emails || 0) + (totals.emailFollowups || 0)}
            hint={`${totals.emails || 0} first · ${totals.emailFollowups || 0} follow-ups`}
          />
          <StatCard
            label="LinkedIn actions"
            value={totals.linkedin}
            hint={`${totals.linkedinConnectionSent || 0} requests · ${totals.linkedinMessages || 0} msgs`}
          />
          <StatCard
            label="Calls"
            value={totals.calls}
            hint={`${totals.callsConnected || 0} connected · ${totals.messages || 0} WhatsApp`}
          />
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>2. What moved in the funnel (unique leads)</h3>
        <p className="stat-hint" style={{ marginTop: 0 }}>
          Stage changes — each number is a prospect, not an email.
        </p>
        <div className="grid grid-4">
          <StatCard label="Leads touched" value={totals.leadsTouched} hint="Unique prospects worked" />
          <StatCard label="Replies received" value={totals.replies} />
          <StatCard
            label="→ Engaged"
            value={totals.toEngaged ?? totals.toConversation}
            hint="Prospects who replied / engaged"
          />
          <StatCard label="→ Demo booked" value={totals.toDemo} />
        </div>
        <div className="grid grid-4" style={{ marginTop: '0.75rem' }}>
          <StatCard label="→ Trial / test" value={totals.toTrial} />
          <StatCard label="Paid" value={totals.paid} />
          <StatCard label="Follow-ups completed" value={totals.followupsCompleted} />
          <StatCard label="Meetings logged" value={totals.meetings} />
        </div>
      </div>

      {showTeamTable ? (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div>
              <h3 style={{ margin: 0 }}>3. Per BD comparison</h3>
              <p className="stat-hint" style={{ margin: '0.25rem 0 0' }}>
                Click a name to see their activity feed. Sort is by total outreach.
              </p>
            </div>
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
                  <th>BD</th>
                  <th>Leads added</th>
                  <th>Emails</th>
                  <th>LinkedIn</th>
                  <th>Calls</th>
                  <th>Touched</th>
                  <th>→ Engaged</th>
                  <th>→ Demo</th>
                  <th>Paid</th>
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
                        focusUserId === r.id
                          ? 'color-mix(in srgb, var(--brand-primary) 12%, transparent)'
                          : undefined,
                    }}
                    onClick={() => setFocusUser(r.id)}
                  >
                    <td>
                      <strong>{r.name}</strong>
                    </td>
                    <td>{r.leadsAdded}</td>
                    <td>{(r.emails || 0) + (r.emailFollowups || 0)}</td>
                    <td>{r.linkedin}</td>
                    <td>{r.calls}</td>
                    <td>{r.leadsTouched}</td>
                    <td>{r.toEngaged ?? r.toConversation}</td>
                    <td>{r.toDemo}</td>
                    <td>{r.paid}</td>
                    <td>{r.overdueFollowups}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                          {a.outcome ? <span className="stat-hint"> · {a.outcome}</span> : null}
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
            Select a BD above to see their call comments, notes, and leads added.
          </p>
        </div>
      )}

      {user?.role === 'telesales' && !totals.totalOutreach && !totals.leadsAdded ? (
        <div className="card" style={{ marginTop: '1rem' }}>
          <p style={{ margin: 0 }}>
            Tip: log every call, LinkedIn touch, and email from the lead panel so your working shows here.
          </p>
        </div>
      ) : null}
    </div>
  );
}
