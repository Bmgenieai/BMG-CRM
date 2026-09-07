export function StatusBadge({ status }) {
  const map = {
    new: 'badge-blue',
    contacted: 'badge-amber',
    interested: 'badge-green',
    neutral: 'badge-amber',
    follow_up_scheduled: 'badge-amber',
    not_interested: 'badge-grey',
    converted: 'badge-green',
    lost: 'badge-grey',
    pending: 'badge-amber',
    overdue: 'badge-red',
    completed: 'badge-green',
    cancelled: 'badge-grey',
  };
  const labels = {
    new: 'New',
    contacted: 'Contacted',
    interested: 'Interested',
    neutral: 'Neutral',
    follow_up_scheduled: 'Follow Up',
    not_interested: 'Not Interested',
    converted: 'Converted',
    lost: 'Not Interested',
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
