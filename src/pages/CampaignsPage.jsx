import React, { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { fmtPktDate } from '../components/Badges.jsx';

const EMAIL_FORMATS = [
  { key: 'plain_text', label: 'Plain text' },
  { key: 'image', label: 'Image' },
  { key: 'gif', label: 'GIF' },
  { key: 'video', label: 'Video' },
];
const VARIANT_LETTERS = ['A', 'B', 'C', 'D'];

function formatLabel(key) {
  return EMAIL_FORMATS.find((f) => f.key === key)?.label || key || '—';
}

function formatNextSend(iso) {
  return fmtPktDate(iso);
}

function emptyVariant(key = 'A') {
  return {
    key,
    contentCategory: key === 'A' ? 'plain_text' : key === 'B' ? 'gif' : key === 'C' ? 'image' : 'video',
    subject: '',
    htmlContent: '',
    textContent: '',
    templateId: '',
  };
}

/** One sequence email with Instantly-style A/B/C/D variants. */
const emptyStep = () => ({
  delayDays: 0,
  activeVariant: 0,
  variants: [emptyVariant('A')],
});

function splitHint(leadCount, variantCount) {
  if (!leadCount || !variantCount) return '';
  const base = Math.floor(leadCount / variantCount);
  const rem = leadCount % variantCount;
  if (!base && !rem) return '';
  const parts = Array.from({ length: variantCount }, (_, i) => base + (i < rem ? 1 : 0));
  return `${leadCount} leads → split ${parts.join(' / ')} across ${variantCount} variants`;
}

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
  const [importBatches, setImportBatches] = useState([]);
  const [leadSheetId, setLeadSheetId] = useState('');
  const [stepPreviews, setStepPreviews] = useState({});
  const [categoryStats, setCategoryStats] = useState(null);
  const [drilldown, setDrilldown] = useState(null); // { title, metric, campaignId, loading, items, error }

  const openCampaignDrilldown = async (campaignId, metric, title) => {
    setDrilldown({
      campaignId,
      metric,
      title,
      loading: true,
      items: [],
      error: '',
      count: 0,
    });
    try {
      const data = await api(
        `/email/campaigns/${campaignId}/drilldown?metric=${encodeURIComponent(metric)}`,
      );
      setDrilldown({
        campaignId,
        metric,
        title: data.title || title,
        loading: false,
        items: data.items || [],
        error: '',
        count: data.count || (data.items || []).length,
      });
    } catch (e) {
      setDrilldown({
        campaignId,
        metric,
        title,
        loading: false,
        items: [],
        error: e.message || 'Failed to load',
        count: 0,
      });
    }
  };

  if (!can('email:manage_campaigns')) return <Navigate to="/" replace />;

  const loadList = async () => {
    const [d, cat] = await Promise.all([
      api('/email/campaigns'),
      api('/email/campaigns/category-stats?period=overall').catch(() => null),
    ]);
    setCampaigns(d.campaigns || []);
    if (cat) setCategoryStats(cat);
  };

  const updateVariant = (stepIdx, patch) => {
    setSteps((prev) => {
      const next = [...prev];
      const step = { ...next[stepIdx] };
      const vi = step.activeVariant || 0;
      const variants = [...(step.variants || [])];
      variants[vi] = { ...variants[vi], ...patch };
      step.variants = variants;
      next[stepIdx] = step;
      return next;
    });
  };

  const addVariantToAllSteps = () => {
    setSteps((prev) => {
      const used = new Set((prev[0]?.variants || []).map((v) => v.key));
      const nextKey = VARIANT_LETTERS.find((k) => !used.has(k));
      if (!nextKey) return prev;
      return prev.map((step) => ({
        ...step,
        variants: [...(step.variants || []), emptyVariant(nextKey)],
        activeVariant: (step.variants || []).length,
      }));
    });
  };

  const removeVariantFromAllSteps = (key) => {
    setSteps((prev) => {
      if ((prev[0]?.variants || []).length <= 1) return prev;
      return prev.map((step) => {
        const variants = (step.variants || []).filter((v) => v.key !== key);
        return {
          ...step,
          variants,
          activeVariant: Math.min(step.activeVariant || 0, Math.max(variants.length - 1, 0)),
        };
      });
    });
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
      const [acc, tpl, leadRows, meta] = await Promise.all([
        api('/email/accounts'),
        api('/email/templates'),
        api('/leads'),
        api('/leads/meta').catch(() => ({ importBatches: [] })),
      ]);
      const activeAccounts = (acc.accounts || []).filter((a) => a.is_active);
      setAccounts(activeAccounts);
      setTemplates(tpl.templates || []);
      setLeads((leadRows || []).filter((l) => l.email));
      setImportBatches(meta.importBatches || []);
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
      if (leadSheetId === '__manual__') {
        if (l.import_batch_id) return false;
      } else if (leadSheetId && l.import_batch_id !== leadSheetId) {
        return false;
      }
      if (!q) return true;
      return (
        (l.name || '').toLowerCase().includes(q) ||
        (l.email || '').toLowerCase().includes(q) ||
        (l.company || '').toLowerCase().includes(q) ||
        (l.import_batch_filename || '').toLowerCase().includes(q)
      );
    });
  }, [leads, leadFilter, leadStatus, leadSource, leadSheetId]);

  const previewStep = async (idx) => {
    if (!emailAccountId) {
      setError('Select a From account (email) before preview');
      return;
    }
    const step = steps[idx];
    const variant = step?.variants?.[step.activeVariant || 0];
    if (!variant) return;
    setBusy(true);
    setError('');
    try {
      const leadId = pickLeads[0] || filteredLeads[0]?.id;
      const body = {
        templateId: variant.templateId || undefined,
        subject: variant.subject,
        htmlContent: variant.htmlContent,
        textContent: variant.textContent || undefined,
        emailAccountId,
      };
      if (leadId) body.leadId = leadId;
      else body.sample = true;
      const data = await api('/email/preview', { method: 'POST', body });
      setStepPreviews((prev) => ({ ...prev, [`${idx}-${variant.key}`]: data }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const selectFiltered = () => {
    setPickLeads((prev) => [...new Set([...prev, ...filteredLeads.map((l) => l.id)])]);
  };

  const clearPick = () => setPickLeads([]);

  const applyTemplate = (idx, templateId) => {
    const tpl = templates.find((t) => t.id === templateId);
    updateVariant(idx, {
      templateId,
      ...(tpl
        ? {
            subject: tpl.subject,
            htmlContent: tpl.htmlContent,
            textContent: tpl.textContent,
          }
        : {}),
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
          variants: (s.variants || []).map((v) => ({
            key: v.key,
            contentCategory: v.contentCategory || 'plain_text',
            subject: v.subject || undefined,
            htmlContent: v.htmlContent || undefined,
            textContent: v.textContent || undefined,
            templateId: v.templateId || undefined,
          })),
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
            variants: (s.variants && s.variants.length
              ? s.variants
              : [
                  {
                    key: 'A',
                    content_category: s.content_category,
                    subject: s.subject,
                    html_content: s.html_content,
                    text_content: s.text_content,
                    template_id: s.template_id,
                  },
                ]
            ).map((v) => ({
              key: v.variant_key || v.key || 'A',
              contentCategory: v.content_category || v.contentCategory || 'plain_text',
              subject: v.subject || undefined,
              htmlContent: v.html_content || v.htmlContent || undefined,
              textContent: v.text_content || v.textContent || undefined,
              templateId: v.template_id || v.templateId || undefined,
            })),
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
      <p className="page-sub" style={{ marginTop: 0 }}>
        Add variants A/B/C/D inside each email (like Instantly). Leads are split evenly across
        variants — each group gets a different email from the same campaign.
      </p>
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

            {(() => {
              const variantCount = steps[0]?.variants?.length || 1;
              const hint = splitHint(pickLeads.length, variantCount);
              return hint ? (
                <p className="stat-hint" style={{ marginTop: 0 }}>
                  {hint}
                </p>
              ) : null;
            })()}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={(steps[0]?.variants || []).length >= 4}
                onClick={addVariantToAllSteps}
              >
                Add variant ({VARIANT_LETTERS[(steps[0]?.variants || []).length] || '—'})
              </button>
              <span className="stat-hint" style={{ alignSelf: 'center' }}>
                Same variants on every email in the sequence (A gets A on follow-ups too).
              </span>
            </div>

            {steps.map((s, idx) => {
              const variants = s.variants || [];
              const vi = Math.min(s.activeVariant || 0, Math.max(variants.length - 1, 0));
              const variant = variants[vi] || emptyVariant('A');
              const previewKey = `${idx}-${variant.key}`;
              return (
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
                    <strong>
                      Email {idx + 1}
                      {idx === 0 ? ' (Day 0)' : ''}
                    </strong>
                    {steps.length > 1 ? (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => setSteps((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        Remove email
                      </button>
                    ) : null}
                  </div>

                  <div className="field">
                    <label className="label">Delay (business days after launch)</label>
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
                    <p className="stat-hint" style={{ marginTop: 6, marginBottom: 0 }}>
                      Sat/Sun are skipped. Sends go out Mon–Fri, 7:00 PM–12:00 AM PKT.
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                    {variants.map((v, vIdx) => (
                      <button
                        key={v.key}
                        type="button"
                        className={`btn ${vi === vIdx ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ minWidth: 44 }}
                        onClick={() =>
                          setSteps((prev) => {
                            const next = [...prev];
                            next[idx] = { ...next[idx], activeVariant: vIdx };
                            return next;
                          })
                        }
                      >
                        {v.key}
                      </button>
                    ))}
                    {variants.length > 1 ? (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => removeVariantFromAllSteps(variant.key)}
                        title={`Remove variant ${variant.key} from all emails`}
                      >
                        Remove {variant.key}
                      </button>
                    ) : null}
                  </div>

                  <p className="stat-hint" style={{ marginTop: 0 }}>
                    Editing variant <strong>{variant.key}</strong> — {formatLabel(variant.contentCategory)}
                  </p>

                  <div className="field">
                    <label className="label">Format for variant {variant.key}</label>
                    <select
                      className="select"
                      value={variant.contentCategory || 'plain_text'}
                      onChange={(e) => updateVariant(idx, { contentCategory: e.target.value })}
                      required
                    >
                      {EMAIL_FORMATS.map((f) => (
                        <option key={f.key} value={f.key}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label className="label">Template</label>
                    <select
                      className="select"
                      value={variant.templateId || ''}
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
                      value={variant.subject || ''}
                      onChange={(e) => updateVariant(idx, { subject: e.target.value })}
                      required
                    />
                  </div>
                  <div className="field">
                    <label className="label">HTML body</label>
                    <textarea
                      className="textarea"
                      rows={4}
                      value={variant.htmlContent || ''}
                      onChange={(e) => updateVariant(idx, { htmlContent: e.target.value })}
                      required
                    />
                    <p className="stat-hint" style={{ marginTop: 6, marginBottom: 0 }}>
                      Use {'{{first_name}}'} and {'{{company}}'} — preview fills them before launch.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busy}
                    onClick={() => previewStep(idx)}
                  >
                    Preview variant {variant.key}
                  </button>
                  {stepPreviews[previewKey] ? (
                    <div
                      style={{
                        marginTop: 8,
                        padding: 10,
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        background: 'var(--alabaster, #f7f7f5)',
                      }}
                    >
                      <p className="stat-hint" style={{ marginTop: 0 }}>
                        Preview · variant {variant.key}
                      </p>
                      <p style={{ fontWeight: 600, margin: '0 0 8px' }}>
                        Subject: {stepPreviews[previewKey].subject}
                      </p>
                      <div
                        style={{ fontSize: '0.9rem', lineHeight: 1.45 }}
                        dangerouslySetInnerHTML={{
                          __html: stepPreviews[previewKey].htmlContent || '<p>(no HTML)</p>',
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}

            <button
              type="button"
              className="btn btn-secondary"
              style={{ marginBottom: 12 }}
              onClick={() =>
                setSteps((prev) => {
                  const keys = (prev[0]?.variants || [emptyVariant('A')]).map((v) => v.key);
                  return [
                    ...prev,
                    {
                      delayDays: prev.length ? 3 : 0,
                      activeVariant: 0,
                      variants: keys.map((k) => emptyVariant(k)),
                    },
                  ];
                })
              }
            >
              Add follow-up email
            </button>

            <div className="field">
              <label className="label">
                Leads ({pickLeads.length} selected · {filteredLeads.length} shown · {leads.length} with email)
              </label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <input
                  className="input"
                  placeholder="Search name, email, company, sheet"
                  value={leadFilter}
                  onChange={(e) => setLeadFilter(e.target.value)}
                  style={{ flex: '1 1 160px', minWidth: 0 }}
                />
                <select
                  className="select"
                  value={leadSheetId}
                  onChange={(e) => setLeadSheetId(e.target.value)}
                  style={{ flex: '1 1 180px', minWidth: 0 }}
                  title="Filter by uploaded sheet"
                >
                  <option value="">All uploaded sheets</option>
                  <option value="__manual__">Manual / no sheet</option>
                  {importBatches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.filename}
                      {b.imported_count != null ? ` (${b.imported_count})` : ''}
                    </option>
                  ))}
                </select>
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
                        alignItems: 'flex-start',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={pickLeads.includes(l.id)}
                        onChange={() => toggleLead(l.id)}
                        style={{ marginTop: 2 }}
                      />
                      <span>
                        {l.name} · {l.email}
                        <span
                          style={{
                            display: 'block',
                            fontSize: '0.72rem',
                            color: 'var(--muted)',
                            marginTop: 2,
                          }}
                          title={l.import_batch_filename || 'Manual / no sheet'}
                        >
                          {l.import_batch_filename || 'Manual / no sheet'}
                        </span>
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>
        <div className="card" style={{ margin: 0 }}>
          <h3 style={{ marginTop: 0 }}>Which variant works better?</h3>
          <p className="stat-hint" style={{ marginTop: 0 }}>
            Open and reply rates by variant (A/B/C/D) across all campaigns.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Variant</th>
                  <th>Sent</th>
                  <th>Opened</th>
                  <th>Open rate</th>
                  <th>Replies</th>
                  <th>Reply rate</th>
                </tr>
              </thead>
              <tbody>
                {(categoryStats?.variants ||
                  VARIANT_LETTERS.map((k) => ({
                    variant_key: k,
                    label: `Variant ${k}`,
                    sent: 0,
                    opened: 0,
                    openRate: 0,
                    replies: 0,
                    replyRate: 0,
                  }))).map((row) => (
                  <tr key={row.variant_key || row.label}>
                    <td>{row.label}</td>
                    <td>{row.sent || 0}</td>
                    <td>{row.opened || 0}</td>
                    <td>{row.sent ? `${row.openRate}%` : '—'}</td>
                    <td>{row.replies || 0}</td>
                    <td>{row.sent ? `${row.replyRate}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(categoryStats?.categories || []).some((c) => c.sent > 0) ? (
            <>
              <h4 style={{ marginBottom: 6 }}>By format</h4>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Format</th>
                      <th>Sent</th>
                      <th>Open rate</th>
                      <th>Reply rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(categoryStats.categories || [])
                      .filter((row) => row.sent > 0)
                      .map((row) => (
                        <tr key={row.content_category || row.label}>
                          <td>{row.label}</td>
                          <td>{row.sent || 0}</td>
                          <td>{row.sent ? `${row.openRate}%` : '—'}</td>
                          <td>{row.sent ? `${row.replyRate}%` : '—'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>

        <div className="card" style={{ margin: 0 }}>
          <h3 style={{ marginTop: 0 }}>Campaigns</h3>
          <p className="stat-hint" style={{ marginTop: 0 }}>
            Click a campaign to open details below. Click any number to see the full list in a popup.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Leads</th>
                  <th title="First email in the sequence">Email 1</th>
                  <th title="Second email (follow-up)">Email 2</th>
                  <th title="Third email (follow-up)">Email 3</th>
                  <th title="Fourth email (follow-up)">Email 4</th>
                  <th>Next follow-up</th>
                  <th>Opened</th>
                  <th>Replies</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => {
                  const numBtn = (metric, label, value, extra = null) => (
                    <button
                      type="button"
                      className="table-num-btn"
                      title={`View ${label}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(c.id);
                        openCampaignDrilldown(c.id, metric, `${c.name} — ${label}`);
                      }}
                    >
                      {value ?? 0}
                      {extra}
                    </button>
                  );
                  return (
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
                      <td>{numBtn('leads', 'Leads', c.lead_count)}</td>
                      <td>{numBtn('step_1', 'Email 1', c.sent_step_1 || 0)}</td>
                      <td>{numBtn('step_2', 'Email 2', c.sent_step_2 || 0)}</td>
                      <td>{numBtn('step_3', 'Email 3', c.sent_step_3 || 0)}</td>
                      <td>{numBtn('step_4', 'Email 4', c.sent_step_4 || 0)}</td>
                      <td>{formatNextSend(c.next_follow_up_at)}</td>
                      <td>
                        {numBtn(
                          'opened',
                          'Opened',
                          c.opened_count || 0,
                          c.sent_count ? (
                            <span className="stat-hint"> ({c.open_rate}%)</span>
                          ) : null,
                        )}
                      </td>
                      <td>
                        {numBtn(
                          'replies',
                          'Replies',
                          c.reply_count || 0,
                          c.sent_count ? (
                            <span className="stat-hint"> ({c.reply_rate}%)</span>
                          ) : null,
                        )}
                      </td>
                    </tr>
                  );
                })}
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

              {detail.stats ? (
                <div
                  className="grid grid-4"
                  style={{ marginBottom: '0.85rem', gap: 8 }}
                >
                  {[
                    { label: 'Sent', value: detail.stats.sent, metric: 'sent' },
                    {
                      label: 'Opened',
                      value: detail.stats.opened,
                      hint: detail.stats.sent ? `${detail.stats.openRate}%` : null,
                      metric: 'opened',
                    },
                    {
                      label: 'Replies',
                      value: detail.stats.replies,
                      hint: detail.stats.sent ? `${detail.stats.replyRate}%` : null,
                      metric: 'replies',
                    },
                    {
                      label: 'Bounces',
                      value: detail.stats.bounced,
                      hint: detail.stats.sent ? `${detail.stats.bounceRate}%` : null,
                      metric: 'bounced',
                    },
                  ].map((card) => (
                    <div
                      key={card.label}
                      className="card"
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        openCampaignDrilldown(
                          detail.id,
                          card.metric,
                          `${detail.name} — ${card.label}`,
                        )
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openCampaignDrilldown(
                            detail.id,
                            card.metric,
                            `${detail.name} — ${card.label}`,
                          );
                        }
                      }}
                      style={{ margin: 0, padding: '0.65rem 0.75rem', cursor: 'pointer' }}
                      title={`View ${card.label}`}
                    >
                      <p className="stat-label" style={{ margin: 0 }}>
                        {card.label}
                      </p>
                      <p className="stat-value" style={{ margin: '4px 0 0', fontSize: '1.35rem' }}>
                        {card.value ?? 0}
                      </p>
                      {card.hint ? (
                        <p className="stat-hint" style={{ margin: 0 }}>
                          {card.hint}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}

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
              {(detail.stats?.byVariant || []).length ? (
                <div className="table-wrap" style={{ marginBottom: 12 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Variant</th>
                        <th>Leads</th>
                        <th>Sent</th>
                        <th>Opened</th>
                        <th>Replies</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.stats.byVariant.map((row) => {
                        const assigned =
                          (detail.stats.variantAssigned || []).find(
                            (a) => a.variant_key === row.variant_key,
                          )?.leads || 0;
                        return (
                          <tr key={row.variant_key}>
                            <td>{row.variant_key}</td>
                            <td>{assigned}</td>
                            <td>{row.sent}</td>
                            <td>
                              {row.opened}
                              {row.sent ? ` (${row.openRate}%)` : ''}
                            </td>
                            <td>
                              {row.replies}
                              {row.sent ? ` (${row.replyRate}%)` : ''}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}
              <ul style={{ paddingLeft: 18 }}>
                {(detail.steps || []).map((s, idx) => {
                  const stepStat = (detail.stats?.byStep || []).find((x) => x.step_id === s.id);
                  const variants = s.variants || [];
                  const stepMetric = `step_${idx + 1}`;
                  return (
                    <li key={s.id} style={{ marginBottom: 10 }}>
                      <strong>Email {idx + 1}</strong>
                      {' · day '}
                      {s.delay_days}
                      {stepStat ? (
                        <span className="stat-hint">
                          {' '}
                          ·{' '}
                          <button
                            type="button"
                            className="table-num-btn"
                            onClick={() =>
                              openCampaignDrilldown(
                                detail.id,
                                stepMetric,
                                `${detail.name} — Email ${idx + 1}`,
                              )
                            }
                          >
                            {stepStat.sent} sent
                          </button>
                          {' · '}
                          {stepStat.openRate}% open · {stepStat.replyRate}% reply
                        </span>
                      ) : null}
                      <ul style={{ paddingLeft: 16, marginTop: 4 }}>
                        {variants.map((v) => (
                          <li key={v.id || v.variant_key} className="stat-hint">
                            Variant {v.variant_key} · {formatLabel(v.content_category)} ·{' '}
                            {v.subject || '(no subject)'}
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                })}
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

      {drilldown ? (
        <div
          role="presentation"
          onClick={() => setDrilldown(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            zIndex: 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            className="card"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(860px, 100%)',
              maxHeight: '85vh',
              overflow: 'auto',
              margin: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                alignItems: 'flex-start',
              }}
            >
              <div>
                <h3 style={{ marginTop: 0, marginBottom: 4 }}>{drilldown.title}</h3>
                <p className="stat-hint" style={{ margin: 0 }}>
                  {drilldown.loading
                    ? 'Loading…'
                    : `${drilldown.count} record${drilldown.count === 1 ? '' : 's'}`}
                </p>
              </div>
              <button type="button" className="btn btn-ghost" onClick={() => setDrilldown(null)}>
                Close
              </button>
            </div>
            {drilldown.error ? (
              <div className="login-error" style={{ marginTop: 12 }}>
                {drilldown.error}
              </div>
            ) : null}
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table>
                <thead>
                  <tr>
                    <th>Lead</th>
                    <th>Email</th>
                    <th>Subject / note</th>
                    <th>Step</th>
                    <th>Variant</th>
                    <th>Status</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {drilldown.loading ? (
                    <tr>
                      <td colSpan={7} className="empty">
                        Loading…
                      </td>
                    </tr>
                  ) : (drilldown.items || []).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="empty">
                        No records for this count.
                      </td>
                    </tr>
                  ) : (
                    drilldown.items.map((it) => (
                      <tr key={it.id || `${it.lead_id}-${it.date}`}>
                        <td>{it.lead_name || '—'}</td>
                        <td>{it.lead_email || it.to_email || '—'}</td>
                        <td>{it.subject || '—'}</td>
                        <td>{it.step_order ? `Email ${it.step_order}` : '—'}</td>
                        <td>{it.variant_key || '—'}</td>
                        <td>{it.status || it.lead_status || '—'}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {it.date ? formatNextSend(it.date) : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
