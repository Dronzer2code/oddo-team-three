import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAdmin } from './lib/auth';
import { AdminLayout } from './components/AdminLayout';
import { LoginPage } from './features/auth/LoginPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { EmployeesPage } from './features/employees/EmployeesPage';
import { EmployeeDetailPage } from './features/employees/EmployeeDetailPage';
import { EmployeeApprovalsPage } from './features/employees/EmployeeApprovalsPage';
import { InvitationsPage } from './features/invitations/InvitationsPage';
import { VehiclesPage } from './features/vehicles/VehiclesPage';
import { VehicleDetailPage } from './features/vehicles/VehicleDetailPage';
import { VehicleApprovalsPage } from './features/vehicles/VehicleApprovalsPage';
import { DriversPage } from './features/drivers/DriversPage';
import { RidesPage } from './features/rides/RidesPage';
import { RideDetailPage } from './features/rides/RideDetailPage';
import { RideRequestsPage } from './features/rides/RideRequestsPage';
import { ActiveTripsPage } from './features/trips/ActiveTripsPage';
import { CompletedTripsPage } from './features/trips/CompletedTripsPage';
import { OrganizationPage } from './features/organization/OrganizationPage';
import { CostsPage } from './features/costs/CostsPage';
import { ParticipationPage } from './features/participation/ParticipationPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { NotificationsPage } from './features/notifications/NotificationsPage';
import { AuditLogsPage } from './features/audit-logs/AuditLogsPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { NotFoundPage } from './features/NotFoundPage';

/**
 * Routes follow the platform contract exactly: every admin screen lives under
 * `/admin/*`. Nothing is reachable by hiding a navigation item — `RequireAdmin`
 * guards the whole subtree and the API re-checks the role on every request.
 */
export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

        <Route path="/admin/dashboard" element={<DashboardPage />} />
        <Route path="/admin/employees" element={<EmployeesPage />} />
        <Route path="/admin/employees/:id" element={<EmployeeDetailPage />} />
        <Route path="/admin/employee-approvals" element={<EmployeeApprovalsPage />} />
        <Route path="/admin/vehicles" element={<VehiclesPage />} />
        <Route path="/admin/vehicles/:id" element={<VehicleDetailPage />} />
        <Route path="/admin/vehicle-approvals" element={<VehicleApprovalsPage />} />
        <Route path="/admin/drivers" element={<DriversPage />} />
        <Route path="/admin/rides" element={<RidesPage />} />
        <Route path="/admin/rides/:id" element={<RideDetailPage />} />
        <Route path="/admin/ride-requests" element={<RideRequestsPage />} />
        <Route path="/admin/active-trips" element={<ActiveTripsPage />} />
        <Route path="/admin/completed-trips" element={<CompletedTripsPage />} />
        <Route path="/admin/organization" element={<OrganizationPage />} />
        <Route path="/admin/costs" element={<CostsPage />} />
        <Route path="/admin/participation" element={<ParticipationPage />} />
        <Route path="/admin/reports" element={<ReportsPage />} />
        <Route path="/admin/notifications" element={<NotificationsPage />} />
        <Route path="/admin/audit-logs" element={<AuditLogsPage />} />
        <Route path="/admin/settings" element={<SettingsPage />} />

        {/* Invitations are reached from Employees; the contract's navigation
            list does not carry a tab for them. */}
        <Route path="/admin/invitations" element={<InvitationsPage />} />

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
