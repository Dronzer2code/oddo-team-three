import { Router } from 'express';
import {
  RIDE_REQUEST_STATUS,
  RIDE_STATUS,
  VEHICLE_STATUS,
  publishRideSchema,
  requestSeatSchema,
  respondRequestSchema,
  rideSearchSchema,
  type Paginated,
  type Ride,
} from '@carpool/shared';
import { authenticate, actorOf, requireOperationalAccount, requireRole } from '../../middleware/auth.js';
import { parseBody, parseId, parseQuery } from '../../middleware/validate.js';
import { handler, ok, created, paginationMeta, resolvePage } from '../../shared/http.js';
import { errors } from '../../shared/errors.js';
import { num } from '../../database/client.js';
import { computeCost, costPerSeat, resolveCostBasis } from '../../shared/cost.js';
import { mapRide, mapRideRequest } from '../../shared/mappers.js';
import { touchActivity } from '../../shared/activity.js';
import { RIDE_BASE_SELECT, RIDE_REQUEST_SELECT } from './queries.js';
import type { Queryable } from '../../database/client.js';

export const employeeRidesRouter = Router();
employeeRidesRouter.use(authenticate, requireRole('employee'));

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

async function loadRide(db: Queryable, organizationId: string, viewerId: string, rideId: string): Promise<Ride> {
  const { rows } = await db.query(`${RIDE_BASE_SELECT} AND r.id = $3::uuid`, [organizationId, viewerId, rideId]);
  const row = rows[0];
  if (!row) throw errors.notFound('That ride is not available');
  return mapRide(row, { viewerId });
}

async function loadRequests(db: Queryable, rideId: string, revealPhone: boolean) {
  const { rows } = await db.query(`${RIDE_REQUEST_SELECT} WHERE rq.ride_id = $1::uuid ORDER BY rq.created_at ASC`, [
    rideId,
  ]);
  return rows.map((row) => mapRideRequest(row as Record<string, unknown>, revealPhone));
}

async function assertCarpoolingEnabled(db: Queryable, organizationId: string): Promise<void> {
  const { rows } = await db.query<{ carpooling_enabled: boolean }>(
    'SELECT carpooling_enabled FROM organizations WHERE id = $1::uuid',
    [organizationId],
  );
  if (rows[0] && rows[0].carpooling_enabled === false) {
    throw errors.ruleViolation('Carpooling is currently disabled for your organization');
  }
}

/* ------------------------------------------------------------------ */
/* Discovery                                                           */
/* ------------------------------------------------------------------ */

/** GET /api/employee/rides — find a ride (organization-scoped search). */
employeeRidesRouter.get(
  '/',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const query = parseQuery(req, rideSearchSchema);
    const page = resolvePage(query);

    const params: unknown[] = [actor.organizationId, actor.id];
    const filters: string[] = [
      `r.status = 'published'`,
      `r.driver_id <> $2::uuid`,
      `r.departure_at > NOW()`,
      `r.seats_taken < r.total_seats`,
    ];

    if (query.from) {
      params.push(`%${query.from}%`);
      filters.push(`r.start_location ILIKE $${params.length}`);
    }
    if (query.to) {
      params.push(`%${query.to}%`);
      filters.push(`r.destination ILIKE $${params.length}`);
    }
    if (query.date) {
      params.push(query.date);
      filters.push(`r.departure_at::date = $${params.length}::date`);
    }
    if (query.timeFrom) {
      params.push(query.timeFrom);
      filters.push(`r.departure_at::time >= $${params.length}::time`);
    }
    if (query.timeTo) {
      params.push(query.timeTo);
      filters.push(`r.departure_at::time <= $${params.length}::time`);
    }
    if (query.minSeats) {
      params.push(query.minSeats);
      filters.push(`(r.total_seats - r.seats_taken) >= $${params.length}::int`);
    }
    if (query.vehicleType) {
      params.push(query.vehicleType);
      filters.push(`v.vehicle_type = $${params.length}::vehicle_type`);
    }

    const where = filters.map((f) => `AND ${f}`).join(' ');

    const countResult = await req.db.query<{ total: unknown }>(
      `SELECT COUNT(*) AS total
         FROM rides r JOIN vehicles v ON v.id = r.vehicle_id
        WHERE r.organization_id = $1::uuid ${where}`,
      params,
    );

    const listParams = [...params, page.limit, page.offset];
    const { rows } = await req.db.query(
      `${RIDE_BASE_SELECT} ${where}
        ORDER BY r.departure_at ASC
        LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams,
    );

    const payload: Paginated<Ride> = {
      items: rows.map((row) => mapRide(row as Record<string, unknown>, { viewerId: actor.id })),
      pagination: paginationMeta(page, num(countResult.rows[0]?.total)),
    };
    return ok(res, payload);
  }),
);

/** GET /api/employee/rides/mine — rides I published + rides I ride on. */
employeeRidesRouter.get(
  '/mine',
  handler(async (req, res) => {
    const actor = actorOf(req);

    const driving = await req.db.query(
      `${RIDE_BASE_SELECT} AND r.driver_id = $2::uuid ORDER BY r.departure_at DESC LIMIT 100`,
      [actor.organizationId, actor.id],
    );

    const riding = await req.db.query(
      `${RIDE_BASE_SELECT}
         AND r.driver_id <> $2::uuid
         AND EXISTS (
           SELECT 1 FROM ride_requests rq
            WHERE rq.ride_id = r.id AND rq.passenger_id = $2::uuid
              AND rq.status IN ('pending','accepted')
         )
       ORDER BY r.departure_at DESC LIMIT 100`,
      [actor.organizationId, actor.id],
    );

    const pending = await req.db.query<{ total: unknown }>(
      `SELECT COUNT(*) AS total
         FROM ride_requests rq JOIN rides r ON r.id = rq.ride_id
        WHERE r.driver_id = $1::uuid AND rq.status = 'pending'`,
      [actor.id],
    );

    return ok(res, {
      driving: driving.rows.map((row) => mapRide(row as Record<string, unknown>, { viewerId: actor.id })),
      riding: riding.rows.map((row) => mapRide(row as Record<string, unknown>, { viewerId: actor.id })),
      pendingIncomingRequests: num(pending.rows[0]?.total),
    });
  }),
);

/** GET /api/employee/rides/:id */
employeeRidesRouter.get(
  '/:id',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const rideId = parseId(req.params.id, 'ride id');
    const ride = await loadRide(req.db, actor.organizationId, actor.id, rideId);

    // Only the driver sees the full request queue; passengers see their own.
    if (ride.viewer.isDriver) {
      ride.requests = await loadRequests(req.db, rideId, true);
    } else {
      const all = await loadRequests(req.db, rideId, false);
      ride.requests = all.filter((r) => r.passenger.id === actor.id);
    }
    return ok(res, ride);
  }),
);

/* ------------------------------------------------------------------ */
/* Publish                                                             */
/* ------------------------------------------------------------------ */

/** POST /api/employee/rides — publish a ride. */
employeeRidesRouter.post(
  '/',
  requireOperationalAccount,
  handler(async (req, res) => {
    const actor = actorOf(req);
    const input = parseBody(req, publishRideSchema);

    await assertCarpoolingEnabled(req.db, actor.organizationId);

    const departure = new Date(input.departureAt);
    if (Number.isNaN(departure.getTime())) {
      throw errors.validation('Enter a valid departure time', { departureAt: 'Invalid date/time' });
    }
    if (departure.getTime() <= Date.now()) {
      throw errors.validation('Departure must be in the future', { departureAt: 'Choose a future time' });
    }

    const vehicleResult = await req.db.query<{
      id: string;
      owner_id: string;
      status: string;
      seating_capacity: unknown;
    }>(
      `SELECT id, owner_id, status::text AS status, seating_capacity
         FROM vehicles
        WHERE id = $1::uuid AND organization_id = $2::uuid`,
      [input.vehicleId, actor.organizationId],
    );
    const vehicle = vehicleResult.rows[0];
    if (!vehicle) throw errors.notFound('That vehicle is not registered in your organization');
    if (vehicle.owner_id !== actor.id) throw errors.forbidden('You can only publish rides with your own vehicle');
    if (vehicle.status !== VEHICLE_STATUS.ACTIVE) {
      throw errors.ruleViolation(
        vehicle.status === VEHICLE_STATUS.UNDER_REVIEW
          ? 'This vehicle is still under review by your administrator'
          : 'This vehicle is inactive and cannot be used for new rides',
      );
    }

    // The driver occupies one seat, so offered seats are capacity - 1.
    const offerable = Math.max(0, num(vehicle.seating_capacity) - 1);
    if (input.seats > offerable) {
      throw errors.ruleViolation(
        `This vehicle seats ${num(vehicle.seating_capacity)}, so you can offer at most ${offerable} seat${
          offerable === 1 ? '' : 's'
        }`,
        { seats: `Maximum ${offerable}` },
      );
    }

    const basis = await resolveCostBasis(req.db, actor.organizationId, departure);
    const breakdown = computeCost(input.estimatedDistanceKm, basis);
    const perSeat = costPerSeat(breakdown.totalCost, input.seats);

    const inserted = await req.db.query<{ id: string }>(
      `INSERT INTO rides (organization_id, driver_id, vehicle_id, start_location, destination,
                          departure_at, total_seats, estimated_distance_km, estimated_cost,
                          cost_per_seat, currency, notes, status)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6::timestamptz, $7::int,
               $8::numeric, $9::numeric, $10::numeric, $11, $12, 'published'::ride_status)
       RETURNING id`,
      [
        actor.organizationId,
        actor.id,
        input.vehicleId,
        input.startLocation,
        input.destination,
        departure.toISOString(),
        input.seats,
        input.estimatedDistanceKm,
        breakdown.totalCost,
        perSeat,
        basis.currency,
        input.notes ?? null,
      ],
    );

    await touchActivity(req.db, actor.id);
    const ride = await loadRide(req.db, actor.organizationId, actor.id, inserted.rows[0]!.id);
    return created(res, ride, 'Ride published');
  }),
);

/** POST /api/employee/rides/:id/cancel */
employeeRidesRouter.post(
  '/:id/cancel',
  requireOperationalAccount,
  handler(async (req, res) => {
    const actor = actorOf(req);
    const rideId = parseId(req.params.id, 'ride id');

    await req.db.transaction(async (tx) => {
      const { rows } = await tx.query<{ driver_id: string; status: string }>(
        `SELECT driver_id, status::text AS status FROM rides
          WHERE id = $1::uuid AND organization_id = $2::uuid FOR UPDATE`,
        [rideId, actor.organizationId],
      );
      const ride = rows[0];
      if (!ride) throw errors.notFound('That ride is not available');
      if (ride.driver_id !== actor.id) throw errors.forbidden('Only the driver can cancel this ride');
      if (ride.status !== RIDE_STATUS.PUBLISHED && ride.status !== RIDE_STATUS.FULL) {
        throw errors.ruleViolation(`A ride that is ${ride.status.replace('_', ' ')} can no longer be canceled`);
      }

      await tx.query(`UPDATE rides SET status = 'canceled'::ride_status WHERE id = $1::uuid`, [rideId]);
      await tx.query(
        `UPDATE ride_requests SET status = 'canceled'::ride_request_status
          WHERE ride_id = $1::uuid AND status IN ('pending','accepted')`,
        [rideId],
      );
    });

    const ride = await loadRide(req.db, actor.organizationId, actor.id, rideId);
    return ok(res, ride, 'Ride canceled');
  }),
);

/* ------------------------------------------------------------------ */
/* Requests                                                            */
/* ------------------------------------------------------------------ */

/**
 * GET /api/employee/rides/:id/requests — the request queue for one ride.
 * Drivers see every request; anyone else sees only their own, so the endpoint
 * cannot be used to enumerate who asked for a seat on someone else's ride.
 */
employeeRidesRouter.get(
  '/:id/requests',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const rideId = parseId(req.params.id, 'ride id');
    const ride = await loadRide(req.db, actor.organizationId, actor.id, rideId);

    if (ride.viewer.isDriver) {
      return ok(res, await loadRequests(req.db, rideId, true));
    }
    const own = await loadRequests(req.db, rideId, false);
    return ok(res, own.filter((request) => request.passenger.id === actor.id));
  }),
);

/** POST /api/employee/rides/:id/requests — request a seat. */
employeeRidesRouter.post(
  '/:id/requests',
  requireOperationalAccount,
  handler(async (req, res) => {
    const actor = actorOf(req);
    const rideId = parseId(req.params.id, 'ride id');
    const input = parseBody(req, requestSeatSchema);

    await assertCarpoolingEnabled(req.db, actor.organizationId);

    const requestId = await req.db.transaction(async (tx) => {
      const { rows } = await tx.query<{
        driver_id: string;
        status: string;
        total_seats: unknown;
        seats_taken: unknown;
        departure_at: unknown;
      }>(
        `SELECT driver_id, status::text AS status, total_seats, seats_taken, departure_at
           FROM rides WHERE id = $1::uuid AND organization_id = $2::uuid FOR UPDATE`,
        [rideId, actor.organizationId],
      );
      const ride = rows[0];
      if (!ride) throw errors.notFound('That ride is not available');
      if (ride.driver_id === actor.id) throw errors.ruleViolation('You cannot request a seat on your own ride');
      if (ride.status !== RIDE_STATUS.PUBLISHED) {
        throw errors.ruleViolation('This ride is no longer accepting requests');
      }
      if (new Date(String(ride.departure_at)).getTime() <= Date.now()) {
        throw errors.ruleViolation('This ride has already departed');
      }

      const available = num(ride.total_seats) - num(ride.seats_taken);
      if (input.seats > available) {
        throw errors.ruleViolation(
          available === 0 ? 'This ride is full' : `Only ${available} seat${available === 1 ? '' : 's'} left`,
          { seats: `Maximum ${available}` },
        );
      }

      const live = await tx.query(
        `SELECT 1 FROM ride_requests
          WHERE ride_id = $1::uuid AND passenger_id = $2::uuid AND status IN ('pending','accepted')`,
        [rideId, actor.id],
      );
      if (live.rows.length > 0) throw errors.conflict('You already have an open request for this ride');

      const inserted = await tx.query<{ id: string }>(
        `INSERT INTO ride_requests (organization_id, ride_id, passenger_id, seats, note, status)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::int, $5, 'pending'::ride_request_status)
         RETURNING id`,
        [actor.organizationId, rideId, actor.id, input.seats, input.note ?? null],
      );
      return inserted.rows[0]!.id;
    });

    await touchActivity(req.db, actor.id);

    const { rows } = await req.db.query(`${RIDE_REQUEST_SELECT} WHERE rq.id = $1::uuid`, [requestId]);
    return created(res, mapRideRequest(rows[0] as Record<string, unknown>), 'Seat requested');
  }),
);

/** POST /api/employee/rides/:id/requests/:requestId/respond — driver decision. */
employeeRidesRouter.post(
  '/:id/requests/:requestId/respond',
  requireOperationalAccount,
  handler(async (req, res) => {
    const actor = actorOf(req);
    const rideId = parseId(req.params.id, 'ride id');
    const requestId = parseId(req.params.requestId, 'request id');
    const { action } = parseBody(req, respondRequestSchema);

    await req.db.transaction(async (tx) => {
      const rideResult = await tx.query<{
        driver_id: string;
        status: string;
        total_seats: unknown;
        seats_taken: unknown;
      }>(
        `SELECT driver_id, status::text AS status, total_seats, seats_taken
           FROM rides WHERE id = $1::uuid AND organization_id = $2::uuid FOR UPDATE`,
        [rideId, actor.organizationId],
      );
      const ride = rideResult.rows[0];
      if (!ride) throw errors.notFound('That ride is not available');
      if (ride.driver_id !== actor.id) throw errors.forbidden('Only the driver can respond to requests');
      if (ride.status !== RIDE_STATUS.PUBLISHED && ride.status !== RIDE_STATUS.FULL) {
        throw errors.ruleViolation('This ride is no longer accepting changes');
      }

      const requestResult = await tx.query<{ id: string; seats: unknown; status: string }>(
        `SELECT id, seats, status::text AS status FROM ride_requests
          WHERE id = $1::uuid AND ride_id = $2::uuid FOR UPDATE`,
        [requestId, rideId],
      );
      const request = requestResult.rows[0];
      if (!request) throw errors.notFound('That request no longer exists');
      if (request.status !== RIDE_REQUEST_STATUS.PENDING) {
        throw errors.ruleViolation(`This request was already ${request.status}`);
      }

      if (action === 'reject') {
        await tx.query(
          `UPDATE ride_requests
              SET status = 'rejected'::ride_request_status, responded_by = $2::uuid, responded_at = NOW()
            WHERE id = $1::uuid`,
          [requestId, actor.id],
        );
        return;
      }

      const seats = num(request.seats);
      const available = num(ride.total_seats) - num(ride.seats_taken);
      if (seats > available) {
        throw errors.ruleViolation(
          available === 0
            ? 'There are no seats left to accept this request'
            : `Only ${available} seat${available === 1 ? '' : 's'} left — this request needs ${seats}`,
        );
      }

      await tx.query(
        `UPDATE ride_requests
            SET status = 'accepted'::ride_request_status, responded_by = $2::uuid, responded_at = NOW()
          WHERE id = $1::uuid`,
        [requestId, actor.id],
      );
      await tx.query('UPDATE rides SET seats_taken = seats_taken + $2::int WHERE id = $1::uuid', [rideId, seats]);
      await tx.query(
        `UPDATE rides SET status = 'full'::ride_status
          WHERE id = $1::uuid AND seats_taken >= total_seats AND status = 'published'::ride_status`,
        [rideId],
      );
    });

    await touchActivity(req.db, actor.id);
    const ride = await loadRide(req.db, actor.organizationId, actor.id, rideId);
    ride.requests = await loadRequests(req.db, rideId, true);
    return ok(res, ride, action === 'accept' ? 'Request accepted' : 'Request rejected');
  }),
);

/** POST /api/employee/rides/:id/requests/:requestId/cancel — passenger withdraws. */
employeeRidesRouter.post(
  '/:id/requests/:requestId/cancel',
  requireOperationalAccount,
  handler(async (req, res) => {
    const actor = actorOf(req);
    const rideId = parseId(req.params.id, 'ride id');
    const requestId = parseId(req.params.requestId, 'request id');

    await req.db.transaction(async (tx) => {
      const rideResult = await tx.query<{ status: string }>(
        `SELECT status::text AS status FROM rides
          WHERE id = $1::uuid AND organization_id = $2::uuid FOR UPDATE`,
        [rideId, actor.organizationId],
      );
      const ride = rideResult.rows[0];
      if (!ride) throw errors.notFound('That ride is not available');
      if (['in_progress', 'completed'].includes(ride.status)) {
        throw errors.ruleViolation('This ride has already started — talk to the driver instead');
      }

      const requestResult = await tx.query<{ seats: unknown; status: string; passenger_id: string }>(
        `SELECT seats, status::text AS status, passenger_id FROM ride_requests
          WHERE id = $1::uuid AND ride_id = $2::uuid FOR UPDATE`,
        [requestId, rideId],
      );
      const request = requestResult.rows[0];
      if (!request) throw errors.notFound('That request no longer exists');
      if (request.passenger_id !== actor.id) throw errors.forbidden('You can only withdraw your own request');
      if (!['pending', 'accepted'].includes(request.status)) {
        throw errors.ruleViolation(`This request is already ${request.status}`);
      }

      await tx.query(`UPDATE ride_requests SET status = 'canceled'::ride_request_status WHERE id = $1::uuid`, [
        requestId,
      ]);

      if (request.status === RIDE_REQUEST_STATUS.ACCEPTED) {
        await tx.query(
          `UPDATE rides
              SET seats_taken = GREATEST(0, seats_taken - $2::int),
                  status = CASE WHEN status = 'full'::ride_status THEN 'published'::ride_status ELSE status END
            WHERE id = $1::uuid`,
          [rideId, num(request.seats)],
        );
      }
    });

    const ride = await loadRide(req.db, actor.organizationId, actor.id, rideId);
    return ok(res, ride, 'Request withdrawn');
  }),
);

/** GET /api/employee/rides/requests/incoming — driver's pending queue. */
employeeRidesRouter.get(
  '/requests/incoming',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const { rows } = await req.db.query(
      `${RIDE_REQUEST_SELECT}
        JOIN rides r ON r.id = rq.ride_id
       WHERE r.driver_id = $1::uuid AND r.organization_id = $2::uuid AND rq.status = 'pending'
       ORDER BY rq.created_at ASC`,
      [actor.id, actor.organizationId],
    );
    return ok(res, rows.map((row) => mapRideRequest(row as Record<string, unknown>, true)));
  }),
);
