import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getToken } from '../api.js';
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
      const res = await fetch('/api/leads/import/csv', {
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
        Upload Meta ads or campaign exports. Columns: name, email, phone, company, country,
        estimated_value, notes.
      </p>

      {error ? <div className="login-error">{error}</div> : null}

      <div className="card" style={{ maxWidth: 560 }}>
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

        <p style={{ marginTop: '1.25rem', color: 'var(--muted)', fontSize: '0.85rem' }}>
          Sample file available in repo: <code>backend/sample-leads.csv</code>
        </p>
      </div>
    </div>
  );
}
