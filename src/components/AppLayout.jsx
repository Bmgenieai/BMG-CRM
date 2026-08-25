import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  GitBranch,
  CalendarClock,
  Share2,
  Upload,
  Shield,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../auth.jsx';

const LINKS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, perm: null },
  { to: '/leads', label: 'Leads', icon: Users, perm: null },
  { to: '/distribution', label: 'Distribution', icon: Share2, perm: 'leads:assign' },
  { to: '/follow-ups', label: 'Follow-ups', icon: CalendarClock, perm: null },
  { to: '/working-tree', label: 'Working tree', icon: GitBranch, perm: null },
  { to: '/import', label: 'CSV import', icon: Upload, perm: 'leads:import' },
  { to: '/admin', label: 'Admin', icon: Shield, perm: 'admin:employees' },
];

export default function AppLayout({ children }) {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">bm</div>
          <div>
            <div className="brand-text">
              <span>bmgenie</span>.ai
              <span className="brand-badge">CRM</span>
            </div>
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {LINKS.filter((l) => !l.perm || can(l.perm)).map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
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
      <main className="main">{children}</main>
    </div>
  );
}
