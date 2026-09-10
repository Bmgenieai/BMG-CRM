import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { SourceBadge, StatusBadge } from '../components/Badges.jsx';

export default function DistributionPage() {
  const { can } = useAuth();
  const [stats, setStats] = useState(null);
  const [unassigned, setUnassigned] = useState([]);
  const [openLeads, setOpenLeads] = useState([]);
  const [reps, setReps] = useState([]);
  const [mode, setMode] = useState('manual');
  const [manualRep, setManualRep] = useState('');
  const [selectedUnassigned, setSelectedUnassigned] = useState([]);
  const [selectedReassign, setSelectedReassign] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!can('leads:assign')) return <Navigate to="/" replace />;

  const telesalesReps = reps.filter((r) => r.role === 'telesales');
  const assignTargets = telesalesReps.length ? telesalesReps : reps;

  const load = async () => {
    try {
      const [s, unassignedLeads, allLeads, r] = await Promise.all([
        api('/distribution/queue-stats'),
        api('/leads?unassigned=1'),
        api('/leads'),
        api('/users/reps'),
      ]);
      setStats(s);
      setUnassigned(unassignedLeads);
      setOpenLeads(
        (allLeads || []).filter(
          (l) =>
            l.assigned_to &&
            ['qualified', 'conversation', 'demo_booked', 'trial'].includes(l.status),
        ),
      );
      setReps(r);
      setManualRep((prev) => {
        if (prev && r.some((x) => x.id === prev)) return prev;
        const firstTs = r.find((x) => x.role === 'telesales');
        return firstTs?.id || r[0]?.id || '';
      });
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = (list, setList, id) => {
    setList((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const assignSelected = async (leadIds, label) => {
    setMessage('');
    setError('');
    if (!manualRep) {
      setError('Pick a telesales agent first');
      return;
    }
    if (!leadIds.length) {
      setError('Select at least one lead to assign');
      return;
    }
    setBusy(true);
    try {
      const res = await api('/distribution/assign', {
        method: 'POST',
        body: { leadIds, assignedTo: manualRep },
      });
      const repName = assignTargets.find((r) => r.id === manualRep)?.name || 'agent';
      setMessage(`${label}: assigned ${res.assigned} lead(s) to ${repName}`);
      setSelectedUnassigned([]);
      setSelectedReassign([]);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const distributeQueue = async () => {
    setMessage('');
    setError('');
    if (mode === 'manual') {
      // Manual on empty queue without selection → clear error
      const ids = selectedUnassigned.length
        ? selectedUnassigned
        : unassigned.map((l) => l.id);
      if (!ids.length) {
        setError(
          'Unassigned queue is empty. Use “Reassign open leads” below to move leads between agents, or import/generate new leads first.',
        );
        return;
      }
      return assignSelected(ids, 'Manual assign');
    }

    setBusy(true);
    try {
      const res = await api('/distribution/distribute', {
        method: 'POST',
        body: {
          mode,
          leadIds: selectedUnassigned.length ? selectedUnassigned : undefined,
          limit: 50,
        },
      });
      if (!res.assigned) {
        setError(
          res.message ||
            'No unassigned leads to distribute. Reassign existing leads below, or add new ones via CSV / segment generation.',
        );
      } else {
        setMessage(`Distributed ${res.assigned} lead(s) via ${res.mode || mode}`);
      }
      setSelectedUnassigned([]);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">Lead distribution</h1>
      <p className="page-sub">
        <strong>Manual:</strong> select leads → pick a telesales agent → Assign.
        Round-robin / workload only apply to the <em>unassigned</em> queue.
      </p>

      {error ? <div className="login-error">{error}</div> : null}
      {message ? (
        <div className="card" style={{ marginBottom: '1rem', borderColor: 'var(--brand-border)' }}>
          {message}
        </div>
      ) : null}

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="toolbar" style={{ marginBottom: 0, alignItems: 'flex-end' }}>
          <div className="field" style={{ marginBottom: 0, minWidth: 180 }}>
            <label className="label">Mode</label>
            <select className="select" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="manual">Manual (pick agent)</option>
              <option value="round_robin">Round-robin (unassigned only)</option>
              <option value="workload">Workload-balanced (unassigned only)</option>
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0, minWidth: 220 }}>
            <label className="label">Assign to agent</label>
            <select
              className="select"
              value={manualRep}
              onChange={(e) => setManualRep(e.target.value)}
              disabled={mode !== 'manual' && !selectedUnassigned.length && !selectedReassign.length}
            >
              {assignTargets.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.role})
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={distributeQueue}
          >
            {mode === 'manual'
              ? selectedUnassigned.length
                ? `Assign ${selectedUnassigned.length} from queue`
                : 'Assign unassigned queue'
              : 'Distribute unassigned queue'}
          </button>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: '1rem' }}>
        <div className="card">
          <p className="stat-label">Unassigned open leads</p>
          <p className="stat-value">{stats?.unassigned ?? '—'}</p>
          {(stats?.unassigned || 0) === 0 ? (
            <p className="stat-hint">Queue empty — import CSV or wait for bmgenie.ai signups</p>
          ) : (
            <p className="stat-hint">Check rows, pick agent, Assign</p>
          )}
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

      <div className="card table-wrap" style={{ marginBottom: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Unassigned queue</h3>
        <p style={{ color: 'var(--muted)', fontSize: '0.88rem', marginTop: 0 }}>
          New leads with no owner. Tick rows (or leave unticked to take the whole queue), pick agent, Assign.
        </p>
        <table className="leads-table">
          <thead>
            <tr>
              <th></th>
              <th>Lead</th>
              <th>Source</th>
              <th>Status</th>
              <th>Country</th>
            </tr>
          </thead>
          <tbody>
            {unassigned.map((l) => (
              <tr key={l.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedUnassigned.includes(l.id)}
                    onChange={() => toggle(selectedUnassigned, setSelectedUnassigned, l.id)}
                  />
                </td>
                <td>
                  <strong>{l.name}</strong>
                  <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{l.email}</div>
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
            {!unassigned.length ? (
              <tr>
                <td colSpan={5} className="empty">
                  Queue empty — all open leads already have an owner
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="card table-wrap">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
            alignItems: 'center',
            marginBottom: '0.75rem',
          }}
        >
          <div>
            <h3 style={{ margin: 0 }}>Reassign open leads</h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.88rem', margin: '0.25rem 0 0' }}>
              Move leads from one agent to another. Select rows → pick agent above → Reassign selected.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !selectedReassign.length}
            onClick={() => assignSelected(selectedReassign, 'Reassign')}
          >
            {selectedReassign.length
              ? `Reassign ${selectedReassign.length} to agent`
              : 'Select leads to reassign'}
          </button>
        </div>
        <table className="leads-table">
          <thead>
            <tr>
              <th></th>
              <th>Lead</th>
              <th>Status</th>
              <th>Current owner</th>
              <th>Source</th>
              <th>Country</th>
            </tr>
          </thead>
          <tbody>
            {openLeads.map((l) => (
              <tr key={l.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedReassign.includes(l.id)}
                    onChange={() => toggle(selectedReassign, setSelectedReassign, l.id)}
                  />
                </td>
                <td>
                  <strong>{l.name}</strong>
                  <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{l.email}</div>
                </td>
                <td>
                  <StatusBadge status={l.status} />
                </td>
                <td>{l.assigned_name || '—'}</td>
                <td>
                  <SourceBadge source={l.source} />
                </td>
                <td>{l.country || '—'}</td>
              </tr>
            ))}
            {!openLeads.length ? (
              <tr>
                <td colSpan={6} className="empty">
                  No open assigned leads
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
