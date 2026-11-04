import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import DrilldownModal from '../components/DrilldownModal.jsx';
import LeadPanel from '../components/LeadPanel.jsx';

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
  const [error, setError] = useState('');
  const [drilldown, setDrilldown] = useState(null);
  const [leadId, setLeadId] = useState(null);

  if (!canUse) return <Navigate to="/" replace />;

  const load = () => {
    setError('');
    const params = new URLSearchParams();
    if (accountId) params.set('emailAccountId', accountId);
    params.set('scope', focusUserId ? 'me' : scope);
    if (focusUserId) params.set('userId', focusUserId);
    api(`/email/performance?${params}`)
      .then((res) => {
        setData(res);
        if (!accountId && res.account?.id) setAccountId(res.account.id);
      })
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    load();
  }, [accountId, scope, focusUserId]);

  const stats = data?.stats || {};
  const accounts = data?.accounts || [];
  const activeAccountId = accountId || data?.account?.id || '';

  const openMetric = (metric, title) => {
    setDrilldown({
      metric,
      title,
      emailAccountId: activeAccountId || undefined,
      userId: focusUserId || (scope === 'me' ? data?.user?.id : undefined),
    });
  };

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
          <h1 className="page-title">Email stats</h1>
          {data?.account ? (
            <p className="page-sub" style={{ margin: 0 }}>
              {data.account.name} &lt;{data.account.email}&gt;
            </p>
          ) : null}
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'nowrap',
            alignItems: 'center',
            gap: 8,
            overflowX: 'auto',
            maxWidth: '100%',
          }}
        >
          <select
            className="select"
            value={activeAccountId}
            onChange={(e) => {
              setAccountId(e.target.value);
              setFocusUserId('');
            }}
            style={{ minWidth: 200, flex: '0 0 auto' }}
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
            style={{ minWidth: 160, flex: '0 0 auto' }}
          >
            <option value="account">All from this sender</option>
            <option value="me">My sends only</option>
          </select>
          {canTeam && (data?.team || []).length ? (
            <select
              className="select"
              value={focusUserId}
              onChange={(e) => setFocusUserId(e.target.value)}
              style={{ minWidth: 140, flex: '0 0 auto' }}
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
          period="overall"
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
