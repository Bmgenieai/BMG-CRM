import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

export default function DistributionPage() {
  const { can } = useAuth();
  const [stats, setStats] = useState(null);
  const [unassigned, setUnassigned] = useState([]);
  const [reps, setReps] = useState([]);
  const [mode, setMode] = useState('round_robin');
  const [manualRep, setManualRep] = useState('');
  const [selected, setSelected] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (!can('leads:assign')) return <Navigate to="/" replace />;

  const load = async () => {
    try {
      const [s, leads, r] = await Promise.all([
        api('/distribution/queue-stats'),
        api('/leads?unassigned=1'),
        api('/users/reps'),
      ]);
      setStats(s);
      setUnassigned(leads);
      setReps(r);
      if (!manualRep && r[0]) setManualRep(r[0].id);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const distribute = async () => {
    setMessage('');
    setError('');
    try {
      const body = {
        mode,
        leadIds: selected.length ? selected : undefined,
        assignedTo: mode === 'manual' ? manualRep : undefined,
        limit: 50,
      };
      const res = await api('/distribution/distribute', { method: 'POST', body });
      setMessage(`Assigned ${res.assigned} lead(s) via ${res.mode || mode}`);
      setSelected([]);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div>
      <h1 className="page-title">Lead distribution</h1>
      <p className="page-sub">
        Assign unassigned segment/CSV leads to telesales — round-robin, workload-balanced, or manual.
      </p>

      {error ? <div className="login-error">{error}</div> : null}
      {message ? (
        <div className="card" style={{ marginBottom: '1rem', borderColor: 'var(--brand-border)' }}>
          {message}
        </div>
      ) : null}

      <div className="grid grid-2" style={{ marginBottom: '1rem' }}>
        <div className="card">
          <p className="stat-label">Unassigned open leads</p>
          <p className="stat-value">{stats?.unassigned ?? '—'}</p>
        </div>
        <div className="card">
          <div className="toolbar" style={{ marginBottom: 0 }}>
            <select className="select" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="round_robin">Round-robin</option>
              <option value="workload">Workload-balanced</option>
              <option value="manual">Manual (pick rep)</option>
            </select>
            {mode === 'manual' ? (
              <select className="select" value={manualRep} onChange={(e) => setManualRep(e.target.value)}>
                {reps.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.role})
                  </option>
                ))}
              </select>
            ) : null}
            <button type="button" className="btn btn-primary" onClick={distribute}>
              {selected.length ? `Assign ${selected.length} selected` : 'Distribute queue'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card table-wrap">
          <h3 style={{ marginTop: 0 }}>Unassigned queue</h3>
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Lead</th>
                <th>Source</th>
                <th>Country</th>
              </tr>
            </thead>
            <tbody>
              {unassigned.map((l) => (
                <tr key={l.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.includes(l.id)}
                      onChange={() => toggle(l.id)}
                    />
                  </td>
                  <td>{l.name}</td>
                  <td>{l.source}</td>
                  <td>{l.country || '—'}</td>
                </tr>
              ))}
              {!unassigned.length ? (
                <tr>
                  <td colSpan={4} className="empty">
                    Queue empty
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="card table-wrap">
          <h3 style={{ marginTop: 0 }}>Rep workload</h3>
          <table>
            <thead>
              <tr>
                <th>Rep</th>
                <th>Open</th>
                <th>Converted</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.byRep || []).map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.open_count}</td>
                  <td>{r.converted_count}</td>
                  <td>{r.total_assigned}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
