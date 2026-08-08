import { Router } from 'express';
import type { EmployeeHomeData, Trip } from '@carpool/shared';
import { actorOf, authenticate, requireRole } from '../../middleware/auth.js';
import { handler, ok } from '../../shared/http.js';
import { num } from '../../database/client.js';
import { mapRide, mapTrip, mapTripParticipant } from '../../shared/mappers.js';
import { RIDE_BASE_SELECT } from '../rides/queries.js';
import type { Queryable } from '../../database/client.js';

export const employeeHomeRouter = Router();
employeeHomeRouter.use(authenticate, requireRole('employee'));

const TRIP_SELECT = `
SELECT t.*, d.name AS driver_name FROM trips t JOIN users d ON d.id = t.driver_id`;

async function hydrateTrips(db: Queryable, rows: Array<Record<string, any>>, viewerId: string): Promise<Trip[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const participants = await db.query(
    `SELECT tp.trip_id, tp.user_id, tp.role, tp.seats, tp.share_amount, u.name AS user_name, u.phone AS user_phone
       FROM trip_participants tp JOIN users u ON u.id = tp.user_id
      WHERE tp.trip_id = ANY($1::uuid[])`,
    [ids],
  );
  const grouped = new Map<string, ReturnType<typeof mapTripParticipant>[]>();
  for (const p of participants.rows as Array<Record<string, any>>) {
    const list = grouped.get(p.trip_id) ?? [];
    list.push(mapTripParticipant(p, true));
    grouped.set(p.trip_id, list);
  }
  return rows.map((row) => mapTrip(row, grouped.get(row.id) ?? [], viewerId));
}

/**
 * GET /api/employee/home
 * One request that answers "what do I need to do with my commute today?".
 * Deliberately small: upcoming rides, the live trip, a few suggestions, stats.
 */
employeeHomeRouter.get(
  '/',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const org = actor.organizationId;

    const [upcoming, suggestions, activeTripRow, recentTripRows, pending, stats] = await Promise.all([
      req.db.query(
        `${RIDE_BASE_SELECT}
           AND r.departure_at > NOW()
           AND r.status IN ('published','full')
           AND (r.driver_id = $2::uuid OR EXISTS (
                 SELECT 1 FROM ride_requests rq
                  WHERE rq.ride_id = r.id AND rq.passenger_id = $2::uuid AND rq.status = 'accepted'))
         ORDER BY r.departure_at ASC LIMIT 3`,
        [org, actor.id],
      ),
      req.db.query(
        `${RIDE_BASE_SELECT}
           AND r.status = 'published'
           AND r.departure_at > NOW()
           AND r.driver_id <> $2::uuid
           AND r.seats_taken < r.total_seats
           AND NOT EXISTS (
             SELECT 1 FROM ride_requests rq
              WHERE rq.ride_id = r.id AND rq.passenger_id = $2::uuid AND rq.status IN ('pending','accepted'))
         ORDER BY r.departure_at ASC LIMIT 3`,
        [org, actor.id],
      ),
      req.db.query(
        `${TRIP_SELECT}
          WHERE t.organization_id = $1::uuid AND t.status = 'in_progress'
            AND EXISTS (SELECT 1 FROM trip_participants tp WHERE tp.trip_id = t.id AND tp.user_id = $2::uuid)
          ORDER BY t.started_at DESC LIMIT 1`,
        [org, actor.id],
      ),
      req.db.query(
        `${TRIP_SELECT}
          WHERE t.organization_id = $1::uuid AND t.status <> 'in_progress'
            AND EXISTS (SELECT 1 FROM trip_participants tp WHERE tp.trip_id = t.id AND tp.user_id = $2::uuid)
          ORDER BY COALESCE(t.completed_at, t.started_at) DESC LIMIT 4`,
        [org, actor.id],
      ),
      req.db.query<{ total: unknown }>(
        `SELECT COUNT(*) AS total FROM ride_requests rq JOIN rides r ON r.id = rq.ride_id
          WHERE r.driver_id = $1::uuid AND rq.status = 'pending'`,
        [actor.id],
      ),
      req.db.query<{
        rides_published: unknown;
        trips_completed: unknown;
        distance_km: unknown;
        saved_amount: unknown;
      }>(
        `SELECT
            (SELECT COUNT(*) FROM rides WHERE driver_id = $1::uuid) AS rides_published,
            (SELECT COUNT(*) FROM trip_participants tp JOIN trips t ON t.id = tp.trip_id
              WHERE tp.user_id = $1::uuid AND t.status = 'completed') AS trips_completed,
            (SELECT COALESCE(SUM(t.distance_km), 0) FROM trip_participants tp JOIN trips t ON t.id = tp.trip_id
              WHERE tp.user_id = $1::uuid AND t.status = 'completed') AS distance_km,
            (SELECT COALESCE(SUM(t.total_cost - tp.share_amount), 0)
               FROM trip_participants tp JOIN trips t ON t.id = tp.trip_id
              WHERE tp.user_id = $1::uuid AND t.status = 'completed') AS saved_amount`,
        [actor.id],
      ),
    ]);

    const activeTrips = await hydrateTrips(req.db, activeTripRow.rows as Array<Record<string, any>>, actor.id);
    const recentTrips = await hydrateTrips(req.db, recentTripRows.rows as Array<Record<string, any>>, actor.id);
    const s = stats.rows[0];

    const payload: EmployeeHomeData = {
      greetingName: actor.name.split(' ')[0] ?? actor.name,
      upcomingRides: upcoming.rows.map((row) => mapRide(row as Record<string, any>, { viewerId: actor.id })),
      activeTrip: activeTrips[0] ?? null,
      suggestions: suggestions.rows.map((row) => mapRide(row as Record<string, any>, { viewerId: actor.id })),
      pendingIncomingRequests: num(pending.rows[0]?.total),
      stats: {
        ridesPublished: num(s?.rides_published),
        tripsCompleted: num(s?.trips_completed),
        distanceKm: num(s?.distance_km),
        savedAmount: Math.max(0, num(s?.saved_amount)),
        currency: actor.organizationCurrency,
      },
      recentTrips,
    };

    return ok(res, payload);
  }),
);
