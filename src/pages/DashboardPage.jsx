import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { money, SourceBadge, StatusBadge } from '../components/Badges.jsx';

export default function DashboardPage() {
  const { user, can } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/analytics/overview')
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="card">{error}</div>;
  if (!data) return <div className="card">Loading analytics…</div>;

  const { totals, bySource, revenue, performance, recentLeads, followUpHealth } = data;

  return (
    <div>
      <h1 className="page-title">
        {user.role === 'ceo' ? 'CEO analytics' : user.role === 'manager' ? 'Manager overview' : 'My dashboard'}
      </h1>
      <p className="page-sub">
        Leads from product segments + CSV/Meta — not geography zones. US & Europe focus.
      </p>

      <div className="grid grid-4" style={{ marginBottom: '1rem' }}>
        <div className="card">
          <p className="stat-label">Total leads</p>
          <p className="stat-value">{totals.total_leads}</p>
          <p className="stat-hint">{totals.open_leads} open · {totals.unassigned} unassigned</p>
        </div>
        <div className="card">
          <p className="stat-label">Converted</p>
          <p className="stat-value">{totals.converted}</p>
          <p className="stat-hint">{totals.lost} lost</p>
        </div>
        {can('revenue:view') ? (
          <div className="card">
            <p className="stat-label">Recorded revenue</p>
            <p className="stat-value">{money(revenue.recorded)}</p>
            <p className="stat-hint">{money(revenue.last30Days)} last 30 days</p>
          </div>
        ) : (
          <div className="card">
            <p className="stat-label">My conversions</p>
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

      <div className="grid grid-2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Leads by source</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Leads</th>
                  <th>Converted</th>
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

        <div className="card">
          <h3 style={{ marginTop: 0 }}>
            {can('analytics:view_team') ? 'Telesales performance' : 'My performance'}
          </h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rep</th>
                  <th>Assigned</th>
                  <th>Won</th>
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
                    <Link to={`/leads/${l.id}`} style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>
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
