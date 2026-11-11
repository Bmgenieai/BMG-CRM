import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, downloadApiFile } from '../api.js';
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
  // Leftmost = everyone still in the funnel (New or further), not only uncontacted stock.
  { key: 'uncontacted', label: 'In pipeline' },
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
  const [period, setPeriod] = useState('yesterday');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [funnel, setFunnel] = useState(null);
  const [bdWork, setBdWork] = useState(null);
  const [error, setError] = useState('');
  const [drilldown, setDrilldown] = useState(null);
  const [activeLeadId, setActiveLeadId] = useState(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [reportMsg, setReportMsg] = useState('');

  const isChatSupport = user?.role === 'chat_support';
  const canViewTeam = can('analytics:view_team');
  const hasCustomDates = Boolean(dateFrom && dateTo);

  const filterQuery = useMemo(() => {
    const p = new URLSearchParams();
    if (hasCustomDates) {
      p.set('from', dateFrom);
      p.set('to', dateTo);
    } else {
      p.set('period', period);
    }
    return p.toString();
  }, [hasCustomDates, dateFrom, dateTo, period]);

  useEffect(() => {
    if (isChatSupport) return undefined;
    setError('');
    setFunnel(null);
    setBdWork(null);
    Promise.all([
      api(`/analytics/funnel?${filterQuery}`),
      api(`/analytics/telesales-working?${filterQuery}`).catch(() => null),
    ])
      .then(([funnelData, working]) => {
        setFunnel(funnelData);
        setBdWork(working);
      })
      .catch((e) => setError(e.message));
    return undefined;
  }, [filterQuery, isChatSupport]);

  const reps = useMemo(() => {
    const rows = bdWork?.reps || [];
    if (canViewTeam) return rows;
    return rows.filter((r) => r.id === user?.id);
  }, [bdWork?.reps, canViewTeam, user?.id]);

  if (isChatSupport) return <ChatSupportDashboard />;

  const selectPeriod = (key) => {
    setPeriod(key);
    setDateFrom('');
    setDateTo('');
  };

  const downloadReport = async (forUserId) => {
    setReportBusy(true);
    setReportMsg('');
    try {
      const q = new URLSearchParams(filterQuery);
      if (forUserId) q.set('userId', forUserId);
      const name = await downloadApiFile(`/analytics/daily-report?${q}`, 'BD_daily_report.csv');
      setReportMsg(`Downloaded ${name}`);
    } catch (e) {
      setReportMsg(e.message || 'Report download failed');
    } finally {
      setReportBusy(false);
    }
  };

  const openDrilldown = (metric, title, extra = {}) => {
    setDrilldown({
      metric,
      title: title || String(metric).replace(/_/g, ' '),
      period: hasCustomDates ? 'custom' : period,
      dateFrom: hasCustomDates ? dateFrom : undefined,
      dateTo: hasCustomDates ? dateTo : undefined,
      cumulative: false,
      ...extra,
    });
  };

  const periodObj = DASHBOARD_PERIODS.find((p) => p.key === period) || DASHBOARD_PERIODS[0];
  const periodLabel = hasCustomDates
    ? dateFrom === dateTo
      ? dateFrom
      : `${dateFrom} → ${dateTo}`
    : funnel?.periodLabel || periodObj.label;
  const totals = bdWork?.totals || {};
  const stages = funnel?.stages || {};
  const firstEmails = totals.crmFirstEmails ?? totals.emails ?? 0;
  const followupEmails = totals.crmFollowupEmails ?? totals.emailFollowups ?? 0;
  const emailsSent =
    totals.crmEmailsSent != null
      ? totals.crmEmailsSent
      : (totals.emails || 0) + (totals.emailFollowups || 0);
  const overdueFollowups = reps.reduce((s, r) => s + (Number(r.overdueFollowups) || 0), 0);
  const workingLinkQs = filterQuery;

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
            <strong>{periodLabel}</strong>
          </p>
        </div>
        <div className="ceo-dashboard-filters" role="group" aria-label="Dashboard date filters">
          <div className="ceo-period-chips" role="group" aria-label="Date period">
            {DASHBOARD_PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                className={`btn ${!hasCustomDates && period === p.key ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => selectPeriod(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <span className="ceo-filter-divider" aria-hidden="true" />
          <div className="ceo-date-range" role="group" aria-label="Custom date range">
            <label className="ceo-date-field">
              <span>From</span>
              <input
                type="date"
                className="input"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) => {
                  const v = e.target.value;
                  setDateFrom(v);
                  if (v && !dateTo) setDateTo(v);
                }}
              />
            </label>
            <span className="ceo-date-sep">–</span>
            <label className="ceo-date-field">
              <span>To</span>
              <input
                type="date"
                className="input"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => {
                  const v = e.target.value;
                  setDateTo(v);
                  if (v && !dateFrom) setDateFrom(v);
                }}
              />
            </label>
            {hasCustomDates ? (
              <button
                type="button"
                className="btn btn-ghost ceo-date-clear"
                onClick={() => selectPeriod(period)}
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {reportMsg ? (
        <p className="stat-hint" style={{ marginTop: 0, marginBottom: '0.75rem' }}>
          {reportMsg}
        </p>
      ) : null}

      {/* 1) Snapshot — team totals once */}
      <div className="grid grid-5" style={{ marginBottom: '0.75rem' }}>
        <SnapshotCard
          label="Leads added"
          value={totals.leadsAdded ?? 0}
          hint={`${periodLabel}`}
          onClick={() => openDrilldown('leads_added', `Leads added (${periodLabel})`)}
        />
        <SnapshotCard
          label="First emails"
          value={firstEmails}
          hint="New / email 1"
          onClick={() => openDrilldown('emails_sent', `First emails (${periodLabel})`)}
        />
        <SnapshotCard
          label="Follow-up emails"
          value={followupEmails}
          hint="Email 2, 3, …"
          onClick={() => openDrilldown('email_followups', `Follow-up emails (${periodLabel})`)}
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
      </div>
      <p className="stat-hint" style={{ marginTop: 0, marginBottom: '1rem' }}>
        Total emails sent: <strong>{emailsSent}</strong>
        {` (${firstEmails} first + ${followupEmails} follow-up)`}
        {overdueFollowups > 0 ? (
          <>
            {' · '}
            <button
              type="button"
              className="table-num-btn"
              style={{ color: 'var(--danger)' }}
              onClick={() => openDrilldown('followups_overdue', 'Overdue follow-ups')}
            >
              {overdueFollowups} overdue follow-ups
            </button>
          </>
        ) : null}
      </p>

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
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {!canViewTeam ? (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.85rem' }}
                disabled={reportBusy}
                onClick={() => downloadReport(user?.id)}
                title="Download CSV activity report for this period"
              >
                {reportBusy ? 'Preparing…' : 'Download my daily report'}
              </button>
            ) : null}
            {canViewTeam ? (
              <Link
                to={`/telesales-working?${workingLinkQs}`}
                className="btn btn-ghost"
                style={{ fontSize: '0.85rem' }}
              >
                BD Working →
              </Link>
            ) : null}
          </div>
        </div>

        <div className="table-wrap">
          <table className="leads-table">
            <thead>
              <tr>
                <th>BD</th>
                <th>Leads added</th>
                <th>First emails</th>
                <th>Follow-ups</th>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <Link
                          to={`/telesales-working?${workingLinkQs}&userId=${r.id}`}
                          style={{ color: 'var(--brand-primary)', fontWeight: 600 }}
                          title={`Open full detail for ${r.name}`}
                        >
                          {r.name}
                        </Link>
                        {canViewTeam ? (
                          <button
                            type="button"
                            className="btn btn-ghost"
                            style={{ fontSize: '0.75rem', padding: '0.15rem 0.45rem' }}
                            disabled={reportBusy}
                            onClick={() => downloadReport(r.id)}
                            title={`Download ${r.name}'s activity report`}
                          >
                            Report
                          </button>
                        ) : null}
                      </div>
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
                          openDrilldown('emails_sent', `${r.name} — first emails`, { userId: r.id })
                        }
                      >
                        {r.crmFirstEmails ?? r.emails ?? 0}
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="table-num-btn"
                        onClick={() =>
                          openDrilldown('email_followups', `${r.name} — follow-ups`, {
                            userId: r.id,
                          })
                        }
                      >
                        {r.crmFollowupEmails ?? r.emailFollowups ?? 0}
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
                  <td colSpan={8} className="empty">
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
          Closed — no more BD work:{' '}
          <button
            type="button"
            className="table-num-btn"
            style={{ fontWeight: 700 }}
            onClick={() => openDrilldown('stage', 'Completed leads', { stage: 'completed' })}
          >
            Completed {stages.completed ?? 0}
          </button>
          {' · '}
          <button
            type="button"
            className="table-num-btn"
            style={{ fontWeight: 700 }}
            onClick={() => openDrilldown('stage', 'Not interested leads', { stage: 'nurture' })}
          >
            Not interested {stages.nurture ?? 0}
          </button>
        </p>
      </div>

      {/* 4) By profession + by US state — same period chips */}
      <div className="dashboard-split" style={{ marginBottom: '1rem' }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>By profession</h3>
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
          dateFrom={drilldown.dateFrom}
          dateTo={drilldown.dateTo}
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
