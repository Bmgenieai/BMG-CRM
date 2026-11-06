import React, { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

const emptyStep = () => ({
  delayDays: 0,
  subject: '',
  htmlContent: '',
  textContent: '',
  templateId: '',
});

/** Avoid showing the email twice when lead.name was stored as the email. */
function displayCampaignLeadName(lead) {
  const name = String(lead?.lead_name || '').trim();
  const email = String(lead?.lead_email || '').trim();
  const company = String(lead?.lead_company || '').trim();
  const nameLooksLikeEmail =
    !name ||
    (email && name.toLowerCase() === email.toLowerCase()) ||
    name.includes('@');
  if (!nameLooksLikeEmail) return name;
  if (company) return company;
  const local = email.split('@')[0] || '';
  if (!local) return '—';
  const human = local
    .replace(/[._+-]+/g, ' ')
    .replace(/\d+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
  return human || '—';
}

export default function CampaignsPage() {
  const { can } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [leads, setLeads] = useState([]);
  const [name, setName] = useState('');
  const [emailAccountId, setEmailAccountId] = useState('');
  const [steps, setSteps] = useState([emptyStep()]);
  const [pickLeads, setPickLeads] = useState([]);
  const [leadFilter, setLeadFilter] = useState('');
  const [leadStatus, setLeadStatus] = useState('');
  const [leadSource, setLeadSource] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [detailLeadFilter, setDetailLeadFilter] = useState('');

  if (!can('email:manage_campaigns')) return <Navigate to="/" replace />;

  const loadList = async () => {
    const d = await api('/email/campaigns');
    setCampaigns(d.campaigns || []);
  };

  const loadDetail = async (id) => {
    if (!id) {
      setDetail(null);
      return;
    }
    const d = await api(`/email/campaigns/${id}`);
    setDetail(d);
  };

  const load = async () => {
    setError('');
    try {
      const [acc, tpl, leadRows] = await Promise.all([
        api('/email/accounts'),
        api('/email/templates'),
        api('/leads'),
      ]);
      const activeAccounts = (acc.accounts || []).filter((a) => a.is_active);
      setAccounts(activeAccounts);
      setTemplates(tpl.templates || []);
      setLeads((leadRows || []).filter((l) => l.email));
      setEmailAccountId((prev) => {
        if (prev && activeAccounts.some((a) => a.id === prev)) return prev;
        const def = activeAccounts.find((a) => a.is_default) || activeAccounts[0];
        return def?.id || '';
      });
      await loadList();
      if (selectedId) await loadDetail(selectedId);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setDetailLeadFilter('');
    if (selectedId) loadDetail(selectedId).catch((e) => setError(e.message));
    else setDetail(null);
  }, [selectedId]);

  const filteredLeads = useMemo(() => {
    const q = leadFilter.trim().toLowerCase();
    return leads.filter((l) => {
      if (leadStatus && l.status !== leadStatus) return false;
      if (leadSource && l.source !== leadSource) return false;
      if (!q) return true;
      return (
        (l.name || '').toLowerCase().includes(q) ||
        (l.email || '').toLowerCase().includes(q) ||
        (l.company || '').toLowerCase().includes(q)
      );
    });
  }, [leads, leadFilter, leadStatus, leadSource]);

  const selectFiltered = () => {
    setPickLeads((prev) => [...new Set([...prev, ...filteredLeads.map((l) => l.id)])]);
  };

  const clearPick = () => setPickLeads([]);

  const applyTemplate = (idx, templateId) => {
    const tpl = templates.find((t) => t.id === templateId);
    setSteps((prev) => {
      const next = [...prev];
      const step = { ...next[idx], templateId };
      if (tpl) {
        step.subject = tpl.subject;
        step.htmlContent = tpl.htmlContent;
        step.textContent = tpl.textContent;
      }
      next[idx] = step;
      return next;
    });
  };

  const create = async (e) => {
    e.preventDefault();
    if (!emailAccountId) {
      setError('Select a From account (email) for this campaign');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const body = {
        name,
        emailAccountId,
        steps: steps.map((s, i) => ({
          stepOrder: i + 1,
          delayDays: Number(s.delayDays) || 0,
          subject: s.subject || undefined,
          htmlContent: s.htmlContent || undefined,
          textContent: s.textContent || undefined,
          templateId: s.templateId || undefined,
        })),
      };
      const created = await api('/email/campaigns', { method: 'POST', body });
      if (pickLeads.length) {
        await api(`/email/campaigns/${created.id}/leads`, {
          method: 'POST',
          body: { leadIds: pickLeads },
        });
      }
      setMessage('Campaign created');
      setName('');
      setSteps([emptyStep()]);
      setPickLeads([]);
      setSelectedId(created.id);
      await loadList();
      await loadDetail(created.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = async () => {
    if (!detail || detail.status === 'active') return;
    if (!detail.email_account_id) {
      setError('Select a From account (email) before saving');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api(`/email/campaigns/${detail.id}`, {
        method: 'PATCH',
        body: {
          name: detail.name,
          emailAccountId: detail.email_account_id,
          steps: (detail.steps || []).map((s, i) => ({
            stepOrder: i + 1,
            delayDays: Number(s.delay_days) || 0,
            subject: s.subject || undefined,
            htmlContent: s.html_content || undefined,
            textContent: s.text_content || undefined,
            templateId: s.template_id || undefined,
          })),
        },
      });
      setMessage('Saved');
      await loadList();
      await loadDetail(detail.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const addLeadsToCampaign = async () => {
    if (!detail || !pickLeads.length) return;
    setBusy(true);
    setError('');
    try {
      const r = await api(`/email/campaigns/${detail.id}/leads`, {
        method: 'POST',
        body: { leadIds: pickLeads },
      });
      setMessage(`Added ${r.added} lead(s)`);
      setPickLeads([]);
      await loadDetail(detail.id);
      await loadList();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const launch = async () => {
    if (!detail) return;
    if (!detail.email_account_id) {
      setError('Select a From account (email) before launching');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const r = await api(`/email/campaigns/${detail.id}/launch`, { method: 'POST', body: {} });
      setMessage(`Launched · ${r.scheduled} scheduled send(s)`);
      await loadList();
      await loadDetail(detail.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const pause = async () => {
    if (!detail) return;
    setBusy(true);
    setError('');
    try {
      await api(`/email/campaigns/${detail.id}/pause`, { method: 'POST', body: {} });
      setMessage('Paused');
      await loadList();
      await loadDetail(detail.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!detail) return;
    setBusy(true);
    setError('');
    try {
      await api(`/email/campaigns/${detail.id}/cancel`, { method: 'POST', body: {} });
      setMessage('Cancelled');
      await loadList();
      await loadDetail(detail.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleLead = (id) => {
    setPickLeads((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const detailLeads = useMemo(() => {
    const rows = detail?.leads || [];
    const q = detailLeadFilter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((l) => {
      const name = displayCampaignLeadName(l).toLowerCase();
      return (
        name.includes(q) ||
        (l.lead_email || '').toLowerCase().includes(q) ||
        (l.lead_company || '').toLowerCase().includes(q) ||
        (l.status || '').toLowerCase().includes(q)
      );
    });
  }, [detail, detailLeadFilter]);

  return (
    <div>
      <h1 className="page-title">Campaigns</h1>
      {error ? <div className="login-error">{error}</div> : null}
      {message ? (
        <div
          className="card"
          style={{ borderColor: 'var(--success)', color: 'var(--success)', marginBottom: '1rem' }}
        >
          {message}
        </div>
      ) : null}

      <div className="grid grid-2" style={{ marginBottom: '1rem' }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>New campaign</h3>
          <form onSubmit={create}>
            <div className="field">
              <label className="label">Name</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label className="label">From account</label>
              <select
                className="select"
                value={emailAccountId}
                onChange={(e) => setEmailAccountId(e.target.value)}
                required
              >
                <option value="" disabled>
                  Select email account…
                </option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label} · {a.email}
                  </option>
                ))}
              </select>
            </div>

            {steps.map((s, idx) => (
              <div
                key={idx}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '0.75rem',
                  marginBottom: 8,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong>Step {idx + 1}</strong>
                  {steps.length > 1 ? (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setSteps((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <div className="field">
                  <label className="label">Delay (days after launch)</label>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={s.delayDays}
                    onChange={(e) =>
                      setSteps((prev) => {
                        const next = [...prev];
                        next[idx] = { ...next[idx], delayDays: e.target.value };
                        return next;
                      })
                    }
                  />
                </div>
                <div className="field">
                  <label className="label">Template</label>
                  <select
                    className="select"
                    value={s.templateId}
                    onChange={(e) => applyTemplate(idx, e.target.value)}
                  >
                    <option value="">Custom</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label className="label">Subject</label>
                  <input
                    className="input"
                    value={s.subject}
                    onChange={(e) =>
                      setSteps((prev) => {
                        const next = [...prev];
                        next[idx] = { ...next[idx], subject: e.target.value };
                        return next;
                      })
                    }
                    required
                  />
                </div>
                <div className="field">
                  <label className="label">HTML body</label>
                  <textarea
                    className="textarea"
                    rows={4}
                    value={s.htmlContent}
                    onChange={(e) =>
                      setSteps((prev) => {
                        const next = [...prev];
                        next[idx] = { ...next[idx], htmlContent: e.target.value };
                        return next;
                      })
                    }
                    required
                  />
                </div>
              </div>
            ))}

            <button
              type="button"
              className="btn btn-secondary"
              style={{ marginBottom: 12 }}
              onClick={() =>
                setSteps((prev) => [
                  ...prev,
                  { ...emptyStep(), delayDays: prev.length ? 3 : 0 },
                ])
              }
            >
              Add step
            </button>

            <div className="field">
              <label className="label">
                Leads ({pickLeads.length} selected · {filteredLeads.length} shown · {leads.length} with email)
              </label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <input
                  className="input"
                  placeholder="Search name, email, company"
                  value={leadFilter}
                  onChange={(e) => setLeadFilter(e.target.value)}
                  style={{ flex: '1 1 160px', minWidth: 0 }}
                />
                <select
                  className="select"
                  value={leadStatus}
                  onChange={(e) => setLeadStatus(e.target.value)}
                  style={{ flex: '1 1 120px', minWidth: 0 }}
                >
                  <option value="">All statuses</option>
                  <option value="uncontacted">Uncontacted</option>
                  <option value="contacted">Contacted</option>
                  <option value="qualified">Qualified</option>
                  <option value="engaged">Engaged</option>
                  <option value="nurture">Nurture</option>
                </select>
                <select
                  className="select"
                  value={leadSource}
                  onChange={(e) => setLeadSource(e.target.value)}
                  style={{ flex: '1 1 120px', minWidth: 0 }}
                >
                  <option value="">All sources</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="facebook">Facebook</option>
                  <option value="instagram">Instagram</option>
                  <option value="csv_import">CSV / Meta</option>
                  <option value="telesales">BD</option>
                  <option value="signup_no_listing">Signup</option>
                  <option value="free_credit_no_purchase">Free credit</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={selectFiltered}>
                  Select all shown
                </button>
                <button type="button" className="btn btn-ghost" onClick={clearPick}>
                  Clear
                </button>
              </div>
              <div
                style={{
                  maxHeight: 360,
                  overflow: 'auto',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                }}
              >
                {filteredLeads.length === 0 ? (
                  <p className="empty" style={{ padding: 12, margin: 0 }}>
                    No leads match. Try search or clear filters.
                  </p>
                ) : (
                  filteredLeads.map((l) => (
                    <label
                      key={l.id}
                      style={{
                        display: 'flex',
                        gap: 8,
                        padding: '6px 8px',
                        borderBottom: '1px solid var(--border)',
                        fontSize: '0.85rem',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={pickLeads.includes(l.id)}
                        onChange={() => toggleLead(l.id)}
                      />
                      <span>
                        {l.name} · {l.email}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <button className="btn btn-primary" type="submit" disabled={busy}>
              Create
            </button>
          </form>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Campaigns</h3>
          <p className="stat-hint" style={{ marginTop: 0 }}>
            Status is overall campaign state (all leads finished → completed). Steps = emails in the
            sequence, not “current step”.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Leads</th>
                  <th title="Number of emails in the sequence">Emails</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr
                    key={c.id}
                    style={{
                      cursor: 'pointer',
                      background:
                        selectedId === c.id
                          ? 'color-mix(in srgb, var(--brand-primary) 10%, transparent)'
                          : undefined,
                    }}
                    onClick={() => setSelectedId(c.id)}
                  >
                    <td>{c.name}</td>
                    <td>{c.status}</td>
                    <td>{c.lead_count}</td>
                    <td>{c.step_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {detail ? (
            <div style={{ marginTop: '1rem' }}>
              <h3 style={{ marginTop: 0 }}>{detail.name}</h3>
              <p className="stat-hint" style={{ marginTop: 0 }}>
                {detail.status}
                {detail.account_email ? ` · ${detail.account_email}` : ''}
                {detail.counts
                  ? ` · ${detail.counts.total || detail.leads?.length || 0} leads · ${detail.counts.active || 0} active · ${detail.counts.completed || 0} done · ${detail.counts.stopped || 0} stopped`
                  : ''}
              </p>

              {(detail.status === 'draft' || detail.status === 'paused') && (
                <div className="field">
                  <label className="label">From account</label>
                  <select
                    className="select"
                    value={detail.email_account_id || ''}
                    onChange={(e) =>
                      setDetail({ ...detail, email_account_id: e.target.value || null })
                    }
                    required
                  >
                    <option value="" disabled>
                      Select email account…
                    </option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label} · {a.email}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                {(detail.status === 'draft' || detail.status === 'paused') && (
                  <>
                    <button type="button" className="btn btn-secondary" disabled={busy} onClick={saveDraft}>
                      Save
                    </button>
                    <button type="button" className="btn btn-primary" disabled={busy} onClick={launch}>
                      Launch
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={busy || !pickLeads.length}
                      onClick={addLeadsToCampaign}
                    >
                      Add selected leads
                    </button>
                  </>
                )}
                {detail.status === 'active' ? (
                  <button type="button" className="btn btn-secondary" disabled={busy} onClick={pause}>
                    Pause
                  </button>
                ) : null}
                {detail.status !== 'cancelled' && detail.status !== 'completed' ? (
                  <button type="button" className="btn btn-ghost" disabled={busy} onClick={cancel}>
                    Cancel campaign
                  </button>
                ) : null}
              </div>

              <h4>Sequence ({(detail.steps || []).length} emails)</h4>
              <ul style={{ paddingLeft: 18 }}>
                {(detail.steps || []).map((s, idx) => (
                  <li key={s.id}>
                    Email {idx + 1} · send on day {s.delay_days}:{' '}
                    {s.subject || s.template_id || '(no subject)'}
                  </li>
                ))}
              </ul>

              <h4>
                Leads ({detail.counts?.total ?? detail.leads?.length ?? 0}
                {detailLeadFilter.trim()
                  ? ` · ${detailLeads.length} match`
                  : ''}
                )
              </h4>
              <input
                className="input"
                placeholder="Search name, email, company, status"
                value={detailLeadFilter}
                onChange={(e) => setDetailLeadFilter(e.target.value)}
                style={{ marginBottom: 8 }}
              />
              <div className="table-wrap" style={{ maxHeight: 420, overflow: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailLeads.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="empty">
                          No leads match.
                        </td>
                      </tr>
                    ) : (
                      detailLeads.map((l) => (
                        <tr key={l.id}>
                          <td>{displayCampaignLeadName(l)}</td>
                          <td>{l.lead_email}</td>
                          <td>{l.status}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
