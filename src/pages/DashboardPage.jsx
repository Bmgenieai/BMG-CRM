import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { money, BusinessTypeBadge, StateBadge, SourceBadge, StatusBadge } from '../components/Badges.jsx';
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

function FunnelStep({ label, value, hint, onClick }) {
  return (
    <div
      className="funnel-step clickable"
      onClick={onClick}
      title={`Click to view ${label} leads`}
      style={{ cursor: 'pointer' }}
    >
      <div className="funnel-step-value">{value ?? 0}</div>
      <div className="funnel-step-label">{label}</div>
      {hint ? <div className="funnel-step-rate">{hint}</div> : null}
    </div>
  );
}

function ActivityStat({ label, value, onClick }) {
  return (
    <div
      className="activity-stat clickable"
      onClick={onClick}
      title={`Click to view ${label}`}
      style={{ cursor: 'pointer' }}
    >
      <div className="activity-stat-value">{value ?? 0}</div>
      <div className="activity-stat-label">{label}</div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, can } = useAuth();
  const [period, setPeriod] = useState('today');
  const [data, setData] = useState(null);
  const [funnel, setFunnel] = useState(null);
  const [bdWork, setBdWork] = useState(null);
  const [error, setError] = useState('');
  const [drilldown, setDrilldown] = useState(null);
  const [activeLeadId, setActiveLeadId] = useState(null);

  const isChatSupport = user?.role === 'chat_support';

  useEffect(() => {
    if (isChatSupport) return undefined;
    Promise.all([
      api('/analytics/overview'),
      api(`/analytics/funnel?period=${period}`),
      api(`/analytics/telesales-working?period=${period}`).catch(() => null),
    ])
      .then(([overview, funnelData, working]) => {
        setData(overview);
        setFunnel(funnelData);
        setBdWork(working);
      })
      .catch((e) => setError(e.message));
    return undefined;
  }, [period, isChatSupport]);

  if (isChatSupport) return <ChatSupportDashboard />;

  const openDrilldown = (metric, title, extra = {}) => {
    setDrilldown({
      metric,
      title: title || String(metric).replace(/_/g, ' '),
      period,
      ...extra,
    });
  };

  if (error) return <div className="card">{error}</div>;
  if (!data || !funnel) return <div className="card">Loading analytics…</div>;

  const { totals, bySource, byBusinessType = [], byState = [], revenue, performance, recentLeads, followUpHealth } = data;
  const { stages, activities, outreach, rates, lostReasons } = funnel;
  const act = activities || {};

  const periodObj = DASHBOARD_PERIODS.find((p) => p.key === period) || DASHBOARD_PERIODS[0];

  return (
    <div>
      {/* Top Header and Period Filter */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: '0.75rem',
        }}
      >
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>
            {user.role === 'ceo' ? 'Command center' : user.role === 'manager' ? 'Manager overview' : 'My dashboard'}
          </h1>
          <p className="page-sub" style={{ margin: '0.25rem 0 0' }}>
            Activities = work volume. Funnel = unique leads (one prospect, one stage). Click any number to see exact leads/working.
          </p>
        </div>

        {/* Global Period Filter Chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <span className="stat-hint" style={{ marginRight: 4, fontWeight: 600 }}>Period:</span>
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

      {/* 1. BD Work (Image 1 Section 1) */}
      {bdWork?.totals ? (
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
                {period === 'today'
                  ? (can('analytics:view_team') ? "Today's BD work (plain English)" : "Today's work")
                  : `${periodObj.label}'s BD work`}
              </h3>
              <p className="stat-hint" style={{ margin: '0.25rem 0 0' }}>
                {bdWork.timezone} · team outreach in <strong>{periodObj.label.toLowerCase()}</strong> (click any count to view)
              </p>
            </div>
            <Link to={`/telesales-working?period=${period}`} className="btn btn-secondary">
              Open full BD report ({periodObj.label})
            </Link>
          </div>

          <div className="grid grid-6" style={{ marginTop: '0.75rem' }}>
            <div
              className="stat-clickable"
              onClick={() => openDrilldown('leads_added', `Leads added (${periodObj.label})`)}
              title="Click to view added leads"
            >
              <p className="stat-label">Leads added</p>
              <p className="stat-value" style={{ fontSize: '1.35rem' }}>
                {bdWork.totals.leadsAdded ?? 0}
              </p>
              <span className="stat-hint" style={{ fontSize: '0.72rem' }}>
                {bdWork.totals.leadsManual ?? 0} manual · {bdWork.totals.leadsCsv ?? 0} CSV
              </span>
            </div>

            <div
              className="stat-clickable"
              onClick={() => openDrilldown('emails_sent', `Emails sent (${periodObj.label})`)}
              title="Click to view emails sent"
            >
              <p className="stat-label">Emails sent</p>
              <p className="stat-value" style={{ fontSize: '1.35rem' }}>
                {(bdWork.totals.emails || 0) + (bdWork.totals.emailFollowups || 0)}
              </p>
              <span className="stat-hint" style={{ fontSize: '0.72rem' }}>
                {bdWork.totals.emails ?? 0} initial · {bdWork.totals.emailFollowups ?? 0} follow-ups
              </span>
            </div>

            <div
              className="stat-clickable"
              onClick={() => openDrilldown('linkedin', `LinkedIn actions (${periodObj.label})`)}
              title="Click to view LinkedIn working"
            >
              <p className="stat-label">LinkedIn actions</p>
              <p className="stat-value" style={{ fontSize: '1.35rem' }}>
                {bdWork.totals.linkedin ?? 0}
              </p>
              <span className="stat-hint" style={{ fontSize: '0.72rem' }}>
                {bdWork.totals.linkedinConnectionSent ?? 0} requests · {bdWork.totals.linkedinMessages ?? 0} msgs
              </span>
            </div>

            <div
              className="stat-clickable"
              onClick={() => openDrilldown('facebook', `Facebook actions (${periodObj.label})`)}
              title="Click to view Facebook working"
            >
              <p className="stat-label">Facebook actions</p>
              <p className="stat-value" style={{ fontSize: '1.35rem' }}>
                {bdWork.totals.facebook ?? 0}
              </p>
              <span className="stat-hint" style={{ fontSize: '0.72rem' }}>
                {bdWork.totals.facebookMessages ?? 0} msgs · {bdWork.totals.facebookReplies ?? 0} replies
              </span>
            </div>

            <div
              className="stat-clickable"
              onClick={() => openDrilldown('instagram', `Instagram actions (${periodObj.label})`)}
              title="Click to view Instagram working"
            >
              <p className="stat-label">Instagram actions</p>
              <p className="stat-value" style={{ fontSize: '1.35rem' }}>
                {bdWork.totals.instagram ?? 0}
              </p>
              <span className="stat-hint" style={{ fontSize: '0.72rem' }}>
                {bdWork.totals.instagramMessages ?? 0} msgs · {bdWork.totals.instagramReplies ?? 0} replies
              </span>
            </div>

            <div
              className="stat-clickable"
              onClick={() => openDrilldown('calls', `Calls (${periodObj.label})`)}
              title="Click to view calls"
            >
              <p className="stat-label">Calls</p>
              <p className="stat-value" style={{ fontSize: '1.35rem' }}>
                {bdWork.totals.calls ?? 0}
              </p>
              <span className="stat-hint" style={{ fontSize: '0.72rem' }}>
                {bdWork.totals.callsConnected ?? 0} connected · {bdWork.totals.messages ?? 0} WhatsApp
              </span>
            </div>
          </div>

          <div className="grid grid-5" style={{ marginTop: '0.65rem' }}>
            <div
              className="stat-clickable"
              onClick={() => openDrilldown('email_replies', `Replies received (${periodObj.label})`)}
              title="Click to view replies"
            >
              <p className="stat-label">Replies received</p>
              <p className="stat-value" style={{ fontSize: '1.15rem' }}>
                {bdWork.totals.replies ?? 0}
              </p>
            </div>

            <div
              className="stat-clickable"
              onClick={() => openDrilldown('to_engaged', `Moved to Engaged (${periodObj.label})`)}
              title="Click to view engaged leads"
            >
              <p className="stat-label">Moved to Engaged</p>
              <p className="stat-value" style={{ fontSize: '1.15rem' }}>
                {bdWork.totals.toEngaged ?? bdWork.totals.toConversation ?? 0}
              </p>
            </div>

            <div
              className="stat-clickable"
              onClick={() => openDrilldown('followups_completed', `Follow-ups done (${periodObj.label})`)}
              title="Click to view completed follow-ups"
            >
              <p className="stat-label">Follow-ups done</p>
              <p className="stat-value" style={{ fontSize: '1.15rem' }}>
                {bdWork.totals.followupsCompleted ?? 0}
              </p>
            </div>

            <div
              className="stat-clickable"
              onClick={() => openDrilldown('demos_booked', `Demos booked (${periodObj.label})`)}
              title="Click to view demos"
            >
              <p className="stat-label">Demos booked</p>
              <p className="stat-value" style={{ fontSize: '1.15rem' }}>
                {bdWork.totals.toDemo ?? 0}
              </p>
            </div>

            <div
              className="stat-clickable"
              onClick={() => openDrilldown('paid', `Paid leads (${periodObj.label})`)}
              title="Click to view paid leads"
            >
              <p className="stat-label">Paid this period</p>
              <p className="stat-value" style={{ fontSize: '1.15rem' }}>
                {bdWork.totals.paid ?? 0}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* 2. Activity Dashboard (Image 1 Section 2) */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0 }}>Activity dashboard</h3>
            <p className="stat-hint" style={{ margin: '0.2rem 0 0' }}>
              Completed work counts in <strong>{periodObj.label.toLowerCase()}</strong>. Click any box to inspect exact activities.
            </p>
          </div>
        </div>

        <div className="activity-grid" style={{ marginTop: '0.75rem' }}>
          <ActivityStat
            label="New leads added"
            value={act.leadsAdded}
            onClick={() => openDrilldown('leads_added', 'New leads added')}
          />
          <ActivityStat
            label="Leads verified"
            value={act.leadsVerified}
            onClick={() => openDrilldown('leads_verified', 'Verified leads (with email)')}
          />
          <ActivityStat
            label="Emails sent"
            value={act.emailsSent}
            onClick={() => openDrilldown('emails_sent', 'Emails sent')}
          />
          <ActivityStat
            label="Email opens"
            value={act.emailOpens}
            onClick={() => openDrilldown('email_opens', 'Email opens')}
          />
          <ActivityStat
            label="Email replies"
            value={act.emailReplies}
            onClick={() => openDrilldown('email_replies', 'Email replies')}
          />
          <ActivityStat
            label="Follow-ups completed"
            value={act.followupsCompleted}
            onClick={() => openDrilldown('followups_completed', 'Follow-ups completed')}
          />
          <ActivityStat
            label="Email follow-ups"
            value={act.emailFollowupsSent ?? act.followupsSent}
            onClick={() => openDrilldown('email_followups', 'Email follow-ups sent')}
          />
          <ActivityStat
            label="LI connection requests"
            value={act.linkedinConnectionSent}
            onClick={() => openDrilldown('linkedin_connection_sent', 'LinkedIn connection requests')}
          />
          <ActivityStat
            label="LI connections accepted"
            value={act.linkedinConnectionAccepted}
            onClick={() => openDrilldown('linkedin_connection_accepted', 'LinkedIn connections accepted')}
          />
          <ActivityStat
            label="LinkedIn messages"
            value={act.linkedinMessages}
            onClick={() => openDrilldown('linkedin_messages', 'LinkedIn messages')}
          />
          <ActivityStat
            label="LinkedIn replies"
            value={act.linkedinReplies}
            onClick={() => openDrilldown('linkedin_replies', 'LinkedIn replies')}
          />
          <ActivityStat
            label="Facebook actions"
            value={act.facebookTouches}
            onClick={() => openDrilldown('facebook', 'Facebook actions')}
          />
          <ActivityStat
            label="Instagram actions"
            value={act.instagramTouches}
            onClick={() => openDrilldown('instagram', 'Instagram actions')}
          />
          <ActivityStat
            label="Calls attempted"
            value={act.callsAttempted}
            onClick={() => openDrilldown('calls_attempted', 'Calls attempted')}
          />
          <ActivityStat
            label="Calls connected"
            value={act.callsConnected}
            onClick={() => openDrilldown('calls_connected', 'Calls connected')}
          />
          <ActivityStat
            label="Positive replies"
            value={act.positiveReplies}
            onClick={() => openDrilldown('positive_replies', 'Positive replies')}
          />
          <ActivityStat
            label="Meetings requested"
            value={act.meetingsRequested}
            onClick={() => openDrilldown('meetings_requested', 'Meetings requested')}
          />
          <ActivityStat
            label="Demos booked"
            value={act.demosBooked}
            onClick={() => openDrilldown('demos_booked', 'Demos booked')}
          />
        </div>
      </div>

      {/* 3. Outreach by Business Type (Requirement 5) */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0 }}>Outreach by business type</h3>
            <p className="stat-hint" style={{ margin: '0.2rem 0 0' }}>
              CEO breakdown across prospect segments (Realtors, Owners, Agencies, Individuals, Photographers). Click any number to see records.
            </p>
          </div>
        </div>

        <div className="grid grid-3" style={{ marginTop: '0.75rem', gap: 10 }}>
          {byBusinessType.map((b) => (
            <div
              key={b.key}
              style={{
                background: 'var(--alabaster, #f8fafc)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '0.85rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <strong>{b.label}</strong>
                <BusinessTypeBadge type={b.key} />
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <div
                  className="stat-clickable"
                  style={{ flex: 1, padding: 4 }}
                  onClick={() => openDrilldown('business_type', `${b.label} Leads`, { businessType: b.key })}
                  title={`View all ${b.label} leads`}
                >
                  <p className="stat-label" style={{ fontSize: '0.75rem', margin: 0 }}>Leads</p>
                  <p className="stat-value" style={{ fontSize: '1.2rem', margin: '2px 0 0' }}>{b.leadsCount}</p>
                </div>

                <div
                  className="stat-clickable"
                  style={{ flex: 1, padding: 4 }}
                  onClick={() => openDrilldown('emails_by_business_type', `Emails to ${b.label}`, { businessType: b.key })}
                  title={`View emails sent to ${b.label}`}
                >
                  <p className="stat-label" style={{ fontSize: '0.75rem', margin: 0 }}>Emails sent</p>
                  <p className="stat-value" style={{ fontSize: '1.2rem', margin: '2px 0 0', color: 'var(--brand-primary)' }}>{b.emailsSent}</p>
                </div>

                <div
                  className="stat-clickable"
                  style={{ flex: 1, padding: 4 }}
                  onClick={() => openDrilldown('email_replies', `Replies from ${b.label}`, { businessType: b.key })}
                  title={`View replies from ${b.label}`}
                >
                  <p className="stat-label" style={{ fontSize: '0.75rem', margin: 0 }}>Replies</p>
                  <p className="stat-value" style={{ fontSize: '1.2rem', margin: '2px 0 0' }}>{b.repliesCount}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Outreach by US state — BD geography */}
      {(user.role === 'ceo' || user.role === 'manager') && byState.length > 0 ? (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <h3 style={{ margin: 0 }}>Outreach by US state</h3>
              <p className="stat-hint" style={{ margin: '0.2rem 0 0' }}>
                See where BDs are working geographically. Click leads / emails / replies for that state.
              </p>
            </div>
            <Link to="/telesales-working" className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
              BD working by state →
            </Link>
          </div>
          <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
            <table>
              <thead>
                <tr>
                  <th>State</th>
                  <th>Leads</th>
                  <th>Emails sent</th>
                  <th>Replies</th>
                  <th>Paid / Repeat</th>
                </tr>
              </thead>
              <tbody>
                {byState.slice(0, 20).map((s) => (
                  <tr key={s.key}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <StateBadge state={s.label === 'Unspecified' ? null : s.label} />
                        <strong>{s.label}</strong>
                      </div>
                    </td>
                    <td>
                      <span
                        className="stat-clickable"
                        onClick={() =>
                          openDrilldown('by_state', `Leads in ${s.label}`, { state: s.key })
                        }
                      >
                        {s.leadsCount}
                      </span>
                    </td>
                    <td>
                      <span
                        className="stat-clickable"
                        onClick={() =>
                          openDrilldown('emails_by_state', `Emails to ${s.label}`, { state: s.key })
                        }
                      >
                        {s.emailsSent}
                      </span>
                    </td>
                    <td>
                      <span
                        className="stat-clickable"
                        onClick={() =>
                          openDrilldown('email_replies', `Replies from ${s.label}`, { state: s.key })
                        }
                      >
                        {s.repliesCount}
                      </span>
                    </td>
                    <td>{s.converted || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* 4. Conversion Funnel (Image 1 Section 3) */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Conversion funnel</h3>
        <p className="stat-hint" style={{ marginTop: 0 }}>
          Unique prospects only — each lead appears in one stage. Click any stage to open prospects in a modal.
        </p>
        <div className="funnel-flow">
          <FunnelStep
            label="Uncontacted"
            value={stages.uncontacted}
            onClick={() => openDrilldown('stage', 'Uncontacted leads', { stage: 'uncontacted' })}
          />
          <span className="funnel-arrow">→</span>
          <FunnelStep
            label="Contacted"
            value={stages.contacted}
            onClick={() => openDrilldown('stage', 'Contacted leads', { stage: 'contacted' })}
          />
          <span className="funnel-arrow">→</span>
          <FunnelStep
            label="Engaged"
            value={stages.engaged}
            onClick={() => openDrilldown('stage', 'Engaged leads', { stage: 'engaged' })}
          />
          <span className="funnel-arrow">→</span>
          <FunnelStep
            label="Qualified"
            value={stages.qualified}
            onClick={() => openDrilldown('stage', 'Qualified leads', { stage: 'qualified' })}
          />
          <span className="funnel-arrow">→</span>
          <FunnelStep
            label="Demo scheduled"
            value={stages.demoScheduled}
            onClick={() => openDrilldown('stage', 'Demo scheduled leads', { stage: 'demo_scheduled' })}
          />
          <span className="funnel-arrow">→</span>
          <FunnelStep
            label="Challenge offered"
            value={stages.challengeOffered}
            onClick={() => openDrilldown('stage', 'Challenge offered leads', { stage: 'challenge_offered' })}
          />
          <span className="funnel-arrow">→</span>
          <FunnelStep
            label="Challenge accepted"
            value={stages.challengeAccepted}
            onClick={() => openDrilldown('stage', 'Challenge accepted leads', { stage: 'challenge_accepted' })}
          />
          <span className="funnel-arrow">→</span>
          <FunnelStep
            label="Test done"
            value={stages.trials}
            onClick={() => openDrilldown('stage', 'Test completed leads', { stage: 'trial' })}
          />
          <span className="funnel-arrow">→</span>
          <FunnelStep
            label="Paid"
            value={stages.paid}
            onClick={() => openDrilldown('stage', 'Paid leads', { stage: 'paid' })}
          />
          <span className="funnel-arrow">→</span>
          <FunnelStep
            label="Repeat"
            value={stages.repeat}
            onClick={() => openDrilldown('stage', 'Repeat leads', { stage: 'repeat' })}
          />
        </div>
        <p className="stat-hint" style={{ marginBottom: 0 }}>
          Reply rate {rates.replyRate}% · Positive reply {rates.positiveReplyRate}% · Show rate{' '}
          {rates.showRate}% · Paid conversion {rates.conversionRate}% · Nurture/DQ{' '}
          <span
            style={{ cursor: 'pointer', textDecoration: 'underline' }}
            onClick={() => openDrilldown('stage', 'Nurture / Disqualified leads', { stage: 'nurture' })}
          >
            {stages.nurture ?? 0}
          </span>
        </p>
      </div>

      {/* 5. Summary Cards */}
      <div className="grid grid-4" style={{ marginBottom: '1rem' }}>
        <div
          className="card stat-clickable"
          onClick={() => openDrilldown('open_pipeline', 'Open pipeline leads')}
          title="Click to view open pipeline"
        >
          <p className="stat-label">Open pipeline</p>
          <p className="stat-value">{totals.open_leads ?? 0}</p>
          <span className="stat-hint" style={{ color: 'var(--brand-primary)' }}>
            View all open leads →
          </span>
        </div>

        <div
          className="card stat-clickable"
          onClick={() => openDrilldown('paid', 'Paid customers')}
          title="Click to view paid customers"
        >
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

        <div
          className="card stat-clickable"
          onClick={() => openDrilldown('followups_overdue', 'Overdue follow-ups')}
          title="Click to view overdue follow-ups"
        >
          <p className="stat-label">Follow-up health</p>
          <p className="stat-value" style={{ color: followUpHealth?.overdue > 0 ? 'var(--danger)' : undefined }}>
            {followUpHealth?.overdue || 0}
          </p>
          <p className="stat-hint">
            overdue · {followUpHealth?.pending || 0} pending · {followUpHealth?.completed || 0} done
          </p>
        </div>
      </div>

      {/* 6. Quick Queues and Nurture Reasons */}
      <div className="grid grid-2">
        <div className="card">
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
                    <tr
                      key={r.reason}
                      className="clickable-row"
                      style={{ cursor: 'pointer' }}
                      onClick={() => openDrilldown('lost_reason', `Nurture: ${r.reason}`, { reason: r.reason })}
                      title="Click to view leads for this reason"
                    >
                      <td>{r.reason}</td>
                      <td>
                        <strong>{r.count}</strong>
                      </td>
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
      </div>

      {/* Drilldown Modal (Clicking any count) */}
      {drilldown && (
        <DrilldownModal
          title={drilldown.title}
          metric={drilldown.metric}
          period={drilldown.period}
          userId={drilldown.userId}
          stage={drilldown.stage}
          businessType={drilldown.businessType}
          state={drilldown.state}
          reason={drilldown.reason}
          onClose={() => setDrilldown(null)}
          onOpenLead={(id) => setActiveLeadId(id)}
        />
      )}

      {/* Lead Detail Drawer */}
      {activeLeadId && (
        <LeadPanel
          leadId={activeLeadId}
          onClose={() => setActiveLeadId(null)}
          onChanged={() => {
            // refresh
          }}
        />
      )}
    </div>
  );
}
