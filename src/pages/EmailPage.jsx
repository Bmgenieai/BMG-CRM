import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Mail, RefreshCw, Send, Users } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { FUNNEL_STATUSES, SourceBadge, fmtDate, fmtInTz, fmtPktDate } from '../components/Badges.jsx';

const VALID_MERGE_TAGS = new Set([
  'name',
  'first_name',
  'firstName',
  'company',
  'company_name',
  'companyName',
  'country',
  'email',
  'source',
  'source_label',
  'sender_name',
  'sender_email',
]);

function findInvalidMergeTags(...texts) {
  const bad = new Set();
  const re = /\{\{\s*([^}]+?)\s*\}\}/g;
  for (const t of texts) {
    if (!t) continue;
    let m;
    while ((m = re.exec(String(t))) !== null) {
      const key = m[1].trim();
      if (!VALID_MERGE_TAGS.has(key)) bad.add(`{{${key}}}`);
    }
  }
  return [...bad];
}

const COLD_EMAIL_STAGES = [
  ...FUNNEL_STATUSES,
  { value: 'challenge_offered', label: 'Challenge offered' },
  { value: 'challenge_accepted', label: 'Challenge accepted' },
  { value: 'trial', label: 'Trial' },
];

function chunkArray(arr, size = 25) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function toLocalInputValue() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtDay(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

export default function EmailPage() {
  const { can } = useAuth();
  const canBulk = can('email:bulk_send');

  const [status, setStatus] = useState(null);
  const [lists, setLists] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [leads, setLeads] = useState([]);
  const [selected, setSelected] = useState([]);
  const [templateId, setTemplateId] = useState('');
  const [subject, setSubject] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [textContent, setTextContent] = useState('');
  const [previewLeadId, setPreviewLeadId] = useState('');
  const [preview, setPreview] = useState(null);
  const [sourceFilter, setSourceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [emailStatusFilter, setEmailStatusFilter] = useState('not_sent');
  const [busy, setBusy] = useState(false);
  const [batchProgress, setBatchProgress] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleAt, setScheduleAt] = useState(() => toLocalInputValue());
  const [scheduledBatches, setScheduledBatches] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [emailAccountId, setEmailAccountId] = useState('');
  const [recipientsModal, setRecipientsModal] = useState(null);
  const [templateName, setTemplateName] = useState('');
  const [showTemplateSave, setShowTemplateSave] = useState(false);
  const [tplBusy, setTplBusy] = useState(false);

  const invalidTags = useMemo(
    () => findInvalidMergeTags(subject, htmlContent, textContent),
    [subject, htmlContent, textContent],
  );

  const load = async () => {
    setError('');
    try {
      const [st, tpl, leadRows, acc] = await Promise.all([
        api('/email/status'),
        api('/email/templates'),
        api('/leads'),
        api('/email/accounts').catch(() => ({ accounts: [] })),
      ]);
      setStatus(st);
      setTemplates(tpl.templates || []);
      setLeads(leadRows || []);
      const activeAccounts = (acc.accounts || []).filter((a) => a.is_active);
      setAccounts(activeAccounts);
      if (!emailAccountId) {
        const def = activeAccounts.find((a) => a.is_default) || activeAccounts[0];
        if (def) setEmailAccountId(def.id);
      }
      if (canBulk) {
        try {
          const listData = await api('/email/lists');
          setLists(listData.lists || []);
        } catch {
          setLists([]);
        }
        try {
          const sched = await api('/email/scheduled?status=pending');
          setScheduledBatches(sched.batches || []);
        } catch {
          setScheduledBatches([]);
        }
      }
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      if (!l.email) return false;
      if (sourceFilter && l.source !== sourceFilter) return false;
      if (statusFilter && l.status !== statusFilter) return false;
      if (emailStatusFilter === 'sent' && !l.last_emailed_at) return false;
      if (emailStatusFilter === 'not_sent' && l.last_emailed_at) return false;
      if (emailStatusFilter === 'opened' && !(Number(l.email_open_count) > 0)) return false;
      if (emailStatusFilter === 'replied' && !(Number(l.email_reply_count) > 0)) return false;
      return true;
    });
  }, [leads, sourceFilter, statusFilter, emailStatusFilter]);

  const applyTemplate = (id) => {
    setTemplateId(id);
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) {
      setTemplateName('');
      return;
    }
    setTemplateName(tpl.name || tpl.label || '');
    setSubject(tpl.subject || '');
    setHtmlContent(tpl.htmlContent || '');
    setTextContent(tpl.textContent || '');
  };

  const saveTemplate = async (asNew = false) => {
    const name = templateName.trim();
    if (!name) {
      setError('Enter a template name');
      return;
    }
    if (!subject.trim()) {
      setError('Enter a subject before saving the template');
      return;
    }
    if (!htmlContent.trim() && !textContent.trim()) {
      setError('Enter an email body before saving the template');
      return;
    }
    setTplBusy(true);
    setError('');
    setMessage('');
    try {
      let res;
      if (!asNew && templateId) {
        res = await api(`/email/templates/${templateId}`, {
          method: 'PATCH',
          body: { name, subject, htmlContent, textContent },
        });
        setMessage(`Updated template "${res.template?.name || name}"`);
      } else {
        res = await api('/email/templates', {
          method: 'POST',
          body: { name, subject, htmlContent, textContent },
        });
        if (res.template?.id) setTemplateId(res.template.id);
        setMessage(`Saved new template "${res.template?.name || name}"`);
      }
      setShowTemplateSave(false);
      await load();
    } catch (e) {
      setError(e.message || 'Failed to save template');
    } finally {
      setTplBusy(false);
    }
  };

  const deleteCurrentTemplate = async () => {
    if (!templateId) return;
    const tpl = templates.find((t) => t.id === templateId);
    if (!window.confirm(`Delete template "${tpl?.label || tpl?.name || templateId}"?`)) return;
    setTplBusy(true);
    setError('');
    try {
      await api(`/email/templates/${templateId}`, { method: 'DELETE' });
      setTemplateId('');
      setTemplateName('');
      setMessage('Template deleted');
      await load();
    } catch (e) {
      setError(e.message || 'Failed to delete template');
    } finally {
      setTplBusy(false);
    }
  };

  const toggle = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleAll = () => {
    const ids = filteredLeads.map((l) => l.id);
    const allSelected = ids.length && ids.every((id) => selected.includes(id));
    setSelected(allSelected ? selected.filter((id) => !ids.includes(id)) : [...new Set([...selected, ...ids])]);
  };

  const runPreview = async () => {
    const leadId = previewLeadId || selected[0] || filteredLeads[0]?.id;
    if (!leadId) return;
    if (!emailAccountId) {
      setError('Select a From account (email) before preview');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const data = await api('/email/preview', {
        method: 'POST',
        body: {
          leadId,
          templateId: templateId || undefined,
          subject,
          htmlContent,
          textContent,
          emailAccountId,
        },
      });
      setPreview(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const sendBulk = async () => {
    if (!selected.length) {
      setError('Select at least one lead');
      return;
    }
    if (!emailAccountId) {
      setError('Select a From account (email) before sending');
      return;
    }
    if (
      invalidTags.length &&
      !window.confirm(
        `Warning: unknown merge tag(s) detected: ${invalidTags.join(', ')}. They will render blank. Send anyway?`,
      )
    ) {
      return;
    }
    const batches = chunkArray(selected, 25);
    if (
      batches.length > 1 &&
      !window.confirm(
        `You selected ${selected.length} leads. They will be sent in ${batches.length} batches of up to 25 leads. Continue?`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    let totalSent = 0;
    let totalFailed = 0;
    let totalSuppressed = 0;
    let totalCapped = 0;
    try {
      for (let i = 0; i < batches.length; i += 1) {
        if (batches.length > 1) {
          setBatchProgress(`Sending batch ${i + 1} of ${batches.length}…`);
        }
        const data = await api('/email/bulk-send', {
          method: 'POST',
          body: {
            leadIds: batches[i],
            templateId: templateId || undefined,
            subject,
            htmlContent,
            textContent,
            syncToBrevo: true,
            emailAccountId,
          },
        });
        totalSent += Number(data.sent || 0);
        totalFailed += Number(data.failed || 0);
        totalSuppressed += Number(data.skippedSuppressed || 0);
        totalCapped += Number(data.skippedDailyCap || 0);
        if (data.skippedDailyCap > 0) break;
      }
      const parts = [`Sent ${totalSent} email(s)`];
      if (totalFailed) parts.push(`${totalFailed} failed`);
      if (totalSuppressed) parts.push(`${totalSuppressed} suppressed/skipped`);
      if (totalCapped) parts.push(`${totalCapped} paused (daily cap reached)`);
      setMessage(parts.join(' · '));
      setSelected([]);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBatchProgress('');
      setBusy(false);
    }
  };

  const syncBulk = async () => {
    if (!selected.length) {
      setError('Select leads to sync');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const data = await api('/email/sync-bulk', {
        method: 'POST',
        body: { leadIds: selected },
      });
      setMessage(`Synced ${data.synced} contact(s) to Brevo${data.failed ? ` · ${data.failed} failed` : ''}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const scheduleBulk = async () => {
    if (!selected.length) {
      setError('Select at least one lead');
      return;
    }
    if (!emailAccountId) {
      setError('Select a From account (email) before scheduling');
      return;
    }
    if (!scheduleAt) {
      setError('Pick a date and time to schedule');
      return;
    }
    const when = new Date(scheduleAt);
    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      setError('Schedule time must be in the future');
      return;
    }
    if (
      invalidTags.length &&
      !window.confirm(
        `Warning: unknown merge tag(s) detected: ${invalidTags.join(', ')}. They will render blank. Schedule anyway?`,
      )
    ) {
      return;
    }
    const batches = chunkArray(selected, 25);
    setBusy(true);
    setError('');
    setMessage('');
    let totalScheduled = 0;
    let totalSuppressed = 0;
    let lastAt = when.toISOString();
    try {
      for (let i = 0; i < batches.length; i += 1) {
        if (batches.length > 1) {
          setBatchProgress(`Scheduling batch ${i + 1} of ${batches.length}…`);
        }
        // Space batches slightly (5 min apart) when scheduling >25 leads
        const batchTime = new Date(when.getTime() + i * 5 * 60 * 1000);
        const data = await api('/email/schedule', {
          method: 'POST',
          body: {
            leadIds: batches[i],
            templateId: templateId || undefined,
            subject,
            htmlContent,
            textContent,
            syncToBrevo: true,
            scheduledAt: batchTime.toISOString(),
            emailAccountId,
          },
        });
        totalScheduled += Number(data.count || 0);
        totalSuppressed += Number(data.skippedSuppressed || 0);
        lastAt = data.scheduledAt || lastAt;
      }
      setMessage(
        `Scheduled ${totalScheduled} email(s) across ${batches.length} batch(es) starting ${fmtDate(when.toISOString())}${
          totalSuppressed ? ` · ${totalSuppressed} suppressed/skipped` : ''
        }`,
      );
      setSelected([]);
      setShowSchedule(false);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBatchProgress('');
      setBusy(false);
    }
  };

  const cancelBatch = async (batch) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const ids = (batch.recipients || []).map((r) => r.id).filter(Boolean);
      const data = ids.length
        ? await api('/email/scheduled/cancel', { method: 'POST', body: { ids } })
        : await api(`/email/scheduled/${batch.batchId}/cancel`, { method: 'POST' });
      setMessage(`Cancelled ${data.cancelled} scheduled email(s)`);
      setRecipientsModal(null);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">Cold email</h1>

      {error ? <div className="login-error">{error}</div> : null}
      {message ? <div className="card" style={{ borderColor: 'var(--success)', color: 'var(--success)', marginBottom: '1rem' }}>{message}</div> : null}

      <div className="grid grid-2">
        <div className="card">
          <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Mail size={18} /> Compose
          </h3>

          <div className="field">
            <label className="label">From</label>
            <select
              className="select"
              value={emailAccountId}
              onChange={(e) => setEmailAccountId(e.target.value)}
              required
            >
              <option value="" disabled>
                {accounts.length ? 'Select email account…' : 'No Brevo accounts — add one under Brevo accounts'}
              </option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label} · {a.email}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label className="label" style={{ margin: 0 }}>Template</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowTemplateSave((v) => !v)}
                >
                  {showTemplateSave ? 'Close template editor' : templateId ? 'Edit / Save template' : 'Save as template'}
                </button>
                {templateId ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--danger, #dc2626)' }}
                    disabled={tplBusy}
                    onClick={deleteCurrentTemplate}
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </div>
            <select
              className="select"
              value={templateId}
              onChange={(e) => applyTemplate(e.target.value)}
            >
              <option value="">Custom / pick template…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label || t.name}
                </option>
              ))}
            </select>
            {showTemplateSave ? (
              <div
                style={{
                  marginTop: 8,
                  padding: '0.65rem',
                  borderRadius: 8,
                  background: 'var(--brand-soft)',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <input
                  className="input"
                  placeholder="Template name…"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  style={{ flex: '1 1 180px' }}
                />
                {templateId ? (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={tplBusy}
                    onClick={() => saveTemplate(false)}
                  >
                    Update template
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={tplBusy}
                  onClick={() => saveTemplate(true)}
                >
                  Save as new
                </button>
              </div>
            ) : null}
          </div>

          {invalidTags.length ? (
            <div
              style={{
                marginBottom: '0.75rem',
                padding: '0.65rem 0.75rem',
                borderRadius: 8,
                border: '1px solid #f59e0b',
                background: 'rgba(245, 158, 11, 0.12)',
                color: '#92400e',
                fontSize: 13,
              }}
            >
              <strong>Misspelled merge tag(s):</strong> {invalidTags.join(', ')}
              <div style={{ fontSize: 12, marginTop: 4 }}>
                Valid tags: <code>{'{{first_name}}'}</code>, <code>{'{{name}}'}</code>, <code>{'{{company}}'}</code>,{' '}
                <code>{'{{country}}'}</code>, <code>{'{{email}}'}</code>, <code>{'{{sender_name}}'}</code>
              </div>
            </div>
          ) : null}

          <div className="field">
            <label className="label">Subject</label>
            <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          <div className="field">
            <label className="label">HTML body</label>
            <textarea
              className="textarea"
              rows={8}
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
            />
          </div>

          <div className="field">
            <label className="label">Plain text (fallback)</label>
            <textarea
              className="textarea"
              rows={5}
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
            />
          </div>

          {selected.length > 25 ? (
            <div
              style={{
                marginBottom: '0.75rem',
                padding: '0.6rem 0.75rem',
                borderRadius: 8,
                border: '1px solid #f59e0b',
                background: 'rgba(245, 158, 11, 0.12)',
                color: '#92400e',
                fontSize: 13,
              }}
            >
              <strong>{selected.length} leads selected</strong> — will be automatically processed in{' '}
              <strong>{Math.ceil(selected.length / 25)} batches of 25</strong> (respecting inbox daily cap &amp; suppression list).
            </div>
          ) : null}

          {batchProgress ? (
            <div style={{ marginBottom: '0.75rem', fontSize: 13, fontWeight: 600, color: 'var(--brand)' }}>
              {batchProgress}
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={runPreview}>
              Preview merge
            </button>
            {canBulk ? (
              <>
                <button type="button" className="btn btn-primary" disabled={busy || !status?.enabled} onClick={sendBulk}>
                  <Send size={16} /> Send to selected ({selected.length})
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy || !status?.enabled}
                  onClick={() => setShowSchedule((v) => !v)}
                >
                  <CalendarClock size={16} /> Schedule
                </button>
                <button type="button" className="btn btn-secondary" disabled={busy || !status?.enabled} onClick={syncBulk}>
                  <Users size={16} /> Sync to Brevo
                </button>
              </>
            ) : (
              <p className="stat-hint">
                Bulk send is unavailable for your role — use the lead drawer for one-off sends.
              </p>
            )}
          </div>

          {canBulk && showSchedule ? (
            <div
              style={{
                marginTop: '0.75rem',
                padding: '0.75rem',
                background: 'var(--brand-soft)',
                borderRadius: 8,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                alignItems: 'flex-end',
              }}
            >
              <label className="field" style={{ margin: 0, minWidth: 220 }}>
                <span className="label">Send at (your local time)</span>
                <input
                  type="datetime-local"
                  className="input"
                  value={scheduleAt}
                  onChange={(e) => setScheduleAt(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || !status?.enabled || !selected.length}
                onClick={scheduleBulk}
              >
                Confirm schedule ({selected.length})
              </button>
              <p className="stat-hint" style={{ margin: 0, flexBasis: '100%' }}>
                CRM sends via Brevo automatically at that time (checked every ~30s). Selections over 25 leads
                are automatically split into batches of 25 spaced 5 minutes apart.
              </p>
            </div>
          ) : null}

          {preview ? (
            <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--brand-soft)', borderRadius: 8 }}>
              <strong>Preview subject:</strong> {preview.subject}
              <div
                style={{ marginTop: 8, fontSize: '0.9rem' }}
                dangerouslySetInnerHTML={{ __html: preview.htmlContent || '' }}
              />
            </div>
          ) : null}
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ margin: 0 }}>Select leads</h3>
            <button type="button" className="btn btn-ghost" onClick={load}>
              <RefreshCw size={16} /> Refresh
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ flex: 1, minWidth: 120 }}>
              <option value="">All CRM stages</option>
              {COLD_EMAIL_STAGES.map((st) => (
                <option key={st.value} value={st.value}>
                  {st.label}
                </option>
              ))}
            </select>
            <select className="select" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} style={{ flex: 1, minWidth: 120 }}>
              <option value="">All sources</option>
              <option value="signup_no_listing">Signup · no listing</option>
              <option value="free_credit_no_purchase">Free credit</option>
              <option value="purchased_no_repurchase">Win-back</option>
              <option value="csv_import">CSV / Meta</option>
              <option value="linkedin">LinkedIn</option>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
              <option value="telesales">BD</option>
              <option value="manual">Manual</option>
            </select>
            <select
              className="select"
              value={emailStatusFilter}
              onChange={(e) => setEmailStatusFilter(e.target.value)}
              style={{ flex: 1, minWidth: 120 }}
            >
              <option value="">All email</option>
              <option value="not_sent">Not emailed yet</option>
              <option value="sent">Already emailed</option>
              <option value="opened">Opened email</option>
              <option value="replied">Replied email</option>
            </select>
          </div>

          <div className="field">
            <label className="label">Preview as lead</label>
            <select className="select" value={previewLeadId} onChange={(e) => setPreviewLeadId(e.target.value)}>
              <option value="">First selected / first in list</option>
              {filteredLeads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.email})
                </option>
              ))}
            </select>
          </div>

          {lists.length ? (
            <p className="stat-hint" style={{ marginBottom: '0.5rem' }}>
              Brevo lists: {lists.map((l) => `#${l.id} ${l.name}`).join(' · ')}
            </p>
          ) : null}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    <input type="checkbox" checked={filteredLeads.length > 0 && filteredLeads.every((l) => selected.includes(l.id))} onChange={toggleAll} />
                  </th>
                  <th>Lead</th>
                  <th>Source</th>
                  <th>Date added</th>
                  <th>Email</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <input type="checkbox" checked={selected.includes(l.id)} onChange={() => toggle(l.id)} />
                    </td>
                    <td>
                      <div>{l.name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{l.email}</div>
                    </td>
                    <td>
                      <SourceBadge source={l.source} />
                    </td>
                    <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                      {fmtDay(l.date_added_effective || l.date_added || l.created_at)}
                    </td>
                    <td>
                      {l.last_emailed_at ? (
                        <div>
                          <span className="badge badge-blue">
                            {(l.email_reply_count || 0) > 0
                              ? `Replied (${l.email_reply_count})`
                              : (l.email_open_count || 0) > 0
                                ? `Opened (${l.email_open_count})`
                                : 'Sent'}
                          </span>
                          <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: 2 }}>
                            {fmtDay(l.last_emailed_at)}
                          </div>
                        </div>
                      ) : (
                        <span className="badge badge-grey">Not sent</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!filteredLeads.length ? (
                  <tr>
                    <td colSpan={5} className="empty">
                      No leads with email match filters
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {canBulk && scheduledBatches.length ? (
        <div className="card" style={{ marginTop: '1rem' }}>
          <h3 style={{ marginTop: 0 }}>Upcoming scheduled sends</h3>
          <p className="stat-hint" style={{ marginTop: 0 }}>
            Campaign sends: Mon–Fri, 9:00 AM–5:00 PM in each campaign’s audience timezone (at the
            preferred send time). Click a recipient count to see every lead.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>When (audience TZ)</th>
                  <th>Campaign</th>
                  <th>Step</th>
                  <th>Subject</th>
                  <th>Recipients</th>
                  <th>By</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {scheduledBatches.map((b) => (
                  <tr key={b.id || b.batchId}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {b.timezone
                        ? fmtInTz(b.scheduledAt, b.timezone)
                        : fmtPktDate(b.scheduledAt)}
                      {b.timezone ? (
                        <span className="stat-hint" style={{ display: 'block' }}>
                          {b.timezone.replace(/_/g, ' ').split('/').pop()}
                        </span>
                      ) : (
                        <span className="stat-hint" style={{ display: 'block' }}>
                          PKT
                        </span>
                      )}
                    </td>
                    <td>{b.campaignName || '— (cold email)'}</td>
                    <td>
                      {b.stepLabel || '—'}
                      {b.emailType && b.emailType !== 'cold' ? (
                        <span className="stat-hint">
                          {' '}
                          · {b.emailType === 'new' ? 'first email' : 'follow-up'}
                        </span>
                      ) : null}
                      {b.variantKey ? (
                        <span className="stat-hint"> · var {b.variantKey}</span>
                      ) : null}
                    </td>
                    <td>{b.subject || b.templateId || '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="table-num-btn"
                        onClick={() => setRecipientsModal(b)}
                        title="View all recipients"
                      >
                        {b.count}
                      </button>
                    </td>
                    <td>{b.scheduledByName || '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        disabled={busy}
                        onClick={() => cancelBatch(b)}
                      >
                        Cancel
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {recipientsModal ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setRecipientsModal(null)}
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
              width: 'min(720px, 100%)',
              maxHeight: '80vh',
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
                <h3 style={{ marginTop: 0, marginBottom: 4 }}>
                  {recipientsModal.campaignName || 'Scheduled send'} ·{' '}
                  {recipientsModal.count} recipient
                  {recipientsModal.count === 1 ? '' : 's'}
                </h3>
                <p className="stat-hint" style={{ margin: 0 }}>
                  {recipientsModal.stepLabel || 'Cold email'}
                  {recipientsModal.emailType === 'follow-up'
                    ? ' · follow-up'
                    : recipientsModal.emailType === 'new'
                      ? ' · first email'
                      : ''}
                  {' · '}
                  {recipientsModal.timezone
                    ? `${fmtInTz(recipientsModal.scheduledAt, recipientsModal.timezone)} (${recipientsModal.timezone})`
                    : `${fmtPktDate(recipientsModal.scheduledAt)} PKT`}
                </p>
                <p style={{ margin: '6px 0 0', fontWeight: 600 }}>
                  {recipientsModal.subject || recipientsModal.templateId || '—'}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setRecipientsModal(null)}
              >
                Close
              </button>
            </div>
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table>
                <thead>
                  <tr>
                    <th>Lead</th>
                    <th>Email</th>
                    <th>Variant</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(recipientsModal.recipients || []).length ? (
                    recipientsModal.recipients.map((r) => (
                      <tr key={r.id}>
                        <td>{r.leadName || '—'}</td>
                        <td>{r.leadEmail || '—'}</td>
                        <td>{r.variantKey || '—'}</td>
                        <td>{r.status}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="empty">
                        No recipients loaded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {!status?.enabled ? (
        <div className="card" style={{ marginTop: '1rem' }}>
          <h3 style={{ marginTop: 0 }}>Setup checklist</h3>
          <ol style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--muted)' }}>
            <li>Brevo → SMTP &amp; API → create API key (<code>xkeysib-…</code>)</li>
            <li>Verify sender domain / email (e.g. magic.retouching@bmgenie.ai)</li>
            <li>On CRM API server <code>.env</code>: set <code>BREVO_ENABLED=true</code>, <code>BREVO_API_KEY</code>, <code>BREVO_LIST_ID=2</code></li>
            <li>Restart API: <code>pm2 restart bmg-crm-api</code></li>
          </ol>
        </div>
      ) : null}
    </div>
  );
}
