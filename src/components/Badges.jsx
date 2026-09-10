export function StatusBadge({ status }) {
  const map = {
    qualified: 'badge-blue',
    conversation: 'badge-amber',
    demo_booked: 'badge-amber',
    trial: 'badge-green',
    paid: 'badge-green',
    lost: 'badge-grey',
    // legacy
    new: 'badge-blue',
    contacted: 'badge-amber',
    interested: 'badge-amber',
    neutral: 'badge-amber',
    follow_up_scheduled: 'badge-amber',
    not_interested: 'badge-grey',
    converted: 'badge-green',
    pending: 'badge-amber',
    overdue: 'badge-red',
    completed: 'badge-green',
    cancelled: 'badge-grey',
  };
  const labels = {
    qualified: 'Qualified',
    conversation: 'Conversation',
    demo_booked: 'Demo booked',
    trial: 'Trial',
    paid: 'Paid',
    lost: 'Lost',
    new: 'Qualified',
    contacted: 'Qualified',
    interested: 'Conversation',
    neutral: 'Conversation',
    follow_up_scheduled: 'Conversation',
    not_interested: 'Lost',
    converted: 'Paid',
  };
  const label = labels[status] || String(status || '').replace(/_/g, ' ');
  return <span className={`badge ${map[status] || 'badge-grey'}`}>{label}</span>;
}

const SOURCE_LABELS = {
  signup_no_listing: 'Signed up · no purchase',
  free_credit_no_purchase: 'Free credit · no purchase',
  purchased_no_repurchase: 'Credits used · no repurchase',
  csv_import: 'CSV / Google Sheet',
  telesales: 'Telesales',
  manual: 'Manual',
};

export function SourceBadge({ source, createdByName }) {
  const label = SOURCE_LABELS[source] || String(source || '').replace(/_/g, ' ');
  const text = createdByName ? `${label} · ${createdByName}` : label;
  return <span className="badge badge-blue">{text}</span>;
}

export function money(n) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);
}

export function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
