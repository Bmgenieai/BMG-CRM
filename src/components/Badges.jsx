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
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  instagram: 'Instagram',
  manual: 'Manual',
};

export function SourceBadge({ source, createdByName }) {
  const label = SOURCE_LABELS[source] || String(source || '').replace(/_/g, ' ');
  const text = createdByName ? `${label} · ${createdByName}` : label;
  const colorMap = {
    linkedin: 'badge-blue',
    facebook: 'badge-blue',
    instagram: 'badge-amber',
    telesales: 'badge-blue',
  };
  const cls = colorMap[source] || 'badge-blue';
  return <span className={`badge ${cls}`}>{text}</span>;
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

export const BUSINESS_TYPE_LABELS = {
  realtor: 'Realtor / Agent',
  real_estate_owner: 'Real estate owner',
  agency: 'Agency / Brokerage',
  photographer: 'Photographer',
  individual: 'Individual',
  other: 'Other',
};

/** US states for lead geography (BD outreach is often state-based). */
export const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
  { code: 'DC', name: 'Washington DC' },
];

export function BusinessTypeBadge({ type }) {
  if (!type) return null;
  const label = BUSINESS_TYPE_LABELS[type] || String(type).replace(/_/g, ' ');
  const colorMap = {
    realtor: 'badge-blue',
    real_estate_owner: 'badge-purple',
    agency: 'badge-amber',
    photographer: 'badge-pink',
    individual: 'badge-green',
    other: 'badge-grey',
  };
  return <span className={`badge ${colorMap[type] || 'badge-grey'}`}>{label}</span>;
}

export function StateBadge({ state }) {
  if (!state || !String(state).trim()) return null;
  const raw = String(state).trim();
  const upper = raw.toUpperCase();
  const match =
    US_STATES.find((s) => s.code === upper) ||
    US_STATES.find((s) => s.name.toLowerCase() === raw.toLowerCase());
  const label = match ? `${match.code}` : raw;
  const title = match ? match.name : raw;
  return (
    <span className="badge badge-grey" title={title} style={{ fontWeight: 600 }}>
      {label}
    </span>
  );
}

