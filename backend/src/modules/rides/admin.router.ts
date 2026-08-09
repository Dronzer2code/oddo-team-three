import { Router } from 'express';
import {
  AUDIT_ACTION,
  adminRideListQuerySchema,
  adminRideRequestQuerySchema,
  cancelRideSchema,
  type AdminRideDetail,
  type AdminRideRequestRow,
  type AdminRideRow,
  type Paginated,
} from '@carpool/shared';
import { actorOf, authenticate, requireRole } from '../../middleware/auth.js';
import { parseBody, parseId, parseQuery } from '../../middleware/validate.js';
import { handler, ok, paginationMeta, resolvePage } from '../../shared/http.js';
import { errors } from '../../shared/errors.js';
import { num, round2 } from '../../database/client.js';
import { writeAudit } from '../../shared/audit.js';
import { mapAuditLog } from '../../shared/mappers.js';

export const adminRidesRouter = Router();
adminRidesRouter.use(authenticate, requireRole('admin'));

/**
 * Administrative ride projection. Deliberately *not* the employee `Ride`
 * shape: an administrator has no viewer-relative state, but does need the
 * organization, the passenger count and the created date the admin row shows.
 *
 * $1 = organization id (from the session, never the client)
 */
const ADMIN_RIDE_SELECT = `
SELECT r.id, r.organization_id, r.driver_id, r.vehicle_id,
       r.start_location, r.destination, r.departure_at,
       r.total_seats, r.seats_taken,
       r.estimated_distance_km, r.estimated_cost, r.cost_per_seat, r.currency,
       r.notes, r.status, r.created_at,
       o.name AS organization_name,
       d.name AS driver_name, d.department AS driver_department,
       v.make, v.model, v.registration_number, v.vehicle_type, v.seating_capacity, v.color,
       t.id AS trip_id,
       (SELECT COUNT(*) FROM ride_requests rq WHERE rq.ride_id = r.id AND rq.status = 'accepted') AS passenger_count,
       (SELECT COUNT(*) FROM ride_requests rq WHERE rq.ride_id = r.id AND rq.status = 'pending') AS pending_requests
  FROM rides r
  JOIN organizations o ON o.id = r.organization_id
  JOIN users d ON d.id = r.driver_id
  JOIN vehicles v ON v.id = r.vehicle_id
  LEFT JOIN trips t ON t.ride_id = r.id
 WHERE r.organization_id = $1::uuid`;

function mapAdminRide(row: Record<string, any>): AdminRideRow {
  const totalSeats = num(row.total_seats);
  const seatsTaken = num(row.seats_taken);
  return {
    id: row.id,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    driver: {
      id: row.driver_id,
      name: row.driver_name,
      department: row.driver_department ?? null,
    },
    vehicle: {
      id: row.vehicle_id,
      make: row.make,
      model: row.model,
      registrationNumber: row.registration_number,
      vehicleType: row.vehicle_type,
      seatingCapacity: num(row.seating_capacity),
      color: row.color ?? null,
    },
    startLocation: row.start_location,
    destination: row.destination,
    departureAt: new Date(row.departure_at).toISOString(),
    totalSeats,
    seatsTaken,
    seatsAvailable: Math.max(0, totalSeats - seatsTaken),
    passengerCount: num(row.passenger_count),
    pendingRequests: num(row.pending_requests),
    estimatedDistanceKm: round2(num(row.estimated_distance_km)),
    estimatedCost: round2(num(row.estimated_cost)),
    costPerSeat: round2(num(row.cost_per_seat)),
    currency: (row.currency ?? 'INR').trim(),
    notes: row.notes ?? null,
    status: row.status,
    tripId: row.trip_id ?? null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

/** GET /api/admin/rides — every ride in the organization, filterable. */
adminRidesRouter.get(
  '/',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const query = parseQuery(req, adminRideListQuerySchema);
    const page = resolvePage(query);

    const params: unknown[] = [actor.organizationId];
    const filters: string[] = [];

    if (query.search) {
      params.push(`%${query.search}%`);
      filters.push(
        `(r.start_location ILIKE $${params.length} OR r.destination ILIKE $${params.length}
          OR d.name ILIKE $${params.length} OR v.registration_number ILIKE $${params.length})`,
      );
    }
    if (query.status) {
      params.push(query.status);
      filters.push(`r.status = $${params.length}::ride_status`);
    }
    if (query.driverId) {
      params.push(query.driverId);
      filters.push(`r.driver_id = $${params.length}::uuid`);
    }
    if (query.vehicleId) {
      params.push(query.vehicleId);
      filters.push(`r.vehicle_id = $${params.length}::uuid`);
    }
    if (query.date) {
      params.push(query.date);
      filters.push(`r.departure_at::date = $${params.length}::date`);
    }
    const where = filters.map((filter) => `AND ${filter}`).join(' ');

    const countResult = await req.db.query<{ total: unknown }>(
      `SELECT COUNT(*) AS total
         FROM rides r
         JOIN users d ON d.id = r.driver_id
         JOIN vehicles v ON v.id = r.vehicle_id
        WHERE r.organization_id = $1::uuid ${where}`,
      params,
    );

    const listParams = [...params, page.limit, page.offset];
    const { rows } = await req.db.query(
      `${ADMIN_RIDE_SELECT} ${where}
        ORDER BY r.departure_at DESC
        LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams,
    );

    const payload: Paginated<AdminRideRow> = {
      items: rows.map((row) => mapAdminRide(row as Record<string, any>)),
      pagination: paginationMeta(page, num(countResult.rows[0]?.total)),
    };
    return ok(res, payload);
  }),
);

/** GET /api/admin/rides/:id — ride with its passengers and its audit trail. */
adminRidesRouter.get(
  '/:id',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const rideId = parseId(req.params.id, 'ride id');

    const { rows } = await req.db.query(`${ADMIN_RIDE_SELECT} AND r.id = $2::uuid`, [
      actor.organizationId,
      rideId,
    ]);
    const row = rows[0] as Record<string, any> | undefined;
    if (!row) throw errors.notFound('That ride is not in your organization');

    const requests = await req.db.query<Record<string, any>>(
      `SELECT rq.id, rq.passenger_id, rq.seats, rq.status, rq.note, rq.created_at,
              p.name AS passenger_name, p.department AS passenger_department,
              p.employee_code AS passenger_employee_code
         FROM ride_requests rq
         JOIN users p ON p.id = rq.passenger_id
        WHERE rq.ride_id = $1::uuid
        ORDER BY rq.created_at ASC`,
      [rideId],
    );

    const logs = await req.db.query(
      `SELECT * FROM audit_logs
        WHERE organization_id = $1::uuid AND entity_type = 'ride' AND entity_id = $2
        ORDER BY created_at DESC LIMIT 50`,
      [actor.organizationId, rideId],
    );

    const detail: AdminRideDetail = {
      ...mapAdminRide(row),
      requests: requests.rows.map((request) => ({
        id: request.id,
        passengerId: request.passenger_id,
        passengerName: request.passenger_name,
        passengerDepartment: request.passenger_department ?? null,
        passengerEmployeeCode: request.passenger_employee_code ?? null,
        seats: num(request.seats),
        status: request.status,
        note: request.note ?? null,
        createdAt: new Date(request.created_at).toISOString(),
      })),
      auditLogs: logs.rows.map((log) => mapAuditLog(log as Record<string, unknown>)),
    };
    return ok(res, detail);
  }),
);

/**
 * POST /api/admin/rides/:id/cancel
 * The one write an administrator has over rides: pulling an unsafe ride.
 * Publishing and booking stay with the employee panels — see the product rules.
 */
adminRidesRouter.post(
  '/:id/cancel',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const rideId = parseId(req.params.id, 'ride id');
    const input = parseBody(req, cancelRideSchema);

    const ride = await req.db.transaction(async (tx) => {
      const existing = await tx.query<{ status: string; driver_id: string }>(
        `SELECT status::text AS status, driver_id FROM rides
          WHERE id = $1::uuid AND organization_id = $2::uuid FOR UPDATE`,
        [rideId, actor.organizationId],
      );
      const before = existing.rows[0];
      if (!before) throw errors.notFound('That ride is not in your organization');
      if (before.status === 'canceled') throw errors.ruleViolation('This ride is already canceled');
      if (before.status === 'completed') throw errors.ruleViolation('A completed ride cannot be canceled');
      if (before.status === 'in_progress') {
        throw errors.ruleViolation('This trip is already running. Ask the driver to complete or cancel it.');
      }

      await tx.query(`UPDATE rides SET status = 'canceled' WHERE id = $1::uuid`, [rideId]);
      await tx.query(
        `UPDATE ride_requests SET status = 'canceled'
          WHERE ride_id = $1::uuid AND status IN ('pending', 'accepted')`,
        [rideId],
      );

      await writeAudit(tx, {
        organizationId: actor.organizationId,
        actorId: actor.id,
        actorName: actor.name,
        action: AUDIT_ACTION.RIDE_CANCELED,
        entityType: 'ride',
        entityId: rideId,
        previousValues: { status: before.status },
        newValues: { status: 'canceled' },
        metadata: { via: 'admin', reason: input.reason ?? null },
      });

      const { rows } = await tx.query(`${ADMIN_RIDE_SELECT} AND r.id = $2::uuid`, [
        actor.organizationId,
        rideId,
      ]);
      return mapAdminRide(rows[0] as Record<string, any>);
    });

    return ok(res, ride, 'Ride canceled');
  }),
);

/* ------------------------------------------------------------------ */
/* Ride requests — read-only monitoring                                */
/* ------------------------------------------------------------------ */

export const adminRideRequestsRouter = Router();
adminRideRequestsRouter.use(authenticate, requireRole('admin'));

/**
 * GET /api/admin/ride-requests
 * Seat requests across every ride. The accept/reject decision belongs to the
 * driver, so this view is read-only by design.
 */
adminRideRequestsRouter.get(
  '/',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const query = parseQuery(req, adminRideRequestQuerySchema);
    const page = resolvePage(query);

    const params: unknown[] = [actor.organizationId];
    const filters: string[] = [];

    if (query.search) {
      params.push(`%${query.search}%`);
      filters.push(
        `(p.name ILIKE $${params.length} OR d.name ILIKE $${params.length}
          OR r.start_location ILIKE $${params.length} OR r.destination ILIKE $${params.length})`,
      );
    }
    if (query.status) {
      params.push(query.status);
      filters.push(`rq.status = $${params.length}::ride_request_status`);
    }
    if (query.rideId) {
      params.push(query.rideId);
      filters.push(`rq.ride_id = $${params.length}::uuid`);
    }
    const where = filters.map((filter) => `AND ${filter}`).join(' ');

    const from = `
      FROM ride_requests rq
      JOIN rides r ON r.id = rq.ride_id
      JOIN users p ON p.id = rq.passenger_id
      JOIN users d ON d.id = r.driver_id
     WHERE rq.organization_id = $1::uuid ${where}`;

    const countResult = await req.db.query<{ total: unknown }>(`SELECT COUNT(*) AS total ${from}`, params);

    const listParams = [...params, page.limit, page.offset];
    const { rows } = await req.db.query<Record<string, any>>(
      `SELECT rq.id, rq.ride_id, rq.seats, rq.status, rq.note, rq.created_at,
              r.start_location, r.destination, r.departure_at,
              r.driver_id, d.name AS driver_name,
              rq.passenger_id, p.name AS passenger_name,
              p.employee_code AS passenger_employee_code, p.department AS passenger_department
       ${from}
        ORDER BY rq.created_at DESC
        LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams,
    );

    const payload: Paginated<AdminRideRequestRow> = {
      items: rows.map((row) => ({
        id: row.id,
        rideId: row.ride_id,
        startLocation: row.start_location,
        destination: row.destination,
        departureAt: new Date(row.departure_at).toISOString(),
        driverId: row.driver_id,
        driverName: row.driver_name,
        passengerId: row.passenger_id,
        passengerName: row.passenger_name,
        passengerEmployeeCode: row.passenger_employee_code ?? null,
        passengerDepartment: row.passenger_department ?? null,
        seats: num(row.seats),
        status: row.status,
        note: row.note ?? null,
        createdAt: new Date(row.created_at).toISOString(),
      })),
      pagination: paginationMeta(page, num(countResult.rows[0]?.total)),
    };
    return ok(res, payload);
  }),
);
