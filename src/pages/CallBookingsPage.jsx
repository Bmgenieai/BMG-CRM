import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { fmtInTz } from '../components/Badges.jsx';

export default function CallBookingsPage() {
  const [rows, setRows] = useState(null);
  const [counts, setCounts] = useState(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    const qs = params.toString() ? `?${params}` : '';
    Promise.all([api(`/call-bookings${qs}`), api('/call-bookings/counts')])
      .then(([list, c]) => {
        setRows(list);
        setCounts(c);
      })
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return <div className="card">{error}</div>;
  if (!rows) return <div className="card">Loading call bookings…</div>;

  return (
    <div>
      <h1 className="page-title">Call bookings</h1>

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
          <p>No call bookings yet. Open a lead → Book call / meeting.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Timezone</th>
                <th>Booked by</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {fmtInTz(r.scheduled_at, r.timezone || 'America/Los_Angeles')}
                  </td>
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
                  <td>{(r.timezone || '').replace(/_/g, ' ').split('/').pop() || '—'}</td>
                  <td>{r.booked_by_name || '—'}</td>
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
