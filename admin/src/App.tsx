import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAdmin } from './lib/auth';
import { AdminLayout } from './components/AdminLayout';
import { LoginPage } from './features/auth/LoginPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { EmployeesPage } from './features/employees/EmployeesPage';
import { EmployeeDetailPage } from './features/employees/EmployeeDetailPage';
import { InvitationsPage } from './features/invitations/InvitationsPage';
import { VehiclesPage } from './features/vehicles/VehiclesPage';
import { VehicleDetailPage } from './features/vehicles/VehicleDetailPage';
import { DriversPage } from './features/drivers/DriversPage';
import { OrganizationPage } from './features/organization/OrganizationPage';
import { CostsPage } from './features/costs/CostsPage';
import { ParticipationPage } from './features/participation/ParticipationPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { AuditLogsPage } from './features/audit-logs/AuditLogsPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { NotFoundPage } from './features/NotFoundPage';

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
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/employees" element={<EmployeesPage />} />
        <Route path="/employees/:id" element={<EmployeeDetailPage />} />
        <Route path="/invitations" element={<InvitationsPage />} />
        <Route path="/vehicles" element={<VehiclesPage />} />
        <Route path="/vehicles/:id" element={<VehicleDetailPage />} />
        <Route path="/drivers" element={<DriversPage />} />
        <Route path="/organization" element={<OrganizationPage />} />
        <Route path="/costs" element={<CostsPage />} />
        <Route path="/participation" element={<ParticipationPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/audit-logs" element={<AuditLogsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
