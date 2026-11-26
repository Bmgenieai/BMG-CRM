import React, { useEffect, useState } from 'react';
import { RefreshCw, Phone, Mail, ExternalLink } from 'lucide-react';
import { api } from '../api.js';
import { StatusBadge } from './Badges.jsx';
import { formatCallOutcome } from '../lib/callOutcomes.js';

function todayYmd() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function yesterdayYmd() {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtTime(iso) {
  if (!iso) return '—';
  try {
    const raw = String(iso).includes('T') ? iso : `${String(iso).replace(' ', 'T')}Z`;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function outcomeBadgeClass(key) {
  if (key === 'demo_booked' || key === 'connected_interested') return 'badge badge-green';
  if (key === 'connected_callback' || key === 'busy_callback') return 'badge badge-amber';
  if (key === 'wrong_number' || key === 'connected_not_interested') return 'badge badge-red';
  return 'badge badge-grey';
}

const TABS = [
  { key: 'calls', label: 'Call Attempts' },
  { key: 'uniqueCalled', label: 'Unique People Called' },
  { key: 'researched', label: 'Prospects Researched' },
  { key: 'newLeads', label: 'New Leads Added' },
  { key: 'interested', label: 'Interested Prospects' },
  { key: 'pendingEmails', label: 'Pending Emails' },
  { key: 'sentEmails', label: 'Sent Emails' },
];

export default function SdrDailyActivityCard({ onOpenLead, refreshTick = 0 }) {
  const [date, setDate] = useState(todayYmd);
  const [sdrId, setSdrId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('calls');
  const [editingLeadId, setEditingLeadId] = useState(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const saveInterestedNote = async (leadId) => {
    setSavingNote(true);
    setError('');
    try {
      await api(`/leads/${leadId}/interested-notes`, {
        method: 'PATCH',
        body: { interested_notes: noteDraft },
      });
      setEditingLeadId(null);
      setNoteDraft('');
      load(date, sdrId);
    } catch (e) {
      setError(e.message || 'Failed to save note');
    } finally {
      setSavingNote(false);
    }
  };

  const load = (targetDate = date, targetSdrId = sdrId) => {
    setLoading(true);
    setError('');
    const p = new URLSearchParams();
    if (targetDate) p.set('date', targetDate);
    if (targetSdrId) p.set('userId', targetSdrId);
    api(`/analytics/sdr-daily?${p.toString()}`)
      .then((res) => {
        setData(res);
        if (!targetSdrId && res?.sdr?.id) {
          setSdrId(res.sdr.id);
        }
      })
      .catch((e) => setError(e.message || 'Failed to load daily SDR activity'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(date, sdrId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, sdrId, refreshTick]);

  const counts = data?.counts || {};
  const itemsMap = data?.items || {};
  const rows = itemsMap[activeTab] || [];
  const sdrName = data?.sdr?.name || 'SDR';

  const cards = [
    {
      key: 'researched',
      label: 'Prospects Researched',
      value: counts.prospectsResearched ?? 0,
      hint: 'New + existing leads',
    },
    {
      key: 'newLeads',
      label: 'New Leads Added',
      value: counts.newLeadsAdded ?? 0,
      hint: 'Created on this date',
    },
    {
      key: 'calls',
      label: 'Call Attempts',
      value: counts.totalCalls ?? 0,
      hint: `${counts.uniquePeopleCalled ?? 0} unique people`,
    },
    {
      key: 'uniqueCalled',
      label: 'Unique People Called',
      value: counts.uniquePeopleCalled ?? 0,
      hint: 'Distinct contacts',
    },
    {
      key: 'interested',
      label: 'Interested Prospects',
      value: counts.interested ?? 0,
      hint: 'Interested / demo / email req',
    },
    {
      key: 'pendingEmails',
      label: 'Pending Emails',
      value: counts.pendingEmails ?? 0,
      hint: `${counts.emailRequested ?? 0} asked for details`,
      highlight: Number(counts.pendingEmails || 0) > 0,
    },
    {
      key: 'sentEmails',
      label: 'Emails Sent',
      value: counts.sentEmails ?? 0,
      hint: 'Requested details fulfilled',
    },
  ];

  return (
    <div className="card" style={{ marginBottom: '1.25rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 12,
        }}
      >
        <div>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Phone size={18} />
            Daily SDR Activity — {sdrName}
          </h3>
          <p className="stat-hint" style={{ margin: '2px 0 0' }}>
            Covers both new prospects and existing CRM leads worked on <strong>{data?.date || date}</strong>. Click any count to inspect and open lead records.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {(data?.sdrs || []).length > 1 ? (
            <select
              className="select"
              value={sdrId || data?.sdr?.id || ''}
              onChange={(e) => setSdrId(e.target.value)}
              style={{ width: 160 }}
            >
              {data.sdrs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          ) : null}
          <button
            type="button"
            className={`btn btn-sm ${date === todayYmd() ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setDate(todayYmd())}
          >
            Today
          </button>
          <button
            type="button"
            className={`btn btn-sm ${date === yesterdayYmd() ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setDate(yesterdayYmd())}
          >
            Yesterday
          </button>
          <input
            type="date"
            className="input"
            value={date}
            onChange={(e) => {
              if (e.target.value) setDate(e.target.value);
            }}
            style={{ width: 150 }}
          />
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => load(date, sdrId)}
            title="Refresh"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {error ? (
        <div
          className="login-error"
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}
        >
          <span>{error}</span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => load(date, sdrId)}
          >
            Retry
          </button>
        </div>
      ) : null}

      {!data?.sdr && !loading ? (
        <p className="empty">No active SDR / Caller account found.</p>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))',
              gap: 8,
              marginBottom: 14,
            }}
          >
            {cards.map((c) => {
              const active = activeTab === c.key;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setActiveTab(c.key)}
                  className="card"
                  style={{
                    margin: 0,
                    padding: '0.65rem 0.75rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                    border: active
                      ? '2px solid var(--brand-primary, #4f46e5)'
                      : c.highlight
                        ? '1px solid #f59e0b'
                        : undefined,
                    background: c.highlight
                      ? 'rgba(245, 158, 11, 0.08)'
                      : active
                        ? 'color-mix(in srgb, var(--brand-primary, #4f46e5) 6%, transparent)'
                        : undefined,
                  }}
                >
                  <div className="stat-label" style={{ margin: 0 }}>
                    {c.label}
                  </div>
                  <div
                    className="stat-value"
                    style={{
                      margin: '4px 0 0',
                      fontSize: '1.35rem',
                      color: c.highlight ? '#b45309' : undefined,
                    }}
                  >
                    {loading ? '…' : c.value}
                  </div>
                  <div className="stat-hint" style={{ margin: 0, fontSize: 11 }}>
                    {c.hint}
                  </div>
                </button>
              );
            })}
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <strong style={{ fontSize: 14 }}>
              {TABS.find((t) => t.key === activeTab)?.label} ({rows.length})
            </strong>
          </div>

          {loading ? (
            <p className="empty">Loading daily activity…</p>
          ) : !rows.length ? (
            <p className="empty">No records under this category for {data?.date || date}.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Lead / Contact</th>
                    <th>Type</th>
                    <th>Company</th>
                    <th>Outcome / Stage</th>
                    <th>
                      {activeTab === 'interested'
                        ? 'SDR Handoff Notes (for BD)'
                        : 'Notes & Email Request'}
                    </th>
                    <th>Email Status</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={row.id || row.lead_id || idx}>
                      <td>
                        {row.lead_id ? (
                          <button
                            type="button"
                            className="table-num-btn"
                            style={{ textAlign: 'left', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            onClick={() => onOpenLead?.(row.lead_id)}
                            title="Open lead record"
                          >
                            <span>{row.contact_name}</span>
                            <ExternalLink size={12} />
                          </button>
                        ) : (
                          <span style={{ fontWeight: 600 }}>{row.contact_name}</span>
                        )}
                        <div className="stat-hint" style={{ fontSize: 11 }}>
                          {[row.phone, row.email].filter(Boolean).join(' · ') || '—'}
                        </div>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {row.source_type === 'cold_call' ? (
                          <span className="badge badge-grey">Cold Call Log</span>
                        ) : row.is_new_lead ? (
                          <span className="badge badge-blue">New Lead</span>
                        ) : (
                          <span className="badge badge-grey">Existing Lead</span>
                        )}
                        {row.attempt_count > 1 ? (
                          <div className="stat-hint" style={{ fontSize: 11, marginTop: 2 }}>
                            {row.attempt_count} attempts
                          </div>
                        ) : null}
                      </td>
                      <td>{row.company || '—'}</td>
                      <td>
                        {row.outcome ? (
                          <span className={outcomeBadgeClass(row.outcome)}>
                            {formatCallOutcome(row.outcome)}
                          </span>
                        ) : row.lead_status ? (
                          <StatusBadge status={row.lead_status} />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td style={{ maxWidth: 360, fontSize: 12 }}>
                        {row.interested_notes ? (
                          <div
                            style={{
                              padding: '5px 8px',
                              borderRadius: 6,
                              background: 'rgba(245, 158, 11, 0.1)',
                              border: '1px solid rgba(245, 158, 11, 0.35)',
                              marginBottom: 4,
                              whiteSpace: 'pre-wrap',
                            }}
                          >
                            <strong style={{ color: '#92400e', fontSize: 11 }}>SDR Handoff Note:</strong>
                            <div style={{ marginTop: 2 }}>{row.interested_notes}</div>
                          </div>
                        ) : null}
                        {row.notes && row.notes !== row.interested_notes ? <div>{row.notes}</div> : null}
                        {row.email_details_requested &&
                        row.email_request_notes &&
                        row.email_request_notes !== row.notes ? (
                          <div style={{ marginTop: 4, color: '#92400e', fontWeight: 500 }}>
                            Requested: {row.email_request_notes}
                          </div>
                        ) : null}
                        {row.lead_id &&
                        (activeTab === 'interested' ||
                          activeTab === 'pendingEmails' ||
                          activeTab === 'sentEmails') ? (
                          editingLeadId === row.lead_id ? (
                            <div style={{ marginTop: 6 }}>
                              <textarea
                                className="textarea"
                                rows={3}
                                style={{ fontSize: 12 }}
                                value={noteDraft}
                                onChange={(e) => setNoteDraft(e.target.value)}
                                placeholder="What you already explained about BMGenie, what the prospect was interested in, and any questions or details to send…"
                              />
                              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  disabled={savingNote}
                                  onClick={() => saveInterestedNote(row.lead_id)}
                                >
                                  {savingNote ? 'Saving…' : 'Save note'}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => setEditingLeadId(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '2px 6px', fontSize: 11, marginTop: 4 }}
                              onClick={() => {
                                setEditingLeadId(row.lead_id);
                                setNoteDraft(row.interested_notes || row.notes || '');
                              }}
                            >
                              {row.interested_notes ? 'Edit handoff note' : '+ Add handoff note'}
                            </button>
                          )
                        ) : !row.interested_notes && !row.notes && !row.email_request_notes ? (
                          '—'
                        ) : null}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {row.email_status === 'pending' ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className="badge badge-amber">Pending</span>
                            {row.lead_id ? (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                style={{ padding: '2px 6px', fontSize: 11 }}
                                onClick={() => onOpenLead?.(row.lead_id)}
                                title="Open lead to send requested details"
                              >
                                <Mail size={12} /> Send
                              </button>
                            ) : null}
                          </div>
                        ) : row.email_status === 'sent' ? (
                          <div>
                            <span className="badge badge-green">Sent</span>
                            {row.email_sent_at ? (
                              <div className="stat-hint" style={{ fontSize: 11 }}>
                                {fmtTime(row.email_sent_at)}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{fmtTime(row.at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
