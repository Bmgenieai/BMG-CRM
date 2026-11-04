import React from 'react';

const OPTIONS = [
  { key: 'all', label: 'All users' },
  { key: 'new', label: 'New users' },
  { key: 'old', label: 'Old users' },
];

export default function CohortFilter({
  value = 'all',
  onChange,
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
    </div>
  );
}
