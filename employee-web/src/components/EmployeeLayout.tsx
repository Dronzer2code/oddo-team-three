import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ACCOUNT_STATUS } from '@carpool/shared';
import { Alert, Icon, type IconName } from '@carpool/ui';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
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
  const [minimized, setMinimized] = useState(() => {
    return localStorage.getItem('employee_sidebar_minimized') === 'true';
  });

  const toggleMinimize = () => {
    setMinimized((prev) => {
      const next = !prev;
      localStorage.setItem('employee_sidebar_minimized', String(next));
      return next;
    });
  };

  // Pending seat requests drive the badge on "My rides" and Activity.
  const pending = useApi(() => api.employee.rides.incomingRequests(), [location.pathname]);
  const pendingCount = pending.data?.length ?? 0;

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const suspended = user?.status === ACCOUNT_STATUS.SUSPENDED;

  return (
    <div className={`app-shell has-tabbar ${minimized ? 'is-sidebar-minimized' : ''}`}>
      <aside className={`main-sidebar ${sidebarOpen ? 'is-open' : ''} ${minimized ? 'is-minimized' : ''}`}>
        <div className="main-sidebar__brand">
          <span className="main-sidebar__brand-text">
            <span className="main-sidebar__brand-name">ridesync</span>
            <span className="main-sidebar__brand-sub">
              {user?.organizationName ?? 'Commute'}
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

        <nav className="main-sidebar__nav" aria-label="Sections">
          <div className="main-sidebar__section">Commute</div>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/rides'}
              className={({ isActive }) => (isActive ? 'nav-link is-active' : 'nav-link')}
              data-tooltip={minimized ? item.label : undefined}
            >
              <span className="nav-link__icon">
                <Icon name={item.icon} size={16} />
              </span>
              <span className="nav-link__label">{item.label}</span>
              {item.to === '/my-rides' && pendingCount > 0 ? (
                <span className="nav-link__badge">{pendingCount}</span>
              ) : null}
            </NavLink>
          ))}

          <div className="main-sidebar__section">You</div>
          <NavLink
            to="/activity"
            className={({ isActive }) => (isActive ? 'nav-link is-active' : 'nav-link')}
            data-tooltip={minimized ? 'Activity' : undefined}
          >
            <span className="nav-link__icon">
              <Icon name="bell" size={16} />
            </span>
            <span className="nav-link__label">Activity</span>
            {pendingCount > 0 ? <span className="nav-link__badge">{pendingCount}</span> : null}
          </NavLink>
          <NavLink
            to="/profile"
            className={({ isActive }) => (isActive ? 'nav-link is-active' : 'nav-link')}
            data-tooltip={minimized ? 'Profile and settings' : undefined}
          >
            <span className="nav-link__icon">
              <Icon name="user" size={16} />
            </span>
            <span className="nav-link__label">Profile and settings</span>
          </NavLink>
        </nav>

        <div className="main-sidebar__footer">
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

      {sidebarOpen ? <div className="sidebar-scrim" onClick={() => setSidebarOpen(false)} /> : null}

      <div className={`main-panel ${minimized ? 'is-sidebar-minimized' : ''}`}>
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
