export function StatusBadge({ status }) {
  const map = {
    uncontacted: 'badge-grey',
    contacted: 'badge-blue',
    engaged: 'badge-amber',
    qualified: 'badge-blue',
    demo_scheduled: 'badge-amber',
    challenge_offered: 'badge-amber',
    challenge_accepted: 'badge-amber',
    trial: 'badge-green',
    paid: 'badge-green',
    repeat: 'badge-green',
    nurture: 'badge-grey',
    // legacy
    conversation: 'badge-amber',
    demo_booked: 'badge-amber',
    lost: 'badge-grey',
    new: 'badge-grey',
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
    uncontacted: 'New / Uncontacted',
    contacted: 'Contacted',
    engaged: 'Engaged / Replied',
    qualified: 'Qualified',
    demo_scheduled: 'Demo scheduled',
    challenge_offered: 'Challenge offered',
    challenge_accepted: 'Challenge accepted',
    trial: 'Test completed',
    paid: 'Paid',
    repeat: 'Repeat / expanded',
    nurture: 'Nurture / DQ',
    conversation: 'Engaged / Replied',
    demo_booked: 'Demo scheduled',
    lost: 'Nurture / DQ',
    new: 'New / Uncontacted',
    contacted_legacy: 'Contacted',
    interested: 'Engaged / Replied',
    converted: 'Paid',
  };
  const label = labels[status] || String(status || '').replace(/_/g, ' ');
  return <span className={`badge ${map[status] || 'badge-grey'}`}>{label}</span>;
}

const SOURCE_LABELS = {
  signup_no_listing: 'Signed up · no purchase',
  free_credit_no_purchase: 'Free credit · no purchase',
  purchased_no_repurchase: 'Credits used · no repurchase',
  checkout_abandoned: 'Stripe · abandoned',
  revision_requested: 'Asked for revisions',
  demo_booking: 'Book a demo',
  chat_support: 'Chat support',
  csv_import: 'CSV / Google Sheet',
  telesales: 'BD',
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

export const FUNNEL_STATUSES = [
  { key: 'uncontacted', label: 'New / Uncontacted' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'engaged', label: 'Engaged / Replied' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'demo_scheduled', label: 'Demo scheduled' },
  { key: 'challenge_offered', label: 'Shoot Challenge offered' },
  { key: 'challenge_accepted', label: 'Shoot Challenge accepted' },
  { key: 'trial', label: 'Test completed' },
  { key: 'paid', label: 'Paid customer' },
  { key: 'repeat', label: 'Repeat / expanded' },
  { key: 'nurture', label: 'Nurture / Disqualified' },
];
