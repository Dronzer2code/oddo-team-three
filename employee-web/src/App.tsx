import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireEmployee } from './lib/auth';
import { EmployeeLayout } from './components/EmployeeLayout';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { InvitePage } from './features/auth/InvitePage';
import { OnboardingPage } from './features/onboarding/OnboardingPage';
import { HomePage } from './features/home/HomePage';
import { FindRidePage } from './features/rides/FindRidePage';
import { PublishRidePage } from './features/rides/PublishRidePage';
import { RideDetailPage } from './features/rides/RideDetailPage';
import { MyRidesPage } from './features/rides/MyRidesPage';
import { TripsPage } from './features/trips/TripsPage';
import { TripDetailPage } from './features/trips/TripDetailPage';
import { VehiclesPage } from './features/vehicles/VehiclesPage';
import { WalletPage } from './features/wallet/WalletPage';
import { ActivityPage } from './features/activity/ActivityPage';
import { ProfilePage } from './features/profile/ProfilePage';
import { NotFoundPage } from './features/NotFoundPage';

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
      <Route
        element={
          <RequireEmployee>
            <EmployeeLayout />
          </RequireEmployee>
        }
      >
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/rides" element={<FindRidePage />} />
        <Route path="/rides/new" element={<PublishRidePage />} />
        <Route path="/rides/:id" element={<RideDetailPage />} />
        <Route path="/my-rides" element={<MyRidesPage />} />
        <Route path="/trips" element={<TripsPage />} />
        <Route path="/trips/:id" element={<TripDetailPage />} />
        <Route path="/vehicles" element={<VehiclesPage />} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="/activity" element={<ActivityPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
