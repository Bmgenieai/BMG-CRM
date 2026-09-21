import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { fmtDate } from '../components/Badges.jsx';

function EmailModal({ card, onClose }) {
  if (!card) return null;
  const users = card.users || [];
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal"
        style={{ maxWidth: 560, maxHeight: '80vh', overflow: 'auto' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
          <div>
            <h3 style={{ margin: 0 }}>{card.title}</h3>
            <p className="page-sub" style={{ margin: '0.35rem 0 0' }}>
              {card.count} · {card.date}
              {card.source === 'crm_fallback' ? ' · CRM fallback' : ' · Live from BMGenie'}
            </p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
        {card.definition ? (
          <p className="stat-hint" style={{ marginTop: '0.75rem' }}>
            {card.definition}
          </p>
        ) : null}
        {users.length === 0 ? (
          <p style={{ marginTop: '1rem' }}>No users for this day.</p>
        ) : (
          <table className="table" style={{ marginTop: '1rem' }}>
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Company</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id || u.email || i}>
                  <td>
                    {u.email ? (
                      <a href={`mailto:${u.email}`} style={{ color: 'var(--brand-primary)' }}>
                        {u.email}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{u.name || '—'}</td>
                  <td>{u.company || '—'}</td>
                  <td>{fmtDate(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function ProductAnalyticsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [modalCard, setModalCard] = useState(null);

  useEffect(() => {
    setError('');
    setData(null);
    api(`/analytics/product-tracking?date=${encodeURIComponent(date)}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [date]);

  if (error) return <div className="card">{error}</div>;
  if (!data) return <div className="card">Loading product analytics…</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">Product analytics</h1>
          <p className="page-sub">
            BMGenie site user tracking for CEO / managers. Click a number to see emails.
          </p>
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.85rem' }}>
          Date
          <input
            type="date"
            className="input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      </div>

      {!data.bmgenieApiConfigured ? (
        <div className="card" style={{ marginBottom: '1rem', borderColor: 'var(--warning)' }}>
          Set <code>BMGENIE_API_URL</code> on the CRM API so live daily lists come from the main site.
          Showing CRM ingest fallback until then.
        </div>
      ) : !data.mainAvailable ? (
        <div className="card" style={{ marginBottom: '1rem' }}>
          Main BMGenie analytics API not reachable yet
          {data.mainError ? `: ${data.mainError}` : ''}. Showing CRM fallback counts.
        </div>
      ) : null}

      <div className="grid grid-3" style={{ marginBottom: '1rem' }}>
        {data.cards.map((card) => (
          <button
            key={card.key}
            type="button"
            className="card analytics-count-card"
            onClick={() => setModalCard(card)}
            style={{ textAlign: 'left', cursor: 'pointer', border: '1px solid var(--border)' }}
          >
            <p className="stat-label">{card.title}</p>
            <p className="stat-value" style={{ color: 'var(--brand-primary)' }}>
              {card.count}
            </p>
            <p className="stat-hint">{card.description}</p>
            <p className="stat-hint" style={{ marginTop: '0.5rem', color: 'var(--brand-primary)' }}>
              Click to view emails →
            </p>
          </button>
        ))}
      </div>

      <div className="grid grid-2" style={{ marginBottom: '1rem' }}>
        <Link to="/demos" className="card" style={{ display: 'block' }}>
          <p className="stat-label">Book a demo (today)</p>
          <p className="stat-value">{data.extras?.demosToday ?? 0}</p>
          <p className="stat-hint">Open demo bookings tab →</p>
        </Link>
        <Link to="/chats" className="card" style={{ display: 'block' }}>
          <p className="stat-label">Chat support (today)</p>
          <p className="stat-value">{data.extras?.chatsToday ?? 0}</p>
          <p className="stat-hint">Open chat support tab →</p>
        </Link>
      </div>

      {modalCard ? <EmailModal card={modalCard} onClose={() => setModalCard(null)} /> : null}
    </div>
  );
}
