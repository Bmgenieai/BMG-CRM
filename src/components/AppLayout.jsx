import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  GitBranch,
  CalendarClock,
  Share2,
  Upload,
  Shield,
  LogOut,
  Mail,
} from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

const TOOL_LINKS = [
  { to: '/distribution', label: 'Distribution', icon: Share2, perm: 'leads:assign' },
  { to: '/follow-ups', label: 'Follow-ups', icon: CalendarClock, perm: null },
  { to: '/email', label: 'Cold email', icon: Mail, perm: null },
  { to: '/working-tree', label: 'Working tree', icon: GitBranch, perm: null },
  { to: '/import', label: 'CSV import', icon: Upload, perm: 'leads:import' },
  { to: '/admin', label: 'Admin', icon: Shield, perm: 'admin:employees' },
];

const STATUS_TABS = [
  { slug: 'new', label: 'New Leads' },
  { slug: 'contacted', label: 'Contacted' },
  { slug: 'interested', label: 'Interested' },
  { slug: 'neutral', label: 'Neutral' },
  { slug: 'follow-up', label: 'Follow Up' },
  { slug: 'not-interested', label: 'Not Interested' },
  { slug: 'converted', label: 'Converted' },
];

const PRODUCT_TABS = [
  { slug: 'signup', label: 'Signup · no purchase' },
  { slug: 'free-credit', label: 'Free credit · no purchase' },
  { slug: 'winback', label: 'Win-back · no repurchase' },
];

function TabLink({ to, label, count, end = false }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `nav-link nav-link-sub${isActive ? ' active' : ''}`}
    >
      <span style={{ flex: 1 }}>{label}</span>
      {count != null ? <span className="nav-count">{count}</span> : null}
    </NavLink>
  );
}

export default function AppLayout({ children }) {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const [counts, setCounts] = useState(null);

  useEffect(() => {
    api('/leads/counts')
      .then(setCounts)
      .catch(() => setCounts(null));
  }, []);

  const refreshCounts = () => {
    api('/leads/counts')
      .then(setCounts)
      .catch(() => {});
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img
            className="brand-logo"
            src="/bmgenie-logo.png"
            alt="bmgenie"
          />
          <span className="brand-crm">CRM</span>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, overflowY: 'auto' }}>
          <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <LayoutDashboard size={18} />
            Dashboard
          </NavLink>

          <div className="nav-section-label">Leads</div>
          <TabLink to="/leads" label="All leads" count={counts?.total} end />
          {STATUS_TABS.map((t) => (
            <TabLink
              key={t.slug}
              to={`/leads/${t.slug}`}
              label={t.label}
              count={counts?.statusCounts?.[t.slug]}
            />
          ))}

          <div className="nav-section-label">From bmgenie.ai</div>
          {PRODUCT_TABS.map((t) => (
            <TabLink
              key={t.slug}
              to={`/leads/${t.slug}`}
              label={t.label}
              count={counts?.productCounts?.[t.slug]}
            />
          ))}

          <div className="nav-section-label">Tools</div>
          {TOOL_LINKS.filter((l) => !l.perm || can(l.perm)).map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <l.icon size={18} />
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="user-chip">
          <strong>{user?.name}</strong>
          <span>{user?.role}</span>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ justifyContent: 'flex-start', paddingLeft: 0 }}
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>
      <main className="main">
        {React.isValidElement(children)
          ? React.cloneElement(children, { refreshSidebarCounts: refreshCounts })
          : children}
      </main>
    </div>
  );
}
