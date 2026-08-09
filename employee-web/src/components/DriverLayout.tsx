import { PanelLayout, type PanelNavItem } from './PanelLayout';
import { api } from '../lib/api';
import { useApi } from '../lib/hooks';

/**
 * Driver navigation, exactly as the platform contract lists it:
 *
 *   Home · My Vehicle · Publish Ride · My Rides · Requests ·
 *   Active Trip · Trip History · Profile
 */
const PRIMARY: PanelNavItem[] = [
  { to: '/driver/home', label: 'Home', icon: 'home', tab: true },
  { to: '/driver/vehicle', label: 'My Vehicle', icon: 'car', tab: true, tabLabel: 'Vehicle' },
  { to: '/driver/rides/new', label: 'Publish Ride', icon: 'plus' },
  { to: '/driver/rides', label: 'My Rides', icon: 'route', tab: true, tabLabel: 'Rides' },
  { to: '/driver/requests', label: 'Requests', icon: 'seat', tab: true, badge: 'pendingRequests' },
  { to: '/driver/active-trip', label: 'Active Trip', icon: 'play' },
  { to: '/driver/history', label: 'Trip History', icon: 'history' },
  { to: '/driver/profile', label: 'Profile', icon: 'user', tab: true },
];

export function DriverLayout() {
  // The pending queue drives the badge on Requests, so it has to be live.
  const pending = useApi(() => api.employee.rides.incomingRequests(), []);

  return (
    <PanelLayout
      panel="driver"
      sectionLabel="Driver Panel"
      primaryNav={PRIMARY}
      pendingRequests={pending.data?.length ?? 0}
      notificationsHref="/driver/notifications"
    />
  );
}
