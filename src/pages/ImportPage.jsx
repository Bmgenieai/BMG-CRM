import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { apiUrl, getToken } from '../api.js';
import { useAuth } from '../auth.jsx';

export default function ImportPage() {
  const { can } = useAuth();
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!can('leads:import')) return <Navigate to="/" replace />;

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
      const res = await fetch(apiUrl('/leads/import/csv'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      setResult(data);
      setFile(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1 className="page-title">CSV / Google Sheet import</h1>
      <p className="page-sub">
        Export your Google Sheet as CSV (File → Download → CSV), then upload here. Same columns as
        manual lead generation. Source shows as <strong>CSV / Google Sheet · your name</strong>.
      </p>

      {error ? <div className="login-error">{error}</div> : null}

      <div className="grid grid-2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Upload</h3>
          <form onSubmit={onSubmit}>
            <div className="field">
              <label className="label">CSV file (from Google Sheet)</label>
              <input
                className="input"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={!file || busy}>
              {busy ? 'Importing…' : 'Import leads'}
            </button>
          </form>

          {result ? (
            <div style={{ marginTop: '1rem', fontSize: '0.92rem' }}>
              Imported <strong>{result.imported}</strong> / {result.rowCount} rows
              {result.skipped ? ` · skipped ${result.skipped}` : ''}. Batch {result.batchId}.
            </div>
          ) : null}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Sheet / CSV columns</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--muted)', marginTop: 0 }}>
            First row must be headers. UTF-8. One lead per row. Add employees later in the lead panel.
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
                  <td><code>contact</code></td>
                  <td>No</td>
                  <td>Also <code>phone</code>, <code>Phone</code>, <code>mobile</code></td>
                </tr>
                <tr>
                  <td><code>company</code></td>
                  <td>No</td>
                  <td>Also <code>Company</code>. For employee format = employer name</td>
                </tr>
                <tr>
                  <td><code>industry</code></td>
                  <td>Recommended</td>
                  <td>Also <code>Industry</code>. Required on manual New lead</td>
                </tr>
                <tr>
                  <td><code>contact_format</code></td>
                  <td>No</td>
                  <td><code>company</code> (default) or <code>employee</code></td>
                </tr>
                <tr>
                  <td><code>state</code></td>
                  <td>No</td>
                  <td>Also <code>State</code></td>
                </tr>
                <tr>
                  <td><code>job_title</code></td>
                  <td>No</td>
                  <td>Also <code>Job Title</code>, <code>title</code></td>
                </tr>
                <tr>
                  <td><code>follow_up_notes</code></td>
                  <td>No</td>
                  <td>Also <code>notes</code>, <code>Notes</code></td>
                </tr>
                <tr>
                  <td><code>email</code></td>
                  <td>Recommended</td>
                  <td>Also <code>Email</code></td>
                </tr>
                <tr>
                  <td><code>estimated_revenue</code></td>
                  <td>No</td>
                  <td>Also <code>estimated_value</code>, <code>value</code></td>
                </tr>
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: 0 }}>
            *Each row needs at least <code>name</code> or <code>email</code>.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Example (Google Sheet header row)</h3>
        <pre
          style={{
            margin: 0,
            padding: '0.75rem',
            background: 'var(--alabaster)',
            borderRadius: 8,
            fontSize: '0.82rem',
            overflow: 'auto',
          }}
        >{`name,contact,company,state,job_title,industry,contact_format,follow_up_notes,email,estimated_revenue
Sunset Realty Photos,+1-602-555-0144,Sunset Realty Photos,Arizona,,Real estate photography,company,Called Mon — interested,info@sunset.com,450`}</pre>
        <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: 0 }}>
          Template: <code>backend/sample-leads.csv</code>
        </p>
      </div>
    </div>
  );
}
