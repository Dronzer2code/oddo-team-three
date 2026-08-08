import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Avatar, Icon, IconButton, type IconName } from '@carpool/ui';
import { useAuth } from '../lib/auth';
import { api, config } from '../lib/api';
import { useApi } from '../lib/hooks';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  /** Which attention count, if any, sits on this row. */
  badge?: 'pendingEmployees' | 'pendingVehicles';
}

const OPERATIONS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: 'chart' },
  { to: '/employees', label: 'Employees', icon: 'users', badge: 'pendingEmployees' },
  { to: '/invitations', label: 'Invitations', icon: 'mail' },
  { to: '/vehicles', label: 'Vehicles', icon: 'car', badge: 'pendingVehicles' },
  { to: '/drivers', label: 'Drivers', icon: 'user' },
];

const CONFIGURATION: NavItem[] = [
  { to: '/organization', label: 'Organization', icon: 'building' },
  { to: '/costs', label: 'Costs', icon: 'fuel' },
];

const INSIGHT: NavItem[] = [
  { to: '/participation', label: 'Participation', icon: 'trend' },
  { to: '/reports', label: 'Reports', icon: 'list' },
  { to: '/audit-logs', label: 'Audit logs', icon: 'history' },
];

function NavSection({
  title,
  items,
  minimized,
  counts,
  onNavigate,
}: {
  title: string;
  items: NavItem[];
  minimized: boolean;
  counts: Record<string, number>;
  onNavigate: () => void;
}) {
  return (
    <>
      <div className="main-sidebar__section">{title}</div>
      {items.map((item) => {
        const count = item.badge ? (counts[item.badge] ?? 0) : 0;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => (isActive ? 'nav-link is-active' : 'nav-link')}
            onClick={onNavigate}
            data-tooltip={minimized ? item.label : undefined}
          >
            <span className="nav-link__icon">
              <Icon name={item.icon} size={16} />
            </span>
            <span className="nav-link__label">{item.label}</span>
            {count > 0 ? <span className="nav-link__badge">{count}</span> : null}
          </NavLink>
        );
      })}
    </>
  );
}

/**
 * Admin shell. Structurally the same as the employee shell — collapsible
 * sidebar with tooltips when narrowed, attention badges on the rows that need
 * a decision, sign out reachable without opening a menu — but it keeps the
 * topbar, because an operations console needs breadcrumb space and a visible
 * link across to the employee app.
 */
export function AdminLayout() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [minimized, setMinimized] = useState(
    () => localStorage.getItem('admin_sidebar_minimized') === 'true',
  );

  const toggleMinimize = () => {
    setMinimized((previous) => {
      const next = !previous;
      localStorage.setItem('admin_sidebar_minimized', String(next));
      return next;
    });
  };

  // Employees waiting for activation and vehicles waiting for review are the
  // two things an administrator is expected to clear, so they get the badges.
  const summary = useApi(() => api.admin.dashboard.summary(), [location.pathname]);
  const counts = {
    pendingEmployees: summary.data?.employees.pending ?? 0,
    pendingVehicles: summary.data?.vehicles.underReview ?? 0,
  };

  useEffect(() => {
    setSidebarOpen(false);
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const close = () => setSidebarOpen(false);

  return (
    <div className={`app-shell ${minimized ? 'is-sidebar-minimized' : ''}`}>
      <aside className={`main-sidebar ${sidebarOpen ? 'is-open' : ''} ${minimized ? 'is-minimized' : ''}`}>
        <div className="main-sidebar__brand">
          <span className="main-sidebar__brand-text">
            <span className="main-sidebar__brand-name">ridesync</span>
            <span className="main-sidebar__brand-sub" title={user?.organizationName}>
              {user?.organizationName ?? 'Administration'}
            </span>
          </span>
          <button
            className="main-sidebar__toggle"
            onClick={toggleMinimize}
            aria-label={minimized ? 'Expand menu' : 'Minimize menu'}
            data-tooltip={minimized ? 'Expand menu' : 'Minimize menu'}
          >
            <Icon name="menu" size={18} />
          </button>
        </div>

        <nav className="main-sidebar__nav" aria-label="Admin sections">
          <NavSection
            title="Operations"
            items={OPERATIONS}
            minimized={minimized}
            counts={counts}
            onNavigate={close}
          />
          <NavSection
            title="Configuration"
            items={CONFIGURATION}
            minimized={minimized}
            counts={counts}
            onNavigate={close}
          />
          <NavSection
            title="Insight"
            items={INSIGHT}
            minimized={minimized}
            counts={counts}
            onNavigate={close}
          />
        </nav>

        <div className="main-sidebar__footer">
          <NavLink
            to="/settings"
            className={({ isActive }) => (isActive ? 'nav-link is-active' : 'nav-link')}
            onClick={close}
            data-tooltip={minimized ? 'Admin settings' : undefined}
          >
            <span className="nav-link__icon">
              <Icon name="settings" size={16} />
            </span>
            <span className="nav-link__label">Admin settings</span>
          </NavLink>
          <button
            className="nav-link"
            onClick={signOut}
            style={{ width: '100%' }}
            data-tooltip={minimized ? 'Sign out' : undefined}
          >
            <span className="nav-link__icon">
              <Icon name="logout" size={16} />
            </span>
            <span className="nav-link__label">Sign out</span>
          </button>
        </div>
      </aside>

      {sidebarOpen ? <div className="sidebar-scrim" onClick={close} /> : null}

      <div className={`main-panel ${minimized ? 'is-sidebar-minimized' : ''}`}>
        <header className="topbar">
          <IconButton
            icon="menu"
            label="Open navigation"
            className="topbar__menu"
            onClick={() => setSidebarOpen(true)}
          />

          <span className="topbar__title">Administration</span>

          <span className="grow" />

          <a
            className="btn btn-ghost btn-sm topbar__optional"
            href={config.employeeUrl}
            target="_blank"
            rel="noreferrer"
          >
            Employee app
            <Icon name="external" size={13} />
          </a>

          <div className="dropdown" ref={menuRef}>
            <button className="row" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen}>
              <Avatar name={user?.name ?? 'Admin'} size="sm" ink />
              <span className="t-caption t-medium topbar__optional">{user?.name}</span>
              <Icon name="chevronDown" size={14} />
            </button>
            {menuOpen ? (
              <div className="dropdown__menu">
                <div className="dropdown__header">
                  <div className="t-medium">{user?.name}</div>
                  <div className="t-caption">{user?.email}</div>
                </div>
                <Link className="dropdown__item" to="/settings">
                  <Icon name="settings" size={15} />
                  Admin settings
                </Link>
                <Link className="dropdown__item" to="/organization">
                  <Icon name="building" size={15} />
                  Organization
                </Link>
                <div className="dropdown__divider" />
                <button className="dropdown__item dropdown__item--danger" onClick={signOut}>
                  <Icon name="logout" size={15} />
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        </header>

        <main className="main-content" id="main">
          {/* Keyed on the path so every navigation replays the entrance. */}
          <div className="page" key={location.pathname}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
