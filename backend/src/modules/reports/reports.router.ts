import { Router } from 'express';
import {
  reportQuerySchema,
  type DriverActivityRow,
  type ReportsResponse,
  type TrendPoint,
  type VehicleCostRow,
} from '@carpool/shared';
import { actorOf, authenticate, requireRole } from '../../middleware/auth.js';
import { parseQuery } from '../../middleware/validate.js';
import { handler, ok } from '../../shared/http.js';
import { num, round2 } from '../../database/client.js';
import { resolveRange } from './range.js';

export const adminReportsRouter = Router();
adminReportsRouter.use(authenticate, requireRole('admin'));

/**
 * GET /api/admin/reports
 *
 * Every figure comes from completed trips only — canceled rides and canceled
 * trips are reported separately and never inflate completed-trip metrics.
 * Fuel and cost come from each trip's own snapshot, so re-running a report
 * after a price change reproduces the original numbers.
 */
adminReportsRouter.get(
  '/',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const query = parseQuery(req, reportQuerySchema);
    const range = resolveRange(query.from, query.to);

    const params: unknown[] = [actor.organizationId, range.from, range.toExclusive];
    const filters: string[] = [];

    if (query.vehicleId) {
      params.push(query.vehicleId);
      filters.push(`r.vehicle_id = $${params.length}::uuid`);
    }
    if (query.driverId) {
      params.push(query.driverId);
      filters.push(`t.driver_id = $${params.length}::uuid`);
    }
    if (query.department) {
      params.push(query.department);
      filters.push(`d.department = $${params.length}`);
    }

    const extra = filters.map((f) => `AND ${f}`).join(' ');

    const statusFilter = query.tripStatus
      ? `t.status = '${query.tripStatus}'`
      : `t.status = 'completed'`;

    /** Trips inside the range, honouring every filter. */
    const scope = `
      FROM trips t
      JOIN rides r ON r.id = t.ride_id
      JOIN users d ON d.id = t.driver_id
      JOIN vehicles v ON v.id = r.vehicle_id
     WHERE t.organization_id = $1::uuid
       AND ${statusFilter}
       AND COALESCE(t.completed_at, t.started_at) >= $2::timestamptz
       AND COALESCE(t.completed_at, t.started_at) < $3::timestamptz
       ${extra}`;

    const [totalsResult, canceledResult, monthlyResult, vehiclesResult, driversResult] = await Promise.all([
      req.db.query<Record<string, unknown>>(
        `SELECT COUNT(*) AS trips,
                COALESCE(SUM(t.distance_km), 0) AS distance_km,
                COALESCE(SUM(t.fuel_consumed_litres), 0) AS fuel_litres,
                COALESCE(SUM(t.total_cost), 0) AS total_cost,
                COALESCE(AVG((SELECT COUNT(*) FROM trip_participants tp WHERE tp.trip_id = t.id)), 0) AS occupancy
         ${scope}`,
        params,
      ),
      req.db.query<Record<string, unknown>>(
        `SELECT
           (SELECT COUNT(*) FROM rides r2
             WHERE r2.organization_id = $1::uuid AND r2.status = 'canceled'
               AND r2.departure_at >= $2::timestamptz AND r2.departure_at < $3::timestamptz) AS canceled_rides,
           (SELECT COUNT(*) FROM trips t2
             WHERE t2.organization_id = $1::uuid AND t2.status = 'canceled'
               AND COALESCE(t2.completed_at, t2.started_at) >= $2::timestamptz
               AND COALESCE(t2.completed_at, t2.started_at) < $3::timestamptz) AS canceled_trips,
           (SELECT COUNT(*) FROM rides r3
             WHERE r3.organization_id = $1::uuid
               AND r3.departure_at >= $2::timestamptz AND r3.departure_at < $3::timestamptz) AS rides`,
        [actor.organizationId, range.from, range.toExclusive],
      ),
      req.db.query<Record<string, unknown>>(
        `SELECT to_char(date_trunc('month', COALESCE(t.completed_at, t.started_at)), 'YYYY-MM') AS period,
                to_char(date_trunc('month', COALESCE(t.completed_at, t.started_at)), 'Mon') AS label,
                COUNT(*) AS trips,
                COALESCE(SUM(t.distance_km), 0) AS distance_km,
                COALESCE(SUM(t.total_cost), 0) AS cost,
                COUNT(DISTINCT t.driver_id) AS participants
         ${scope}
         GROUP BY 1, 2
         ORDER BY 1 ASC`,
        params,
      ),
      req.db.query<Record<string, unknown>>(
        `SELECT v.id AS vehicle_id,
                v.make || ' ' || v.model AS label,
                v.registration_number,
                COUNT(*) AS trips,
                COALESCE(SUM(t.distance_km), 0) AS distance_km,
                COALESCE(SUM(t.fuel_consumed_litres), 0) AS fuel_litres,
                COALESCE(SUM(t.total_cost), 0) AS cost
         ${scope}
         GROUP BY v.id, v.make, v.model, v.registration_number
         ORDER BY cost DESC
         LIMIT 25`,
        params,
      ),
      req.db.query<Record<string, unknown>>(
        `SELECT d.id AS driver_id, d.name, d.department,
                (SELECT COUNT(*) FROM rides r2 WHERE r2.driver_id = d.id
                  AND r2.created_at >= $2::timestamptz AND r2.created_at < $3::timestamptz) AS rides_published,
                COUNT(*) AS trips_completed,
                COALESCE(SUM(t.distance_km), 0) AS distance_km,
                COALESCE(SUM((SELECT COUNT(*) FROM trip_participants tp
                               WHERE tp.trip_id = t.id AND tp.role = 'passenger')), 0) AS passengers_served,
                COALESCE(SUM(t.total_cost), 0) AS cost
         ${scope}
         GROUP BY d.id, d.name, d.department
         ORDER BY trips_completed DESC, d.name ASC
         LIMIT 25`,
        params,
      ),
    ]);

    const totalsRow = totalsResult.rows[0] ?? {};
    const distanceKm = round2(num(totalsRow.distance_km));
    const totalCost = round2(num(totalsRow.total_cost));
    const canceled = canceledResult.rows[0] ?? {};

    const monthly: TrendPoint[] = monthlyResult.rows.map((row) => ({
      period: String(row.period),
      label: String(row.label).trim(),
      trips: num(row.trips),
      distanceKm: round2(num(row.distance_km)),
      participants: num(row.participants),
      cost: round2(num(row.cost)),
    }));

    const vehicles: VehicleCostRow[] = vehiclesResult.rows.map((row) => {
      const vDistance = round2(num(row.distance_km));
      const vFuel = round2(num(row.fuel_litres));
      const vCost = round2(num(row.cost));
      return {
        vehicleId: String(row.vehicle_id),
        label: String(row.label),
        registrationNumber: String(row.registration_number),
        trips: num(row.trips),
        distanceKm: vDistance,
        fuelLitres: vFuel,
        cost: vCost,
        costPerKm: vDistance > 0 ? round2(vCost / vDistance) : 0,
        efficiencyKmpl: vFuel > 0 ? round2(vDistance / vFuel) : 0,
      };
    });

    const drivers: DriverActivityRow[] = driversResult.rows.map((row) => ({
      driverId: String(row.driver_id),
      name: String(row.name),
      department: (row.department as string | null) ?? null,
      ridesPublished: num(row.rides_published),
      tripsCompleted: num(row.trips_completed),
      distanceKm: round2(num(row.distance_km)),
      passengersServed: num(row.passengers_served),
      cost: round2(num(row.cost)),
    }));

    const payload: ReportsResponse = {
      totals: {
        rides: num(canceled.rides),
        completedTrips: num(totalsRow.trips),
        canceledRides: num(canceled.canceled_rides),
        canceledTrips: num(canceled.canceled_trips),
        distanceKm,
        fuelLitres: round2(num(totalsRow.fuel_litres)),
        totalCost,
        costPerKm: distanceKm > 0 ? round2(totalCost / distanceKm) : 0,
        averageOccupancy: round2(num(totalsRow.occupancy)),
        currency: actor.organizationCurrency,
      },
      monthly,
      vehicles,
      drivers,
      filters: {
        from: range.from,
        to: range.to,
        vehicleId: query.vehicleId ?? null,
        driverId: query.driverId ?? null,
        department: query.department ?? null,
        tripStatus: query.tripStatus ?? null,
      },
    };

    return ok(res, payload);
  }),
);
