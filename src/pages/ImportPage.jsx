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
      <h1 className="page-title">CSV / Meta import</h1>
      <p className="page-sub">
        Upload a CSV with a header row. Imported leads appear under <strong>All leads</strong> with
        source <strong>CSV / Meta ads</strong> and status <strong>New</strong>.
      </p>

      {error ? <div className="login-error">{error}</div> : null}

      <div className="grid grid-2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Upload</h3>
          <form onSubmit={onSubmit}>
            <div className="field">
              <label className="label">CSV file</label>
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
          <h3 style={{ marginTop: 0 }}>CSV structure</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--muted)', marginTop: 0 }}>
            First row must be column headers. UTF-8 encoding. One lead per row.
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
                  <td>Contact or company name. Also accepts <code>Name</code>, <code>full_name</code>, <code>Full Name</code></td>
                </tr>
                <tr>
                  <td><code>email</code></td>
                  <td>Recommended</td>
                  <td>Also <code>Email</code>. If name is empty, email is used as name</td>
                </tr>
                <tr>
                  <td><code>phone</code></td>
                  <td>No</td>
                  <td>Also <code>Phone</code>, <code>mobile</code></td>
                </tr>
                <tr>
                  <td><code>company</code></td>
                  <td>No</td>
                  <td>Also <code>Company</code></td>
                </tr>
                <tr>
                  <td><code>country</code></td>
                  <td>No</td>
                  <td>Also <code>Country</code> — e.g. US, UK, DE</td>
                </tr>
                <tr>
                  <td><code>estimated_value</code></td>
                  <td>No</td>
                  <td>Also <code>value</code> — number in USD (e.g. 65, 450)</td>
                </tr>
                <tr>
                  <td><code>notes</code></td>
                  <td>No</td>
                  <td>Also <code>Notes</code> — campaign or context</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: 0 }}>
            *Each row needs at least <code>name</code> or <code>email</code>. Rows without both are skipped.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Example CSV</h3>
        <pre
          style={{
            margin: 0,
            padding: '0.75rem',
            background: 'var(--alabaster)',
            borderRadius: 8,
            fontSize: '0.82rem',
            overflow: 'auto',
          }}
        >{`name,email,phone,company,country,estimated_value,notes
Sunset Realty Photos,info@sunsetrealtyphotos.com,+1-602-555-0144,Sunset Realty Photos,US,65,Meta campaign spring
Casa Visual Madrid,hola@casavisual.es,,Casa Visual,ES,450,Meta EU lookalike
Edinburgh Nest Media,hi@edinest.uk,+44-131-555-0190,Edinburgh Nest,UK,65,Lead form`}</pre>
        <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: 0 }}>
          Template file in repo: <code>backend/sample-leads.csv</code>
        </p>
      </div>
    </div>
  );
}
