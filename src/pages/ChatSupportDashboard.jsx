import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { fmtDate } from '../components/Badges.jsx';

function statusPriority(status) {
  if (status === 'waiting_human') return 0;
  if (status === 'human_active') return 1;
  if (status === 'open') return 2;
  return 3;
}

export default function ChatSupportDashboard() {
  const [counts, setCounts] = useState(null);
  const [waiting, setWaiting] = useState(null);
  const [mine, setMine] = useState(null);
  const [error, setError] = useState('');
  const prevWaitingRef = useRef(null);

  const load = () => {
    Promise.all([
      api('/chats/counts'),
      api('/chats?status=waiting_human'),
      api('/chats?assignee=me'),
    ])
      .then(([c, waitingList, mineList]) => {
        setCounts(c);
        const sortFn = (a, b) => {
          const p = statusPriority(a.status) - statusPriority(b.status);
          if (p !== 0) return p;
          return String(b.started_at || b.created_at || '').localeCompare(
            String(a.started_at || a.created_at || ''),
          );
        };
        setWaiting(Array.isArray(waitingList) ? [...waitingList].sort(sortFn) : []);
        setMine(Array.isArray(mineList) ? [...mineList].sort(sortFn) : []);
        setError('');

        const waitingN = Number(c?.waitingHuman || 0);
        const prev = prevWaitingRef.current;
        if (prev != null && waitingN > prev) {
          try {
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              new Notification('BMGenie chat — human requested', {
                body: `${waitingN} visitor(s) waiting for Chat Support.`,
              });
            }
          } catch {
            /* ignore */
          }
        }
        prevWaitingRef.current = waitingN;
      })
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);

  if (error) return <div className="card">{error}</div>;
  if (!counts || !waiting || !mine) return <div className="card">Loading chat dashboard…</div>;

  return (
    <div>
      <h1 className="page-title">Chat Support</h1>
      <p className="page-sub">
        Your queue for website AI chats. Take a waiting visitor, reply live, and keep one agent per
        thread.
      </p>

      {Number(counts.waitingHuman || 0) > 0 ? (
        <div
          className="card"
          style={{
            marginBottom: '1rem',
            border: '2px solid #dc2626',
            background: 'rgba(220,38,38,0.08)',
          }}
        >
          <p style={{ margin: 0, fontWeight: 700, color: '#991b1b' }}>
            {counts.waitingHuman} visitor{counts.waitingHuman === 1 ? '' : 's'} waiting for a human
          </p>
          <p className="stat-hint" style={{ margin: '6px 0 0' }}>
            Open Chats, click <strong>Take chat</strong>, then reply. Other agents will see it is
            yours.
          </p>
          <Link className="btn btn-primary" to="/chats?status=waiting_human" style={{ marginTop: 10, display: 'inline-block' }}>
            Open waiting queue
          </Link>
        </div>
      ) : null}

      <div className="grid grid-3" style={{ marginBottom: '1rem' }}>
        <div
          className="card"
          style={
            Number(counts.waitingHuman || 0) > 0
              ? { border: '2px solid #dc2626', background: 'rgba(220,38,38,0.06)' }
              : undefined
          }
        >
          <p className="stat-label">Needs human</p>
          <p className="stat-value" style={{ color: Number(counts.waitingHuman || 0) > 0 ? '#dc2626' : undefined }}>
            {counts.waitingHuman ?? 0}
          </p>
        </div>
        <div className="card">
          <p className="stat-label">My active chats</p>
          <p className="stat-value">{counts.mine ?? 0}</p>
        </div>
        <div className="card">
          <p className="stat-label">Today</p>
          <p className="stat-value">{counts.today ?? 0}</p>
        </div>
      </div>

      <div className="grid grid-2" style={{ gap: '1rem' }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Waiting for human</h3>
            <Link className="btn btn-ghost" to="/chats?status=waiting_human">
              View all
            </Link>
          </div>
          {waiting.length === 0 ? (
            <p className="stat-hint" style={{ marginTop: '0.75rem' }}>
              No visitors waiting right now.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: '0.75rem 0 0' }}>
              {waiting.slice(0, 8).map((r) => (
                <li
                  key={r.id}
                  style={{
                    padding: '10px 0',
                    borderBottom: '1px solid rgba(0,0,0,0.06)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{r.visitor_name || r.lead_name || 'Visitor'}</div>
                    <div className="stat-hint">
                      {fmtDate(r.started_at || r.created_at)}
                      {r.assignedTo ? ` · Taken by ${r.assignedTo.name}` : ' · Unclaimed'}
                    </div>
                    <div className="stat-hint" style={{ maxWidth: 280 }}>
                      {r.preview || '—'}
                    </div>
                  </div>
                  <Link className="btn btn-primary" to={`/chats?open=${r.id}`}>
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>My chats</h3>
            <Link className="btn btn-ghost" to="/chats?assignee=me">
              View all
            </Link>
          </div>
          {mine.length === 0 ? (
            <p className="stat-hint" style={{ marginTop: '0.75rem' }}>
              You have not taken any chats yet.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: '0.75rem 0 0' }}>
              {mine.slice(0, 8).map((r) => (
                <li
                  key={r.id}
                  style={{
                    padding: '10px 0',
                    borderBottom: '1px solid rgba(0,0,0,0.06)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{r.visitor_name || r.lead_name || 'Visitor'}</div>
                    <div className="stat-hint">
                      {r.status} · {fmtDate(r.updated_at || r.started_at || r.created_at)}
                    </div>
                    <div className="stat-hint" style={{ maxWidth: 280 }}>
                      {r.preview || '—'}
                    </div>
                  </div>
                  <Link className="btn btn-ghost" to={`/chats?open=${r.id}`}>
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
