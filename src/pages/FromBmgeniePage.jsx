import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

const PRODUCT_QUEUE_BOXES = [
  { slug: 'signup', label: 'Signup · no purchase', hint: 'Signed up on bmgenie.ai without buying a package' },
  { slug: 'free-credit', label: 'Free credit · no purchase', hint: 'Used free trial credit, no purchase yet' },
  { slug: 'winback', label: 'Win-back · no repurchase', hint: 'Bought before, credits used up, no repurchase' },
  { slug: 'checkout-abandoned', label: 'Stripe · abandoned', hint: 'Started checkout and left' },
  { slug: 'revisions', label: 'Asked for revisions', hint: 'Requested revisions on product' },
];

export default function FromBmgeniePage() {
  const [productCounts, setProductCounts] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    api('/leads/counts')
      .then((c) => setProductCounts(c.productCounts || {}))
      .catch((e) => setError(e.message || 'Failed to load counts'));
  }, []);

  return (
    <div>
      <h1 className="page-title">From bmgenie.ai</h1>
      <p className="page-sub">
        Product queues from the main site. Click a box to open those leads.
      </p>

      {error ? <div className="login-error">{error}</div> : null}

      <div className="grid grid-5" style={{ gap: '1rem' }}>
        {PRODUCT_QUEUE_BOXES.map((box) => {
          const count = productCounts[box.slug];
          return (
            <Link
              key={box.slug}
              to={`/leads/${box.slug}`}
              className="card queue-box"
              title={`Open ${box.label} in Leads`}
            >
              <p className="stat-label">{box.label}</p>
              <p className="stat-value">{count != null ? count : '—'}</p>
              <p className="stat-hint" style={{ marginBottom: 0 }}>{box.hint}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
