import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { fmtDate } from '../components/Badges.jsx';

export default function ChatsPage() {
  const [rows, setRows] = useState(null);
  const [counts, setCounts] = useState(null);
  const [selected, setSelected] = useState(null);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    const qs = q ? `?q=${encodeURIComponent(q)}` : '';
    Promise.all([api(`/chats${qs}`), api('/chats/counts')])
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
  if (!rows) return <div className="card">Loading chat support…</div>;

  return (
    <div>
      <h1 className="page-title">Chat support</h1>
      <p className="page-sub">
        Tawk.to chats from the BMGenie homepage. Point Tawk webhooks to <code>/api/ingest/tawk</code>.
        Replies must be sent in the Tawk dashboard (API cannot inject agent messages).
      </p>

      <div className="grid grid-3" style={{ marginBottom: '1rem' }}>
        <div className="card">
          <p className="stat-label">Total</p>
          <p className="stat-value">{counts?.total ?? 0}</p>
        </div>
        <div className="card">
          <p className="stat-label">Open</p>
          <p className="stat-value">{counts?.open ?? 0}</p>
        </div>
        <div className="card">
          <p className="stat-label">Today</p>
          <p className="stat-value">{counts?.today ?? 0}</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            className="input"
            placeholder="Search visitor, email, message…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ flex: 1, minWidth: 200 }}
          />
          <button type="button" className="btn btn-primary" onClick={load}>
            Search
          </button>
          <a
            className="btn btn-ghost"
            href="https://dashboard.tawk.to/"
            target="_blank"
            rel="noreferrer"
          >
            Open Tawk dashboard
          </a>
        </div>
      </div>

      <div className="card">
        {rows.length === 0 ? (
          <p>No chats yet. After Tawk webhooks are connected, conversations appear here.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Started</th>
                <th>Visitor</th>
                <th>Email</th>
                <th>Preview</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDate(r.started_at || r.created_at)}</td>
                  <td>{r.visitor_name || '—'}</td>
                  <td>
                    {r.visitor_email ? (
                      <a href={`mailto:${r.visitor_email}`} style={{ color: 'var(--brand-primary)' }}>
                        {r.visitor_email}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td style={{ maxWidth: 280 }}>{r.preview || '—'}</td>
                  <td>{r.status}</td>
                  <td>
                    <button type="button" className="btn btn-ghost" onClick={() => setSelected(r)}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected ? (
        <div className="modal-backdrop" onClick={() => setSelected(null)} role="presentation">
          <div
            className="modal"
            style={{ maxWidth: 640, maxHeight: '80vh', overflow: 'auto' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <h3 style={{ margin: 0 }}>{selected.visitor_name || 'Chat'}</h3>
              <button type="button" className="btn btn-ghost" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
            <p className="stat-hint">
              {selected.visitor_email || 'No email'} · {selected.status} ·{' '}
              {fmtDate(selected.started_at || selected.created_at)}
            </p>
            <p style={{ marginTop: '0.75rem' }}>{selected.preview}</p>
            {Array.isArray(selected.transcript) && selected.transcript.length > 0 ? (
              <div style={{ marginTop: '1rem' }}>
                <h4 style={{ marginBottom: '0.5rem' }}>Transcript</h4>
                <ul style={{ paddingLeft: '1.1rem', margin: 0 }}>
                  {selected.transcript.map((m, i) => (
                    <li key={i} style={{ marginBottom: 6 }}>
                      <strong>{m.n || m.t || 'msg'}:</strong> {m.msg || m.message || m.text || JSON.stringify(m)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div style={{ marginTop: '1.25rem', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a
                className="btn btn-primary"
                href={selected.tawkDashboardUrl || 'https://dashboard.tawk.to/'}
                target="_blank"
                rel="noreferrer"
              >
                Reply in Tawk
              </a>
              <span className="stat-hint" style={{ alignSelf: 'center' }}>
                CRM cannot send replies into Tawk via API.
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
