import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { SourceBadge, StatusBadge } from '../components/Badges.jsx';
import LeadPanel from '../components/LeadPanel.jsx';

const FILTER_TITLES = {
  new: 'New Leads',
  contacted: 'Contacted',
  interested: 'Interested',
  neutral: 'Neutral',
  'follow-up': 'Follow Up',
  'not-interested': 'Not Interested',
  converted: 'Converted',
  signup: 'Signup · no purchase',
  'free-credit': 'Free credit · no purchase',
  winback: 'Win-back · no repurchase',
};

const FILTER_QUERY = {
  new: { status: 'new' },
  contacted: { status: 'contacted' },
  interested: { status: 'interested' },
  neutral: { status: 'neutral' },
  'follow-up': { status: 'follow_up_scheduled' },
  'not-interested': { status: 'not_interested,lost' },
  converted: { status: 'converted' },
  signup: { source: 'signup_no_listing' },
  'free-credit': { source: 'free_credit_no_purchase' },
  winback: { source: 'purchased_no_repurchase' },
};

export default function LeadsPage({ refreshSidebarCounts }) {
  const { filter } = useParams();
  const { can } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('id');

  const preset = FILTER_QUERY[filter] || {};

  const [leads, setLeads] = useState([]);
  const [meta, setMeta] = useState({ sources: [], statuses: [] });
  const [q, setQ] = useState('');
  const [source, setSource] = useState(preset.source || '');
  const [status, setStatus] = useState(preset.status || '');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    country: 'US',
    source: 'manual',
    estimated_value: 65,
  });
  const [error, setError] = useState('');

  const pageTitle = useMemo(() => {
    if (filter && FILTER_TITLES[filter]) return FILTER_TITLES[filter];
    return 'All leads';
  }, [filter]);

  useEffect(() => {
    setSource(preset.source || '');
    setStatus(preset.status || '');
  }, [filter]);

  const load = () => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (source) params.set('source', source);
    if (status) params.set('status', status);
    api(`/leads?${params}`)
      .then(setLeads)
      .catch((e) => setError(e.message));
    refreshSidebarCounts?.();
  };

  useEffect(() => {
    api('/leads/meta').then(setMeta).catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [filter, source, status]);

  const openLead = (id) => {
    setSearchParams({ id });
  };

  const closeLead = () => {
    setSearchParams({});
  };

  const createLead = async (e) => {
    e.preventDefault();
    try {
      const created = await api('/leads', { method: 'POST', body: form });
      setShowCreate(false);
      setForm({
        name: '',
        email: '',
        phone: '',
        company: '',
        country: 'US',
        source: 'manual',
        estimated_value: 65,
      });
      load();
      if (created?.id) openLead(created.id);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h1 className="page-title">{pageTitle}</h1>
      <p className="page-sub">
        {filter === 'signup' && 'Auto-created when users sign up on bmgenie.ai without buying a package.'}
        {filter === 'free-credit' && 'Used free listing credit but has not purchased yet.'}
        {filter === 'winback' && 'Bought a package, used all credits, has not repurchased.'}
        {!filter && 'Click a row to open the side panel — list stays visible.'}
        {filter && !['signup', 'free-credit', 'winback'].includes(filter) && 'Filter by marketing pipeline stage.'}
      </p>

      {error ? <div className="login-error">{error}</div> : null}

      <div className="toolbar">
        <input
          className="input"
          placeholder="Search name, email, company…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
        />
        {!filter && (
          <>
            <select className="select" value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">All sources</option>
              {meta.sources.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {meta.statuses.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </>
        )}
        <button type="button" className="btn btn-secondary" onClick={load}>
          Refresh
        </button>
        {can('leads:create') ? (
          <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)}>
            New lead
          </button>
        ) : null}
      </div>

      <div className="card table-wrap">
        <table className="leads-table">
          <thead>
            <tr>
              <th>Lead</th>
              <th>Source</th>
              <th>Status</th>
              <th>Country</th>
              <th>Owner</th>
              <th>Next FU</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr
                key={l.id}
                className={`clickable-row${selectedId === l.id ? ' row-selected' : ''}`}
                onClick={() => openLead(l.id)}
              >
                <td>
                  <div style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>{l.name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{l.email}</div>
                </td>
                <td>
                  <SourceBadge source={l.source} />
                </td>
                <td>
                  <StatusBadge status={l.status} />
                </td>
                <td>{l.country || '—'}</td>
                <td>{l.assigned_name || 'Unassigned'}</td>
                <td style={{ fontSize: '0.82rem' }}>
                  {l.next_follow_up_at ? new Date(l.next_follow_up_at).toLocaleString() : '—'}
                </td>
              </tr>
            ))}
            {!leads.length ? (
              <tr>
                <td colSpan={6} className="empty">
                  No leads match this view
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {selectedId ? (
        <LeadPanel leadId={selectedId} onClose={closeLead} onChanged={load} />
      ) : null}

      {showCreate ? (
        <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Create lead</h3>
            <form onSubmit={createLead}>
              {['name', 'email', 'phone', 'company', 'country'].map((k) => (
                <div className="field" key={k}>
                  <label className="label">{k}</label>
                  <input
                    className="input"
                    required={k === 'name'}
                    value={form[k]}
                    onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                  />
                </div>
              ))}
              <div className="field">
                <label className="label">source</label>
                <select
                  className="select"
                  value={form.source}
                  onChange={(e) => setForm({ ...form, source: e.target.value })}
                >
                  {meta.sources.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="row-actions">
                <button type="submit" className="btn btn-primary">
                  Create
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
