import React from 'react';

const OPTIONS = [
  { key: 'all', label: 'All users' },
  { key: 'new', label: 'New users' },
  { key: 'old', label: 'Old users' },
];

/**
 * New = first signup on the selected/reference calendar day only.
 * From the next day they count as old.
 */
export default function CohortFilter({
  value = 'all',
  onChange,
  hint = true,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div className="segmented" role="group" aria-label="User cohort">
        {OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            className={`segmented-btn${value === opt.key ? ' active' : ''}`}
            onClick={() => onChange?.(opt.key)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {hint ? (
        <p className="stat-hint" style={{ margin: 0 }}>
          New = signed up that calendar day only. Next day they become old users.
        </p>
      ) : null}
    </div>
  );
}
