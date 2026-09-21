import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { fmtDate } from '../components/Badges.jsx';
import CohortFilter from '../components/CohortFilter.jsx';

export default function DemosPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const cohort = searchParams.get('cohort') || 'all';
  const [rows, setRows] = useState(null);
  const [counts, setCounts] = useState(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  const setCohort = (next) => {
    const nextParams = new URLSearchParams(searchParams);
    if (!next || next === 'all') nextParams.delete('cohort');
    else nextParams.set('cohort', next);
    setSearchParams(nextParams, { replace: true });
  };

  const load = () => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (cohort && cohort !== 'all') params.set('cohort', cohort);
    const qs = params.toString() ? `?${params}` : '';
    const countQs =
      cohort && cohort !== 'all' ? `?cohort=${encodeURIComponent(cohort)}` : '';
    Promise.all([api(`/demos${qs}`), api(`/demos/counts${countQs}`)])
      .then(([list, c]) => {
        setRows(list);
        setCounts(c);
      })
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cohort]);

  if (error) return <div className="card">{error}</div>;
  if (!rows) return <div className="card">Loading demo bookings…</div>;

  return (
    <div>
      <h1 className="page-title">Book a demo</h1>
      <p className="page-sub">
        Calendly bookings from bmgenie.ai — name, email, and scheduled time. Point Calendly webhooks to{' '}
        <code>/api/ingest/calendly</code>.
      </p>

      <div style={{ marginBottom: '1rem' }}>
        <CohortFilter value={cohort} onChange={setCohort} />
      </div>

      <div className="grid grid-3" style={{ marginBottom: '1rem' }}>
        <div className="card">
          <p className="stat-label">Total</p>
          <p className="stat-value">{counts?.total ?? 0}</p>
        </div>
        <div className="card">
          <p className="stat-label">Upcoming</p>
          <p className="stat-value">{counts?.upcoming ?? 0}</p>
        </div>
        <div className="card">
          <p className="stat-label">Today</p>
          <p className="stat-value">{counts?.today ?? 0}</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="toolbar" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            className="input"
            placeholder="Search name, email, phone…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
            style={{ flex: 1, minWidth: 200 }}
          />
          <button type="button" className="btn btn-primary" onClick={load}>
            Search
          </button>
        </div>
      </div>

      <div className="card">
        {rows.length === 0 ? (
          <p>No demo bookings yet. After Calendly webhook is connected, bookings appear here.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Timezone</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDate(r.scheduled_at || r.created_at)}</td>
                  <td>{r.name || '—'}</td>
                  <td>
                    {r.email ? (
                      <a href={`mailto:${r.email}`} style={{ color: 'var(--brand-primary)' }}>
                        {r.email}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{r.phone || '—'}</td>
                  <td>{r.timezone || '—'}</td>
                  <td>{r.status}</td>
                  <td>
                    {r.lead_id ? (
                      <Link className="btn btn-ghost" to={`/leads?id=${r.lead_id}`}>
                        Lead
                      </Link>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
