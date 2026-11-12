import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import DrilldownModal from '../components/DrilldownModal.jsx';
import LeadPanel from '../components/LeadPanel.jsx';

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'overall', label: 'Overall' },
];

const COLUMNS = [
  { key: 'prospectsScraped', label: 'Prospects Scraped / Researched', metric: 'prospects_scraped' },
  { key: 'emailsUploaded', label: 'Emails Uploaded to CRM', metric: 'emails_uploaded' },
  { key: 'crmFirstEmails', label: 'First emails', metric: 'crm_first_emails' },
  { key: 'crmFollowupEmails', label: 'Follow-up emails', metric: 'crm_followup_emails' },
  { key: 'crmEmailsSent', label: 'CRM Emails Sent (total)', metric: 'crm_emails_sent' },
  { key: 'manualEmailsSent', label: 'Manual Emails Sent', metric: 'manual_emails_sent' },
  {
    key: 'linkedinConnectionSent',
    label: 'LinkedIn Connection Requests',
    metric: 'linkedin_connection_sent',
  },
  { key: 'linkedinMessages', label: 'LinkedIn Messages Sent', metric: 'linkedin_messages' },
  { key: 'linkedinFollowups', label: 'LinkedIn Follow-ups', metric: 'linkedin_followup' },
  { key: 'totalEmailOutreach', label: 'Total Email Outreach', metric: 'total_email_outreach' },
  { key: 'totalLinkedinOutreach', label: 'Total LinkedIn Outreach', metric: 'linkedin' },
  { key: 'openRate', label: 'Open rate%', metric: 'email_opens', suffix: '%' },
  { key: 'emailReplies', label: 'Email Replies', metric: 'email_replies' },
  { key: 'positiveReplies', label: 'Positive Replies', metric: 'positive_replies' },
  { key: 'meetingsBooked', label: 'Meetings / Calls Booked', metric: 'meetings' },
];

function todayLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function csvEscape(v) {
  const s = v == null ? '' : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadTextFile(filename, text, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function TelesalesWorkingPage() {
  const { user, can } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const period = searchParams.get('period') || 'today';
  const dateFrom = searchParams.get('from') || '';
  const dateTo = searchParams.get('to') || '';
  const hasCustomDates = Boolean(dateFrom && dateTo);
  const userId = searchParams.get('userId') || '';
  const sourceFilter = searchParams.get('source') || '';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [drilldown, setDrilldown] = useState(null);
  const [activeLeadId, setActiveLeadId] = useState(null);

  const canViewTeam = can('analytics:view_all') || can('analytics:view_team');

  const setParam = (key, value) => {
    const p = new URLSearchParams(searchParams);
    if (value) p.set(key, value);
    else p.delete(key);
    setSearchParams(p, { replace: true });
  };

  const setPeriod = (next) => {
    const p = new URLSearchParams(searchParams);
    p.set('period', next);
    p.delete('from');
    p.delete('to');
    setSearchParams(p, { replace: true });
  };

  const setCustomRange = (from, to) => {
    const p = new URLSearchParams(searchParams);
    if (from && to) {
      p.set('from', from);
      p.set('to', to);
      p.delete('period');
    }
    setSearchParams(p, { replace: true });
  };

  useEffect(() => {
    setError('');
    setData(null);
    const q = new URLSearchParams();
    if (hasCustomDates) {
      q.set('from', dateFrom);
      q.set('to', dateTo);
    } else {
      q.set('period', period);
    }
    if (userId) q.set('userId', userId);
    if (sourceFilter) q.set('source', sourceFilter);
    api(`/analytics/telesales-working?${q}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [period, dateFrom, dateTo, hasCustomDates, userId, sourceFilter]);

  const rows = useMemo(() => {
    if (!data?.reps) return [];
    let list = data.reps;
    if (!canViewTeam) list = list.filter((r) => r.id === user?.id);
    if (userId) list = list.filter((r) => r.id === userId);
    return list;
  }, [data, canViewTeam, user?.id, userId]);

  const openDrilldown = (metric, title, repId = null) => {
    setDrilldown({
      metric,
      title,
      period: hasCustomDates ? 'custom' : period,
      dateFrom: hasCustomDates ? dateFrom : undefined,
      dateTo: hasCustomDates ? dateTo : undefined,
      userId: repId || userId || (!canViewTeam ? user?.id : undefined),
    });
  };

  const exportCsv = () => {
    if (!data) return;
    const header = ['BD', ...COLUMNS.map((c) => c.label)];
    const lines = [header.map(csvEscape).join(',')];
    for (const r of rows) {
      lines.push(
        [r.name, ...COLUMNS.map((c) => (c.suffix === '%' ? `${r[c.key] ?? 0}%` : r[c.key] ?? 0))]
          .map(csvEscape)
          .join(','),
      );
    }
    if (canViewTeam && data.totals) {
      lines.push(
        [
          'TOTAL',
          ...COLUMNS.map((c) =>
            c.suffix === '%' ? `${data.totals[c.key] ?? 0}%` : data.totals[c.key] ?? 0,
          ),
        ]
          .map(csvEscape)
          .join(','),
      );
    }
    const range =
      data.fromYmd === data.toYmd ? data.fromYmd : `${data.fromYmd}_to_${data.toYmd}`;
    downloadTextFile(`BD_working_${range}.csv`, lines.join('\n'));
  };

  const exportPdf = () => {
    if (!data) return;
    const rangeLabel =
      data.fromYmd === data.toYmd ? data.fromYmd : `${data.fromYmd} → ${data.toYmd}`;
    const head = COLUMNS.map((c) => `<th>${c.label}</th>`).join('');
    const body = rows
      .map((r) => {
        const cells = COLUMNS.map((c) => {
          const v = c.suffix === '%' ? `${r[c.key] ?? 0}%` : r[c.key] ?? 0;
          return `<td>${v}</td>`;
        }).join('');
        return `<tr><td><strong>${r.name}</strong></td>${cells}</tr>`;
      })
      .join('');
    const totalRow =
      canViewTeam && data.totals
        ? `<tr><td><strong>TOTAL</strong></td>${COLUMNS.map((c) => {
            const v =
              c.suffix === '%' ? `${data.totals[c.key] ?? 0}%` : data.totals[c.key] ?? 0;
            return `<td><strong>${v}</strong></td>`;
          }).join('')}</tr>`
        : '';
    const w = window.open('', '_blank');
    if (!w) {
      setError('Allow popups to download PDF');
      return;
    }
    w.document.write(`<!doctype html><html><head><title>BD Working ${rangeLabel}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 16px; color: #111; }
        h1 { font-size: 18px; margin: 0 0 4px; }
        p { margin: 0 0 12px; color: #555; font-size: 12px; }
        table { border-collapse: collapse; width: 100%; font-size: 10px; }
        th, td { border: 1px solid #ccc; padding: 6px 5px; text-align: left; }
        th { background: #1e3a5f; color: #fff; }
        tr:nth-child(even) td { background: #f3f7fb; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <h1>BD Working</h1>
      <p>${data.label || ''} · ${rangeLabel}${sourceFilter ? ` · source ${sourceFilter}` : ''}</p>
      <table><thead><tr><th>BD</th>${head}</tr></thead>
      <tbody>${body}${totalRow}</tbody></table>
      <script>window.onload = function () { window.print(); }</script>
      </body></html>`);
    w.document.close();
  };

  if (error) return <div className="card login-error">{error}</div>;
  if (!data) return <div className="card">Loading BD working…</div>;

  const { label, fromYmd, toYmd, sources = [], totals } = data;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: '1rem',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <h1 className="page-title">BD Working</h1>
          <p className="page-sub" style={{ margin: 0 }}>
            {label}
            {fromYmd === toYmd ? ` · ${fromYmd}` : ` · ${fromYmd} → ${toYmd}`}
            {sourceFilter ? ` · source ${sourceFilter}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={exportCsv}>
            Download CSV
          </button>
          <button type="button" className="btn btn-secondary" onClick={exportPdf}>
            Download PDF
          </button>
        </div>
      </div>

      <div
        className="card"
        style={{
          marginBottom: '1rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          alignItems: 'flex-end',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`btn ${!hasCustomDates && period === p.key ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <label className="field" style={{ margin: 0, minWidth: 140 }}>
          <span className="label">From</span>
          <input
            type="date"
            className="input"
            value={dateFrom || (hasCustomDates ? '' : fromYmd || todayLocal())}
            onChange={(e) =>
              setCustomRange(e.target.value, dateTo || e.target.value || todayLocal())
            }
          />
        </label>
        <label className="field" style={{ margin: 0, minWidth: 140 }}>
          <span className="label">To</span>
          <input
            type="date"
            className="input"
            value={dateTo || (hasCustomDates ? '' : toYmd || todayLocal())}
            onChange={(e) =>
              setCustomRange(dateFrom || fromYmd || todayLocal(), e.target.value)
            }
          />
        </label>

        {canViewTeam ? (
          <label className="field" style={{ margin: 0, minWidth: 160 }}>
            <span className="label">BD name</span>
            <select
              className="select"
              value={userId}
              onChange={(e) => setParam('userId', e.target.value)}
            >
              <option value="">All BDs</option>
              {(data.reps || []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="field" style={{ margin: 0, minWidth: 160 }}>
          <span className="label">Source</span>
          <select
            className="select"
            value={sourceFilter}
            onChange={(e) => setParam('source', e.target.value)}
          >
            <option value="">All sources</option>
            {sources.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-wrap" style={{ maxWidth: '100%', overflow: 'auto' }}>
          <table className="leads-table" style={{ minWidth: 1400 }}>
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, background: 'var(--surface, #fff)', zIndex: 1 }}>
                  BD
                </th>
                {COLUMNS.map((c) => (
                  <th key={c.key} title={c.label}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="empty">
                    No BD activity for this period.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td
                      style={{
                        position: 'sticky',
                        left: 0,
                        background: 'var(--surface, #fff)',
                        fontWeight: 600,
                      }}
                    >
                      {r.name}
                    </td>
                    {COLUMNS.map((c) => {
                      const raw = r[c.key] ?? 0;
                      const display = c.suffix === '%' ? `${raw}%` : raw;
                      return (
                        <td key={c.key}>
                          <button
                            type="button"
                            className="table-num-btn"
                            onClick={() =>
                              openDrilldown(c.metric, `${r.name} — ${c.label}`, r.id)
                            }
                            title={`View ${c.label}`}
                          >
                            {display}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
              {canViewTeam && rows.length > 0 && totals ? (
                <tr style={{ background: 'color-mix(in srgb, var(--brand-primary) 8%, transparent)' }}>
                  <td
                    style={{
                      position: 'sticky',
                      left: 0,
                      background: 'color-mix(in srgb, var(--brand-primary) 8%, white)',
                      fontWeight: 700,
                    }}
                  >
                    TOTAL
                  </td>
                  {COLUMNS.map((c) => {
                    const raw = totals[c.key] ?? 0;
                    const display = c.suffix === '%' ? `${raw}%` : raw;
                    return (
                      <td key={c.key}>
                        <button
                          type="button"
                          className="table-num-btn"
                          style={{ fontWeight: 700 }}
                          onClick={() => openDrilldown(c.metric, `All BDs — ${c.label}`, null)}
                        >
                          {display}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {drilldown ? (
        <DrilldownModal
          title={drilldown.title}
          metric={drilldown.metric}
          period={drilldown.period}
          dateFrom={drilldown.dateFrom}
          dateTo={drilldown.dateTo}
          userId={drilldown.userId}
          onClose={() => setDrilldown(null)}
          onOpenLead={(id) => {
            setDrilldown(null);
            setActiveLeadId(id);
          }}
        />
      ) : null}

      {activeLeadId ? (
        <LeadPanel leadId={activeLeadId} onClose={() => setActiveLeadId(null)} />
      ) : null}
    </div>
  );
}
