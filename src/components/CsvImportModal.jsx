import React, { useState } from 'react';
import { apiUrl, getToken } from '../api.js';
import { useAuth } from '../auth.jsx';

function todayLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function CsvImportModal({ onClose, onImported }) {
  const { user } = useAuth();
  const [file, setFile] = useState(null);
  const [dateAdded, setDateAdded] = useState(() => todayLocal());
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isTelesales = user?.role === 'telesales';
  const sourcePreview = isTelesales ? 'BD' : 'CSV / Google Sheet';

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('source_label', 'csv_import');
      if (dateAdded) fd.append('date_added', dateAdded);
      const res = await fetch(apiUrl('/leads/import/csv'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      setResult(data);
      setFile(null);
      onImported?.(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal"
        style={{ width: 'min(720px, 100%)' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="CSV import"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <h3 style={{ marginBottom: 4 }}>Import leads from CSV</h3>
            <p className="page-sub" style={{ margin: 0 }}>
              Export Google Sheet as CSV, then upload. Source shows as{' '}
              <strong>
                {sourcePreview} · {user?.name || 'your name'}
              </strong>
              .
            </p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {error ? <div className="login-error" style={{ marginTop: '0.75rem' }}>{error}</div> : null}

        <form onSubmit={onSubmit} style={{ marginTop: '1rem' }}>
          <div className="field">
            <label className="label">CSV file</label>
            <input
              className="input"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </div>
          <div
            className="field"
            style={{
              padding: '0.85rem',
              background: 'var(--brand-soft)',
              borderRadius: 8,
              border: '1px solid var(--border)',
            }}
          >
            <label className="label">Import date</label>
            <input
              className="input"
              type="date"
              required
              value={dateAdded}
              onChange={(e) => setDateAdded(e.target.value)}
            />
            <p className="stat-hint" style={{ marginTop: 8, marginBottom: 0 }}>
              Tags this batch so you can filter by upload date on All leads / Cold email.
            </p>
          </div>
          <button className="btn btn-primary" type="submit" disabled={!file || busy}>
            {busy ? 'Importing…' : 'Import leads'}
          </button>
        </form>

        {result ? (
          <div style={{ marginTop: '0.85rem', fontSize: '0.92rem' }}>
            Imported <strong>{result.imported}</strong> / {result.rowCount} rows
            {result.skipped ? ` · skipped ${result.skipped}` : ''}
            {result.duplicates ? ` · duplicates ${result.duplicates}` : ''}. Batch {result.batchId}
            {result.dateAdded ? ` · Date added ${String(result.dateAdded).slice(0, 10)}` : ''}.
          </div>
        ) : null}

        <div style={{ marginTop: '1.25rem' }}>
          <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>Required format</h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: 0 }}>
            First row = headers. UTF-8. One lead per row. Each row needs at least <code>name</code> or{' '}
            <code>email</code>.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Column</th>
                  <th>Required</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>name</code></td>
                  <td>Yes*</td>
                  <td>Also <code>Name</code>, <code>full_name</code></td>
                </tr>
                <tr>
                  <td><code>email</code></td>
                  <td>Recommended</td>
                  <td>Also <code>Email</code></td>
                </tr>
                <tr>
                  <td><code>contact</code></td>
                  <td>No</td>
                  <td>Phone / mobile</td>
                </tr>
                <tr>
                  <td><code>company</code></td>
                  <td>No</td>
                  <td>Employer name for employee format</td>
                </tr>
                <tr>
                  <td><code>industry</code></td>
                  <td>Recommended</td>
                  <td>Required on manual New lead</td>
                </tr>
                <tr>
                  <td><code>state</code></td>
                  <td>No</td>
                  <td>US state</td>
                </tr>
                <tr>
                  <td><code>business_type</code></td>
                  <td>No</td>
                  <td>
                    <code>realtor</code>, <code>agency</code>, <code>photographer</code>, etc.
                  </td>
                </tr>
                <tr>
                  <td><code>job_title</code></td>
                  <td>No</td>
                  <td>Also <code>title</code></td>
                </tr>
                <tr>
                  <td><code>contact_format</code></td>
                  <td>No</td>
                  <td><code>company</code> (default) or <code>employee</code></td>
                </tr>
                <tr>
                  <td><code>follow_up_notes</code></td>
                  <td>No</td>
                  <td>Also <code>notes</code></td>
                </tr>
                <tr>
                  <td><code>estimated_revenue</code></td>
                  <td>No</td>
                  <td>Also <code>value</code></td>
                </tr>
              </tbody>
            </table>
          </div>
          <pre
            style={{
              margin: '0.75rem 0 0',
              padding: '0.75rem',
              background: 'var(--alabaster)',
              borderRadius: 8,
              fontSize: '0.75rem',
              overflow: 'auto',
            }}
          >{`name,contact,company,state,job_title,industry,business_type,contact_format,follow_up_notes,email,estimated_revenue
Sunset Realty Photos,+1-602-555-0144,Sunset Realty Photos,Arizona,,Real estate photography,photographer,company,Called Mon — interested,info@sunset.com,450`}</pre>
        </div>
      </div>
    </div>
  );
}
