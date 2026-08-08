import { Router } from 'express';
import {
  RIDE_STATUS,
  TRIP_STATUS,
  completeTripSchema,
  startTripSchema,
  type Trip,
} from '@carpool/shared';
import { actorOf, authenticate, requireOperationalAccount, requireRole } from '../../middleware/auth.js';
import { parseBody, parseId } from '../../middleware/validate.js';
import { created, handler, ok } from '../../shared/http.js';
import { errors } from '../../shared/errors.js';
import { num, type Queryable } from '../../database/client.js';
import { computeCost, resolveCostBasis, splitTripCost } from '../../shared/cost.js';
import { mapTrip, mapTripParticipant } from '../../shared/mappers.js';
import { touchActivity } from '../../shared/activity.js';

export const employeeTripsRouter = Router();
employeeTripsRouter.use(authenticate, requireRole('employee'));

const TRIP_SELECT = `
SELECT t.*, d.name AS driver_name
  FROM trips t JOIN users d ON d.id = t.driver_id`;

const PARTICIPANT_SELECT = `
SELECT tp.trip_id, tp.user_id, tp.role, tp.seats, tp.share_amount,
       u.name AS user_name, u.phone AS user_phone
  FROM trip_participants tp JOIN users u ON u.id = tp.user_id`;

/** Loads a trip the viewer actually took part in. */
async function loadTrip(db: Queryable, organizationId: string, viewerId: string, tripId: string): Promise<Trip> {
  const { rows } = await db.query(`${TRIP_SELECT} WHERE t.id = $1::uuid AND t.organization_id = $2::uuid`, [
    tripId,
    organizationId,
  ]);
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) throw errors.notFound('That trip is not available');

  const participantRows = await db.query(`${PARTICIPANT_SELECT} WHERE tp.trip_id = $1::uuid ORDER BY tp.role ASC`, [
    tripId,
  ]);
  const participants = participantRows.rows.map((p) => mapTripParticipant(p as Record<string, unknown>, true));

  if (!participants.some((p) => p.id === viewerId)) {
    throw errors.forbidden('You were not part of this trip');
  }
  return mapTrip(row, participants, viewerId);
}

/** GET /api/employee/trips — trip history (completed + canceled + active). */
employeeTripsRouter.get(
  '/',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const { rows } = await req.db.query(
      `${TRIP_SELECT}
        WHERE t.organization_id = $2::uuid
          AND EXISTS (SELECT 1 FROM trip_participants tp WHERE tp.trip_id = t.id AND tp.user_id = $1::uuid)
        ORDER BY COALESCE(t.completed_at, t.started_at) DESC
        LIMIT 100`,
      [actor.id, actor.organizationId],
    );

    if (rows.length === 0) return ok(res, []);

    const ids = rows.map((r) => (r as { id: string }).id);
    const participantRows = await req.db.query(
      `${PARTICIPANT_SELECT} WHERE tp.trip_id = ANY($1::uuid[]) ORDER BY tp.role ASC`,
      [ids],
    );

    const grouped = new Map<string, ReturnType<typeof mapTripParticipant>[]>();
    for (const p of participantRows.rows as Array<Record<string, any>>) {
      const list = grouped.get(p.trip_id) ?? [];
      list.push(mapTripParticipant(p, true));
      grouped.set(p.trip_id, list);
    }

    const trips = rows.map((row) =>
      mapTrip(row as Record<string, unknown>, grouped.get((row as { id: string }).id) ?? [], actor.id),
    );
    return ok(res, trips);
  }),
);

/** GET /api/employee/trips/active — the trip currently under way, if any. */
employeeTripsRouter.get(
  '/active',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const { rows } = await req.db.query<{ id: string }>(
      `SELECT t.id FROM trips t
        WHERE t.organization_id = $2::uuid AND t.status = 'in_progress'
          AND EXISTS (SELECT 1 FROM trip_participants tp WHERE tp.trip_id = t.id AND tp.user_id = $1::uuid)
        ORDER BY t.started_at DESC LIMIT 1`,
      [actor.id, actor.organizationId],
    );
    if (!rows[0]) return ok(res, null);
    return ok(res, await loadTrip(req.db, actor.organizationId, actor.id, rows[0].id));
  }),
);

/** GET /api/employee/trips/:id */
employeeTripsRouter.get(
  '/:id',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const tripId = parseId(req.params.id, 'trip id');
    return ok(res, await loadTrip(req.db, actor.organizationId, actor.id, tripId));
  }),
);

/**
 * POST /api/employee/trips — start the trip for a ride.
 * Freezes the vehicle and the effective cost configuration onto the trip so
 * later configuration edits can never rewrite this history.
 */
employeeTripsRouter.post(
  '/',
  requireOperationalAccount,
  handler(async (req, res) => {
    const actor = actorOf(req);
    const { rideId } = parseBody(req, startTripSchema);

    const tripId = await req.db.transaction(async (tx) => {
      const rideResult = await tx.query<Record<string, any>>(
        `SELECT r.*, v.id AS v_id, v.make, v.model, v.registration_number, v.vehicle_type,
                v.seating_capacity, v.color
           FROM rides r JOIN vehicles v ON v.id = r.vehicle_id
          WHERE r.id = $1::uuid AND r.organization_id = $2::uuid FOR UPDATE OF r`,
        [rideId, actor.organizationId],
      );
      const ride = rideResult.rows[0];
      if (!ride) throw errors.notFound('That ride is not available');
      if (ride.driver_id !== actor.id) throw errors.forbidden('Only the driver can start this trip');
      if (ride.status === RIDE_STATUS.IN_PROGRESS) throw errors.conflict('This trip has already started');
      if (ride.status !== RIDE_STATUS.PUBLISHED && ride.status !== RIDE_STATUS.FULL) {
        throw errors.ruleViolation(`A ride that is ${String(ride.status).replace('_', ' ')} cannot be started`);
      }

      const accepted = await tx.query<{ passenger_id: string; seats: unknown }>(
        `SELECT passenger_id, seats FROM ride_requests
          WHERE ride_id = $1::uuid AND status = 'accepted'`,
        [rideId],
      );

      const startedAt = new Date();
      const basis = await resolveCostBasis(tx, actor.organizationId, startedAt);

      const vehicleSnapshot = {
        id: ride.v_id,
        make: ride.make,
        model: ride.model,
        registrationNumber: ride.registration_number,
        vehicleType: ride.vehicle_type,
        seatingCapacity: num(ride.seating_capacity),
        color: ride.color ?? null,
      };
      const costSnapshot = {
        fuelCostPerLitre: basis.fuelCostPerLitre,
        travelCostPerKm: basis.travelCostPerKm,
        mileageKmpl: basis.mileageKmpl,
        currency: basis.currency,
        costConfigurationId: basis.costConfigurationId,
      };

      const inserted = await tx.query<{ id: string }>(
        `INSERT INTO trips (organization_id, ride_id, driver_id, start_location, destination,
                            vehicle_snapshot, cost_snapshot, cost_configuration_id,
                            distance_km, currency, status, started_at)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6::jsonb, $7::jsonb, $8::uuid,
                 $9::numeric, $10, 'in_progress'::trip_status, $11::timestamptz)
         RETURNING id`,
        [
          actor.organizationId,
          rideId,
          actor.id,
          ride.start_location,
          ride.destination,
          JSON.stringify(vehicleSnapshot),
          JSON.stringify(costSnapshot),
          basis.costConfigurationId,
          num(ride.estimated_distance_km),
          basis.currency,
          startedAt.toISOString(),
        ],
      );
      const newTripId = inserted.rows[0]!.id;

      await tx.query(
        `INSERT INTO trip_participants (organization_id, trip_id, user_id, role, seats)
         VALUES ($1::uuid, $2::uuid, $3::uuid, 'driver'::trip_role, 1)`,
        [actor.organizationId, newTripId, actor.id],
      );
      for (const passenger of accepted.rows) {
        await tx.query(
          `INSERT INTO trip_participants (organization_id, trip_id, user_id, role, seats)
           VALUES ($1::uuid, $2::uuid, $3::uuid, 'passenger'::trip_role, $4::int)`,
          [actor.organizationId, newTripId, passenger.passenger_id, num(passenger.seats, 1)],
        );
      }

      await tx.query(`UPDATE rides SET status = 'in_progress'::ride_status WHERE id = $1::uuid`, [rideId]);
      return newTripId;
    });

    await touchActivity(req.db, actor.id);
    return created(res, await loadTrip(req.db, actor.organizationId, actor.id, tripId), 'Trip started');
  }),
);

/**
 * POST /api/employee/trips/:id/complete
 * Applies the snapshotted cost basis to the actual distance, writes the
 * settlement, and closes the ride.
 */
employeeTripsRouter.post(
  '/:id/complete',
  requireOperationalAccount,
  handler(async (req, res) => {
    const actor = actorOf(req);
    const tripId = parseId(req.params.id, 'trip id');
    const input = parseBody(req, completeTripSchema);

    await req.db.transaction(async (tx) => {
      const tripResult = await tx.query<Record<string, any>>(
        `SELECT * FROM trips WHERE id = $1::uuid AND organization_id = $2::uuid FOR UPDATE`,
        [tripId, actor.organizationId],
      );
      const trip = tripResult.rows[0];
      if (!trip) throw errors.notFound('That trip is not available');
      if (trip.driver_id !== actor.id) throw errors.forbidden('Only the driver can complete this trip');
      if (trip.status !== TRIP_STATUS.IN_PROGRESS) {
        throw errors.ruleViolation(`This trip is already ${trip.status}`);
      }

      const snapshot =
        typeof trip.cost_snapshot === 'string' ? JSON.parse(trip.cost_snapshot) : trip.cost_snapshot;
      const distance = input.distanceKm ?? num(trip.distance_km);
      if (distance <= 0) {
        throw errors.validation('Enter the distance travelled', { distanceKm: 'Required' });
      }

      const breakdown = computeCost(distance, {
        fuelCostPerLitre: num(snapshot?.fuelCostPerLitre),
        travelCostPerKm: num(snapshot?.travelCostPerKm),
        mileageKmpl: num(snapshot?.mileageKmpl, 12),
        currency: snapshot?.currency ?? 'INR',
        costConfigurationId: snapshot?.costConfigurationId ?? null,
      });

      const participants = await tx.query<{ user_id: string; role: string; seats: unknown }>(
        'SELECT user_id, role::text AS role, seats FROM trip_participants WHERE trip_id = $1::uuid',
        [tripId],
      );
      const passengers = participants.rows
        .filter((p) => p.role === 'passenger')
        .map((p) => ({ userId: p.user_id, seats: num(p.seats, 1) }));

      const split = splitTripCost(breakdown.totalCost, passengers);

      await tx.query(
        `UPDATE trips
            SET distance_km = $2::numeric,
                fuel_consumed_litres = $3::numeric,
                total_cost = $4::numeric,
                cost_per_km = $5::numeric,
                status = 'completed'::trip_status,
                completed_at = NOW()
          WHERE id = $1::uuid`,
        [tripId, distance, breakdown.fuelLitres, breakdown.totalCost, breakdown.costPerKm],
      );

      await tx.query(
        `UPDATE trip_participants SET share_amount = $2::numeric WHERE trip_id = $1::uuid AND role = 'driver'`,
        [tripId, split.driverShare],
      );

      for (const share of split.passengerShares) {
        await tx.query(
          `UPDATE trip_participants SET share_amount = $3::numeric
            WHERE trip_id = $1::uuid AND user_id = $2::uuid`,
          [tripId, share.userId, share.amount],
        );
        if (share.amount > 0) {
          await tx.query(
            `INSERT INTO payments (organization_id, trip_id, payer_id, receiver_id, amount, currency, status)
             VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::numeric, $6, 'pending'::payment_status)`,
            [actor.organizationId, tripId, share.userId, actor.id, share.amount, trip.currency],
          );
        }
      }

      await tx.query(`UPDATE rides SET status = 'completed'::ride_status WHERE id = $1::uuid`, [trip.ride_id]);
      await tx.query(
        `UPDATE users SET last_activity_at = NOW()
          WHERE id IN (SELECT user_id FROM trip_participants WHERE trip_id = $1::uuid)`,
        [tripId],
      );
    });

    return ok(res, await loadTrip(req.db, actor.organizationId, actor.id, tripId), 'Trip completed');
  }),
);

/** POST /api/employee/trips/:id/cancel */
employeeTripsRouter.post(
  '/:id/cancel',
  requireOperationalAccount,
  handler(async (req, res) => {
    const actor = actorOf(req);
    const tripId = parseId(req.params.id, 'trip id');

    await req.db.transaction(async (tx) => {
      const { rows } = await tx.query<{ driver_id: string; status: string; ride_id: string }>(
        `SELECT driver_id, status::text AS status, ride_id FROM trips
          WHERE id = $1::uuid AND organization_id = $2::uuid FOR UPDATE`,
        [tripId, actor.organizationId],
      );
      const trip = rows[0];
      if (!trip) throw errors.notFound('That trip is not available');
      if (trip.driver_id !== actor.id) throw errors.forbidden('Only the driver can cancel this trip');
      if (trip.status !== TRIP_STATUS.IN_PROGRESS) throw errors.ruleViolation(`This trip is already ${trip.status}`);

      await tx.query(
        `UPDATE trips SET status = 'canceled'::trip_status, completed_at = NOW(), total_cost = 0, distance_km = 0
          WHERE id = $1::uuid`,
        [tripId],
      );
      await tx.query(`UPDATE rides SET status = 'canceled'::ride_status WHERE id = $1::uuid`, [trip.ride_id]);
    });

    return ok(res, await loadTrip(req.db, actor.organizationId, actor.id, tripId), 'Trip canceled');
  }),
);
