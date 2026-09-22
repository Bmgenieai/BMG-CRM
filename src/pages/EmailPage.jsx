import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Mail, RefreshCw, Send, Users } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { SourceBadge, StatusBadge, fmtDate } from '../components/Badges.jsx';

function toLocalInputValue() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
  const [statusFilter, setStatusFilter] = useState('qualified');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleAt, setScheduleAt] = useState(() => toLocalInputValue());
  const [scheduledBatches, setScheduledBatches] = useState([]);

  const load = async () => {
    setError('');
    try {
      const [st, tpl, leadRows] = await Promise.all([
        api('/email/status'),
        api('/email/templates'),
        api('/leads'),
      ]);
      setStatus(st);
      setTemplates(tpl.templates || []);
      setLeads(leadRows || []);
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
      return true;
    });
  }, [leads, sourceFilter, statusFilter]);

  const applyTemplate = (id) => {
    setTemplateId(id);
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    setSubject(tpl.subject);
    setHtmlContent(tpl.htmlContent);
    setTextContent(tpl.textContent);
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
    setBusy(true);
    setError('');
    try {
      const data = await api('/email/preview', {
        method: 'POST',
        body: { leadId, templateId: templateId || undefined, subject, htmlContent, textContent },
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
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const data = await api('/email/bulk-send', {
        method: 'POST',
        body: {
          leadIds: selected,
          templateId: templateId || undefined,
          subject,
          htmlContent,
          textContent,
          syncToBrevo: true,
        },
      });
      setMessage(`Sent ${data.sent} email(s)${data.failed ? ` · ${data.failed} failed` : ''}`);
      setSelected([]);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
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
    if (!scheduleAt) {
      setError('Pick a date and time to schedule');
      return;
    }
    const when = new Date(scheduleAt);
    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      setError('Schedule time must be in the future');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const data = await api('/email/schedule', {
        method: 'POST',
        body: {
          leadIds: selected,
          templateId: templateId || undefined,
          subject,
          htmlContent,
          textContent,
          syncToBrevo: true,
          scheduledAt: when.toISOString(),
        },
      });
      setMessage(
        `Scheduled ${data.count} email(s) for ${fmtDate(data.scheduledAt)} (sends automatically)`,
      );
      setSelected([]);
      setShowSchedule(false);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const cancelBatch = async (batchId) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const data = await api(`/email/scheduled/${batchId}/cancel`, { method: 'POST' });
      setMessage(`Cancelled ${data.cancelled} scheduled email(s)`);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">Cold email (Brevo)</h1>
      <p className="page-sub">
        Send personalized outreach from {status?.sender || 'your verified Brevo sender'}. Templates use merge tags like{' '}
        <code>{'{{first_name}}'}</code>, <code>{'{{company}}'}</code>.
      </p>

      {error ? <div className="login-error">{error}</div> : null}
      {message ? <div className="card" style={{ borderColor: 'var(--success)', color: 'var(--success)', marginBottom: '1rem' }}>{message}</div> : null}

      <div className="grid grid-3" style={{ marginBottom: '1rem' }}>
        <div className="card">
          <p className="stat-label">Brevo status</p>
          <p className="stat-value" style={{ fontSize: '1.1rem' }}>
            {status?.enabled ? 'Connected' : 'Not configured'}
          </p>
          <p className="stat-hint">
            {status?.enabled
              ? `${status.senderName} <${status.sender}>`
              : 'Set BREVO_ENABLED=true + API key on CRM API'}
          </p>
        </div>
        <div className="card">
          <p className="stat-label">Default list</p>
          <p className="stat-value" style={{ fontSize: '1.1rem' }}>
            {status?.defaultListId ? `#${status.defaultListId}` : '—'}
          </p>
          <p className="stat-hint">BREVO_LIST_ID in API .env</p>
        </div>
        <div className="card">
          <p className="stat-label">Leads with email</p>
          <p className="stat-value">{filteredLeads.length}</p>
          <p className="stat-hint">{selected.length} selected</p>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Mail size={18} /> Compose
          </h3>

          <div className="field">
            <label className="label">Template</label>
            <select
              className="select"
              value={templateId}
              onChange={(e) => applyTemplate(e.target.value)}
            >
              <option value="">Custom / pick template…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

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
                CRM will send via Brevo automatically at that time (checked every ~30s). Max 25 leads per
                schedule.
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
              <option value="">All statuses</option>
              <option value="qualified">Qualified</option>
              <option value="conversation">Conversation</option>
              <option value="demo_booked">Demo booked</option>
              <option value="trial">Trial</option>
            </select>
            <select className="select" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} style={{ flex: 1, minWidth: 120 }}>
              <option value="">All sources</option>
              <option value="signup_no_listing">Signup · no listing</option>
              <option value="free_credit_no_purchase">Free credit</option>
              <option value="purchased_no_repurchase">Win-back</option>
              <option value="csv_import">CSV / Meta</option>
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
                  <th>Status</th>
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
                    <td>
                      <StatusBadge status={l.status} />
                    </td>
                  </tr>
                ))}
                {!filteredLeads.length ? (
                  <tr>
                    <td colSpan={4} className="empty">
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
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Subject / template</th>
                  <th>Recipients</th>
                  <th>By</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {scheduledBatches.map((b) => (
                  <tr key={b.batchId}>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(b.scheduledAt)}</td>
                    <td>{b.subject || b.templateId || '—'}</td>
                    <td>{b.count}</td>
                    <td>{b.scheduledByName || '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        disabled={busy}
                        onClick={() => cancelBatch(b.batchId)}
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
