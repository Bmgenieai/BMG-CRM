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
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

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
      setAccounts((acc.accounts || []).filter((a) => a.is_active));
      setTemplates(tpl.templates || []);
      setLeads((leadRows || []).filter((l) => l.email));
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
    if (selectedId) loadDetail(selectedId).catch((e) => setError(e.message));
    else setDetail(null);
  }, [selectedId]);

  const filteredLeads = useMemo(() => {
    const q = leadFilter.trim().toLowerCase();
    if (!q) return leads.slice(0, 200);
    return leads
      .filter(
        (l) =>
          (l.name || '').toLowerCase().includes(q) ||
          (l.email || '').toLowerCase().includes(q) ||
          (l.company || '').toLowerCase().includes(q),
      )
      .slice(0, 200);
  }, [leads, leadFilter]);

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
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const body = {
        name,
        emailAccountId: emailAccountId || undefined,
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
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api(`/email/campaigns/${detail.id}`, {
        method: 'PATCH',
        body: {
          name: detail.name,
          emailAccountId: detail.email_account_id || null,
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
              >
                <option value="">Default</option>
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
              <label className="label">Leads ({pickLeads.length} selected)</label>
              <input
                className="input"
                placeholder="Search"
                value={leadFilter}
                onChange={(e) => setLeadFilter(e.target.value)}
                style={{ marginBottom: 8 }}
              />
              <div style={{ maxHeight: 180, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                {filteredLeads.map((l) => (
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
                ))}
              </div>
            </div>

            <button className="btn btn-primary" type="submit" disabled={busy}>
              Create
            </button>
          </form>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Campaigns</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Leads</th>
                  <th>Steps</th>
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
                  ? ` · ${detail.counts.active || 0} active · ${detail.counts.completed || 0} done · ${detail.counts.stopped || 0} stopped`
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
                  >
                    <option value="">Default</option>
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

              <h4>Steps</h4>
              <ul style={{ paddingLeft: 18 }}>
                {(detail.steps || []).map((s) => (
                  <li key={s.id}>
                    Day {s.delay_days}: {s.subject || s.template_id || '(no subject)'}
                  </li>
                ))}
              </ul>

              <h4>Leads</h4>
              <div className="table-wrap" style={{ maxHeight: 240, overflow: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detail.leads || []).map((l) => (
                      <tr key={l.id}>
                        <td>{l.lead_name}</td>
                        <td>{l.lead_email}</td>
                        <td>{l.status}</td>
                      </tr>
                    ))}
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
