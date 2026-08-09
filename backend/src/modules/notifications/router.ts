import { Router } from 'express';
import type { NotificationItem } from '@carpool/shared';
import { actorOf, authenticate, requireRole } from '../../middleware/auth.js';
import { handler, ok } from '../../shared/http.js';
import { isoRequired, num } from '../../database/client.js';

/**
 * Notifications are *derived*, not stored. The MVP has no notifications table
 * and no delivery channel, so inventing one would mean inventing state that
 * nothing writes. Instead each panel projects the records that actually
 * changed — seat requests, decisions, trips, approvals — into a feed, which
 * keeps the list truthful and keeps it refreshing with the same queries the
 * rest of the panel already invalidates.
 */

function sortByNewest(items: NotificationItem[]): NotificationItem[] {
  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function route(from: string, to: string): string {
  return `${from} → ${to}`;
}

/* ------------------------------------------------------------------ */
/* Passenger                                                           */
/* ------------------------------------------------------------------ */

export const passengerNotificationsRouter = Router();
passengerNotificationsRouter.use(authenticate);

/** GET /api/passenger/notifications */
passengerNotificationsRouter.get(
  '/',
  handler(async (req, res) => {
    const actor = actorOf(req);

    const decisions = await req.db.query<Record<string, any>>(
      `SELECT rq.id, rq.status::text AS status, rq.seats, rq.updated_at, rq.ride_id,
              r.start_location, r.destination, r.departure_at,
              d.name AS driver_name
         FROM ride_requests rq
         JOIN rides r ON r.id = rq.ride_id
         JOIN users d ON d.id = r.driver_id
        WHERE rq.organization_id = $1::uuid AND rq.passenger_id = $2::uuid
        ORDER BY rq.updated_at DESC
        LIMIT 40`,
      [actor.organizationId, actor.id],
    );

    const trips = await req.db.query<Record<string, any>>(
      `SELECT t.id, t.status::text AS status, t.start_location, t.destination,
              t.started_at, t.completed_at, t.total_cost, t.currency,
              tp.share_amount, d.name AS driver_name
         FROM trip_participants tp
         JOIN trips t ON t.id = tp.trip_id
         JOIN users d ON d.id = t.driver_id
        WHERE tp.organization_id = $1::uuid AND tp.user_id = $2::uuid AND tp.role = 'passenger'
        ORDER BY COALESCE(t.completed_at, t.started_at) DESC
        LIMIT 20`,
      [actor.organizationId, actor.id],
    );

    const items: NotificationItem[] = [];

    for (const row of decisions.rows) {
      const where = route(row.start_location, row.destination);
      if (row.status === 'accepted') {
        items.push({
          id: `request-${row.id}-accepted`,
          kind: 'seat_accepted',
          title: 'Seat confirmed',
          body: `${row.driver_name} accepted your request for ${where}.`,
          href: `/passenger/bookings/${row.id}`,
          requiresAction: false,
          createdAt: isoRequired(row.updated_at),
        });
      } else if (row.status === 'rejected') {
        items.push({
          id: `request-${row.id}-rejected`,
          kind: 'seat_rejected',
          title: 'Seat request declined',
          body: `${row.driver_name} could not fit your request for ${where}.`,
          href: '/passenger/rides',
          requiresAction: false,
          createdAt: isoRequired(row.updated_at),
        });
      } else if (row.status === 'pending') {
        items.push({
          id: `request-${row.id}-pending`,
          kind: 'seat_requested',
          title: 'Waiting for the driver',
          body: `Your request for ${row.seats} seat(s) on ${where} is with ${row.driver_name}.`,
          href: `/passenger/bookings/${row.id}`,
          requiresAction: false,
          createdAt: isoRequired(row.updated_at),
        });
      }
    }

    for (const row of trips.rows) {
      const where = route(row.start_location, row.destination);
      if (row.status === 'completed') {
        items.push({
          id: `trip-${row.id}-completed`,
          kind: 'trip_completed',
          title: 'Trip completed',
          body: `${where} is done. Your share is ${(row.currency ?? 'INR').trim()} ${num(row.share_amount).toFixed(2)}.`,
          href: '/passenger/history',
          requiresAction: false,
          createdAt: isoRequired(row.completed_at ?? row.started_at),
        });
      } else if (row.status === 'in_progress') {
        items.push({
          id: `trip-${row.id}-started`,
          kind: 'trip_started',
          title: 'Your trip has started',
          body: `${row.driver_name} started the trip for ${where}.`,
          href: '/passenger/live-trip',
          requiresAction: false,
          createdAt: isoRequired(row.started_at),
        });
      }
    }

    return ok(res, sortByNewest(items).slice(0, 50));
  }),
);

/* ------------------------------------------------------------------ */
/* Driver                                                              */
/* ------------------------------------------------------------------ */

export const driverNotificationsRouter = Router();
driverNotificationsRouter.use(authenticate);

/** GET /api/driver/notifications */
driverNotificationsRouter.get(
  '/',
  handler(async (req, res) => {
    const actor = actorOf(req);

    const requests = await req.db.query<Record<string, any>>(
      `SELECT rq.id, rq.status::text AS status, rq.seats, rq.created_at, rq.updated_at, rq.ride_id,
              r.start_location, r.destination,
              p.name AS passenger_name, p.employee_code AS passenger_employee_code
         FROM ride_requests rq
         JOIN rides r ON r.id = rq.ride_id
         JOIN users p ON p.id = rq.passenger_id
        WHERE rq.organization_id = $1::uuid AND r.driver_id = $2::uuid
        ORDER BY rq.updated_at DESC
        LIMIT 40`,
      [actor.organizationId, actor.id],
    );

    const vehicles = await req.db.query<Record<string, any>>(
      `SELECT v.id, v.make, v.model, v.registration_number, v.status::text AS status, v.updated_at
         FROM vehicles v
        WHERE v.organization_id = $1::uuid AND v.owner_id = $2::uuid
        ORDER BY v.updated_at DESC`,
      [actor.organizationId, actor.id],
    );

    const items: NotificationItem[] = [];

    for (const row of requests.rows) {
      const where = route(row.start_location, row.destination);
      if (row.status === 'pending') {
        items.push({
          id: `request-${row.id}-pending`,
          kind: 'seat_requested',
          title: 'New seat request',
          body: `${row.passenger_name} requested ${num(row.seats)} seat(s) on ${where}.`,
          href: `/driver/rides/${row.ride_id}/requests`,
          requiresAction: true,
          createdAt: isoRequired(row.created_at),
        });
      } else if (row.status === 'canceled') {
        items.push({
          id: `request-${row.id}-canceled`,
          kind: 'seat_canceled',
          title: 'Passenger withdrew',
          body: `${row.passenger_name} released a seat on ${where}.`,
          href: `/driver/rides/${row.ride_id}/requests`,
          requiresAction: false,
          createdAt: isoRequired(row.updated_at),
        });
      }
    }

    for (const row of vehicles.rows) {
      const label = `${row.make} ${row.model} · ${row.registration_number}`;
      if (row.status === 'active') {
        items.push({
          id: `vehicle-${row.id}-approved`,
          kind: 'vehicle_approved',
          title: 'Vehicle approved',
          body: `${label} is approved. You can publish rides with it.`,
          href: '/driver/vehicle',
          requiresAction: false,
          createdAt: isoRequired(row.updated_at),
        });
      } else if (row.status === 'under_review') {
        items.push({
          id: `vehicle-${row.id}-review`,
          kind: 'vehicle_submitted',
          title: 'Vehicle under review',
          body: `${label} is waiting for an administrator decision.`,
          href: '/driver/vehicle',
          requiresAction: false,
          createdAt: isoRequired(row.updated_at),
        });
      } else if (row.status === 'inactive') {
        items.push({
          id: `vehicle-${row.id}-inactive`,
          kind: 'vehicle_rejected',
          title: 'Vehicle not active',
          body: `${label} cannot be used for new rides.`,
          href: '/driver/vehicle',
          requiresAction: false,
          createdAt: isoRequired(row.updated_at),
        });
      }
    }

    return ok(res, sortByNewest(items).slice(0, 50));
  }),
);

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

export const adminNotificationsRouter = Router();
adminNotificationsRouter.use(authenticate, requireRole('admin'));

/** GET /api/admin/notifications — pending decisions first, then recent activity. */
adminNotificationsRouter.get(
  '/',
  handler(async (req, res) => {
    const actor = actorOf(req);

    const employees = await req.db.query<Record<string, any>>(
      `SELECT u.id, u.name, u.email, u.created_at
         FROM users u
        WHERE u.organization_id = $1::uuid AND u.role = 'employee' AND u.status = 'pending'
        ORDER BY u.created_at DESC LIMIT 25`,
      [actor.organizationId],
    );

    const vehicles = await req.db.query<Record<string, any>>(
      `SELECT v.id, v.make, v.model, v.registration_number, v.created_at, u.name AS owner_name
         FROM vehicles v JOIN users u ON u.id = v.owner_id
        WHERE v.organization_id = $1::uuid AND v.status = 'under_review'
        ORDER BY v.created_at DESC LIMIT 25`,
      [actor.organizationId],
    );

    const logs = await req.db.query<Record<string, any>>(
      `SELECT id, actor_name, action, entity_type, created_at
         FROM audit_logs
        WHERE organization_id = $1::uuid
        ORDER BY created_at DESC LIMIT 25`,
      [actor.organizationId],
    );

    const items: NotificationItem[] = [];

    for (const row of employees.rows) {
      items.push({
        id: `employee-${row.id}`,
        kind: 'employee_pending',
        title: 'Employee waiting for approval',
        body: `${row.name} (${row.email}) registered and needs a decision.`,
        href: '/admin/employee-approvals',
        requiresAction: true,
        createdAt: isoRequired(row.created_at),
      });
    }

    for (const row of vehicles.rows) {
      items.push({
        id: `vehicle-${row.id}`,
        kind: 'vehicle_submitted',
        title: 'Vehicle waiting for review',
        body: `${row.owner_name} submitted ${row.make} ${row.model} · ${row.registration_number}.`,
        href: '/admin/vehicle-approvals',
        requiresAction: true,
        createdAt: isoRequired(row.created_at),
      });
    }

    for (const row of logs.rows) {
      items.push({
        id: `audit-${row.id}`,
        kind: 'admin_action',
        title: row.action,
        body: `${row.actor_name} on ${row.entity_type}.`,
        href: '/admin/audit-logs',
        requiresAction: false,
        createdAt: isoRequired(row.created_at),
      });
    }

    // Decisions the administrator still owes come first, regardless of age.
    const pending = sortByNewest(items.filter((item) => item.requiresAction));
    const rest = sortByNewest(items.filter((item) => !item.requiresAction));
    return ok(res, [...pending, ...rest].slice(0, 60));
  }),
);
