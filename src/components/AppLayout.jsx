import React, { useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  GitBranch,
  CalendarClock,
  Share2,
  Upload,
  Shield,
  LogOut,
  Mail,
  Inbox,
  BarChart3,
  CalendarDays,
  MessageCircle,
  ClipboardList,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

const TOOL_LINKS = [
  { to: '/distribution', label: 'Distribution', icon: Share2, perm: 'leads:assign' },
  { to: '/follow-ups', label: 'Follow-ups', icon: CalendarClock, perm: null },
  { to: '/email', label: 'Cold email', icon: Mail, perm: 'email:bulk_send' },
  { to: '/working-tree', label: 'Working tree', icon: GitBranch, perm: null },
  { to: '/import', label: 'CSV / Sheet import', icon: Upload, perm: 'leads:import' },
  { to: '/admin', label: 'Admin', icon: Shield, perm: 'admin:employees' },
];

const STATUS_TABS = [
  { slug: 'uncontacted', label: 'Uncontacted' },
  { slug: 'contacted', label: 'Contacted' },
  { slug: 'engaged', label: 'Engaged' },
  { slug: 'qualified', label: 'Qualified' },
  { slug: 'demo-scheduled', label: 'Demo scheduled' },
  { slug: 'challenge-offered', label: 'Challenge offered' },
  { slug: 'challenge-accepted', label: 'Challenge accepted' },
  { slug: 'trial', label: 'Test completed' },
  { slug: 'paid', label: 'Paid' },
  { slug: 'repeat', label: 'Repeat' },
  { slug: 'nurture', label: 'Nurture / DQ' },
];

const STATUS_SLUGS = new Set(STATUS_TABS.map((t) => t.slug));

const PRODUCT_TABS = [
  { slug: 'signup', label: 'Signup · no purchase' },
  { slug: 'free-credit', label: 'Free credit · no purchase' },
  { slug: 'winback', label: 'Win-back · no repurchase' },
  { slug: 'checkout-abandoned', label: 'Stripe · abandoned' },
  { slug: 'revisions', label: 'Asked for revisions' },
];

const PRODUCT_SLUGS = new Set(PRODUCT_TABS.map((t) => t.slug));
const INBOUND_PATHS = new Set(['/demos', '/chats', '/email-replies']);
const TOOL_PATHS = new Set(TOOL_LINKS.map((l) => l.to));

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

function NavSection({ label, open, onToggle, children }) {
  return (
    <div className="nav-section">
      <button
        type="button"
        className="nav-section-toggle"
        aria-expanded={open}
        onClick={onToggle}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span>{label}</span>
      </button>
      {open ? <div className="nav-section-body">{children}</div> : null}
    </div>
  );
}

export default function AppLayout({ children }) {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [counts, setCounts] = useState(null);
  const [leadsOpen, setLeadsOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(true);
  const [inboundOpen, setInboundOpen] = useState(true);
  const [toolsOpen, setToolsOpen] = useState(true);

  const statusPathOpen = (() => {
    const m = location.pathname.match(/^\/leads\/([^/]+)/);
    return Boolean(m && STATUS_SLUGS.has(m[1]));
  })();

  const productPathOpen = (() => {
    const m = location.pathname.match(/^\/leads\/([^/]+)/);
    return Boolean(m && PRODUCT_SLUGS.has(m[1]));
  })();

  const inboundPathOpen = INBOUND_PATHS.has(location.pathname);
  const toolsPathOpen = TOOL_PATHS.has(location.pathname);

  useEffect(() => {
    if (statusPathOpen) setLeadsOpen(true);
  }, [statusPathOpen]);

  useEffect(() => {
    if (productPathOpen) setProductOpen(true);
  }, [productPathOpen]);

  useEffect(() => {
    if (inboundPathOpen) setInboundOpen(true);
  }, [inboundPathOpen]);

  useEffect(() => {
    if (toolsPathOpen) setToolsOpen(true);
  }, [toolsPathOpen]);

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

  const roleDisplay =
    user?.role === 'telesales'
      ? 'BD'
      : user?.role === 'ceo'
        ? 'CEO'
        : user?.role === 'manager'
          ? 'Manager'
          : user?.role;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img
            className="brand-logo"
            src="/bmgenie-logo.png"
            alt="bmgenie.ai"
          />
          <span className="brand-ai">.ai</span>
          <span className="brand-crm">CRM</span>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, overflowY: 'auto' }}>
          <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <LayoutDashboard size={18} />
            Dashboard
          </NavLink>

          {can('analytics:view_team') ? (
            <NavLink
              to="/product-analytics"
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <BarChart3 size={18} />
              Product analytics
            </NavLink>
          ) : null}

          <NavLink
            to="/telesales-working"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <ClipboardList size={18} />
            BD working
          </NavLink>

          <div className="nav-section-label">Leads</div>
          <div className="nav-dropdown">
            <div className="nav-dropdown-row">
              <NavLink
                to="/leads"
                end
                className={({ isActive }) =>
                  `nav-link nav-link-sub nav-dropdown-link${isActive && !statusPathOpen ? ' active' : ''}`
                }
                onClick={() => setLeadsOpen(true)}
              >
                <span style={{ flex: 1 }}>All leads</span>
                {counts?.total != null ? <span className="nav-count">{counts.total}</span> : null}
              </NavLink>
              <button
                type="button"
                className="nav-dropdown-toggle"
                aria-expanded={leadsOpen}
                aria-label={leadsOpen ? 'Hide lead statuses' : 'Show lead statuses'}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setLeadsOpen((o) => !o);
                }}
              >
                {leadsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            </div>
            {leadsOpen ? (
              <div className="nav-dropdown-children">
                {STATUS_TABS.map((t) => (
                  <TabLink
                    key={t.slug}
                    to={`/leads/${t.slug}`}
                    label={t.label}
                    count={counts?.statusCounts?.[t.slug]}
                  />
                ))}
              </div>
            ) : null}
          </div>

          <NavSection
            label="From bmgenie.ai"
            open={productOpen}
            onToggle={() => setProductOpen((o) => !o)}
          >
            {PRODUCT_TABS.map((t) => (
              <TabLink
                key={t.slug}
                to={`/leads/${t.slug}`}
                label={t.label}
                count={counts?.productCounts?.[t.slug]}
              />
            ))}
          </NavSection>

          <NavSection
            label="Inbound"
            open={inboundOpen}
            onToggle={() => setInboundOpen((o) => !o)}
          >
            <NavLink
              to="/demos"
              className={({ isActive }) => `nav-link nav-link-sub${isActive ? ' active' : ''}`}
            >
              <CalendarDays size={16} />
              <span style={{ flex: 1 }}>Book a demo</span>
              {counts?.demosCount != null ? (
                <span className="nav-count">{counts.demosCount}</span>
              ) : null}
            </NavLink>
            <NavLink
              to="/chats"
              className={({ isActive }) => `nav-link nav-link-sub${isActive ? ' active' : ''}`}
            >
              <MessageCircle size={16} />
              <span style={{ flex: 1 }}>Chat support</span>
              {counts?.chatsOpen != null ? (
                <span className="nav-count">{counts.chatsOpen}</span>
              ) : null}
            </NavLink>
            <NavLink
              to="/email-replies"
              className={({ isActive }) => `nav-link nav-link-sub${isActive ? ' active' : ''}`}
            >
              <Inbox size={16} />
              <span style={{ flex: 1 }}>Email replies</span>
              {counts?.emailRepliesUnread != null ? (
                <span className="nav-count">{counts.emailRepliesUnread}</span>
              ) : null}
            </NavLink>
          </NavSection>

          <NavSection
            label="Tools"
            open={toolsOpen}
            onToggle={() => setToolsOpen((o) => !o)}
          >
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
          </NavSection>
        </nav>

        <div className="user-chip">
          <strong>{user?.name}</strong>
          <span>{roleDisplay}</span>
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
