import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { fmtDate, StatusBadge, StateBadge } from '../components/Badges.jsx';
import DrilldownModal from '../components/DrilldownModal.jsx';
import LeadPanel from '../components/LeadPanel.jsx';

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'overall', label: 'Overall' },
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

function StatCard({ label, value, hint, onClick }) {
  return (
    <div
      className={`card ${onClick ? 'clickable' : ''}`}
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s ease',
      }}
      title={onClick ? `Click to inspect ${label}` : undefined}
    >
      <p className="stat-label">{label}</p>
      <p className="stat-value" style={{ color: 'var(--brand-primary)', margin: '0.2rem 0' }}>
        {value ?? 0}
      </p>
      {hint ? <p className="stat-hint" style={{ margin: 0 }}>{hint}</p> : null}
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
  const stateFilter = searchParams.get('state') || '';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [drilldown, setDrilldown] = useState(null);
  const [activeLeadId, setActiveLeadId] = useState(null);

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

  const setStateFilter = (next) => {
    const p = new URLSearchParams(searchParams);
    if (next) p.set('state', next);
    else p.delete('state');
    setSearchParams(p, { replace: true });
  };

  useEffect(() => {
    setError('');
    setData(null);
    const q = new URLSearchParams({ period });
    if (userId) q.set('userId', userId);
    if (stateFilter) q.set('state', stateFilter);
    api(`/analytics/telesales-working?${q}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [period, userId, stateFilter]);

  const openDrilldown = (metric, title, repId = null, extra = {}) => {
    setDrilldown({
      metric,
      title: title || String(metric).replace(/_/g, ' '),
      period,
      userId: repId || userId || undefined,
      state: stateFilter || undefined,
      ...extra,
    });
  };

  if (error) return <div className="card">{error}</div>;
  if (!data) return <div className="card">Loading BD working…</div>;

  const {
    totals,
    reps,
    byState = [],
    feed,
    leadsCreated,
    focusUserId,
    canViewTeam,
    label,
    fromYmd,
    toYmd,
    timezone,
  } = data;
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
              Left side = activity volume (emails, LinkedIn, calls). Right side = unique leads that moved stages. Click any number to inspect in a modal.
            </p>
          ) : null}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
          <PeriodChips value={period} onChange={setPeriod} />
          {canViewTeam ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className="stat-hint" style={{ fontWeight: 600 }}>State:</span>
              <select
                className="select"
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                style={{ minWidth: 160 }}
                title="Filter BD working by US state"
              >
                <option value="">All states</option>
                {byState.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
                {!byState.some((s) => s.key === 'unspecified') ? (
                  <option value="unspecified">Unspecified</option>
                ) : null}
              </select>
              {stateFilter ? (
                <button type="button" className="btn btn-ghost" onClick={() => setStateFilter('')}>
                  Clear state
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {canViewTeam && stateFilter ? (
        <p className="stat-hint" style={{ marginTop: 0, marginBottom: '0.75rem' }}>
          Showing BD working for state <strong>{stateFilter === 'unspecified' ? 'Unspecified' : stateFilter}</strong> only.
        </p>
      ) : null}

      {/* Section 1: What BDs did (activities) */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>1. What BDs did (activities)</h3>
        <p className="stat-hint" style={{ marginTop: 0 }}>
          Raw work counts — one lead can have many emails / LinkedIn / Facebook / Instagram touches.
          Click any card to see items.
        </p>
        <div className="grid grid-6">
          <StatCard
            label="Leads added"
            value={totals.leadsAdded}
            hint={`${totals.leadsManual} manual · ${totals.leadsCsv} CSV`}
            onClick={() => openDrilldown('leads_added', 'Leads added')}
          />
          <StatCard
            label="Emails sent"
            value={(totals.emails || 0) + (totals.emailFollowups || 0)}
            hint={`${totals.emails || 0} first · ${totals.emailFollowups || 0} follow-ups`}
            onClick={() => openDrilldown('emails_sent', 'Emails sent')}
          />
          <StatCard
            label="LinkedIn actions"
            value={totals.linkedin}
            hint={`${totals.linkedinConnectionSent || 0} requests · ${totals.linkedinMessages || 0} msgs`}
            onClick={() => openDrilldown('linkedin', 'LinkedIn actions')}
          />
          <StatCard
            label="Facebook actions"
            value={totals.facebook || 0}
            hint={`${totals.facebookMessages || 0} msgs · ${totals.facebookReplies || 0} replies`}
            onClick={() => openDrilldown('facebook', 'Facebook actions')}
          />
          <StatCard
            label="Instagram actions"
            value={totals.instagram || 0}
            hint={`${totals.instagramMessages || 0} msgs · ${totals.instagramReplies || 0} replies`}
            onClick={() => openDrilldown('instagram', 'Instagram actions')}
          />
          <StatCard
            label="Calls"
            value={totals.calls}
            hint={`${totals.callsConnected || 0} connected · ${totals.messages || 0} WhatsApp`}
            onClick={() => openDrilldown('calls', 'Calls')}
          />
        </div>
      </div>

      {/* Section 2: What moved in the funnel */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>2. What moved in the funnel (unique leads)</h3>
        <p className="stat-hint" style={{ marginTop: 0 }}>
          Stage changes — each number is a prospect, not an email. Click any card to inspect prospects.
        </p>
        <div className="grid grid-4">
          <StatCard
            label="Leads touched"
            value={totals.leadsTouched}
            hint="Unique prospects worked"
            onClick={() => openDrilldown('leads_touched', 'Unique leads touched')}
          />
          <StatCard
            label="Replies received"
            value={totals.replies}
            onClick={() => openDrilldown('email_replies', 'Replies received')}
          />
          <StatCard
            label="→ Engaged"
            value={totals.toEngaged ?? totals.toConversation}
            hint="Prospects who replied / engaged"
            onClick={() => openDrilldown('to_engaged', 'Moved to Engaged')}
          />
          <StatCard
            label="→ Demo booked"
            value={totals.toDemo}
            onClick={() => openDrilldown('to_demo', 'Demos booked')}
          />
        </div>
        <div className="grid grid-4" style={{ marginTop: '0.75rem' }}>
          <StatCard
            label="→ Trial / test"
            value={totals.toTrial}
            onClick={() => openDrilldown('to_trial', 'Trial / test leads')}
          />
          <StatCard
            label="Paid"
            value={totals.paid}
            onClick={() => openDrilldown('paid', 'Paid leads')}
          />
          <StatCard
            label="Follow-ups completed"
            value={totals.followupsCompleted}
            onClick={() => openDrilldown('followups_completed', 'Follow-ups completed')}
          />
          <StatCard
            label="Meetings logged"
            value={totals.meetings}
            onClick={() => openDrilldown('meetings', 'Meetings logged')}
          />
        </div>
      </div>

      {/* Working by US state */}
      {canViewTeam && byState.length > 0 ? (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h3 style={{ marginTop: 0 }}>Working by US state</h3>
          <p className="stat-hint" style={{ marginTop: 0 }}>
            Activity volume by prospect state for this period. Click a state to filter this page, or click a number to inspect records.
          </p>
          <div className="table-wrap" style={{ marginTop: '0.75rem' }}>
            <table>
              <thead>
                <tr>
                  <th>State</th>
                  <th>Leads touched</th>
                  <th>Emails</th>
                  <th>LinkedIn</th>
                  <th>Calls</th>
                  <th>Replies</th>
                  <th>Activities</th>
                </tr>
              </thead>
              <tbody>
                {byState.map((s) => (
                  <tr
                    key={s.key}
                    style={{
                      background:
                        stateFilter === s.key
                          ? 'color-mix(in srgb, var(--brand-primary) 12%, transparent)'
                          : undefined,
                    }}
                  >
                    <td
                      style={{ cursor: 'pointer', fontWeight: 600 }}
                      onClick={() => setStateFilter(s.key === stateFilter ? '' : s.key)}
                      title="Filter page to this state"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <StateBadge state={s.label === 'Unspecified' ? null : s.label} />
                        <span>{s.label}</span>
                      </div>
                    </td>
                    <td>
                      <span
                        className="stat-clickable"
                        onClick={() =>
                          openDrilldown('leads_touched', `Touched in ${s.label}`, null, { state: s.key })
                        }
                      >
                        {s.leadsTouched}
                      </span>
                    </td>
                    <td>
                      <span
                        className="stat-clickable"
                        onClick={() =>
                          openDrilldown('emails_sent', `Emails to ${s.label}`, null, { state: s.key })
                        }
                      >
                        {s.emails}
                      </span>
                    </td>
                    <td>
                      <span
                        className="stat-clickable"
                        onClick={() =>
                          openDrilldown('linkedin', `LinkedIn in ${s.label}`, null, { state: s.key })
                        }
                      >
                        {s.linkedin}
                      </span>
                    </td>
                    <td>
                      <span
                        className="stat-clickable"
                        onClick={() =>
                          openDrilldown('calls', `Calls in ${s.label}`, null, { state: s.key })
                        }
                      >
                        {s.calls}
                      </span>
                    </td>
                    <td>
                      <span
                        className="stat-clickable"
                        onClick={() =>
                          openDrilldown('email_replies', `Replies from ${s.label}`, null, { state: s.key })
                        }
                      >
                        {s.replies}
                      </span>
                    </td>
                    <td>{s.activities}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* Section 3: Per BD comparison */}
      {showTeamTable ? (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div>
              <h3 style={{ margin: 0 }}>3. Per BD comparison</h3>
              <p className="stat-hint" style={{ margin: '0.25rem 0 0' }}>
                Click any cell count to view exact working for that rep. Click name to filter activity feed below.
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
                  <th>Facebook</th>
                  <th>Instagram</th>
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
                      background:
                        focusUserId === r.id
                          ? 'color-mix(in srgb, var(--brand-primary) 12%, transparent)'
                          : undefined,
                    }}
                  >
                    <td
                      style={{ cursor: 'pointer', fontWeight: 600 }}
                      onClick={() => setFocusUser(r.id)}
                      title="Filter feed below"
                    >
                      {r.name}
                    </td>
                    <td>
                      <span
                        className="stat-clickable"
                        onClick={() => openDrilldown('leads_added', `${r.name}: Leads added`, r.id)}
                      >
                        {r.leadsAdded}
                      </span>
                    </td>
                    <td>
                      <span
                        className="stat-clickable"
                        onClick={() => openDrilldown('emails_sent', `${r.name}: Emails sent`, r.id)}
                      >
                        {(r.emails || 0) + (r.emailFollowups || 0)}
                      </span>
                    </td>
                    <td>
                      <span
                        className="stat-clickable"
                        onClick={() => openDrilldown('linkedin', `${r.name}: LinkedIn actions`, r.id)}
                      >
                        {r.linkedin}
                      </span>
                    </td>
                    <td>
                      <span
                        className="stat-clickable"
                        onClick={() => openDrilldown('facebook', `${r.name}: Facebook actions`, r.id)}
                      >
                        {r.facebook || 0}
                      </span>
                    </td>
                    <td>
                      <span
                        className="stat-clickable"
                        onClick={() => openDrilldown('instagram', `${r.name}: Instagram actions`, r.id)}
                      >
                        {r.instagram || 0}
                      </span>
                    </td>
                    <td>
                      <span
                        className="stat-clickable"
                        onClick={() => openDrilldown('calls', `${r.name}: Calls`, r.id)}
                      >
                        {r.calls}
                      </span>
                    </td>
                    <td>
                      <span
                        className="stat-clickable"
                        onClick={() => openDrilldown('leads_touched', `${r.name}: Leads touched`, r.id)}
                      >
                        {r.leadsTouched}
                      </span>
                    </td>
                    <td>
                      <span
                        className="stat-clickable"
                        onClick={() => openDrilldown('to_engaged', `${r.name}: Engaged`, r.id)}
                      >
                        {r.toEngaged ?? r.toConversation}
                      </span>
                    </td>
                    <td>
                      <span
                        className="stat-clickable"
                        onClick={() => openDrilldown('to_demo', `${r.name}: Demos booked`, r.id)}
                      >
                        {r.toDemo}
                      </span>
                    </td>
                    <td>
                      <span
                        className="stat-clickable"
                        onClick={() => openDrilldown('paid', `${r.name}: Paid`, r.id)}
                      >
                        {r.paid}
                      </span>
                    </td>
                    <td>
                      <span
                        className="stat-clickable"
                        style={{ color: r.overdueFollowups > 0 ? 'var(--danger)' : undefined }}
                        onClick={() => openDrilldown('followups_overdue', `${r.name}: Overdue follow-ups`, r.id)}
                      >
                        {r.overdueFollowups}
                      </span>
                    </td>
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
                    <th>State</th>
                    <th>Summary</th>
                  </tr>
                </thead>
                <tbody>
                  {(feed || []).length ? (
                    feed.map((a) => (
                      <tr
                        key={a.id}
                        className="clickable-row"
                        style={{ cursor: a.lead_id ? 'pointer' : 'default' }}
                        onClick={() => a.lead_id && setActiveLeadId(a.lead_id)}
                      >
                        <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(a.created_at)}</td>
                        <td>{ACTIVITY_LABELS[a.type] || a.type}</td>
                        <td>
                          {a.lead_id ? (
                            <span style={{ color: 'var(--brand-primary)', fontWeight: 500 }}>
                              {a.lead_name || a.lead_email || a.lead_id}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          {a.lead_state ? <StateBadge state={a.lead_state} /> : <span className="stat-hint">—</span>}
                        </td>
                        <td>{a.summary}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="empty">
                        No logged outreach in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>
              Leads added
              {focusRep ? ` · ${focusRep.name}` : ''}
            </h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Name</th>
                    <th>State</th>
                    <th>Status</th>
                    <th>Method</th>
                  </tr>
                </thead>
                <tbody>
                  {(leadsCreated || []).length ? (
                    leadsCreated.map((l) => (
                      <tr
                        key={l.id}
                        className="clickable-row"
                        style={{ cursor: 'pointer' }}
                        onClick={() => setActiveLeadId(l.id)}
                      >
                        <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(l.created_at)}</td>
                        <td>
                          <span style={{ color: 'var(--brand-primary)', fontWeight: 500 }}>
                            {l.name}
                          </span>
                        </td>
                        <td>
                          {l.state ? <StateBadge state={l.state} /> : <span className="stat-hint">—</span>}
                        </td>
                        <td>
                          <StatusBadge status={l.status} />
                        </td>
                        <td>
                          <span className="badge badge-grey">{l.addMethod}</span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="empty">
                        No leads added in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {/* Drilldown Modal */}
      {drilldown && (
        <DrilldownModal
          title={drilldown.title}
          metric={drilldown.metric}
          period={drilldown.period}
          userId={drilldown.userId}
          state={drilldown.state}
          onClose={() => setDrilldown(null)}
          onOpenLead={(id) => setActiveLeadId(id)}
        />
      )}

      {/* Lead Detail Drawer */}
      {activeLeadId && (
        <LeadPanel
          leadId={activeLeadId}
          onClose={() => setActiveLeadId(null)}
          onChanged={() => {}}
        />
      )}
    </div>
  );
}
