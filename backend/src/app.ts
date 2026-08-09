import express from 'express';
import cors from 'cors';
import { contactRequestSchema } from '@carpool/shared';
import { env } from './config/env.js';
import type { Database } from './database/client.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { handler, ok } from './shared/http.js';
import { parseBody } from './middleware/validate.js';

import { authRouter } from './modules/auth/router.js';
import { employeeProfileRouter } from './modules/employees/profile.router.js';
import { employeeHomeRouter } from './modules/employees/home.router.js';
import { employeeVehiclesRouter } from './modules/vehicles/employee.router.js';
import { employeeRidesRouter } from './modules/rides/router.js';
import { employeeTripsRouter } from './modules/trips/router.js';
import { employeePaymentsRouter } from './modules/payments/employee.router.js';
import { passengerBookingsRouter } from './modules/bookings/router.js';
import {
  adminNotificationsRouter,
  driverNotificationsRouter,
  passengerNotificationsRouter,
} from './modules/notifications/router.js';

import { adminDashboardRouter } from './modules/reports/dashboard.router.js';
import { adminParticipationRouter } from './modules/reports/participation.router.js';
import { adminReportsRouter } from './modules/reports/reports.router.js';
import { adminEmployeesRouter } from './modules/employees/admin.router.js';
import { adminInvitationsRouter } from './modules/employees/invitations.router.js';
import { adminVehiclesRouter } from './modules/vehicles/admin.router.js';
import { adminDriversRouter } from './modules/drivers/admin.router.js';
import { adminOrganizationRouter } from './modules/organizations/admin.router.js';
import { adminCostsRouter } from './modules/costs/admin.router.js';
import { adminAuditLogsRouter } from './modules/audit-logs/admin.router.js';
import { adminRideRequestsRouter, adminRidesRouter } from './modules/rides/admin.router.js';
import { adminActiveTripsRouter, adminCompletedTripsRouter } from './modules/trips/admin.router.js';
import { adminEmployeeApprovalsRouter } from './modules/employees/approvals.router.js';
import { adminVehicleApprovalsRouter } from './modules/vehicles/approvals.router.js';

/**
 * The database is injected rather than imported so tests can run each suite
 * against a throwaway in-memory PostgreSQL instance.
 */
export function createApp(db: Database) {
  const app = express();

  app.use(
    cors({
      origin: env.isProduction ? env.corsOrigins : true,
      credentials: false,
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  app.use((req, _res, next) => {
    req.db = db;
    next();
  });

  app.get('/api/health', (_req, res) => {
    ok(res, { status: 'ok', service: 'ridesync-api', time: new Date().toISOString() });
  });

  /** Public: demo/contact request from the marketing site. Stored as an audit-free no-op. */
  app.post(
    '/api/public/contact',
    handler(async (req, res) => {
      const input = parseBody(req, contactRequestSchema);
      // Nothing is persisted for a public form in the MVP; the endpoint exists
      // so the marketing site validates against the same schema the API uses.
      return ok(res, { received: true, company: input.company }, 'Thanks — we will be in touch shortly');
    }),
  );

  /* ----------------------------- auth ----------------------------- */
  app.use('/api/auth', authRouter);

  /* --------------------------- employee --------------------------- */
  app.use('/api/employee/profile', employeeProfileRouter);
  app.use('/api/employee/home', employeeHomeRouter);
  app.use('/api/employee/vehicles', employeeVehiclesRouter);
  app.use('/api/employee/rides', employeeRidesRouter);
  app.use('/api/employee/trips', employeeTripsRouter);
  app.use('/api/employee/payments', employeePaymentsRouter);

  /* --------------------------- passenger -------------------------- */
  /* Passenger-only resources. Ride search, ride detail and seat requests are
     served by the employee ride module above — they are the same records and
     the same authorization; only these two have a passenger-specific shape. */
  app.use('/api/passenger/bookings', passengerBookingsRouter);
  app.use('/api/passenger/notifications', passengerNotificationsRouter);

  /* ----------------------------- driver --------------------------- */
  app.use('/api/driver/notifications', driverNotificationsRouter);

  /* ----------------------------- admin ---------------------------- */
  app.use('/api/admin/dashboard', adminDashboardRouter);
  app.use('/api/admin/employees', adminEmployeesRouter);
  app.use('/api/admin/employee-approvals', adminEmployeeApprovalsRouter);
  app.use('/api/admin/invitations', adminInvitationsRouter);
  app.use('/api/admin/vehicles', adminVehiclesRouter);
  app.use('/api/admin/vehicle-approvals', adminVehicleApprovalsRouter);
  app.use('/api/admin/drivers', adminDriversRouter);
  app.use('/api/admin/rides', adminRidesRouter);
  app.use('/api/admin/ride-requests', adminRideRequestsRouter);
  app.use('/api/admin/active-trips', adminActiveTripsRouter);
  app.use('/api/admin/completed-trips', adminCompletedTripsRouter);
  app.use('/api/admin/notifications', adminNotificationsRouter);
  app.use('/api/admin/organization', adminOrganizationRouter);
  app.use('/api/admin/costs', adminCostsRouter);
  app.use('/api/admin/participation', adminParticipationRouter);
  app.use('/api/admin/reports', adminReportsRouter);
  app.use('/api/admin/audit-logs', adminAuditLogsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
