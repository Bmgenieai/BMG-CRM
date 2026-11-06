import React from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import AppLayout from './components/AppLayout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import TelesalesWorkingPage from './pages/TelesalesWorkingPage.jsx';
import LeadsPage from './pages/LeadsPage.jsx';
import LeadDetailPage from './pages/LeadDetailPage.jsx';
import FollowUpsPage from './pages/FollowUpsPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import EmailPage from './pages/EmailPage.jsx';
import EmailRepliesPage from './pages/EmailRepliesPage.jsx';
import EmailAccountsPage from './pages/EmailAccountsPage.jsx';
import CampaignsPage from './pages/CampaignsPage.jsx';
import EmailPerformancePage from './pages/EmailPerformancePage.jsx';
import DemosPage from './pages/DemosPage.jsx';
import ChatsPage from './pages/ChatsPage.jsx';
import FromBmgeniePage from './pages/FromBmgeniePage.jsx';

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

/** Chat Support accounts only use Dashboard + Chats. */
function ChatSupportGate({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (user?.role === 'chat_support') {
    const ok = location.pathname === '/' || location.pathname.startsWith('/chats');
    if (!ok) return <Navigate to="/" replace />;
  }
  return children;
}

function ProtectedLayout() {
  return (
    <Protected>
      <ChatSupportGate>
        <AppLayout>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            {/* Kept for Dashboard “full BD report” deep links; no sidebar tab */}
            <Route path="/telesales-working" element={<TelesalesWorkingPage />} />
            <Route path="/demos" element={<DemosPage />} />
            <Route path="/chats" element={<ChatsPage />} />
            <Route path="/email-replies" element={<EmailRepliesPage />} />
            <Route path="/leads" element={<LeadsPage />} />
            <Route path="/leads/:filter" element={<LeadsPage />} />
            <Route path="/leads/:id" element={<LeadDetailPage />} />
            <Route path="/from-bmgenie" element={<FromBmgeniePage />} />
            <Route path="/follow-ups" element={<FollowUpsPage />} />
            <Route path="/email" element={<EmailPage />} />
            <Route path="/email-performance" element={<EmailPerformancePage />} />
            <Route path="/campaigns" element={<CampaignsPage />} />
            <Route path="/email-accounts" element={<EmailAccountsPage />} />
            <Route path="/admin" element={<AdminPage />} />
            {/* Removed from sidebar — redirect old bookmarks */}
            <Route path="/product-analytics" element={<Navigate to="/" replace />} />
            <Route path="/distribution" element={<Navigate to="/leads" replace />} />
            <Route path="/working-tree" element={<Navigate to="/" replace />} />
            <Route path="/import" element={<Navigate to="/leads" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppLayout>
      </ChatSupportGate>
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
