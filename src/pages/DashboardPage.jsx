import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { money, SourceBadge, StatusBadge } from '../components/Badges.jsx';

function FunnelStep({ label, value, to, hint }) {
  return (
    <div className="funnel-step">
      {to ? (
        <Link to={to} className="funnel-step-link">
          <div className="funnel-step-value">{value ?? 0}</div>
          <div className="funnel-step-label">{label}</div>
        </Link>
      ) : (
        <>
          <div className="funnel-step-value">{value ?? 0}</div>
          <div className="funnel-step-label">{label}</div>
        </>
      )}
      {hint ? <div className="funnel-step-rate">{hint}</div> : null}
    </div>
  );
}

function ActivityStat({ label, value }) {
  return (
    <div className="activity-stat">
      <div className="activity-stat-value">{value ?? 0}</div>
      <div className="activity-stat-label">{label}</div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, can } = useAuth();
  const [data, setData] = useState(null);
  const [funnel, setFunnel] = useState(null);
  const [todayWork, setTodayWork] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api('/analytics/overview'),
      api('/analytics/funnel'),
      api('/analytics/telesales-working?period=today').catch(() => null),
    ])
      .then(([overview, funnelData, working]) => {
        setData(overview);
        setFunnel(funnelData);
        setTodayWork(working);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="card">{error}</div>;
  if (!data || !funnel) return <div className="card">Loading analytics…</div>;

  const { totals, bySource, revenue, performance, recentLeads, followUpHealth } = data;
  const { stages, activities, outreach, rates, lostReasons } = funnel;
  const act = activities || {};

  return (
    <div>
      <h1 className="page-title">
        {user.role === 'ceo' ? 'CEO command center' : user.role === 'manager' ? 'Manager overview' : 'My dashboard'}
      </h1>
      <p className="page-sub">
        Activities = work volume. Funnel = unique leads (one prospect, one stage). Sending 1,000 emails ≠ 1,000 opportunities.
      </p>

      {todayWork?.totals ? (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <h3 style={{ margin: 0 }}>
                {can('analytics:view_team') ? "Today's BD work (plain English)" : "Today's work"}
              </h3>
              <p className="stat-hint" style={{ margin: '0.25rem 0 0' }}>
                {todayWork.timezone} · what the team actually did today
              </p>
            </div>
            <Link to="/telesales-working?period=today" className="btn btn-secondary">
              Open BD working report
            </Link>
          </div>
          <div className="grid grid-4" style={{ marginTop: '0.75rem' }}>
            <div>
              <p className="stat-label">Leads added</p>
              <p className="stat-value" style={{ fontSize: '1.35rem' }}>
                {todayWork.totals.leadsAdded ?? 0}
              </p>
            </div>
            <div>
              <p className="stat-label">Emails sent</p>
              <p className="stat-value" style={{ fontSize: '1.35rem' }}>
                {(todayWork.totals.emails || 0) + (todayWork.totals.emailFollowups || 0)}
              </p>
            </div>
            <div>
              <p className="stat-label">LinkedIn actions</p>
              <p className="stat-value" style={{ fontSize: '1.35rem' }}>
                {todayWork.totals.linkedin ?? 0}
              </p>
            </div>
            <div>
              <p className="stat-label">Calls</p>
              <p className="stat-value" style={{ fontSize: '1.35rem' }}>
                {todayWork.totals.calls ?? 0}
              </p>
            </div>
          </div>
          <div className="grid grid-4" style={{ marginTop: '0.5rem' }}>
            <div>
              <p className="stat-label">Replies received</p>
              <p className="stat-value" style={{ fontSize: '1.15rem' }}>
                {todayWork.totals.replies ?? 0}
              </p>
            </div>
            <div>
              <p className="stat-label">Moved to Engaged</p>
              <p className="stat-value" style={{ fontSize: '1.15rem' }}>
                {todayWork.totals.toEngaged ?? todayWork.totals.toConversation ?? 0}
              </p>
            </div>
            <div>
              <p className="stat-label">Demos booked</p>
              <p className="stat-value" style={{ fontSize: '1.15rem' }}>
                {todayWork.totals.toDemo ?? 0}
              </p>
            </div>
            <div>
              <p className="stat-label">Paid this period</p>
              <p className="stat-value" style={{ fontSize: '1.15rem' }}>
                {todayWork.totals.paid ?? 0}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="card" style={{ marginBottom: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Activity dashboard</h3>
        <p className="stat-hint" style={{ marginTop: 0 }}>
          Completed work counts — emails and LinkedIn actions can exceed unique leads.
        </p>
        <div className="activity-grid">
          <ActivityStat label="New leads added" value={act.leadsAdded} />
          <ActivityStat label="Leads verified" value={act.leadsVerified} />
          <ActivityStat label="Emails sent" value={act.emailsSent} />
          <ActivityStat label="Email opens" value={act.emailOpens} />
          <ActivityStat label="Email replies" value={act.emailReplies} />
          <ActivityStat label="Follow-ups sent" value={act.followupsSent} />
          <ActivityStat label="LI connection requests" value={act.linkedinConnectionSent} />
          <ActivityStat label="LI connections accepted" value={act.linkedinConnectionAccepted} />
          <ActivityStat label="LinkedIn messages" value={act.linkedinMessages} />
          <ActivityStat label="LinkedIn replies" value={act.linkedinReplies} />
          <ActivityStat label="Calls attempted" value={act.callsAttempted} />
          <ActivityStat label="Calls connected" value={act.callsConnected} />
          <ActivityStat label="Positive replies" value={act.positiveReplies} />
          <ActivityStat label="Meetings requested" value={act.meetingsRequested} />
          <ActivityStat label="Demos booked" value={act.demosBooked} />
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Conversion funnel</h3>
        <p className="stat-hint" style={{ marginTop: 0 }}>
          Unique prospects only — each lead appears in one stage.
        </p>
        <div className="funnel-flow">
          <FunnelStep label="Uncontacted" value={stages.uncontacted} to="/leads/uncontacted" />
          <span className="funnel-arrow">→</span>
          <FunnelStep label="Contacted" value={stages.contacted} to="/leads/contacted" />
          <span className="funnel-arrow">→</span>
          <FunnelStep label="Engaged" value={stages.engaged} to="/leads/engaged" />
          <span className="funnel-arrow">→</span>
          <FunnelStep label="Qualified" value={stages.qualified} to="/leads/qualified" />
          <span className="funnel-arrow">→</span>
          <FunnelStep label="Demo scheduled" value={stages.demoScheduled} to="/leads/demo-scheduled" />
          <span className="funnel-arrow">→</span>
          <FunnelStep label="Challenge offered" value={stages.challengeOffered} to="/leads/challenge-offered" />
          <span className="funnel-arrow">→</span>
          <FunnelStep label="Challenge accepted" value={stages.challengeAccepted} to="/leads/challenge-accepted" />
          <span className="funnel-arrow">→</span>
          <FunnelStep label="Test done" value={stages.trials} to="/leads/trial" />
          <span className="funnel-arrow">→</span>
          <FunnelStep label="Paid" value={stages.paid} to="/leads/paid" />
          <span className="funnel-arrow">→</span>
          <FunnelStep label="Repeat" value={stages.repeat} to="/leads/repeat" />
        </div>
        <p className="stat-hint" style={{ marginBottom: 0 }}>
          Reply rate {rates.replyRate}% · Positive reply {rates.positiveReplyRate}% · Show rate{' '}
          {rates.showRate}% · Paid conversion {rates.conversionRate}% · Nurture/DQ{' '}
          {stages.nurture ?? 0}
        </p>
      </div>

      <div className="grid grid-4" style={{ marginBottom: '1rem' }}>
        <div className="card">
          <p className="stat-label">Open pipeline</p>
          <p className="stat-value">{totals.open_leads ?? 0}</p>
          <Link to="/leads" className="stat-hint" style={{ color: 'var(--brand-primary)' }}>
            View all leads →
          </Link>
        </div>
        <div className="card">
          <p className="stat-label">Paid</p>
          <p className="stat-value">{stages.paid}</p>
          <p className="stat-hint">{rates.conversionRate}% of all leads</p>
        </div>
        {can('revenue:view') ? (
          <div className="card">
            <p className="stat-label">Recorded revenue</p>
            <p className="stat-value">{money(revenue.recorded)}</p>
            <p className="stat-hint">{money(revenue.last30Days)} last 30 days</p>
          </div>
        ) : (
          <div className="card">
            <p className="stat-label">My paid</p>
            <p className="stat-value">{performance[0]?.converted ?? 0}</p>
            <p className="stat-hint">{performance[0]?.conversionRate ?? 0}% rate</p>
          </div>
        )}
        <div className="card">
          <p className="stat-label">Follow-up health</p>
          <p className="stat-value">{followUpHealth?.overdue || 0}</p>
          <p className="stat-hint">
            overdue · {followUpHealth?.pending || 0} pending · {followUpHealth?.completed || 0} done
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Quick queues</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link to="/leads/uncontacted" className="btn btn-secondary">
            Uncontacted ({stages.uncontacted ?? 0})
          </Link>
          <Link to="/leads/engaged" className="btn btn-secondary">
            Engaged ({stages.engaged ?? 0})
          </Link>
          <Link to="/leads/demo-scheduled" className="btn btn-secondary">
            Demos ({stages.demoScheduled ?? 0})
          </Link>
          <Link to="/leads?followUpDue=today" className="btn btn-secondary">
            Due follow-up today
          </Link>
          <Link to="/leads/paid" className="btn btn-primary">
            Paid ({stages.paid ?? 0})
          </Link>
          <Link to="/email" className="btn btn-secondary">
            Cold email
          </Link>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Nurture / DQ reasons</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Reason</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                {(lostReasons || []).length ? (
                  lostReasons.map((r) => (
                    <tr key={r.reason}>
                      <td>{r.reason}</td>
                      <td>{r.count}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={2} className="empty">
                      None yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Leads by source</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Leads</th>
                  <th>Paid</th>
                  <th>Rate</th>
                </tr>
              </thead>
              <tbody>
                {bySource.map((s) => (
                  <tr key={s.source}>
                    <td>{s.label}</td>
                    <td>{s.count}</td>
                    <td>{s.converted}</td>
                    <td>{s.conversionRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <h3 style={{ margin: 0 }}>
            {can('analytics:view_team') ? 'BD scoreboard' : 'My performance'}
          </h3>
          <Link to="/telesales-working" className="btn btn-ghost">
            Full BD working →
          </Link>
        </div>
        <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
          <table>
            <thead>
              <tr>
                <th>BD</th>
                <th>Assigned leads</th>
                <th>Paid</th>
                <th>Win rate</th>
                <th>Overdue follow-ups</th>
              </tr>
            </thead>
            <tbody>
              {performance.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.leads_assigned}</td>
                  <td>{p.converted}</td>
                  <td>{p.conversionRate}%</td>
                  <td>{p.overdue_followups ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Recent leads</h3>
          <Link to="/leads" className="btn btn-secondary">
            View all
          </Link>
        </div>
        <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Source</th>
                <th>Status</th>
                <th>Country</th>
              </tr>
            </thead>
            <tbody>
              {recentLeads.map((l) => (
                <tr key={l.id}>
                  <td>
                    <Link to={`/leads?id=${l.id}`} style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>
                      {l.name}
                    </Link>
                  </td>
                  <td>
                    <SourceBadge source={l.source} />
                  </td>
                  <td>
                    <StatusBadge status={l.status} />
                  </td>
                  <td>{l.country || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
