import { Router } from 'express';
import { adminTripListQuerySchema, type AdminTripRow, type Paginated, type TripStatus } from '@carpool/shared';
import { actorOf, authenticate, requireRole } from '../../middleware/auth.js';
import { parseQuery } from '../../middleware/validate.js';
import { handler, ok, paginationMeta, resolvePage } from '../../shared/http.js';
import { json, num, round2 } from '../../database/client.js';

/**
 * Trip monitoring for administrators. Two routers over one query because the
 * admin panel presents "Active Trips" and "Completed Trips" as separate tabs
 * with different columns.
 */

const TRIP_SELECT = `
SELECT t.id, t.ride_id, t.driver_id, t.start_location, t.destination,
       t.vehicle_snapshot, t.distance_km, t.fuel_consumed_litres,
       t.total_cost, t.cost_per_km, t.currency, t.status,
       t.started_at, t.completed_at,
       d.name AS driver_name,
       (SELECT COUNT(*) FROM trip_participants tp
         WHERE tp.trip_id = t.id AND tp.role = 'passenger') AS passenger_count
  FROM trips t
  JOIN users d ON d.id = t.driver_id
 WHERE t.organization_id = $1::uuid`;

function mapAdminTrip(row: Record<string, any>): AdminTripRow {
  const snapshot = json(row.vehicle_snapshot, {
    make: '',
    model: '',
    registrationNumber: '',
  } as { make: string; model: string; registrationNumber: string });

  return {
    id: row.id,
    rideId: row.ride_id,
    driverId: row.driver_id,
    driverName: row.driver_name ?? '',
    startLocation: row.start_location,
    destination: row.destination,
    vehicleLabel: `${snapshot.make ?? ''} ${snapshot.model ?? ''}`.trim(),
    registrationNumber: snapshot.registrationNumber ?? '',
    passengerCount: num(row.passenger_count),
    distanceKm: round2(num(row.distance_km)),
    fuelConsumedLitres: round2(num(row.fuel_consumed_litres)),
    totalCost: round2(num(row.total_cost)),
    costPerKm: round2(num(row.cost_per_km)),
    currency: (row.currency ?? 'INR').trim(),
    status: row.status,
    startedAt: new Date(row.started_at).toISOString(),
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
  };
}

function tripListRouter(status: TripStatus, orderBy: string): Router {
  const router = Router();
  router.use(authenticate, requireRole('admin'));

  router.get(
    '/',
    handler(async (req, res) => {
      const actor = actorOf(req);
      const query = parseQuery(req, adminTripListQuerySchema);
      const page = resolvePage(query);

      const params: unknown[] = [actor.organizationId, status];
      const filters: string[] = ['t.status = $2::trip_status'];

      if (query.search) {
        params.push(`%${query.search}%`);
        filters.push(
          `(t.start_location ILIKE $${params.length} OR t.destination ILIKE $${params.length}
            OR d.name ILIKE $${params.length})`,
        );
      }
      if (query.driverId) {
        params.push(query.driverId);
        filters.push(`t.driver_id = $${params.length}::uuid`);
      }
      if (query.from) {
        params.push(query.from);
        filters.push(`t.started_at >= $${params.length}::timestamptz`);
      }
      if (query.to) {
        params.push(query.to);
        filters.push(`t.started_at < ($${params.length}::date + INTERVAL '1 day')`);
      }
      const where = filters.map((filter) => `AND ${filter}`).join(' ');

      const countResult = await req.db.query<{ total: unknown }>(
        `SELECT COUNT(*) AS total
           FROM trips t JOIN users d ON d.id = t.driver_id
          WHERE t.organization_id = $1::uuid ${where}`,
        params,
      );

      const listParams = [...params, page.limit, page.offset];
      const { rows } = await req.db.query(
        `${TRIP_SELECT} ${where}
          ORDER BY ${orderBy}
          LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
        listParams,
      );

      const payload: Paginated<AdminTripRow> = {
        items: rows.map((row) => mapAdminTrip(row as Record<string, any>)),
        pagination: paginationMeta(page, num(countResult.rows[0]?.total)),
      };
      return ok(res, payload);
    }),
  );

  return router;
}

/** GET /api/admin/active-trips */
export const adminActiveTripsRouter = tripListRouter('in_progress', 't.started_at DESC');

/** GET /api/admin/completed-trips */
export const adminCompletedTripsRouter = tripListRouter('completed', 't.completed_at DESC NULLS LAST');
