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
  { key: 'totalCalls', label: 'Total Calls', metric: 'caller_total_calls' },
  { key: 'connectedCalls', label: 'Connected', metric: 'caller_connected' },
  { key: 'connectRate', label: 'Connect Rate %', metric: 'caller_connected', suffix: '%' },
  { key: 'noAnswerVoicemail', label: 'No Answer / VM', metric: 'caller_no_answer_voicemail' },
  { key: 'wrongNumber', label: 'Wrong Number', metric: 'caller_wrong_number' },
  { key: 'callbacks', label: 'Callbacks', metric: 'caller_callbacks' },
  { key: 'interested', label: 'Interested', metric: 'caller_interested' },
  { key: 'notInterested', label: 'Not Interested', metric: 'caller_not_interested' },
  { key: 'demosBooked', label: 'Demos Booked', metric: 'caller_demos_booked' },
  { key: 'leadsAdded', label: 'New Leads Added', metric: 'caller_leads_added' },
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

export default function CallerWorkingPage() {
  const { user, can } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const period = searchParams.get('period') || 'today';
  const dateFrom = searchParams.get('from') || '';
  const dateTo = searchParams.get('to') || '';
  const hasCustomDates = Boolean(dateFrom && dateTo);
  const userId = searchParams.get('userId') || '';

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

  const load = () => {
    setError('');
    const q = new URLSearchParams();
    if (hasCustomDates) {
      q.set('from', dateFrom);
      q.set('to', dateTo);
    } else {
      q.set('period', period);
    }
    if (userId) q.set('userId', userId);
    api(`/analytics/caller-working?${q}`)
      .then(setData)
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    setData(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, dateFrom, dateTo, hasCustomDates, userId]);

  const rows = useMemo(() => {
    if (!data?.callers) return [];
    let list = data.callers;
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
    const header = ['Caller', ...COLUMNS.map((c) => c.label)];
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
    downloadTextFile(`Caller_working_${range}.csv`, lines.join('\n'));
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
    w.document.write(`<!doctype html><html><head><title>Caller Working ${rangeLabel}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 16px; color: #111; }
        h1 { font-size: 18px; margin: 0 0 4px; }
        p { margin: 0 0 12px; color: #555; font-size: 12px; }
        table { border-collapse: collapse; width: 100%; font-size: 11px; }
        th, td { border: 1px solid #ccc; padding: 6px 5px; text-align: left; }
        th { background: #f3f4f6; }
      </style>
    </head><body>
      <h1>Caller Working Report</h1>
      <p>Period: ${data.periodLabel || period} (${rangeLabel})</p>
      <table><thead><tr><th>Caller</th>${head}</tr></thead><tbody>${body}${totalRow}</tbody></table>
      <script>window.onload = () => { window.print(); };</script>
    </body></html>`);
    w.document.close();
  };

  const totals = data?.totals;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: '1rem',
        }}
      >
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>
            Caller Working
          </h1>
          <p className="page-sub" style={{ margin: 0 }}>
            Daily cold-calling stats from call statuses &amp; talk notes logged on leads. Click any
            number to inspect call details.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary" onClick={exportCsv} disabled={!data}>
            Download CSV
          </button>
          <button type="button" className="btn btn-secondary" onClick={exportPdf} disabled={!data}>
            Download PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <div
        className="card"
        style={{
          marginBottom: '1rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {PERIODS.map((p) => {
            const active = !hasCustomDates && period === p.key;
            return (
              <button
                key={p.key}
                type="button"
                className={`btn ${active ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '0.35rem 0.7rem', fontSize: '0.84rem' }}
                onClick={() => setPeriod(p.key)}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="date"
            className="input"
            style={{ width: 'auto', padding: '0.3rem 0.5rem', fontSize: '0.84rem' }}
            value={dateFrom}
            max={todayLocal()}
            onChange={(e) => setCustomRange(e.target.value, dateTo || e.target.value)}
            aria-label="From date"
          />
          <span style={{ color: 'var(--muted)', fontSize: '0.84rem' }}>to</span>
          <input
            type="date"
            className="input"
            style={{ width: 'auto', padding: '0.3rem 0.5rem', fontSize: '0.84rem' }}
            value={dateTo}
            max={todayLocal()}
            onChange={(e) => setCustomRange(dateFrom || e.target.value, e.target.value)}
            aria-label="To date"
          />

          {canViewTeam && (data?.allCallers?.length || 0) > 0 ? (
            <select
              className="select"
              style={{ width: 'auto', minWidth: 150, padding: '0.3rem 0.5rem', fontSize: '0.84rem' }}
              value={userId}
              onChange={(e) => setParam('userId', e.target.value)}
              aria-label="Filter by caller"
            >
              <option value="">All callers</option>
              {data.allCallers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </div>

      {error ? <div className="login-error">{error}</div> : null}

      {/* Summary KPI cards */}
      {totals ? (
        <div
          className="grid"
          style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '0.75rem',
            marginBottom: '1rem',
          }}
        >
          {[
            { label: 'Total Calls', value: totals.totalCalls, metric: 'caller_total_calls' },
            { label: 'Connected', value: totals.connectedCalls, metric: 'caller_connected' },
            { label: 'Connect Rate', value: `${totals.connectRate}%`, metric: 'caller_connected' },
            { label: 'Interested', value: totals.interested, metric: 'caller_interested' },
            { label: 'Callbacks', value: totals.callbacks, metric: 'caller_callbacks' },
            { label: 'Demos Booked', value: totals.demosBooked, metric: 'caller_demos_booked' },
            { label: 'New Leads', value: totals.leadsAdded, metric: 'caller_leads_added' },
          ].map((kpi) => (
            <button
              key={kpi.label}
              type="button"
              className="card"
              style={{
                textAlign: 'left',
                cursor: 'pointer',
                padding: '0.85rem 1rem',
                border: '1px solid var(--border)',
              }}
              onClick={() => openDrilldown(kpi.metric, kpi.label)}
            >
              <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: 4 }}>
                {kpi.label}
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{kpi.value}</div>
            </button>
          ))}
        </div>
      ) : null}

      {/* Per-caller breakdown table */}
      <div className="card table-wrap">
        {!data ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
            Loading caller working…
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
            No active Caller employees yet. Create a Caller account in <strong>Employees</strong>{' '}
            to track their calls here.
          </div>
        ) : (
          <table className="table" style={{ fontSize: '0.86rem' }}>
            <thead>
              <tr>
                <th>Caller</th>
                {COLUMNS.map((c) => (
                  <th key={c.key} style={{ textAlign: 'right' }}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.name}</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--muted)' }}>{r.email}</div>
                  </td>
                  {COLUMNS.map((c) => {
                    const raw = r[c.key] ?? 0;
                    const display = c.suffix === '%' ? `${raw}%` : raw;
                    return (
                      <td key={c.key} style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{
                            padding: '0.15rem 0.45rem',
                            fontWeight: raw > 0 ? 600 : 400,
                            color: raw > 0 ? 'var(--brand-primary)' : 'var(--muted)',
                          }}
                          onClick={() => openDrilldown(c.metric, `${r.name} — ${c.label}`, r.id)}
                        >
                          {display}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {canViewTeam && totals && rows.length > 1 ? (
                <tr style={{ background: 'rgba(85, 115, 244, 0.05)', fontWeight: 700 }}>
                  <td>TOTAL</td>
                  {COLUMNS.map((c) => {
                    const raw = totals[c.key] ?? 0;
                    const display = c.suffix === '%' ? `${raw}%` : raw;
                    return (
                      <td key={c.key} style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ padding: '0.15rem 0.45rem', fontWeight: 700 }}
                          onClick={() => openDrilldown(c.metric, `All Callers — ${c.label}`)}
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
        )}
      </div>

      {drilldown ? (
        <DrilldownModal
          {...drilldown}
          onClose={() => setDrilldown(null)}
          onOpenLead={(id) => {
            setDrilldown(null);
            setActiveLeadId(id);
          }}
        />
      ) : null}

      {activeLeadId ? (
        <LeadPanel
          leadId={activeLeadId}
          onClose={() => setActiveLeadId(null)}
          onUpdated={() => load()}
        />
      ) : null}
    </div>
  );
}
