import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Icon, type IconName } from '@carpool/ui';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { useApi } from '../lib/hooks';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  /** Which attention count, if any, sits on this row. */
  badge?: 'pendingEmployees' | 'pendingVehicles';
}

/**
 * The seventeen administrator tabs, in the order the platform contract lists
 * them. Grouping is presentational only — the labels and their sequence are
 * the contract's, and nothing may be added to or removed from this list.
 */
const OPERATIONS: NavItem[] = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: 'chart' },
  { to: '/admin/employees', label: 'Employees', icon: 'users' },
  { to: '/admin/employee-approvals', label: 'Employee Approvals', icon: 'shield', badge: 'pendingEmployees' },
  { to: '/admin/vehicles', label: 'Vehicles', icon: 'car' },
  { to: '/admin/vehicle-approvals', label: 'Vehicle Approvals', icon: 'check', badge: 'pendingVehicles' },
  { to: '/admin/drivers', label: 'Drivers', icon: 'user' },
  { to: '/admin/rides', label: 'Rides', icon: 'route' },
  { to: '/admin/ride-requests', label: 'Ride Requests', icon: 'seat' },
  { to: '/admin/active-trips', label: 'Active Trips', icon: 'play' },
  { to: '/admin/completed-trips', label: 'Completed Trips', icon: 'flag' },
];

const CONFIGURATION: NavItem[] = [
  { to: '/admin/organization', label: 'Organization', icon: 'building' },
  { to: '/admin/costs', label: 'Costs', icon: 'fuel' },
];

const INSIGHT: NavItem[] = [
  { to: '/admin/participation', label: 'Participation', icon: 'trend' },
  { to: '/admin/reports', label: 'Reports', icon: 'list' },
  { to: '/admin/notifications', label: 'Notifications', icon: 'bell' },
  { to: '/admin/audit-logs', label: 'Audit Logs', icon: 'history' },
  { to: '/admin/settings', label: 'Settings', icon: 'settings' },
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
  }, [location.pathname]);

  const close = () => setSidebarOpen(false);

  return (
    <div className={`app-shell ${minimized ? 'is-sidebar-minimized' : ''}`}>
      <aside className={`main-sidebar ${sidebarOpen ? 'is-open' : ''} ${minimized ? 'is-minimized' : ''}`}>
        <div className="main-sidebar__brand">
          <span className="main-sidebar__brand-text">
            <span className="main-sidebar__brand-name">ridesync</span>
            <span className="main-sidebar__brand-sub">
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
