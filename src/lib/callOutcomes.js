export const CALL_OUTCOMES = [
  {
    key: 'no_answer',
    label: 'No Answer',
    shortLabel: 'No Answer',
    connected: false,
    defaultStatus: 'contacted',
    requiresNotes: false,
    showCallback: false,
  },
  {
    key: 'voicemail',
    label: 'Voicemail',
    shortLabel: 'Voicemail',
    connected: false,
    defaultStatus: 'contacted',
    requiresNotes: false,
    showCallback: false,
  },
  {
    key: 'busy_callback',
    label: 'Busy / Call Back Later',
    shortLabel: 'Busy / Callback',
    connected: false,
    defaultStatus: 'contacted',
    requiresNotes: false,
    showCallback: true,
  },
  {
    key: 'wrong_number',
    label: 'Wrong Number',
    shortLabel: 'Wrong Number',
    connected: false,
    defaultStatus: 'nurture',
    requiresNotes: false,
    showCallback: false,
  },
  {
    key: 'connected_not_interested',
    label: 'Connected — Not Interested',
    shortLabel: 'Not Interested',
    connected: true,
    defaultStatus: 'nurture',
    requiresNotes: true,
    showCallback: false,
  },
  {
    key: 'connected_callback',
    label: 'Connected — Follow-up / Callback',
    shortLabel: 'Follow-up / Callback',
    connected: true,
    defaultStatus: 'engaged',
    requiresNotes: true,
    showCallback: true,
  },
  {
    key: 'connected_interested',
    label: 'Connected — Interested / Qualified',
    shortLabel: 'Interested / Qualified',
    connected: true,
    defaultStatus: 'qualified',
    requiresNotes: true,
    showCallback: false,
  },
  {
    key: 'demo_booked',
    label: 'Demo / Meeting Booked',
    shortLabel: 'Demo Booked',
    connected: true,
    defaultStatus: 'demo_scheduled',
    requiresNotes: true,
    showCallback: true,
  },
];

export const CALL_OUTCOME_MAP = Object.fromEntries(CALL_OUTCOMES.map((o) => [o.key, o]));

export function formatCallOutcome(key) {
  if (!key) return '';
  return CALL_OUTCOME_MAP[key]?.label || String(key).replace(/_/g, ' ');
}
