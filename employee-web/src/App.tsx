import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireEmployee } from './lib/auth';
import { PanelAccessProvider } from './lib/panels';
import { PassengerLayout } from './components/PassengerLayout';
import { DriverLayout } from './components/DriverLayout';

import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { InvitePage } from './features/auth/InvitePage';
import { OnboardingPage } from './features/onboarding/OnboardingPage';
import { ProfilePage } from './features/profile/ProfilePage';
import { NotFoundPage } from './features/NotFoundPage';

import { PassengerHomePage } from './features/passenger/HomePage';
import { FindRidePage } from './features/passenger/FindRidePage';
import { PassengerRideDetailPage } from './features/passenger/RideDetailPage';
import { BookingsPage } from './features/passenger/BookingsPage';
import { BookingDetailPage } from './features/passenger/BookingDetailPage';
import { LiveTripPage } from './features/passenger/LiveTripPage';
import { PassengerHistoryPage } from './features/passenger/HistoryPage';
import { PassengerWalletPage } from './features/passenger/WalletPage';
import { PassengerNotificationsPage } from './features/passenger/NotificationsPage';
import { HelpPage } from './features/passenger/HelpPage';

import { DriverHomePage } from './features/driver/HomePage';
import { DriverVehiclePage } from './features/driver/VehiclePage';
import { VehicleRegisterPage } from './features/driver/VehicleRegisterPage';
import { DriverRidesPage } from './features/driver/RidesPage';
import { PublishRidePage } from './features/rides/PublishRidePage';
import { DriverRideDetailPage } from './features/driver/RideDetailPage';
import { DriverRequestsPage } from './features/driver/RequestsPage';
import { ActiveTripPage } from './features/driver/ActiveTripPage';
import { DriverHistoryPage } from './features/driver/HistoryPage';
import { DriverNotificationsPage } from './features/driver/NotificationsPage';

/**
 * Two panels, two route trees, exactly as the platform contract lays them out.
 * They share an app shell and a session but nothing else: a passenger route
 * never renders a driver page and vice versa, so a driver control cannot leak
 * into the passenger experience by accident.
 */
export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/invite/:token" element={<InvitePage />} />
      <Route
        path="/onboarding"
        element={
          <RequireEmployee>
            <OnboardingPage />
          </RequireEmployee>
        }
      />

      {/* ----------------------------- passenger ----------------------------- */}
      <Route
        element={
          <RequireEmployee>
            <PanelAccessProvider>
              <PassengerLayout />
            </PanelAccessProvider>
          </RequireEmployee>
        }
      >
        <Route path="/passenger/home" element={<PassengerHomePage />} />
        <Route path="/passenger/rides" element={<FindRidePage />} />
        <Route path="/passenger/rides/:id" element={<PassengerRideDetailPage />} />
        <Route path="/passenger/bookings" element={<BookingsPage />} />
        <Route path="/passenger/bookings/:id" element={<BookingDetailPage />} />
        <Route path="/passenger/live-trip" element={<LiveTripPage />} />
        <Route path="/passenger/history" element={<PassengerHistoryPage />} />
        <Route path="/passenger/wallet" element={<PassengerWalletPage />} />
        <Route path="/passenger/notifications" element={<PassengerNotificationsPage />} />
        <Route path="/passenger/profile" element={<ProfilePage />} />
        <Route path="/passenger/help" element={<HelpPage />} />
      </Route>

      {/* ------------------------------- driver ------------------------------ */}
      <Route
        element={
          <RequireEmployee>
            <PanelAccessProvider>
              <DriverLayout />
            </PanelAccessProvider>
          </RequireEmployee>
        }
      >
        <Route path="/driver/home" element={<DriverHomePage />} />
        <Route path="/driver/vehicle" element={<DriverVehiclePage />} />
        <Route path="/driver/vehicle/register" element={<VehicleRegisterPage />} />
        <Route path="/driver/vehicle/:id" element={<DriverVehiclePage />} />
        <Route path="/driver/rides" element={<DriverRidesPage />} />
        <Route path="/driver/rides/new" element={<PublishRidePage />} />
        <Route path="/driver/rides/:id" element={<DriverRideDetailPage />} />
        <Route path="/driver/rides/:id/requests" element={<DriverRequestsPage scoped />} />
        {/* The Requests tab needs a target of its own — the contract lists the
            tab but only names the per-ride route. */}
        <Route path="/driver/requests" element={<DriverRequestsPage />} />
        <Route path="/driver/active-trip" element={<ActiveTripPage />} />
        <Route path="/driver/history" element={<DriverHistoryPage />} />
        <Route path="/driver/notifications" element={<DriverNotificationsPage />} />
        <Route path="/driver/profile" element={<ProfilePage />} />
      </Route>

      <Route path="/" element={<Navigate to="/passenger/home" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
