import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { money, SourceBadge, StatusBadge } from '../components/Badges.jsx';

function FunnelStep({ label, value, to, rate }) {
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
      {rate != null ? <div className="funnel-step-rate">{rate}%</div> : null}
    </div>
  );
}

export default function DashboardPage() {
  const { user, can } = useAuth();
  const [data, setData] = useState(null);
  const [funnel, setFunnel] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api('/analytics/overview'), api('/analytics/funnel')])
      .then(([overview, funnelData]) => {
        setData(overview);
        setFunnel(funnelData);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="card">{error}</div>;
  if (!data || !funnel) return <div className="card">Loading analytics…</div>;

  const { totals, bySource, revenue, performance, recentLeads, followUpHealth } = data;
  const { stages, outreach, rates, lostReasons } = funnel;

  return (
    <div>
      <h1 className="page-title">
        {user.role === 'ceo' ? 'CEO analytics' : user.role === 'manager' ? 'Manager overview' : 'My dashboard'}
      </h1>
      <p className="page-sub">
        Sales funnel: qualified → outreach → replies → conversations → demos → trials → paid.
      </p>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Sales funnel</h3>
        <div className="funnel-flow">
          <FunnelStep label="Qualified prospects" value={stages.qualifiedProspects} to="/leads" />
          <span className="funnel-arrow">→</span>
          <FunnelStep label="Emails" value={outreach.emails} />
          <span className="funnel-arrow">→</span>
          <FunnelStep label="LinkedIn" value={outreach.linkedinTouches} />
          <span className="funnel-arrow">→</span>
          <FunnelStep label="Calls" value={outreach.calls} />
          <span className="funnel-arrow">→</span>
          <FunnelStep label="Reply rate" value={`${rates.replyRate}%`} />
          <span className="funnel-arrow">→</span>
          <FunnelStep label="Positive reply" value={`${rates.positiveReplyRate}%`} />
          <span className="funnel-arrow">→</span>
          <FunnelStep label="Conversations" value={stages.conversations} to="/leads/conversation" />
          <span className="funnel-arrow">→</span>
          <FunnelStep label="Demos booked" value={stages.demosBooked} to="/leads/demo-booked" />
          <span className="funnel-arrow">→</span>
          <FunnelStep label="Show rate" value={`${rates.showRate}%`} />
          <span className="funnel-arrow">→</span>
          <FunnelStep label="Trials" value={stages.trials} to="/leads/trial" />
          <span className="funnel-arrow">→</span>
          <FunnelStep label="Paid" value={stages.paid} to="/leads/paid" />
          <span className="funnel-arrow">→</span>
          <FunnelStep label="Conversion" value={`${rates.conversionRate}%`} />
        </div>
        <p className="stat-hint" style={{ marginBottom: 0 }}>
          Reply / positive reply / show rates come from logged activities. Mark replies and “Demo shown” on each lead.
        </p>
      </div>

      <div className="grid grid-4" style={{ marginBottom: '1rem' }}>
        <div className="card">
          <p className="stat-label">Qualified (queue)</p>
          <p className="stat-value">{stages.qualified ?? 0}</p>
          <Link to="/leads/qualified" className="stat-hint" style={{ color: 'var(--brand-primary)' }}>
            View qualified →
          </Link>
        </div>
        <div className="card">
          <p className="stat-label">Paid</p>
          <p className="stat-value">{stages.paid}</p>
          <p className="stat-hint">{rates.conversionRate}% conversion</p>
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
        <div className="card">
          <p className="stat-label">Lost</p>
          <p className="stat-value">{stages.lost ?? 0}</p>
          <Link to="/leads/lost" className="stat-hint" style={{ color: 'var(--brand-primary)' }}>
            View lost →
          </Link>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Quick actions</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link to="/leads/qualified" className="btn btn-secondary">
            Qualified ({stages.qualified ?? 0})
          </Link>
          <Link to="/leads/conversation" className="btn btn-secondary">
            Conversations ({stages.conversations ?? 0})
          </Link>
          <Link to="/leads/demo-booked" className="btn btn-secondary">
            Demos ({stages.demosBooked ?? 0})
          </Link>
          <Link to="/leads/trial" className="btn btn-secondary">
            Trials ({stages.trials ?? 0})
          </Link>
          <Link to="/leads/paid" className="btn btn-primary">
            Paid ({stages.paid ?? 0})
          </Link>
          <Link to="/email" className="btn btn-secondary">
            Cold email (Brevo)
          </Link>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Lost reasons</h3>
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
                      No lost leads yet
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
        <h3 style={{ marginTop: 0 }}>
          {can('analytics:view_team') ? 'Telesales performance' : 'My performance'}
        </h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Rep</th>
                <th>Assigned</th>
                <th>Paid</th>
                <th>Rate</th>
                <th>Overdue FU</th>
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
