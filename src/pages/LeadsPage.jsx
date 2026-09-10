import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { SourceBadge, StatusBadge } from '../components/Badges.jsx';
import LeadPanel from '../components/LeadPanel.jsx';

const FILTER_TITLES = {
  qualified: 'Qualified prospects',
  conversation: 'Conversations',
  'demo-booked': 'Demos booked',
  trial: 'Trials',
  paid: 'Paid',
  lost: 'Lost',
  // legacy URL redirects still labelled
  new: 'Qualified prospects',
  contacted: 'Qualified prospects',
  interested: 'Conversations',
  neutral: 'Conversations',
  'follow-up': 'Conversations',
  'not-interested': 'Lost',
  converted: 'Paid',
  signup: 'Signup · no purchase',
  'free-credit': 'Free credit · no purchase',
  winback: 'Win-back · no repurchase',
};

const FILTER_QUERY = {
  qualified: { status: 'qualified' },
  conversation: { status: 'conversation' },
  'demo-booked': { status: 'demo_booked' },
  trial: { status: 'trial' },
  paid: { status: 'paid' },
  lost: { status: 'lost' },
  new: { status: 'qualified' },
  contacted: { status: 'qualified' },
  interested: { status: 'conversation' },
  neutral: { status: 'conversation' },
  'follow-up': { status: 'conversation' },
  'not-interested': { status: 'lost' },
  converted: { status: 'paid' },
  signup: { source: 'signup_no_listing' },
  'free-credit': { source: 'free_credit_no_purchase' },
  winback: { source: 'purchased_no_repurchase' },
};

const EMPTY_FORM = {
  contact_format: 'company',
  name: '',
  email: '',
  phone: '',
  company: '',
  state: '',
  job_title: '',
  industry: '',
  notes: '',
  estimated_value: '',
  country: '',
  source: 'telesales',
};

export default function LeadsPage({ refreshSidebarCounts }) {
  const { filter } = useParams();
  const { can, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('id');

  const preset = FILTER_QUERY[filter] || {};

  const [leads, setLeads] = useState([]);
  const [meta, setMeta] = useState({ sources: [], statuses: [] });
  const [q, setQ] = useState('');
  const [source, setSource] = useState(preset.source || '');
  const [status, setStatus] = useState(preset.status || '');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(() => ({
    ...EMPTY_FORM,
    source: user?.role === 'telesales' ? 'telesales' : 'manual',
  }));
  const [error, setError] = useState('');

  const pageTitle = useMemo(() => {
    if (filter && FILTER_TITLES[filter]) return FILTER_TITLES[filter];
    return 'All leads';
  }, [filter]);

  const createSources = useMemo(() => {
    const all = meta.sources || [];
    if (user?.role === 'telesales') {
      return all.filter((s) => s.key === 'telesales');
    }
    return all.filter((s) => ['telesales', 'manual', 'csv_import'].includes(s.key) || s.key === form.source);
  }, [meta.sources, user?.role, form.source]);

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
    if (!form.industry.trim()) {
      setError('Industry is required');
      return;
    }
    try {
      const isCompany = form.contact_format === 'company';
      const body = {
        contact_format: form.contact_format,
        name: form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        company: isCompany ? form.name : form.company || undefined,
        state: form.state || undefined,
        job_title: isCompany ? undefined : form.job_title || undefined,
        industry: form.industry.trim(),
        notes: form.notes || undefined,
        estimated_value: form.estimated_value === '' ? 0 : Number(form.estimated_value),
        country: form.country || undefined,
        source: user?.role === 'telesales' ? 'telesales' : form.source || 'manual',
      };
      const created = await api('/leads', { method: 'POST', body });
      setShowCreate(false);
      setForm({
        ...EMPTY_FORM,
        source: user?.role === 'telesales' ? 'telesales' : 'manual',
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
        {filter && !['signup', 'free-credit', 'winback'].includes(filter) && 'Filter by sales funnel stage.'}
      </p>

      {error ? <div className="login-error">{error}</div> : null}

      <div className="toolbar">
        <input
          className="input"
          placeholder="Search name, email, company, industry, state…"
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
              <th>State</th>
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
                  <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                    {[
                      l.contact_format === 'employee' ? 'Employee' : l.contact_format === 'company' ? 'Company' : null,
                      l.industry,
                      l.company && l.company !== l.name ? l.company : null,
                      l.job_title,
                    ]
                      .filter(Boolean)
                      .join(' · ') || l.email || '—'}
                  </div>
                </td>
                <td>
                  <SourceBadge source={l.source} createdByName={l.created_by_name} />
                </td>
                <td>
                  <StatusBadge status={l.status} />
                </td>
                <td>{l.state || l.country || '—'}</td>
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
            <h3>Lead generation</h3>
            <p className="page-sub" style={{ marginTop: 0 }}>
              Source will show as{' '}
              <strong>
                {user?.role === 'telesales' ? 'Telesales' : form.source === 'telesales' ? 'Telesales' : 'Manual'} ·{' '}
                {user?.name || 'you'}
              </strong>
            </p>
            <form onSubmit={createLead}>
              <div className="field">
                <label className="label">Contact format</label>
                <div className="segmented" role="group" aria-label="Contact format">
                  <button
                    type="button"
                    className={`segmented-btn${form.contact_format === 'company' ? ' active' : ''}`}
                    onClick={() => setForm({ ...form, contact_format: 'company', job_title: '' })}
                  >
                    Company
                  </button>
                  <button
                    type="button"
                    className={`segmented-btn${form.contact_format === 'employee' ? ' active' : ''}`}
                    onClick={() => setForm({ ...form, contact_format: 'employee' })}
                  >
                    Employee
                  </button>
                </div>
              </div>
              <div className="field">
                <label className="label">
                  {form.contact_format === 'company' ? 'Company name' : 'Employee name'}
                </label>
                <input
                  className="input"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="field">
                <label className="label">Industry</label>
                <input
                  className="input"
                  required
                  placeholder="e.g. Real estate photography"
                  value={form.industry}
                  onChange={(e) => setForm({ ...form, industry: e.target.value })}
                />
              </div>
              <div className="field">
                <label className="label">Contact</label>
                <input
                  className="input"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              {form.contact_format === 'employee' ? (
                <>
                  <div className="field">
                    <label className="label">Company</label>
                    <input
                      className="input"
                      value={form.company}
                      onChange={(e) => setForm({ ...form, company: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label className="label">Job title</label>
                    <input
                      className="input"
                      value={form.job_title}
                      onChange={(e) => setForm({ ...form, job_title: e.target.value })}
                    />
                  </div>
                </>
              ) : null}
              <div className="field">
                <label className="label">State</label>
                <input
                  className="input"
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                />
              </div>
              <div className="field">
                <label className="label">Email</label>
                <input
                  className="input"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="field">
                <label className="label">Estimated revenue</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="1"
                  value={form.estimated_value}
                  onChange={(e) => setForm({ ...form, estimated_value: e.target.value })}
                />
              </div>
              <div className="field">
                <label className="label">Follow-up notes</label>
                <textarea
                  className="textarea"
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              {user?.role !== 'telesales' ? (
                <div className="field">
                  <label className="label">Source</label>
                  <select
                    className="select"
                    value={form.source}
                    onChange={(e) => setForm({ ...form, source: e.target.value })}
                  >
                    {createSources.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div className="row-actions">
                <button type="submit" className="btn btn-primary">
                  Create lead
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
