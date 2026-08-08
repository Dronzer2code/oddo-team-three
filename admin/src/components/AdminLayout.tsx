import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Avatar, Icon, IconButton, type IconName } from '@carpool/ui';
import { useAuth } from '../lib/auth';
import { config } from '../lib/api';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
}

const OPERATIONS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: 'chart' },
  { to: '/employees', label: 'Employees', icon: 'users' },
  { to: '/invitations', label: 'Invitations', icon: 'mail' },
  { to: '/vehicles', label: 'Vehicles', icon: 'car' },
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

function NavSection({ title, items, onNavigate }: { title: string; items: NavItem[]; onNavigate: () => void }) {
  return (
    <>
      <div className="main-sidebar__section">{title}</div>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => (isActive ? 'nav-link is-active' : 'nav-link')}
          onClick={onNavigate}
        >
          <span className="nav-link__icon">
            <Icon name={item.icon} size={16} />
          </span>
          {item.label}
        </NavLink>
      ))}
    </>
  );
}

export function AdminLayout() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
    <div className="app-shell">
      <aside className={sidebarOpen ? 'main-sidebar is-open' : 'main-sidebar'}>
        <div className="main-sidebar__brand">
          <span className="main-sidebar__brand-mark">
            <Icon name="logo" size={16} />
          </span>
          <span className="main-sidebar__brand-text">
            <span className="main-sidebar__brand-name">{user?.organizationName ?? 'RideSync'}</span>
            <span className="main-sidebar__brand-sub">Operations</span>
          </span>
        </div>

        <nav className="main-sidebar__nav" aria-label="Admin sections">
          <NavSection title="Operations" items={OPERATIONS} onNavigate={close} />
          <NavSection title="Configuration" items={CONFIGURATION} onNavigate={close} />
          <NavSection title="Insight" items={INSIGHT} onNavigate={close} />
        </nav>

        <div className="main-sidebar__footer">
          <NavLink
            to="/settings"
            className={({ isActive }) => (isActive ? 'nav-link is-active' : 'nav-link')}
            onClick={close}
          >
            <span className="nav-link__icon">
              <Icon name="settings" size={16} />
            </span>
            Admin settings
          </NavLink>
        </div>
      </aside>

      {sidebarOpen ? <div className="sidebar-scrim" onClick={close} /> : null}

      <div className="main-panel">
        <header className="topbar">
          <IconButton
            icon="menu"
            label="Open navigation"
            className="topbar__menu"
            onClick={() => setSidebarOpen(true)}
          />

          <span className="topbar__title">Administration</span>

          <span className="grow" />

          <a className="btn btn-ghost btn-sm" href={config.employeeUrl} target="_blank" rel="noreferrer">
            Employee app
            <Icon name="external" size={13} />
          </a>

          <div className="dropdown" ref={menuRef}>
            <button className="row" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen}>
              <Avatar name={user?.name ?? 'Admin'} size="sm" ink />
              <span className="t-caption t-medium">{user?.name}</span>
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
          <Outlet />
        </main>
      </div>
    </div>
  );
}
