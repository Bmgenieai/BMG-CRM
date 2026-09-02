import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import AppLayout from './components/AppLayout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import LeadsPage from './pages/LeadsPage.jsx';
import LeadDetailPage from './pages/LeadDetailPage.jsx';
import DistributionPage from './pages/DistributionPage.jsx';
import FollowUpsPage from './pages/FollowUpsPage.jsx';
import WorkingTreePage from './pages/WorkingTreePage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import ImportPage from './pages/ImportPage.jsx';
import EmailPage from './pages/EmailPage.jsx';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="login-page">
        <div className="card">Loading BMGenie CRM…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function ProtectedLayout() {
  return (
    <Protected>
      <AppLayout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/leads/:filter" element={<LeadsPage />} />
          <Route path="/leads/:id" element={<LeadDetailPage />} />
          <Route path="/distribution" element={<DistributionPage />} />
          <Route path="/follow-ups" element={<FollowUpsPage />} />
          <Route path="/email" element={<EmailPage />} />
          <Route path="/working-tree" element={<WorkingTreePage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
    </Protected>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={<ProtectedLayout />} />
    </Routes>
  );
}
