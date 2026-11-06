import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarClock,
  Shield,
  LogOut,
  Mail,
  Inbox,
  CalendarDays,
  MessageCircle,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  User,
  PanelLeftClose,
  PanelLeft,
  List,
  Sparkles,
} from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

const SIDEBAR_COLLAPSED_KEY = 'bmg-crm-sidebar-collapsed';

const TOOL_LINKS = [
  { to: '/email', label: 'Cold email', icon: Mail, perm: 'email:bulk_send' },
  { to: '/campaigns', label: 'Campaigns', icon: ClipboardList, perm: 'email:manage_campaigns' },
  { to: '/email-accounts', label: 'Brevo accounts', icon: Mail, perm: 'email:manage_accounts' },
  { to: '/admin', label: 'Employees', icon: Shield, perm: 'admin:employees' },
];

const INBOUND_PATHS = new Set(['/demos', '/chats', '/email-replies']);
const TOOL_PATHS = new Set(TOOL_LINKS.map((l) => l.to));

function NavSection({ label, open, onToggle, children, forceOpen = false }) {
  const showBody = open || forceOpen;
  return (
    <div className="nav-section">
      <button
        type="button"
        className="nav-section-toggle"
        aria-expanded={showBody}
        onClick={onToggle}
      >
        {showBody ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span>{label}</span>
      </button>
      {showBody ? <div className="nav-section-body">{children}</div> : null}
    </div>
  );
}

export default function AppLayout({ children }) {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [counts, setCounts] = useState(null);
  const [inboundOpen, setInboundOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const profileRef = useRef(null);
  const isChatSupport = user?.role === 'chat_support';

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const inboundPathOpen = INBOUND_PATHS.has(location.pathname);
  const toolsPathOpen = TOOL_PATHS.has(location.pathname);

  useEffect(() => {
    if (inboundPathOpen) setInboundOpen(true);
  }, [inboundPathOpen]);

  useEffect(() => {
    if (toolsPathOpen) setToolsOpen(true);
  }, [toolsPathOpen]);

  useEffect(() => {
    const loadCounts = () => {
      if (isChatSupport) {
        api('/chats/counts')
          .then((c) =>
            setCounts({
              chatsWaitingHuman: c.waitingHuman,
              chatsOpen: c.open,
              chatsMine: c.mine,
            }),
          )
          .catch(() => setCounts(null));
        return;
      }
      api('/leads/counts')
        .then(setCounts)
        .catch(() => setCounts(null));
    };
    loadCounts();
    // Poll so agents see new “Talk to a human” requests without refreshing.
    const timer = setInterval(loadCounts, 10000);
    return () => clearInterval(timer);
  }, [isChatSupport]);

  // Tab title alert when someone is waiting for a human.
  useEffect(() => {
    const waiting = Number(counts?.chatsWaitingHuman || 0);
    const base = 'BMGenie CRM';
    if (waiting > 0) {
      document.title = `(${waiting}) Human chat waiting — ${base}`;
    } else if (document.title.includes('Human chat waiting')) {
      document.title = base;
    }
  }, [counts?.chatsWaitingHuman]);

  useEffect(() => {
    if (!profileOpen) return undefined;
    const onPointerDown = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setProfileOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [profileOpen]);

  const refreshCounts = () => {
    if (isChatSupport) {
      api('/chats/counts')
        .then((c) =>
          setCounts({
            chatsWaitingHuman: c.waitingHuman,
            chatsOpen: c.open,
            chatsMine: c.mine,
          }),
        )
        .catch(() => {});
      return;
    }
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
          : user?.role === 'chat_support'
            ? 'Chat Support'
            : user?.role;

  const sidebarToggleBtn = (
    <button
      type="button"
      className="sidebar-toggle"
      aria-label={sidebarCollapsed ? 'Open sidebar' : 'Minimize sidebar'}
      title={sidebarCollapsed ? 'Open sidebar' : 'Minimize sidebar'}
      onClick={toggleSidebar}
    >
      {sidebarCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
    </button>
  );

  return (
    <div className={`app-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      <aside className="sidebar" aria-label="Main navigation">
        <div className="brand-row">
          <div className="brand">
            <img
              className="brand-logo"
              src="/bmgenie-logo.png"
              alt="bmgenie.ai"
            />
            <span className="brand-ai">.ai</span>
            <span className="brand-crm">CRM</span>
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, overflowY: 'auto' }}>
          <NavLink
            to="/"
            end
            title="Dashboard"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <LayoutDashboard size={18} />
            <span className="nav-label">Dashboard</span>
          </NavLink>

          {isChatSupport ? (
            <NavLink
              to="/chats"
              title="Chats"
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <MessageCircle size={18} />
              <span className="nav-label" style={{ flex: 1 }}>Chats</span>
              {Number(counts?.chatsWaitingHuman || 0) > 0 ? (
                <span
                  className="nav-count"
                  title="Visitors waiting for a human"
                  style={{ background: '#dc2626', color: '#fff' }}
                >
                  {counts.chatsWaitingHuman} need you
                </span>
              ) : counts?.chatsOpen != null ? (
                <span className="nav-count">{counts.chatsOpen}</span>
              ) : null}
            </NavLink>
          ) : (
            <>
              <div className="nav-section-label">Leads</div>
              <NavLink
                to="/leads"
                title="Leads"
                className={({ isActive }) => `nav-link nav-link-sub${isActive ? ' active' : ''}`}
              >
                {sidebarCollapsed ? <List size={18} /> : null}
                <span className="nav-label" style={{ flex: 1 }}>Leads</span>
                {counts?.total != null ? <span className="nav-count">{counts.total}</span> : null}
              </NavLink>
              <NavLink
                to="/follow-ups"
                title="Follow-ups"
                className={({ isActive }) => `nav-link nav-link-sub${isActive ? ' active' : ''}`}
              >
                <CalendarClock size={16} />
                <span className="nav-label" style={{ flex: 1 }}>Follow-ups</span>
              </NavLink>
              <NavLink
                to="/from-bmgenie"
                title="From bmgenie.ai"
                className={({ isActive }) => `nav-link nav-link-sub${isActive ? ' active' : ''}`}
              >
                <Sparkles size={16} />
                <span className="nav-label" style={{ flex: 1 }}>From bmgenie.ai</span>
              </NavLink>

              <NavSection
                label="Inbound"
                open={inboundOpen}
                onToggle={() => setInboundOpen((o) => !o)}
                forceOpen={sidebarCollapsed}
              >
                <NavLink
                  to="/demos"
                  title="Book a demo"
                  className={({ isActive }) => `nav-link nav-link-sub${isActive ? ' active' : ''}`}
                >
                  <CalendarDays size={16} />
                  <span className="nav-label">Book a demo</span>
                </NavLink>
                <NavLink
                  to="/email-replies"
                  title="Email replies"
                  className={({ isActive }) => `nav-link nav-link-sub${isActive ? ' active' : ''}`}
                >
                  <Inbox size={16} />
                  <span className="nav-label">Email replies</span>
                </NavLink>
              </NavSection>

              <NavSection
                label="Tools"
                open={toolsOpen}
                onToggle={() => setToolsOpen((o) => !o)}
                forceOpen={sidebarCollapsed}
              >
                {TOOL_LINKS.filter((l) => !l.perm || can(l.perm)).map((l) => (
                  <NavLink
                    key={l.to}
                    to={l.to}
                    title={l.label}
                    className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                  >
                    <l.icon size={18} />
                    <span className="nav-label">{l.label}</span>
                  </NavLink>
                ))}
              </NavSection>
            </>
          )}
        </nav>

        <button
          type="button"
          className="sidebar-collapse-footer"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Minimize sidebar'}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Minimize sidebar'}
          onClick={toggleSidebar}
        >
          {sidebarCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </aside>
      <div className="content-area">
        <header className="app-topbar">
          <div className="app-topbar-left">
            {/* Re-open control when sidebar is hidden on small screens */}
            {sidebarCollapsed ? sidebarToggleBtn : null}
          </div>
          <div className="profile-menu" ref={profileRef}>
            <button
              type="button"
              className="profile-menu-trigger"
              aria-haspopup="menu"
              aria-expanded={profileOpen}
              aria-label="Account menu"
              onClick={() => setProfileOpen((o) => !o)}
            >
              <User size={18} />
            </button>
            {profileOpen ? (
              <div className="profile-menu-dropdown" role="menu">
                <div className="profile-menu-meta">
                  <strong>{user?.name || '—'}</strong>
                  <span>{roleDisplay}</span>
                </div>
                <button
                  type="button"
                  className="profile-menu-item"
                  role="menuitem"
                  onClick={() => {
                    setProfileOpen(false);
                    logout();
                    navigate('/login');
                  }}
                >
                  <LogOut size={16} /> Sign out
                </button>
              </div>
            ) : null}
          </div>
        </header>
        <main className="main">
          {React.isValidElement(children)
            ? React.cloneElement(children, { refreshSidebarCounts: refreshCounts })
            : children}
        </main>
      </div>
    </div>
  );
}
