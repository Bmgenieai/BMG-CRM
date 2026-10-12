import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { fmtDate, StatusBadge, BusinessTypeBadge, StateBadge } from './Badges.jsx';

export default function DrilldownModal({
  title,
  metric,
  period = 'overall',
  userId,
  stage,
  businessType,
  state,
  reason,
  onClose,
  onOpenLead,
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!metric && !stage && !businessType && !state) return;
    setLoading(true);
    setError('');

    const params = new URLSearchParams();
    if (metric) params.set('metric', metric);
    if (period) params.set('period', period);
    if (userId) params.set('userId', userId);
    if (stage) params.set('stage', stage);
    if (businessType) params.set('businessType', businessType);
    if (state) params.set('state', state);
    if (reason) params.set('reason', reason);

    api(`/analytics/drilldown?${params}`)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message || 'Failed to load details');
        setLoading(false);
      });
  }, [metric, period, userId, stage, businessType, state, reason]);

  const items = data?.items || [];

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase().trim();
    return items.filter((it) => {
      return (
        it.lead_name?.toLowerCase().includes(q) ||
        it.name?.toLowerCase().includes(q) ||
        it.lead_email?.toLowerCase().includes(q) ||
        it.email?.toLowerCase().includes(q) ||
        it.lead_company?.toLowerCase().includes(q) ||
        it.company?.toLowerCase().includes(q) ||
        it.user_name?.toLowerCase().includes(q) ||
        it.assigned_to_name?.toLowerCase().includes(q) ||
        it.subject?.toLowerCase().includes(q) ||
        it.summary?.toLowerCase().includes(q) ||
        it.notes?.toLowerCase().includes(q) ||
        it.business_type?.toLowerCase().includes(q) ||
        it.state?.toLowerCase().includes(q) ||
        it.lead_state?.toLowerCase().includes(q) ||
        it.status?.toLowerCase().includes(q)
      );
    });
  }, [items, search]);

  const modalTitle = title || data?.title || 'Details';
  const periodLabel = data?.periodLabel || period;

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal"
        style={{
          maxWidth: 960,
          width: '92%',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.25rem',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
            borderBottom: '1px solid var(--border)',
            paddingBottom: '0.85rem',
            marginBottom: '0.85rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', textTransform: 'capitalize' }}>
                {modalTitle}
              </h3>
              <span
                style={{
                  background: 'rgba(85, 115, 244, 0.1)',
                  color: 'var(--brand-primary)',
                  padding: '2px 8px',
                  borderRadius: 999,
                  fontSize: '0.8rem',
                  fontWeight: 600,
                }}
              >
                {data ? `${filteredItems.length} records` : 'Loading…'}
              </span>
            </div>
            <p className="stat-hint" style={{ margin: '0.25rem 0 0' }}>
              Period: <strong>{periodLabel}</strong>
              {data?.dateRange ? ` (${data.dateRange})` : ''}
              {businessType ? ` · Segment: ${businessType}` : ''}
              {state ? ` · State: ${state}` : ''}
            </p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            ✕ Close
          </button>
        </div>

        {/* Filter / Search Bar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: '0.85rem' }}>
          <input
            type="text"
            className="input"
            placeholder="Filter by lead, company, email, rep, or subject…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1 }}
          />
          {search && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setSearch('')}
              style={{ padding: '0.3rem 0.6rem' }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 200 }}>
          {loading ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--muted)' }}>
              Loading records…
            </div>
          ) : error ? (
            <div style={{ padding: '1.5rem', color: 'var(--danger)', textAlign: 'center' }}>
              {error}
            </div>
          ) : filteredItems.length === 0 ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--muted)' }}>
              {items.length === 0
                ? 'No activity or leads logged for this count in the selected period.'
                : 'No matching records found for your search query.'}
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table" style={{ fontSize: '0.86rem' }}>
                <thead>
                  <tr>
                    <th>Lead / Contact</th>
                    <th>State</th>
                    <th>Business type</th>
                    <th>Activity / Details</th>
                    <th>BD / Rep</th>
                    <th>Date</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item, idx) => {
                    const leadId = item.lead_id || item.id;
                    const leadName = item.lead_name || item.name || 'Unnamed Lead';
                    const leadEmail = item.lead_email || item.email || item.to_email || item.from_email;
                    const leadCompany = item.lead_company || item.company;
                    const leadStatus = item.lead_status || item.status;
                    const bType = item.business_type;
                    const leadState = item.state || item.lead_state;
                    const detail =
                      item.subject ||
                      item.summary ||
                      item.preview ||
                      item.notes ||
                      item.lost_reason ||
                      item.type ||
                      '—';
                    const rep = item.user_name || item.assigned_to_name || 'System';

                    return (
                      <tr
                        key={item.id || idx}
                        style={{ cursor: onOpenLead ? 'pointer' : 'default' }}
                        onClick={() => onOpenLead && leadId && onOpenLead(leadId)}
                        className="clickable-row"
                      >
                        <td>
                          <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span>{leadName}</span>
                            <StateBadge state={leadState} />
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                            {leadCompany ? <span>{leadCompany} · </span> : null}
                            {leadEmail ? <span>{leadEmail}</span> : null}
                          </div>
                          {leadStatus ? (
                            <div style={{ marginTop: 3 }}>
                              <StatusBadge status={leadStatus} />
                            </div>
                          ) : null}
                        </td>
                        <td>
                          {leadState ? <StateBadge state={leadState} /> : <span className="stat-hint">—</span>}
                        </td>
                        <td>
                          <BusinessTypeBadge type={bType} />
                          {!bType && <span className="stat-hint">—</span>}
                        </td>
                        <td style={{ maxWidth: 300 }}>
                          <div
                            style={{
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              maxWidth: 300,
                            }}
                            title={String(detail)}
                          >
                            {item.outcome && (
                              <span
                                style={{
                                  fontWeight: 600,
                                  color: 'var(--brand-primary)',
                                  marginRight: 4,
                                }}
                              >
                                [{item.outcome}]
                              </span>
                            )}
                            {detail}
                          </div>
                          {item.type && item.type !== detail ? (
                            <span className="stat-hint" style={{ fontSize: '0.72rem' }}>
                              Type: {String(item.type).replace(/_/g, ' ')}
                            </span>
                          ) : null}
                        </td>
                        <td>
                          <span style={{ fontWeight: 500 }}>{rep}</span>
                        </td>
                        <td style={{ whiteSpace: 'nowrap', color: 'var(--muted)' }}>
                          {fmtDate(item.date || item.created_at)}
                        </td>
                        <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                          {leadId && onOpenLead ? (
                            <button
                              type="button"
                              className="btn btn-ghost"
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.78rem' }}
                              onClick={() => onOpenLead(leadId)}
                            >
                              Open lead →
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
