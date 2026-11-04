import React, { useEffect, useRef, useState } from 'react';
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
  Linkedin,
  Facebook,
  Instagram,
  User,
  PanelLeftClose,
  PanelLeft,
  List,
} from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

const SIDEBAR_COLLAPSED_KEY = 'bmg-crm-sidebar-collapsed';

const TOOL_LINKS = [
  { to: '/distribution', label: 'Distribution', icon: Share2, perm: 'leads:assign' },
  { to: '/follow-ups', label: 'Follow-ups', icon: CalendarClock, perm: null },
  { to: '/email', label: 'Cold email', icon: Mail, perm: 'email:bulk_send' },
  { to: '/email-performance', label: 'My email stats', icon: BarChart3, perm: 'email:bulk_send' },
  { to: '/campaigns', label: 'Campaigns', icon: ClipboardList, perm: 'email:manage_campaigns' },
  { to: '/email-accounts', label: 'Email accounts', icon: Mail, perm: 'email:manage_accounts' },
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
const SOCIAL_SLUGS = new Set(['linkedin', 'facebook', 'instagram']);

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
      title={label}
      className={({ isActive }) => `nav-link nav-link-sub${isActive ? ' active' : ''}`}
    >
      <span className="nav-label" style={{ flex: 1 }}>{label}</span>
      {count != null ? <span className="nav-count">{count}</span> : null}
    </NavLink>
  );
}

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
  const [leadsOpen, setLeadsOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
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
              {can('analytics:view_team') ? (
                <NavLink
                  to="/product-analytics"
                  title="Product analytics"
                  className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                >
                  <BarChart3 size={18} />
                  <span className="nav-label">Product analytics</span>
                </NavLink>
              ) : null}

              <NavLink
                to="/telesales-working"
                title="BD working"
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                <ClipboardList size={18} />
                <span className="nav-label">BD working</span>
              </NavLink>

              <div className="nav-section-label">Leads</div>
              <div className="nav-dropdown">
                <div className="nav-dropdown-row">
                  <NavLink
                    to="/leads"
                    end
                    title="All leads"
                    className={({ isActive }) =>
                      `nav-link nav-link-sub nav-dropdown-link${isActive && !statusPathOpen ? ' active' : ''}`
                    }
                    onClick={() => setLeadsOpen(true)}
                  >
                    {sidebarCollapsed ? <List size={18} /> : null}
                    <span className="nav-label" style={{ flex: 1 }}>All leads</span>
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

              <NavLink
                to="/leads/linkedin"
                title="LinkedIn leads"
                className={({ isActive }) => `nav-link nav-link-sub${isActive ? ' active' : ''}`}
              >
                <Linkedin size={16} />
                <span className="nav-label" style={{ flex: 1 }}>LinkedIn leads</span>
                {counts?.socialCounts?.linkedin != null ? (
                  <span className="nav-count">{counts.socialCounts.linkedin}</span>
                ) : null}
              </NavLink>

              <NavLink
                to="/leads/facebook"
                title="Facebook leads"
                className={({ isActive }) => `nav-link nav-link-sub${isActive ? ' active' : ''}`}
              >
                <Facebook size={16} />
                <span className="nav-label" style={{ flex: 1 }}>Facebook leads</span>
                {counts?.socialCounts?.facebook != null ? (
                  <span className="nav-count">{counts.socialCounts.facebook}</span>
                ) : null}
              </NavLink>

              <NavLink
                to="/leads/instagram"
                title="Instagram leads"
                className={({ isActive }) => `nav-link nav-link-sub${isActive ? ' active' : ''}`}
              >
                <Instagram size={16} />
                <span className="nav-label" style={{ flex: 1 }}>Instagram leads</span>
                {counts?.socialCounts?.instagram != null ? (
                  <span className="nav-count">{counts.socialCounts.instagram}</span>
                ) : null}
              </NavLink>

              {!sidebarCollapsed ? (
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
              ) : null}

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
                  <span className="nav-label" style={{ flex: 1 }}>Book a demo</span>
                  {counts?.demosCount != null ? (
                    <span className="nav-count">{counts.demosCount}</span>
                  ) : null}
                </NavLink>
                <NavLink
                  to="/chats"
                  title="Chat support"
                  className={({ isActive }) => `nav-link nav-link-sub${isActive ? ' active' : ''}`}
                >
                  <MessageCircle size={16} />
                  <span className="nav-label" style={{ flex: 1 }}>Chat support</span>
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
                <NavLink
                  to="/email-replies"
                  title="Email replies"
                  className={({ isActive }) => `nav-link nav-link-sub${isActive ? ' active' : ''}`}
                >
                  <Inbox size={16} />
                  <span className="nav-label" style={{ flex: 1 }}>Email replies</span>
                  {counts?.emailRepliesCount != null ? (
                    <span className="nav-count">{counts.emailRepliesCount}</span>
                  ) : null}
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
