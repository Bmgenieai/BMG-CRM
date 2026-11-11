import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
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

function StatCard({ label, value, hint, onClick }) {
  return (
    <div
      className={`card${onClick ? ' stat-clickable' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onClick();
            }
          : undefined
      }
    >
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value ?? 0}</p>
      {hint ? <p className="stat-hint">{hint}</p> : null}
    </div>
  );
}

export default function EmailPerformancePage() {
  const { can } = useAuth();
  const canUse =
    can('email:bulk_send') ||
    can('analytics:view_own') ||
    can('analytics:view_team') ||
    can('analytics:view_all');
  const canTeam = can('analytics:view_team') || can('analytics:view_all');

  const [data, setData] = useState(null);
  const [accountId, setAccountId] = useState('');
  const [scope, setScope] = useState('account');
  const [focusUserId, setFocusUserId] = useState('');
  const [period, setPeriod] = useState('overall');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [error, setError] = useState('');
  const [drilldown, setDrilldown] = useState(null);
  const [leadId, setLeadId] = useState(null);

  const hasCustomDates = Boolean(dateFrom && dateTo);

  if (!canUse) return <Navigate to="/" replace />;

  const selectPeriod = (key) => {
    setPeriod(key);
    setDateFrom('');
    setDateTo('');
  };

  const load = () => {
    setError('');
    const params = new URLSearchParams();
    if (accountId) params.set('emailAccountId', accountId);
    params.set('scope', focusUserId ? 'me' : scope);
    if (focusUserId) params.set('userId', focusUserId);
    if (hasCustomDates) {
      params.set('from', dateFrom);
      params.set('to', dateTo);
    } else {
      params.set('period', period);
    }
    api(`/email/performance?${params}`)
      .then((res) => {
        setData(res);
        if (!accountId && res.account?.id) setAccountId(res.account.id);
      })
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    load();
  }, [accountId, scope, focusUserId, period, dateFrom, dateTo]);

  const stats = data?.stats || {};
  const accounts = data?.accounts || [];
  const byDay = data?.byDay || [];
  const activeAccountId = accountId || data?.account?.id || '';
  const periodLabel = hasCustomDates
    ? dateFrom === dateTo
      ? dateFrom
      : `${dateFrom} → ${dateTo}`
    : data?.label || PERIODS.find((p) => p.key === period)?.label || 'Overall';

  const openMetric = (metric, title, dayYmd) => {
    const useRange = Boolean(dayYmd) || hasCustomDates;
    setDrilldown({
      metric,
      title: dayYmd ? `${title} · ${dayYmd}` : title,
      emailAccountId: activeAccountId || undefined,
      userId: focusUserId || (scope === 'me' ? data?.user?.id : undefined),
      dateFrom: dayYmd || (hasCustomDates ? dateFrom : undefined),
      dateTo: dayYmd || (hasCustomDates ? dateTo : undefined),
      period: useRange ? undefined : period,
    });
  };

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: '0.75rem',
          }}
        >
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>
              Email stats
            </h1>
            {data?.account ? (
              <p className="page-sub" style={{ margin: '0.25rem 0 0' }}>
                {data.account.name} &lt;{data.account.email}&gt;
                {periodLabel ? (
                  <>
                    {' '}
                    · <strong>{periodLabel}</strong>
                  </>
                ) : null}
              </p>
            ) : null}
          </div>
          <div className="ceo-dashboard-filters" role="group" aria-label="Email stats date filters">
            <div className="ceo-period-chips" role="group" aria-label="Date period">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  className={`btn ${!hasCustomDates && period === p.key ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => selectPeriod(p.key)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <span className="ceo-filter-divider" aria-hidden="true" />
            <div className="ceo-date-range" role="group" aria-label="Custom date range">
              <label className="ceo-date-field">
                <span>From</span>
                <input
                  type="date"
                  className="input"
                  value={dateFrom}
                  max={dateTo || undefined}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDateFrom(v);
                    if (v && !dateTo) setDateTo(v);
                  }}
                />
              </label>
              <span className="ceo-date-sep">–</span>
              <label className="ceo-date-field">
                <span>To</span>
                <input
                  type="date"
                  className="input"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDateTo(v);
                    if (v && !dateFrom) setDateFrom(v);
                  }}
                />
              </label>
              {hasCustomDates ? (
                <button
                  type="button"
                  className="btn btn-ghost ceo-date-clear"
                  onClick={() => selectPeriod(period)}
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: canTeam && (data?.team || []).length ? '1.4fr 1fr 1fr' : '1.4fr 1fr',
            gap: 8,
            width: '100%',
          }}
        >
          <select
            className="select"
            value={activeAccountId}
            onChange={(e) => {
              setAccountId(e.target.value);
              setFocusUserId('');
            }}
            style={{ width: '100%', minWidth: 0 }}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label} · {a.email}
              </option>
            ))}
          </select>
          <select
            className="select"
            value={focusUserId ? 'user' : scope}
            onChange={(e) => {
              const v = e.target.value;
              if (v === 'me') {
                setScope('me');
                setFocusUserId('');
              } else if (v === 'account') {
                setScope('account');
                setFocusUserId('');
              }
            }}
            style={{ width: '100%', minWidth: 0 }}
          >
            <option value="account">All from this sender</option>
            <option value="me">My sends only</option>
          </select>
          {canTeam && (data?.team || []).length ? (
            <select
              className="select"
              value={focusUserId}
              onChange={(e) => setFocusUserId(e.target.value)}
              style={{ width: '100%', minWidth: 0 }}
            >
              <option value="">All BDs</option>
              {data.team.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </div>

      {error ? <div className="login-error">{error}</div> : null}

      <div className="grid grid-4" style={{ marginBottom: '1rem' }}>
        <StatCard
          label="Sent"
          value={stats.sent}
          hint={periodLabel}
          onClick={() => openMetric('emails_sent', 'Emails sent')}
        />
        <StatCard
          label="Delivered"
          value={stats.delivered}
          hint={stats.sent ? `${stats.deliveryRate}%` : null}
          onClick={() => openMetric('email_delivered', 'Emails delivered')}
        />
        <StatCard
          label="Opened"
          value={stats.opened}
          hint={stats.sent ? `${stats.openRate}%` : null}
          onClick={() => openMetric('email_opens', 'Email opens')}
        />
        <StatCard
          label="Replies"
          value={stats.replies}
          hint={stats.sent ? `${stats.replyRate}%` : null}
          onClick={() => openMetric('email_replies', 'Replies')}
        />
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>By day</h3>
        <p className="stat-hint" style={{ marginTop: 0 }}>
          How many emails went out from this sender each day
          {periodLabel ? ` · ${periodLabel}` : ''}.
        </p>
        {byDay.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Sent</th>
                  <th>Opened</th>
                  <th>Replies</th>
                </tr>
              </thead>
              <tbody>
                {byDay.map((row) => (
                  <tr
                    key={row.day}
                    style={{ cursor: 'pointer' }}
                    onClick={() => openMetric('emails_sent', 'Emails sent', row.day)}
                    title={`See emails sent on ${row.day}`}
                  >
                    <td>{row.day}</td>
                    <td>{row.sent}</td>
                    <td>{row.opened}</td>
                    <td>{row.replies}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="stat-hint" style={{ marginBottom: 0 }}>
            No sends in this date range.
          </p>
        )}
      </div>

      {canTeam && (data?.team || []).length ? (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>By BD</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>BD</th>
                  <th>Sent</th>
                  <th>Opened</th>
                  <th>Replies</th>
                </tr>
              </thead>
              <tbody>
                {data.team.map((t) => (
                  <tr
                    key={t.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setFocusUserId(t.id)}
                  >
                    <td>{t.name}</td>
                    <td>{t.sent}</td>
                    <td>{t.opened}</td>
                    <td>{t.replies}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {drilldown ? (
        <DrilldownModal
          title={drilldown.title}
          metric={drilldown.metric}
          period={drilldown.period}
          dateFrom={drilldown.dateFrom}
          dateTo={drilldown.dateTo}
          userId={drilldown.userId}
          emailAccountId={drilldown.emailAccountId}
          onClose={() => setDrilldown(null)}
          onOpenLead={(id) => {
            setDrilldown(null);
            setLeadId(id);
          }}
        />
      ) : null}

      {leadId ? (
        <LeadPanel leadId={leadId} onClose={() => setLeadId(null)} onChanged={() => load()} />
      ) : null}
    </div>
  );
}
