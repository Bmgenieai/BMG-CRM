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

export function SourceBadge({ source }) {
  return <span className="badge badge-blue">{String(source || '').replace(/_/g, ' ')}</span>;
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
