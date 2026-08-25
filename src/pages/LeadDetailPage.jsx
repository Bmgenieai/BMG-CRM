import React from 'react';
import { Navigate, useParams } from 'react-router-dom';

/** Legacy full-page URL → open Ilaan-style drawer on the leads list. */
export default function LeadDetailPage() {
  const { id } = useParams();
  if (!id) return <Navigate to="/leads" replace />;
  return <Navigate to={`/leads?id=${encodeURIComponent(id)}`} replace />;
}
