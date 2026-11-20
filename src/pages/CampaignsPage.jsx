import React, { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { fmtInTz, fmtNowInTz } from '../components/Badges.jsx';

const EMAIL_FORMATS = [
  { key: 'plain_text', label: 'Plain text' },
  { key: 'image', label: 'Image' },
  { key: 'gif', label: 'GIF' },
  { key: 'video', label: 'Video' },
];
const VARIANT_LETTERS = ['A', 'B', 'C', 'D'];

const CAMPAIGN_TIMEZONES = [
  { value: 'America/New_York', label: 'US Eastern (New York)', short: 'ET' },
  { value: 'America/Chicago', label: 'US Central (Chicago)', short: 'CT' },
  { value: 'America/Denver', label: 'US Mountain (Denver)', short: 'MT' },
  { value: 'America/Los_Angeles', label: 'US Pacific (Los Angeles)', short: 'PT' },
  { value: 'America/Phoenix', label: 'US Arizona (no DST)', short: 'MST' },
  { value: 'Europe/London', label: 'UK (London)', short: 'UK' },
  { value: 'Europe/Dublin', label: 'Ireland (Dublin)', short: 'IST' },
  { value: 'Asia/Karachi', label: 'Pakistan (Karachi)', short: 'PKT' },
  { value: 'UTC', label: 'UTC', short: 'UTC' },
];

const SEND_HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const ampm = i >= 12 ? 'PM' : 'AM';
  const displayHour = i % 12 === 0 ? 12 : i % 12;
  return { value: i, label: `${displayHour}:00 ${ampm}` };
});

const SEND_MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => ({
  value: i,
  label: `:${String(i).padStart(2, '0')}`,
}));

function tzMeta(value) {
  return CAMPAIGN_TIMEZONES.find((t) => t.value === value) || CAMPAIGN_TIMEZONES[0];
}

function formatSendTime(hour, minute = 0) {
  const h = Number(hour) || 0;
  const m = Number(minute) || 0;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  const displayMinute = String(m).padStart(2, '0');
  return `${displayHour}:${displayMinute} ${ampm}`;
}

function formatSendHour(hour, minute = 0) {
  return formatSendTime(hour, minute);
}

function formatLabel(key) {
  return EMAIL_FORMATS.find((f) => f.key === key)?.label || key || '—';
}

function formatNextSend(iso, timeZone = 'America/New_York') {
  if (!iso) return '—';
  const meta = tzMeta(timeZone);
  return `${fmtInTz(iso, timeZone || 'America/New_York')} ${meta.short}`;
}

function defaultScheduleInput(minutesAhead = 15) {
  const d = new Date(Date.now() + minutesAhead * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
  const [timezone, setTimezone] = useState('America/New_York');
  const [sendHour, setSendHour] = useState(9);
  const [sendMinute, setSendMinute] = useState(0);
  const [tzClock, setTzClock] = useState(() => fmtNowInTz('America/New_York'));
  const [detailTzClock, setDetailTzClock] = useState('');
  const [steps, setSteps] = useState([emptyStep()]);
  const [pickLeads, setPickLeads] = useState([]);
  const [manualEmails, setManualEmails] = useState('');
  const [leadFilter, setLeadFilter] = useState('');
  const [leadStatus, setLeadStatus] = useState('');
  const [leadSource, setLeadSource] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [detailLeadFilter, setDetailLeadFilter] = useState('');
  const [detailLeadScope, setDetailLeadScope] = useState('all'); // all | pending | active | completed | stopped | replied
  const [importBatches, setImportBatches] = useState([]);
  const [leadSheetId, setLeadSheetId] = useState('');
  const [stepPreviews, setStepPreviews] = useState({});
  const [categoryStats, setCategoryStats] = useState(null);
  const [failedSummary, setFailedSummary] = useState({ totalFailed: 0, groups: [], error: '' });
  const [selectedFailedStep, setSelectedFailedStep] = useState(null);
  const [stepScheduleAt, setStepScheduleAt] = useState(() => defaultScheduleInput(15));
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
    const [d, cat, failed] = await Promise.all([
      api('/email/campaigns'),
      api('/email/campaigns/category-stats?period=overall').catch(() => null),
      api('/email/campaigns/failed-summary').catch((err) => ({
        totalFailed: 0,
        groups: [],
        error: err?.message || 'Failed to load failed campaign summary',
      })),
    ]);
    setCampaigns(d.campaigns || []);
    if (cat) setCategoryStats(cat);
    if (failed) setFailedSummary({ totalFailed: 0, groups: [], error: '', ...failed });
  };

  const selectFailedStepForAction = (item) => {
    if (!item?.campaignId || !item?.stepId) return;
    setSelectedFailedStep(item);
    setStepScheduleAt(defaultScheduleInput(15));
    setSelectedId(item.campaignId);
  };

  const retryStep = async (campaignId, stepId, mode) => {
    if (!campaignId || !stepId) return;
    if (mode === 'schedule' && !stepScheduleAt) {
      setError('Select a date and time to schedule this step');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const body =
        mode === 'schedule'
          ? { mode: 'schedule', scheduledAt: new Date(stepScheduleAt).toISOString() }
          : { mode: 'now' };
      const res = await api(`/email/campaigns/${campaignId}/steps/${stepId}/retry`, {
        method: 'POST',
        body,
      });
      const followUpNote =
        Number(res.followUpsScheduled) > 0
          ? ` · ${res.followUpsScheduled} next follow-up(s) auto-scheduled`
          : '';
      if (mode === 'schedule') {
        const whenStr = res.scheduledAt ? new Date(res.scheduledAt).toLocaleString() : stepScheduleAt;
        setMessage(`Scheduled ${res.queued} failed ${res.stepLabel} email(s) for ${whenStr}${followUpNote}`);
      } else {
        const sentNow = Number(res.processed) || 0;
        const remaining = Math.max(0, (Number(res.queued) || 0) - sentNow);
        setMessage(
          `Queued ${res.queued} failed ${res.stepLabel} email(s) for immediate send` +
            (sentNow ? ` (${sentNow} dispatched now${remaining ? `, ${remaining} sending every 30s` : ''})` : '') +
            followUpNote,
        );
      }
      setSelectedFailedStep(null);
      await loadList();
      if (res.campaign && selectedId === campaignId) {
        setDetail(res.campaign);
      } else if (selectedId) {
        await loadDetail(selectedId);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const renderStepRetryControls = (stepItem) => {
    if (!stepItem) return null;
    return (
      <div
        style={{
          marginTop: 10,
          padding: '10px 12px',
          borderRadius: 8,
          background: '#fff',
          border: '1px solid #fca5a5',
          color: '#0f172a',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ fontSize: 13 }}>
            <strong>{stepItem.campaignName}</strong> → <strong>{stepItem.stepLabel}</strong>{' '}
            <span style={{ color: '#dc2626', fontWeight: 700 }}>
              ({stepItem.failedCount} failed)
            </span>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: '2px 8px', fontSize: 12 }}
            onClick={() => setSelectedFailedStep(null)}
          >
            Close
          </button>
        </div>
        {stepItem.error ? (
          <p
            className="stat-hint"
            style={{ margin: '4px 0 8px', color: '#991b1b', wordBreak: 'break-word' }}
          >
            {stepItem.error}
          </p>
        ) : null}
        {stepItem.campaignStatus === 'cancelled' ? (
          <p className="stat-hint" style={{ margin: 0, color: '#991b1b' }}>
            This campaign is cancelled and cannot be resent.
          </p>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => retryStep(stepItem.campaignId, stepItem.stepId, 'now')}
            >
              ⚡ Send now ({stepItem.stepLabel})
            </button>
            <input
              type="datetime-local"
              className="input"
              style={{ width: 'auto' }}
              value={stepScheduleAt}
              onChange={(e) => setStepScheduleAt(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy || !stepScheduleAt}
              onClick={() => retryStep(stepItem.campaignId, stepItem.stepId, 'schedule')}
            >
              Schedule ({stepItem.stepLabel})
            </button>
          </div>
        )}
      </div>
    );
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
    setDetailLeadScope('all');
    if (selectedId) loadDetail(selectedId).catch((e) => setError(e.message));
    else setDetail(null);
  }, [selectedId]);

  useEffect(() => {
    const tick = () => setTzClock(fmtNowInTz(timezone));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [timezone]);

  useEffect(() => {
    const tz = detail?.timezone || 'America/New_York';
    const tick = () => setDetailTzClock(fmtNowInTz(tz));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [detail?.timezone]);

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
        timezone,
        sendHour: Number(sendHour) || 0,
        sendMinute: Number(sendMinute) || 0,
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
      const emailsText = manualEmails.trim();
      if (pickLeads.length || emailsText) {
        await api(`/email/campaigns/${created.id}/leads`, {
          method: 'POST',
          body: {
            leadIds: pickLeads,
            ...(emailsText ? { emails: emailsText } : {}),
          },
        });
      }
      setMessage('Campaign created');
      setName('');
      setSteps([emptyStep()]);
      setPickLeads([]);
      setManualEmails('');
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
          timezone: detail.timezone || 'America/New_York',
          sendHour: Number(detail.send_hour) || 0,
          sendMinute: Number(detail.send_minute) || 0,
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
    if (!detail) return;
    const emailsText = manualEmails.trim();
    if (!pickLeads.length && !emailsText) return;
    setBusy(true);
    setError('');
    try {
      const r = await api(`/email/campaigns/${detail.id}/leads`, {
        method: 'POST',
        body: {
          leadIds: pickLeads,
          ...(emailsText ? { emails: emailsText } : {}),
        },
      });
      const extra =
        r.createdLeads || r.reusedLeads
          ? ` (${r.createdLeads || 0} new · ${r.reusedLeads || 0} existing from typed emails)`
          : '';
      setMessage(`Added ${r.added} lead(s)${extra}`);
      setPickLeads([]);
      setManualEmails('');
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
      // Persist timezone / from account / steps before scheduling
      if (detail.status === 'draft' || detail.status === 'paused') {
        await api(`/email/campaigns/${detail.id}`, {
          method: 'PATCH',
          body: {
            name: detail.name,
            emailAccountId: detail.email_account_id,
            timezone: detail.timezone || 'America/New_York',
            sendHour: Number(detail.send_hour) || 0,
            sendMinute: Number(detail.send_minute) || 0,
          },
        });
      }
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

  const sendNow = async () => {
    if (!detail) return;
    if (!detail.email_account_id) {
      setError('Select a From account (email) before sending');
      return;
    }
    setBusy(true);
    setError('');
    try {
      // Persist draft settings before launch+send
      if (detail.status === 'draft' || detail.status === 'paused') {
        await api(`/email/campaigns/${detail.id}`, {
          method: 'PATCH',
          body: {
            name: detail.name,
            emailAccountId: detail.email_account_id,
            timezone: detail.timezone || 'America/New_York',
            sendHour: Number(detail.send_hour) || 0,
            sendMinute: Number(detail.send_minute) || 0,
          },
        });
      }
      const res = await api(`/email/campaigns/${detail.id}/send-now`, { method: 'POST', body: {} });
      const count =
        typeof res?.processed === 'object' ? res.processed.sent ?? 0 : res?.processed || 0;
      const launchedNote = res?.launched ? 'Launched and ' : '';
      setMessage(
        `${launchedNote}dispatched ${count} campaign email(s) immediately` +
          (res?.bumped ? ` · ${res.bumped} queued as due now` : ''),
      );
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
    let rows = detail?.leads || [];
    if (detailLeadScope === 'replied') {
      rows = rows.filter((l) => l.replied);
    } else if (detailLeadScope !== 'all') {
      rows = rows.filter((l) => l.status === detailLeadScope);
    }
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
  }, [detail, detailLeadFilter, detailLeadScope]);

  return (
    <div>
      <h1 className="page-title">Campaigns</h1>
      <p className="page-sub" style={{ marginTop: 0 }}>
        Primary place for cold-email sequences and follow-ups. Open a campaign to see Email 1,
        Follow-up 1/2+, scheduled dates, pending/completed sends, replies, and paused/stopped leads.
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

            <div className="field">
              <label className="label">Audience timezone</label>
              <select
                className="select"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                {CAMPAIGN_TIMEZONES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <p className="stat-hint" style={{ margin: '6px 0 0' }}>
                Now there: <strong>{tzClock}</strong>
              </p>
            </div>
            <div className="field">
              <label className="label">Preferred send time (local)</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select
                  className="select"
                  style={{ flex: 1 }}
                  value={sendHour}
                  onChange={(e) => setSendHour(Number(e.target.value))}
                >
                  {SEND_HOUR_OPTIONS.map((h) => (
                    <option key={h.value} value={h.value}>
                      {h.label}
                    </option>
                  ))}
                </select>
                <select
                  className="select"
                  style={{ width: 110 }}
                  value={sendMinute}
                  onChange={(e) => setSendMinute(Number(e.target.value))}
                >
                  {SEND_MINUTE_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label} min
                    </option>
                  ))}
                </select>
              </div>
              <p className="stat-hint" style={{ margin: '6px 0 0' }}>
                Scheduled at <strong>{formatSendTime(sendHour, sendMinute)}</strong> in audience timezone ({tzMeta(timezone).short}). 
                Applies to Email 1 and all follow-ups.
              </p>
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
                      Sat/Sun skipped. Scheduled at {formatSendTime(sendHour, sendMinute)} ({tzMeta(timezone).short}).
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
              <label className="label">Type or paste emails (for testing)</label>
              <textarea
                className="input"
                rows={3}
                value={manualEmails}
                onChange={(e) => setManualEmails(e.target.value)}
                placeholder="one@example.com, two@example.com&#10;or one address per line — no CSV needed"
                style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
              />
              <p className="stat-hint" style={{ margin: '6px 0 0' }}>
                Existing leads are reused by email; new addresses become manual leads automatically.
              </p>
            </div>

            <div className="field">
              <label className="label">
                Or pick CRM leads ({pickLeads.length} selected · {filteredLeads.length} shown ·{' '}
                {leads.length} with email)
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

        <div
          className="card"
          style={{
            margin: 0,
            background:
              failedSummary?.error || (failedSummary?.totalFailed || 0) > 0 ? '#fef2f2' : '#f0fdf4',
            borderColor:
              failedSummary?.error || (failedSummary?.totalFailed || 0) > 0 ? '#fecaca' : '#bbf7d0',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div>
              <h3
                style={{
                  margin: 0,
                  color:
                    failedSummary?.error || (failedSummary?.totalFailed || 0) > 0
                      ? '#991b1b'
                      : '#166534',
                }}
              >
                {failedSummary?.error
                  ? '⚠️ Failed Campaign Emails (unable to load)'
                  : (failedSummary?.totalFailed || 0) > 0
                    ? `⚠️ Failed Campaign Emails (${failedSummary.totalFailed})`
                    : 'Failed Campaign Emails (0)'}
              </h3>
              <p
                className="stat-hint"
                style={{
                  margin: '4px 0 0',
                  color:
                    failedSummary?.error || (failedSummary?.totalFailed || 0) > 0
                      ? '#7f1d1d'
                      : undefined,
                }}
              >
                {failedSummary?.error
                  ? `Backend API error: ${failedSummary.error} (pull & restart CRM API on Windows if you just deployed).`
                  : (failedSummary?.groups || []).length > 0
                    ? 'Click any failed step below to inspect it and send immediately or schedule a retry for that specific step.'
                    : 'All campaign steps dispatched with no failed queue items.'}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => loadList().catch((e) => setError(e.message))}
            >
              Refresh
            </button>
          </div>

          {(failedSummary?.groups || []).length > 0 ? (
            <div className="table-wrap" style={{ marginTop: 10, maxHeight: 260, overflow: 'auto', background: '#fff', borderRadius: 8 }}>
              <table>
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Failed step</th>
                    <th>Failed</th>
                    <th>Error</th>
                    <th>Last failed</th>
                  </tr>
                </thead>
                <tbody>
                  {failedSummary.groups.map((g) => {
                    const isPicked =
                      selectedFailedStep?.campaignId === g.campaignId &&
                      selectedFailedStep?.stepId === g.stepId;
                    let whenStr = '—';
                    if (g.lastFailedAt) {
                      try {
                        const raw = g.lastFailedAt;
                        const d = new Date(raw.endsWith('Z') ? raw : `${raw.replace(' ', 'T')}Z`);
                        whenStr = d.toLocaleString();
                      } catch {
                        whenStr = g.lastFailedAt;
                      }
                    }
                    return (
                      <tr
                        key={`${g.campaignId}-${g.stepId || 'none'}`}
                        onClick={() => selectFailedStepForAction(g)}
                        style={{
                          cursor: 'pointer',
                          background: isPicked ? '#fee2e2' : undefined,
                        }}
                        title="Click to select this failed step and Send now or Schedule"
                      >
                        <td>
                          <strong>{g.campaignName}</strong>
                          <div className="stat-hint">{g.campaignStatus}</div>
                        </td>
                        <td>
                          <strong>{g.stepLabel}</strong>
                          {g.subject ? <div className="stat-hint">{g.subject}</div> : null}
                        </td>
                        <td style={{ color: '#dc2626', fontWeight: 700 }}>{g.failedCount}</td>
                        <td
                          className="stat-hint"
                          style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={g.error || ''}
                        >
                          {g.error || 'Delivery failed'}
                        </td>
                        <td className="stat-hint">{whenStr}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          {selectedFailedStep ? renderStepRetryControls(selectedFailedStep) : null}
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
                      <td>{formatNextSend(c.next_follow_up_at, c.timezone)}</td>
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
                <>
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
                  <div className="field">
                    <label className="label">Audience timezone</label>
                    <select
                      className="select"
                      value={detail.timezone || 'America/New_York'}
                      onChange={(e) => setDetail({ ...detail, timezone: e.target.value })}
                    >
                      {CAMPAIGN_TIMEZONES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    <p className="stat-hint" style={{ margin: '6px 0 0' }}>
                      Now there: <strong>{detailTzClock}</strong>
                    </p>
                  </div>
                  <div className="field">
                    <label className="label">Preferred send time (local)</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <select
                        className="select"
                        style={{ flex: 1 }}
                        value={Number(detail.send_hour) || 0}
                        onChange={(e) =>
                          setDetail({ ...detail, send_hour: Number(e.target.value) })
                        }
                      >
                        {SEND_HOUR_OPTIONS.map((h) => (
                          <option key={h.value} value={h.value}>
                            {h.label}
                          </option>
                        ))}
                      </select>
                      <select
                        className="select"
                        style={{ width: 110 }}
                        value={Number(detail.send_minute) || 0}
                        onChange={(e) =>
                          setDetail({ ...detail, send_minute: Number(e.target.value) })
                        }
                      >
                        {SEND_MINUTE_OPTIONS.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label} min
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="stat-hint" style={{ margin: '6px 0 0' }}>
                      Scheduled at <strong>{formatSendTime(detail.send_hour, detail.send_minute)}</strong> ({tzMeta(detail.timezone).short}).
                      Applies to Email 1 and all follow-ups.
                    </p>
                  </div>
                </>
              )}
              {detail.status === 'active' || detail.status === 'completed' || detail.status === 'cancelled' ? (
                <p className="stat-hint" style={{ marginTop: 0 }}>
                  Audience: <strong>{tzMeta(detail.timezone).label}</strong> · send at{' '}
                  <strong>{formatSendTime(detail.send_hour, detail.send_minute)}</strong>
                  {detailTzClock ? <> · now {detailTzClock}</> : null}
                </p>
              ) : null}

              {(detail.status === 'draft' || detail.status === 'paused' || detail.status === 'active') && (
                <div className="field" style={{ marginBottom: 12 }}>
                  <label className="label">Type or paste emails to add</label>
                  <textarea
                    className="input"
                    rows={2}
                    value={manualEmails}
                    onChange={(e) => setManualEmails(e.target.value)}
                    placeholder="test1@example.com, test2@example.com"
                    style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
                    disabled={detail.status === 'cancelled' || detail.status === 'completed'}
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                {(detail.status === 'draft' || detail.status === 'paused') && (
                  <>
                    <button type="button" className="btn btn-secondary" disabled={busy} onClick={saveDraft}>
                      Save
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busy}
                      onClick={sendNow}
                      title="Launch and send the first email wave immediately"
                    >
                      ⚡ Send now
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={busy}
                      onClick={launch}
                      title="Launch and schedule sends for the preferred time"
                    >
                      Launch (schedule)
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={busy || (!pickLeads.length && !manualEmails.trim())}
                      onClick={addLeadsToCampaign}
                    >
                      Add recipients
                    </button>
                  </>
                )}
                {detail.status === 'active' ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busy}
                      onClick={sendNow}
                      title="Send the next queued email wave immediately"
                    >
                      ⚡ Send now
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={busy || (!pickLeads.length && !manualEmails.trim())}
                      onClick={addLeadsToCampaign}
                    >
                      Add recipients
                    </button>
                    <button type="button" className="btn btn-secondary" disabled={busy} onClick={pause}>
                      Pause
                    </button>
                  </>
                ) : null}
                {detail.status !== 'cancelled' && detail.status !== 'completed' ? (
                  <button type="button" className="btn btn-ghost" disabled={busy} onClick={cancel}>
                    Cancel campaign
                  </button>
                ) : null}
              </div>

              {(() => {
                const sends = detail.scheduledSends || [];
                const pending = sends.filter((s) => s.status === 'pending');
                const sending = sends.filter((s) => s.status === 'sending');
                const failed = sends.filter((s) => s.status === 'failed');
                const sent = sends.filter((s) => s.status === 'sent');
                const failedSteps = (detail.sequenceSummary || []).filter((s) => (s.failed || 0) > 0);

                if ((detail.status === 'active' || failed.length > 0) && sends.length > 0) {
                  const nextPending = pending[0];
                  let nextDateStr = '';
                  if (nextPending?.scheduled_at) {
                    try {
                      const raw = nextPending.scheduled_at;
                      const d = new Date(raw.endsWith('Z') ? raw : raw.replace(' ', 'T') + 'Z');
                      nextDateStr = d.toLocaleString();
                    } catch {
                      nextDateStr = nextPending.scheduled_at;
                    }
                  }

                  return (
                    <div
                      style={{
                        padding: '10px 14px',
                        borderRadius: 8,
                        marginBottom: 14,
                        background: failed.length ? '#fef2f2' : pending.length ? '#eff6ff' : '#f0fdf4',
                        border: `1px solid ${failed.length ? '#fecaca' : pending.length ? '#bfdbfe' : '#bbf7d0'}`,
                        fontSize: 13,
                        lineHeight: 1.5,
                        color: failed.length ? '#991b1b' : pending.length ? '#1e40af' : '#166534',
                      }}
                    >
                      <strong>Email Queue Status:</strong>{' '}
                      {pending.length > 0 ? (
                        <>
                          <span>{pending.length} email(s) queued. </span>
                          {nextDateStr && (
                            <span>
                              Next send scheduled for: <strong>{nextDateStr}</strong> ({detail.timezone || 'Audience local time'}).
                            </span>
                          )}
                          <span style={{ marginLeft: 8 }}>
                            Click <strong>⚡ Send now</strong> above to bypass the schedule and dispatch immediately.
                          </span>
                        </>
                      ) : sending.length > 0 ? (
                        <span>Sending {sending.length} email(s) currently...</span>
                      ) : (
                        <span>All queued emails have been sent ({sent.length} sent).</span>
                      )}
                      {failed.length > 0 && (
                        <div style={{ marginTop: 6, color: '#dc2626' }}>
                          <div>⚠️ {failed.length} email(s) encountered an error during dispatch:</div>
                          {failedSteps.length > 0 && (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                              {failedSteps.map((fs) => (
                                <button
                                  key={fs.stepId}
                                  type="button"
                                  className="btn btn-secondary"
                                  style={{
                                    borderColor: '#fca5a5',
                                    background: '#fff',
                                    color: '#991b1b',
                                    fontSize: 12,
                                    padding: '4px 10px',
                                  }}
                                  onClick={() =>
                                    selectFailedStepForAction({
                                      campaignId: detail.id,
                                      campaignName: detail.name,
                                      campaignStatus: detail.status,
                                      stepId: fs.stepId,
                                      stepLabel: fs.label,
                                      failedCount: fs.failed,
                                      error: fs.failedError || failed[0]?.error || null,
                                    })
                                  }
                                >
                                  {fs.label}: {fs.failed} failed (click to Send now / Schedule)
                                </button>
                              ))}
                            </div>
                          )}
                          {selectedFailedStep?.campaignId === detail.id
                            ? renderStepRetryControls(selectedFailedStep)
                            : null}
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              })()}

              <h4>Sequence & follow-ups ({(detail.steps || []).length} emails)</h4>
              <p className="stat-hint" style={{ marginTop: 0 }}>
                Initial email + follow-ups for this campaign only (not legacy manual overdue tasks).
                Sequence status:{' '}
                <strong>{detail.counts?.active || 0}</strong> active ·{' '}
                <strong>{detail.counts?.pending || 0}</strong> pending ·{' '}
                <strong>{detail.counts?.completed || 0}</strong> completed ·{' '}
                <strong>{detail.counts?.stopped || 0}</strong> paused/stopped ·{' '}
                <strong>{detail.counts?.replied || 0}</strong> replied
              </p>
              <div className="table-wrap" style={{ marginBottom: 12 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Step</th>
                      <th>Delay</th>
                      <th>Pending</th>
                      <th>Sent</th>
                      <th>Failed</th>
                      <th>Replies</th>
                      <th>Next scheduled</th>
                      <th>Subject / variants</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detail.sequenceSummary || detail.steps || []).map((row, idx) => {
                      const step = detail.steps?.[idx] || detail.steps?.find((s) => s.id === row.stepId || s.id === row.id);
                      const summary = detail.sequenceSummary?.[idx] || {
                        label: idx === 0 ? 'Initial email' : `Follow-up ${idx}`,
                        delayDays: step?.delay_days ?? row.delay_days ?? 0,
                        pending: 0,
                        sent: 0,
                        replies: 0,
                        nextScheduledAt: null,
                        subject: step?.subject || step?.variants?.[0]?.subject,
                      };
                      const variants = step?.variants || [];
                      const stepMetric = `step_${idx + 1}`;
                      let nextLabel = '—';
                      if (summary.nextScheduledAt) {
                        try {
                          const raw = summary.nextScheduledAt;
                          const d = new Date(raw.endsWith('Z') ? raw : `${raw.replace(' ', 'T')}Z`);
                          nextLabel = d.toLocaleString();
                        } catch {
                          nextLabel = summary.nextScheduledAt;
                        }
                      }
                      return (
                        <tr key={step?.id || summary.stepId || idx}>
                          <td>
                            <button
                              type="button"
                              className="table-num-btn"
                              onClick={() =>
                                openCampaignDrilldown(
                                  detail.id,
                                  stepMetric,
                                  `${detail.name} — ${summary.label}`,
                                )
                              }
                            >
                              {summary.label}
                            </button>
                          </td>
                          <td>
                            {Number(summary.delayDays) === 0
                              ? 'At launch'
                              : `${summary.delayDays} business day(s)`}
                          </td>
                          <td>{summary.pending ?? 0}</td>
                          <td>{summary.sent ?? 0}</td>
                          <td>
                            {(summary.failed || 0) > 0 ? (
                              <button
                                type="button"
                                className="table-num-btn"
                                style={{ color: '#dc2626', fontWeight: 700 }}
                                title="Click to Send now or Schedule failed emails for this step"
                                onClick={() =>
                                  selectFailedStepForAction({
                                    campaignId: detail.id,
                                    campaignName: detail.name,
                                    campaignStatus: detail.status,
                                    stepId: summary.stepId || step?.id,
                                    stepLabel: summary.label,
                                    failedCount: summary.failed,
                                    error: summary.failedError || null,
                                  })
                                }
                              >
                                {summary.failed}
                              </button>
                            ) : (
                              0
                            )}
                          </td>
                          <td>{summary.replies ?? 0}</td>
                          <td>{nextLabel}</td>
                          <td className="stat-hint">
                            {summary.subject || variants[0]?.subject || '(no subject)'}
                            {variants.length > 1
                              ? ` · ${variants.map((v) => v.variant_key).join('/')}`
                              : ''}
                          </td>
                        </tr>
                      );
                    })}
                    {!(detail.steps || []).length ? (
                      <tr>
                        <td colSpan={8} className="empty">
                          No sequence emails yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
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

              <h4>
                Leads ({detail.counts?.total ?? detail.leads?.length ?? 0}
                {detailLeadFilter.trim() || detailLeadScope !== 'all'
                  ? ` · ${detailLeads.length} shown`
                  : ''}
                )
              </h4>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <select
                  className="select"
                  value={detailLeadScope}
                  onChange={(e) => setDetailLeadScope(e.target.value)}
                  style={{ minWidth: 160 }}
                >
                  <option value="all">All sequence statuses</option>
                  <option value="pending">Pending</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="stopped">Paused / stopped</option>
                  <option value="replied">Replied</option>
                </select>
                <input
                  className="input"
                  placeholder="Search name, email, company, status"
                  value={detailLeadFilter}
                  onChange={(e) => setDetailLeadFilter(e.target.value)}
                  style={{ flex: 1, minWidth: 160 }}
                />
              </div>
              <div className="table-wrap" style={{ maxHeight: 420, overflow: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Sequence status</th>
                      <th>Reply</th>
                      <th>Email delivery</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailLeads.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="empty">
                          No leads match.
                        </td>
                      </tr>
                    ) : (
                      detailLeads.map((l) => {
                        let deliveryBadge = null;
                        if (l.scheduled_status === 'sent') {
                          deliveryBadge = (
                            <span style={{ color: '#16a34a', fontWeight: 600 }}>
                              ✓ Sent (Email {l.scheduled_step || 1})
                            </span>
                          );
                        } else if (l.scheduled_status === 'failed') {
                          deliveryBadge = (
                            <span style={{ color: '#dc2626', fontWeight: 600 }} title={l.scheduled_error || 'Error'}>
                              ❌ Failed: {l.scheduled_error || 'Delivery failed'}
                            </span>
                          );
                        } else if (l.scheduled_status === 'sending') {
                          deliveryBadge = (
                            <span style={{ color: '#2563eb', fontWeight: 600 }}>
                              ⏳ Sending now...
                            </span>
                          );
                        } else if (l.scheduled_status === 'pending') {
                          let timeLabel = '';
                          if (l.scheduled_at) {
                            try {
                              const raw = l.scheduled_at;
                              const d = new Date(raw.endsWith('Z') ? raw : raw.replace(' ', 'T') + 'Z');
                              timeLabel = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });
                            } catch {
                              timeLabel = l.scheduled_at;
                            }
                          }
                          deliveryBadge = (
                            <span style={{ color: '#0284c7', fontWeight: 500 }}>
                              ⏳ Email {l.scheduled_step || 1} scheduled for {timeLabel || 'soon'}
                            </span>
                          );
                        } else {
                          deliveryBadge = <span style={{ color: '#64748b' }}>—</span>;
                        }

                        return (
                          <tr key={l.id}>
                            <td>{displayCampaignLeadName(l)}</td>
                            <td>{l.lead_email}</td>
                            <td>
                              <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>
                                {l.status === 'stopped' ? 'Paused / stopped' : l.status}
                              </span>
                              {l.stopped_reason ? (
                                <span className="stat-hint" style={{ display: 'block' }}>
                                  {l.stopped_reason}
                                </span>
                              ) : null}
                            </td>
                            <td>
                              {l.replied ? (
                                <span style={{ color: '#16a34a', fontWeight: 600 }}>Replied</span>
                              ) : (
                                <span style={{ color: '#64748b' }}>—</span>
                              )}
                            </td>
                            <td>{deliveryBadge}</td>
                          </tr>
                        );
                      })
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
