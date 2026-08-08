import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { ACCOUNT_STATUS } from '@carpool/shared';
import { Alert, Avatar, Icon, IconButton, type IconName } from '@carpool/ui';
import { useAuth } from '../lib/auth';
import { api, config } from '../lib/api';
import { useApi } from '../lib/hooks';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  tab?: boolean;
}

const NAV: NavItem[] = [
  { to: '/home', label: 'Home', icon: 'home', tab: true },
  { to: '/rides', label: 'Find a ride', icon: 'search', tab: true },
  { to: '/rides/new', label: 'Publish a ride', icon: 'plus' },
  { to: '/my-rides', label: 'My rides', icon: 'car', tab: true },
  { to: '/trips', label: 'Trips', icon: 'route', tab: true },
  { to: '/vehicles', label: 'Vehicles', icon: 'settings' },
  { to: '/wallet', label: 'Wallet', icon: 'wallet' },
];

/**
 * Employee shell: compact sidebar on desktop, bottom tab bar on mobile.
 * Visually lighter than the admin panel — this is a daily mobility app, not an
 * operations console.
 */
export function EmployeeLayout() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Pending seat requests drive the badge on "My rides" and Activity.
  const pending = useApi(() => api.employee.rides.incomingRequests(), [location.pathname]);
  const pendingCount = pending.data?.length ?? 0;

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

  const suspended = user?.status === ACCOUNT_STATUS.SUSPENDED;

  return (
    <div className="app-shell has-tabbar">
      <aside className={sidebarOpen ? 'main-sidebar is-open' : 'main-sidebar'}>
        <div className="main-sidebar__brand">
          <span className="main-sidebar__brand-text">
            <span className="main-sidebar__brand-name">ridesync</span>
            <span className="main-sidebar__brand-sub" title={user?.organizationName}>
              {user?.organizationName ?? 'Commute'}
            </span>
          </span>
        </div>

        <nav className="main-sidebar__nav" aria-label="Sections">
          <div className="main-sidebar__section">Commute</div>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/rides'}
              className={({ isActive }) => (isActive ? 'nav-link is-active' : 'nav-link')}
            >
              <span className="nav-link__icon">
                <Icon name={item.icon} size={16} />
              </span>
              {item.label}
              {item.to === '/my-rides' && pendingCount > 0 ? (
                <span className="nav-link__badge">{pendingCount}</span>
              ) : null}
            </NavLink>
          ))}

          <div className="main-sidebar__section">You</div>
          <NavLink
            to="/activity"
            className={({ isActive }) => (isActive ? 'nav-link is-active' : 'nav-link')}
          >
            <span className="nav-link__icon">
              <Icon name="bell" size={16} />
            </span>
            Activity
            {pendingCount > 0 ? <span className="nav-link__badge">{pendingCount}</span> : null}
          </NavLink>
          <NavLink to="/profile" className={({ isActive }) => (isActive ? 'nav-link is-active' : 'nav-link')}>
            <span className="nav-link__icon">
              <Icon name="user" size={16} />
            </span>
            Profile and settings
          </NavLink>
        </nav>

        <div className="main-sidebar__footer">
          <button className="nav-link" onClick={signOut} style={{ width: '100%' }}>
            <span className="nav-link__icon">
              <Icon name="logout" size={16} />
            </span>
            Sign out
          </button>
        </div>
      </aside>

      {sidebarOpen ? <div className="sidebar-scrim" onClick={() => setSidebarOpen(false)} /> : null}

      <div className="main-panel">
        <header className="topbar">
          <IconButton
            icon="menu"
            label="Open navigation"
            className="topbar__menu"
            onClick={() => setSidebarOpen(true)}
          />
          <span className="topbar__title">{user?.organizationName}</span>
          <span className="grow" />

          <Link className="btn btn-ghost btn-sm" to="/activity" aria-label="Activity">
            <Icon name="bell" size={17} />
            {pendingCount > 0 ? (
              <span className="badge badge--accent badge--plain">{pendingCount}</span>
            ) : null}
          </Link>

          <Link className="btn btn-accent btn-sm" to="/rides/new">
            <Icon name="plus" size={15} />
            Publish
          </Link>

          <div className="dropdown" ref={menuRef}>
            <button className="row" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen}>
              <Avatar name={user?.name ?? 'You'} size="sm" />
              <Icon name="chevronDown" size={14} />
            </button>
            {menuOpen ? (
              <div className="dropdown__menu">
                <div className="dropdown__header">
                  <div className="t-medium">{user?.name}</div>
                  <div className="t-caption">{user?.email}</div>
                </div>
                <Link className="dropdown__item" to="/profile">
                  <Icon name="user" size={15} />
                  Profile and settings
                </Link>
                <Link className="dropdown__item" to="/vehicles">
                  <Icon name="car" size={15} />
                  My vehicles
                </Link>
                <Link className="dropdown__item" to="/wallet">
                  <Icon name="wallet" size={15} />
                  Wallet
                </Link>
                <div className="dropdown__divider" />
                <a className="dropdown__item" href={config.webUrl} target="_blank" rel="noreferrer">
                  <Icon name="external" size={15} />
                  About RideSync
                </a>
                <button className="dropdown__item dropdown__item--danger" onClick={signOut}>
                  <Icon name="logout" size={15} />
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        </header>

        <main className="main-content" id="main">
          {suspended ? (
            <Alert tone="warning" className="animate-in">
              Your carpooling access is suspended. You can still view your history, but publishing and
              requesting rides is disabled until an administrator restores access.
            </Alert>
          ) : null}
          {/* Keyed on the path so every navigation replays the entrance. */}
          <div className="page" key={location.pathname}>
            <Outlet />
          </div>
        </main>
      </div>

      <nav className="tabbar" aria-label="Primary">
        {NAV.filter((item) => item.tab).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/rides'}
            className={({ isActive }) => (isActive ? 'tabbar__link is-active' : 'tabbar__link')}
          >
            <span className="tabbar__icon">
              <Icon name={item.icon} size={18} />
            </span>
            {item.label === 'Find a ride' ? 'Find' : item.label === 'My rides' ? 'Rides' : item.label}
          </NavLink>
        ))}
        <NavLink
          to="/profile"
          className={({ isActive }) => (isActive ? 'tabbar__link is-active' : 'tabbar__link')}
        >
          <span className="tabbar__icon">
            <Icon name="user" size={18} />
          </span>
          Profile
        </NavLink>
      </nav>
    </div>
  );
}
