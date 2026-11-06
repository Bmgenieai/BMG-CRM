import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import DrilldownModal from '../components/DrilldownModal.jsx';
import LeadPanel from '../components/LeadPanel.jsx';
import ChatSupportDashboard from './ChatSupportDashboard.jsx';

const DASHBOARD_PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'overall', label: 'Overall' },
];

/**
 * Pipeline left → right. Display count = leads at this stage OR further
 * (so numbers always go high → low). Hidden statuses (challenge/trial) still
 * count toward “Demo or further”.
 */
const PIPELINE_STAGES = [
  { key: 'uncontacted', label: 'New' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'engaged', label: 'Engaged' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'demo_scheduled', label: 'Demo' },
  { key: 'paid', label: 'Paid' },
  { key: 'repeat', label: 'Repeat' },
];

/** Full order for cumulative math (includes statuses not shown as boxes). */
const PIPELINE_CUMULATIVE_ORDER = [
  'uncontacted',
  'contacted',
  'engaged',
  'qualified',
  'demo_scheduled',
  'challenge_offered',
  'challenge_accepted',
  'trial',
  'paid',
  'repeat',
];

function stageStock(stages, key) {
  const map = {
    uncontacted: stages.uncontacted,
    contacted: stages.contacted,
    engaged: stages.engaged,
    qualified: stages.qualified,
    demo_scheduled: stages.demoScheduled,
    challenge_offered: stages.challengeOffered,
    challenge_accepted: stages.challengeAccepted,
    trial: stages.trials,
    paid: stages.paid,
    repeat: stages.repeat,
  };
  return Number(map[key]) || 0;
}

function cumulativeFromStage(stages, fromKey) {
  const idx = PIPELINE_CUMULATIVE_ORDER.indexOf(fromKey);
  if (idx < 0) return stageStock(stages, fromKey);
  return PIPELINE_CUMULATIVE_ORDER.slice(idx).reduce((sum, key) => sum + stageStock(stages, key), 0);
}

function SnapshotCard({ label, value, hint, danger, onClick }) {
  return (
    <div
      className="card snapshot-card"
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      title={onClick ? `Click to see ${label}` : undefined}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <p className="stat-label">{label}</p>
      <p
        className="stat-value"
        style={{
          fontSize: '1.75rem',
          color: danger && Number(value) > 0 ? 'var(--danger)' : undefined,
        }}
      >
        {value ?? 0}
      </p>
      {hint ? <p className="stat-hint" style={{ margin: 0 }}>{hint}</p> : null}
    </div>
  );
}

function FunnelStep({ label, value, onClick }) {
  return (
    <div
      className="funnel-step clickable"
      onClick={onClick}
      title={`Click to view ${label} leads`}
      style={{ cursor: 'pointer' }}
    >
      <div className="funnel-step-value">{value ?? 0}</div>
      <div className="funnel-step-label">{label}</div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, can } = useAuth();
  const [period, setPeriod] = useState('today');
  const [funnel, setFunnel] = useState(null);
  const [bdWork, setBdWork] = useState(null);
  const [error, setError] = useState('');
  const [drilldown, setDrilldown] = useState(null);
  const [activeLeadId, setActiveLeadId] = useState(null);

  const isChatSupport = user?.role === 'chat_support';
  const canViewTeam = can('analytics:view_team');

  useEffect(() => {
    if (isChatSupport) return undefined;
    setError('');
    Promise.all([
      api(`/analytics/funnel?period=${period}`),
      api(`/analytics/telesales-working?period=${period}`).catch(() => null),
    ])
      .then(([funnelData, working]) => {
        setFunnel(funnelData);
        setBdWork(working);
      })
      .catch((e) => setError(e.message));
    return undefined;
  }, [period, isChatSupport]);

  const reps = useMemo(() => {
    const rows = bdWork?.reps || [];
    if (canViewTeam) return rows;
    return rows.filter((r) => r.id === user?.id);
  }, [bdWork?.reps, canViewTeam, user?.id]);

  if (isChatSupport) return <ChatSupportDashboard />;

  const openDrilldown = (metric, title, extra = {}) => {
    setDrilldown({
      metric,
      title: title || String(metric).replace(/_/g, ' '),
      period,
      cumulative: false,
      ...extra,
    });
  };

  const periodObj = DASHBOARD_PERIODS.find((p) => p.key === period) || DASHBOARD_PERIODS[0];
  const periodLabel = periodObj.label;
  const totals = bdWork?.totals || {};
  const stages = funnel?.stages || {};
  const emailsSent = (totals.emails || 0) + (totals.emailFollowups || 0);
  const overdueFollowups = reps.reduce((s, r) => s + (Number(r.overdueFollowups) || 0), 0);

  if (error) return <div className="card">{error}</div>;
  if (!funnel || !bdWork) return <div className="card">Loading dashboard…</div>;

  return (
    <div className="ceo-dashboard">
      <div className="ceo-dashboard-header">
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>
            Dashboard
          </h1>
          <p className="page-sub" style={{ margin: '0.25rem 0 0' }}>
            {canViewTeam ? 'Team results' : 'Your results'} for{' '}
            <strong>{periodLabel.toLowerCase()}</strong>
          </p>
        </div>
        <div className="ceo-period-chips" role="group" aria-label="Date period">
          {DASHBOARD_PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`btn ${period === p.key ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 1) Snapshot — team totals once */}
      <div className="grid grid-5" style={{ marginBottom: '1rem' }}>
        <SnapshotCard
          label="Leads added"
          value={totals.leadsAdded ?? 0}
          hint={`${periodLabel}`}
          onClick={() => openDrilldown('leads_added', `Leads added (${periodLabel})`)}
        />
        <SnapshotCard
          label="Emails sent"
          value={emailsSent}
          hint={`${periodLabel}`}
          onClick={() => openDrilldown('emails_sent', `Emails sent (${periodLabel})`)}
        />
        <SnapshotCard
          label="Replies got"
          value={totals.replies ?? 0}
          hint={`${periodLabel}`}
          onClick={() => openDrilldown('email_replies', `Replies (${periodLabel})`)}
        />
        <SnapshotCard
          label="Paid"
          value={totals.paid ?? 0}
          hint={`${periodLabel}`}
          onClick={() => openDrilldown('paid', `Paid (${periodLabel})`)}
        />
        <SnapshotCard
          label="Overdue follow-ups"
          value={overdueFollowups}
          danger
          hint="Needs action now"
          onClick={() => openDrilldown('followups_overdue', 'Overdue follow-ups')}
        />
      </div>

      {/* 2) BD table — by person only */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 12,
            flexWrap: 'wrap',
            marginBottom: '0.75rem',
          }}
        >
          <div>
            <h3 style={{ margin: 0 }}>{canViewTeam ? 'Who worked' : 'My work'}</h3>
            <p className="stat-hint" style={{ margin: '0.2rem 0 0' }}>
              Same period — click a name or number for details
            </p>
          </div>
          {canViewTeam ? (
            <Link
              to={`/telesales-working?period=${period}`}
              className="btn btn-ghost"
              style={{ fontSize: '0.85rem' }}
            >
              Full BD detail →
            </Link>
          ) : null}
        </div>

        <div className="table-wrap">
          <table className="leads-table">
            <thead>
              <tr>
                <th>BD</th>
                <th>Leads added</th>
                <th>Emails</th>
                <th>Calls</th>
                <th>LinkedIn</th>
                <th>Replies</th>
                <th>Paid</th>
              </tr>
            </thead>
            <tbody>
              {reps.length ? (
                reps.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link
                        to={`/telesales-working?period=${period}&userId=${r.id}`}
                        style={{ color: 'var(--brand-primary)', fontWeight: 600 }}
                        title={`Open full detail for ${r.name}`}
                      >
                        {r.name}
                      </Link>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="table-num-btn"
                        onClick={() =>
                          openDrilldown('leads_added', `${r.name} — leads added`, { userId: r.id })
                        }
                      >
                        {r.leadsAdded ?? 0}
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="table-num-btn"
                        onClick={() =>
                          openDrilldown('emails_sent', `${r.name} — emails`, { userId: r.id })
                        }
                      >
                        {(r.emails || 0) + (r.emailFollowups || 0)}
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="table-num-btn"
                        onClick={() => openDrilldown('calls', `${r.name} — calls`, { userId: r.id })}
                      >
                        {r.calls ?? 0}
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="table-num-btn"
                        onClick={() =>
                          openDrilldown('linkedin', `${r.name} — LinkedIn`, { userId: r.id })
                        }
                      >
                        {r.linkedin ?? 0}
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="table-num-btn"
                        onClick={() =>
                          openDrilldown('email_replies', `${r.name} — replies`, { userId: r.id })
                        }
                      >
                        {r.replies ?? 0}
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="table-num-btn"
                        onClick={() => openDrilldown('paid', `${r.name} — paid`, { userId: r.id })}
                      >
                        {r.paid ?? 0}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="empty">
                    No BD activity in this period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3) Pipeline — cumulative (high → low) */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Pipeline</h3>
        <p className="stat-hint" style={{ marginTop: 0 }}>
          Leads at this stage or further — numbers shrink left to right. Click to see who.
        </p>
        <div className="funnel-flow">
          {PIPELINE_STAGES.map((s, idx) => (
            <React.Fragment key={s.key}>
              {idx > 0 ? <span className="funnel-arrow">→</span> : null}
              <FunnelStep
                label={s.label}
                value={cumulativeFromStage(stages, s.key)}
                onClick={() =>
                  openDrilldown('stage', `${s.label} or further`, {
                    stage: s.key,
                    cumulative: true,
                  })
                }
              />
            </React.Fragment>
          ))}
        </div>
        <p className="stat-hint" style={{ marginBottom: 0, marginTop: '0.75rem' }}>
          Not interested:{' '}
          <button
            type="button"
            className="table-num-btn"
            style={{ fontWeight: 700 }}
            onClick={() => openDrilldown('stage', 'Not interested leads', { stage: 'nurture' })}
          >
            {stages.nurture ?? 0}
          </button>
        </p>
      </div>

      {/* 4) By profession + by US state — same period chips */}
      <div className="dashboard-split" style={{ marginBottom: '1rem' }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>By profession</h3>
          <p className="stat-hint" style={{ marginTop: 0 }}>
            Realtors, agencies, photographers — activity in{' '}
            <strong>{periodLabel.toLowerCase()}</strong>. Click a number for the list.
          </p>
          <div className="table-wrap">
            <table className="leads-table">
              <thead>
                <tr>
                  <th>Profession</th>
                  <th>Leads added</th>
                  <th>Emails</th>
                  <th>Replies</th>
                  <th>Paid</th>
                </tr>
              </thead>
              <tbody>
                {(funnel.byBusinessType || []).length ? (
                  funnel.byBusinessType.map((row) => (
                    <tr key={row.key}>
                      <td style={{ fontWeight: 600 }}>{row.label}</td>
                      <td>
                        <button
                          type="button"
                          className="table-num-btn"
                          onClick={() =>
                            openDrilldown('business_type', `${row.label} — leads added`, {
                              businessType: row.key,
                            })
                          }
                        >
                          {row.leadsAdded ?? 0}
                        </button>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="table-num-btn"
                          onClick={() =>
                            openDrilldown(
                              'emails_by_business_type',
                              `${row.label} — emails`,
                              { businessType: row.key },
                            )
                          }
                        >
                          {row.emailsSent ?? 0}
                        </button>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="table-num-btn"
                          onClick={() =>
                            openDrilldown('email_replies', `${row.label} — replies`, {
                              businessType: row.key,
                            })
                          }
                        >
                          {row.replies ?? 0}
                        </button>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="table-num-btn"
                          onClick={() =>
                            openDrilldown('paid', `${row.label} — paid`, {
                              businessType: row.key,
                            })
                          }
                        >
                          {row.paid ?? 0}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="empty">
                      No profession activity in this period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>By US state</h3>
          <p className="stat-hint" style={{ marginTop: 0 }}>
            Where leads came from and were worked — same period. Top states first.
          </p>
          <div className="table-wrap">
            <table className="leads-table">
              <thead>
                <tr>
                  <th>State</th>
                  <th>Leads added</th>
                  <th>Emails</th>
                  <th>Replies</th>
                  <th>Paid</th>
                </tr>
              </thead>
              <tbody>
                {(funnel.byState || []).length ? (
                  funnel.byState.map((row) => (
                    <tr key={row.key}>
                      <td style={{ fontWeight: 600 }}>{row.label}</td>
                      <td>
                        <button
                          type="button"
                          className="table-num-btn"
                          onClick={() =>
                            openDrilldown('by_state', `${row.label} — leads added`, {
                              state: row.key,
                            })
                          }
                        >
                          {row.leadsAdded ?? 0}
                        </button>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="table-num-btn"
                          onClick={() =>
                            openDrilldown('emails_by_state', `${row.label} — emails`, {
                              state: row.key,
                            })
                          }
                        >
                          {row.emailsSent ?? 0}
                        </button>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="table-num-btn"
                          onClick={() =>
                            openDrilldown('email_replies', `${row.label} — replies`, {
                              state: row.key,
                            })
                          }
                        >
                          {row.replies ?? 0}
                        </button>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="table-num-btn"
                          onClick={() =>
                            openDrilldown('paid', `${row.label} — paid`, {
                              state: row.key,
                            })
                          }
                        >
                          {row.paid ?? 0}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="empty">
                      No state activity in this period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {drilldown ? (
        <DrilldownModal
          title={drilldown.title}
          metric={drilldown.metric}
          period={drilldown.period}
          userId={drilldown.userId}
          stage={drilldown.stage}
          cumulative={drilldown.cumulative}
          businessType={drilldown.businessType}
          state={drilldown.state}
          reason={drilldown.reason}
          onClose={() => setDrilldown(null)}
          onOpenLead={(id) => setActiveLeadId(id)}
        />
      ) : null}

      {activeLeadId ? (
        <LeadPanel leadId={activeLeadId} onClose={() => setActiveLeadId(null)} onChanged={() => {}} />
      ) : null}
    </div>
  );
}
