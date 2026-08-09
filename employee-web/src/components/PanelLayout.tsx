import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ACCOUNT_STATUS } from '@carpool/shared';
import { Alert, Icon, type IconName } from '@carpool/ui';
import { useAuth } from '../lib/auth';
import { usePanelAccess } from '../lib/panels';

export interface PanelNavItem {
  to: string;
  label: string;
  icon: IconName;
  /** Shown in the mobile tab bar. Long labels get a short form. */
  tab?: boolean;
  tabLabel?: string;
  /** Attention count key, resolved by the layout. */
  badge?: 'pendingRequests';
}

/**
 * One shell, two panels. Passenger and Driver each supply their own navigation
 * — the labels and their order come straight from the platform contract and
 * nothing is shared between the two lists, so a driver control can never
 * appear in the passenger panel by accident.
 */
export function PanelLayout({
  panel,
  sectionLabel,
  primaryNav,
  secondaryNav,
  secondaryLabel = 'You',
  pendingRequests = 0,
  notificationsHref,
}: {
  panel: 'passenger' | 'driver';
  sectionLabel: string;
  primaryNav: PanelNavItem[];
  secondaryNav?: PanelNavItem[];
  secondaryLabel?: string;
  pendingRequests?: number;
  notificationsHref: string;
}) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { hasDriverContext, awaitingApproval } = usePanelAccess();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [minimized, setMinimized] = useState(
    () => localStorage.getItem('employee_sidebar_minimized') === 'true',
  );

  const toggleMinimize = () => {
    setMinimized((previous) => {
      const next = !previous;
      localStorage.setItem('employee_sidebar_minimized', String(next));
      return next;
    });
  };

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const suspended = user?.status === ACCOUNT_STATUS.SUSPENDED;
  const counts: Record<string, number> = { pendingRequests };

  const renderNav = (items: PanelNavItem[]): ReactNode =>
    items.map((item) => {
      const count = item.badge ? (counts[item.badge] ?? 0) : 0;
      return (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to.endsWith('/rides')}
          className={({ isActive }) => (isActive ? 'nav-link is-active' : 'nav-link')}
          data-tooltip={minimized ? item.label : undefined}
        >
          <span className="nav-link__icon">
            <Icon name={item.icon} size={16} />
          </span>
          <span className="nav-link__label">{item.label}</span>
          {count > 0 ? <span className="nav-link__badge">{count}</span> : null}
        </NavLink>
      );
    });

  const tabs = primaryNav.filter((item) => item.tab);

  return (
    <div className={`app-shell has-tabbar ${minimized ? 'is-sidebar-minimized' : ''}`}>
      <aside className={`main-sidebar ${sidebarOpen ? 'is-open' : ''} ${minimized ? 'is-minimized' : ''}`}>
        <div className="main-sidebar__brand">
          <span className="main-sidebar__brand-text">
            <span className="main-sidebar__brand-name">ridesync</span>
            <span className="main-sidebar__brand-sub">{user?.organizationName ?? 'Commute'}</span>
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

        {/* The panel switch, not a role switch — the driver side only exists
            once an administrator has approved a vehicle. */}
        <div className="role-mode-container">
          <div className="role-mode-switcher">
            <button
              className={`role-mode-btn ${panel === 'passenger' ? 'is-active' : ''}`}
              onClick={() => navigate('/passenger/home')}
              data-tooltip={minimized ? 'Passenger Panel' : undefined}
            >
              <Icon name="seat" size={15} />
              <span className="role-mode-label">Passenger</span>
            </button>
            <button
              className={`role-mode-btn ${panel === 'driver' ? 'is-active' : ''}`}
              onClick={() => navigate(hasDriverContext ? '/driver/home' : '/driver/vehicle')}
              data-tooltip={minimized ? 'Driver Panel' : undefined}
            >
              <Icon name="car" size={15} />
              <span className="role-mode-label">Driver</span>
            </button>
          </div>
        </div>

        <nav className="main-sidebar__nav" aria-label="Sections">
          <div className="main-sidebar__section">{sectionLabel}</div>
          {renderNav(primaryNav)}

          {secondaryNav && secondaryNav.length > 0 ? (
            <>
              <div className="main-sidebar__section">{secondaryLabel}</div>
              {renderNav(secondaryNav)}
            </>
          ) : null}
        </nav>

        <div className="main-sidebar__footer">
          <NavLink
            to={notificationsHref}
            className={({ isActive }) => (isActive ? 'nav-link is-active' : 'nav-link')}
            data-tooltip={minimized ? 'Notifications' : undefined}
          >
            <span className="nav-link__icon">
              <Icon name="bell" size={16} />
            </span>
            <span className="nav-link__label">Notifications</span>
            {pendingRequests > 0 ? <span className="nav-link__badge">{pendingRequests}</span> : null}
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

      {sidebarOpen ? <div className="sidebar-scrim" onClick={() => setSidebarOpen(false)} /> : null}

      <div className={`main-panel ${minimized ? 'is-sidebar-minimized' : ''}`}>
        <main className="main-content" id="main">
          {suspended ? (
            <Alert tone="warning" className="animate-in">
              Your carpooling access is suspended. You can still view your history, but publishing and
              requesting rides is disabled until an administrator restores access.
            </Alert>
          ) : null}
          {panel === 'driver' && !hasDriverContext ? (
            <Alert tone="info" className="animate-in">
              {awaitingApproval
                ? 'Your vehicle is waiting for administrator approval. Publishing opens as soon as it is approved.'
                : 'Register a vehicle and get it approved to start publishing rides.'}
            </Alert>
          ) : null}
          {/* Keyed on the path so every navigation replays the entrance. */}
          <div className="page" key={location.pathname}>
            <Outlet />
          </div>
        </main>
      </div>

      <nav className="tabbar" aria-label="Primary">
        {tabs.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to.endsWith('/rides')}
            className={({ isActive }) => (isActive ? 'tabbar__link is-active' : 'tabbar__link')}
          >
            <span className="tabbar__icon">
              <Icon name={item.icon} size={18} />
            </span>
            {item.tabLabel ?? item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
