import { PanelLayout, type PanelNavItem } from './PanelLayout';
import { api } from '../lib/api';
import { useApi } from '../lib/hooks';

/**
 * Passenger navigation, exactly as the platform contract lists it:
 *
 *   Home · Find a Ride · My Bookings · Wallet / Trip Costs · Profile
 *
 * plus the four optional pages. The Wallet tab is only called "Wallet" when
 * payment records exist — otherwise the contract requires it be named
 * "Trip Costs", so the label follows the data.
 */
const PRIMARY: PanelNavItem[] = [
  { to: '/passenger/home', label: 'Home', icon: 'home', tab: true },
  { to: '/passenger/rides', label: 'Find a Ride', icon: 'search', tab: true, tabLabel: 'Find' },
  { to: '/passenger/bookings', label: 'My Bookings', icon: 'seat', tab: true, tabLabel: 'Bookings' },
];

const OPTIONAL: PanelNavItem[] = [
  { to: '/passenger/live-trip', label: 'Live Trip', icon: 'pin' },
  { to: '/passenger/history', label: 'History', icon: 'history' },
  { to: '/passenger/notifications', label: 'Notifications', icon: 'bell' },
  { to: '/passenger/help', label: 'Help & Safety', icon: 'shield' },
];

export function PassengerLayout() {
  // Whether any money has actually moved decides the tab's name.
  const wallet = useApi(() => api.employee.payments.wallet(), []);
  const hasPayments = (wallet.data?.payments.length ?? 0) > 0;

  const primary: PanelNavItem[] = [
    ...PRIMARY,
    {
      to: '/passenger/wallet',
      label: hasPayments ? 'Wallet' : 'Trip Costs',
      icon: 'wallet',
      tab: true,
      tabLabel: hasPayments ? 'Wallet' : 'Costs',
    },
    { to: '/passenger/profile', label: 'Profile', icon: 'user', tab: true },
  ];

  return (
    <PanelLayout
      panel="passenger"
      sectionLabel="Passenger Panel"
      primaryNav={primary}
      secondaryNav={OPTIONAL}
      secondaryLabel="More"
      notificationsHref="/passenger/notifications"
    />
  );
}
