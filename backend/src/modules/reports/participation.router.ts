import { Router } from 'express';
import { reportQuerySchema, type ParticipationReport, type TrendPoint } from '@carpool/shared';
import { actorOf, authenticate, requireRole } from '../../middleware/auth.js';
import { parseQuery } from '../../middleware/validate.js';
import { handler, ok } from '../../shared/http.js';
import { num, round2 } from '../../database/client.js';
import { resolveRange } from './range.js';

export const adminParticipationRouter = Router();
adminParticipationRouter.use(authenticate, requireRole('admin'));

/**
 * GET /api/admin/participation
 *
 * Active participant = an employee who published, requested, or completed a
 * ride inside the selected period (the product definition).
 */
adminParticipationRouter.get(
  '/',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const query = parseQuery(req, reportQuerySchema);
    const range = resolveRange(query.from, query.to);
    const params = [actor.organizationId, range.from, range.toExclusive];

    const totals = await req.db.query<Record<string, unknown>>(
      `SELECT
         (SELECT COUNT(*) FROM users
           WHERE organization_id = $1::uuid AND role = 'employee' AND status <> 'deactivated') AS total_employees,
         (SELECT COUNT(*) FROM users u
           WHERE u.organization_id = $1::uuid AND u.role = 'employee'
             AND EXISTS (SELECT 1 FROM rides r
                          WHERE r.driver_id = u.id AND r.created_at >= $2::timestamptz
                            AND r.created_at < $3::timestamptz)) AS publishers,
         (SELECT COUNT(*) FROM users u
           WHERE u.organization_id = $1::uuid AND u.role = 'employee'
             AND EXISTS (SELECT 1 FROM ride_requests rq
                          WHERE rq.passenger_id = u.id AND rq.created_at >= $2::timestamptz
                            AND rq.created_at < $3::timestamptz)) AS requesters,
         (SELECT COUNT(*) FROM users u
           WHERE u.organization_id = $1::uuid AND u.role = 'employee'
             AND EXISTS (SELECT 1 FROM trip_participants tp JOIN trips t ON t.id = tp.trip_id
                          WHERE tp.user_id = u.id AND t.status = 'completed'
                            AND t.completed_at >= $2::timestamptz
                            AND t.completed_at < $3::timestamptz)) AS completers,
         (SELECT COUNT(*) FROM users u
           WHERE u.organization_id = $1::uuid AND u.role = 'employee'
             AND (EXISTS (SELECT 1 FROM rides r
                           WHERE r.driver_id = u.id AND r.created_at >= $2::timestamptz
                             AND r.created_at < $3::timestamptz)
               OR EXISTS (SELECT 1 FROM ride_requests rq
                           WHERE rq.passenger_id = u.id AND rq.created_at >= $2::timestamptz
                             AND rq.created_at < $3::timestamptz)
               OR EXISTS (SELECT 1 FROM trip_participants tp JOIN trips t ON t.id = tp.trip_id
                           WHERE tp.user_id = u.id AND t.status = 'completed'
                             AND t.completed_at >= $2::timestamptz
                             AND t.completed_at < $3::timestamptz))) AS active_participants`,
      params,
    );

    const bucket = async (unit: 'week' | 'month', periods: number): Promise<TrendPoint[]> => {
      const { rows } = await req.db.query<Record<string, unknown>>(
        `WITH buckets AS (
           SELECT date_trunc('${unit}', NOW()) - (n || ' ${unit}')::interval AS bucket
             FROM generate_series($2::int - 1, 0, -1) AS n
         )
         SELECT to_char(b.bucket, 'YYYY-MM-DD') AS period,
                to_char(b.bucket, '${unit === 'week' ? 'DD Mon' : 'Mon'}') AS label,
                COALESCE(t.trips, 0) AS trips,
                COALESCE(t.distance_km, 0) AS distance_km,
                COALESCE(t.cost, 0) AS cost,
                COALESCE(p.participants, 0) AS participants
           FROM buckets b
           LEFT JOIN (
             SELECT date_trunc('${unit}', completed_at) AS bucket, COUNT(*) AS trips,
                    SUM(distance_km) AS distance_km, SUM(total_cost) AS cost
               FROM trips
              WHERE organization_id = $1::uuid AND status = 'completed' AND completed_at IS NOT NULL
              GROUP BY 1
           ) t ON t.bucket = b.bucket
           LEFT JOIN (
             SELECT date_trunc('${unit}', t2.completed_at) AS bucket, COUNT(DISTINCT tp.user_id) AS participants
               FROM trip_participants tp JOIN trips t2 ON t2.id = tp.trip_id
              WHERE t2.organization_id = $1::uuid AND t2.status = 'completed' AND t2.completed_at IS NOT NULL
              GROUP BY 1
           ) p ON p.bucket = b.bucket
          ORDER BY b.bucket ASC`,
        [actor.organizationId, periods],
      );
      return rows.map((row) => ({
        period: String(row.period),
        label: String(row.label).trim(),
        trips: num(row.trips),
        distanceKm: round2(num(row.distance_km)),
        participants: num(row.participants),
        cost: round2(num(row.cost)),
      }));
    };

    const [weekly, monthly, top] = await Promise.all([
      bucket('week', 8),
      bucket('month', 6),
      req.db.query<Record<string, unknown>>(
        `SELECT u.id, u.name, u.department,
                (SELECT COUNT(*) FROM rides r WHERE r.driver_id = u.id
                  AND r.created_at >= $2::timestamptz AND r.created_at < $3::timestamptz) AS rides_published,
                (SELECT COUNT(*) FROM ride_requests rq WHERE rq.passenger_id = u.id
                  AND rq.created_at >= $2::timestamptz AND rq.created_at < $3::timestamptz) AS rides_requested,
                (SELECT COUNT(*) FROM trip_participants tp JOIN trips t ON t.id = tp.trip_id
                  WHERE tp.user_id = u.id AND t.status = 'completed'
                    AND t.completed_at >= $2::timestamptz AND t.completed_at < $3::timestamptz) AS trips_completed,
                (SELECT COALESCE(SUM(t.distance_km),0) FROM trip_participants tp JOIN trips t ON t.id = tp.trip_id
                  WHERE tp.user_id = u.id AND t.status = 'completed'
                    AND t.completed_at >= $2::timestamptz AND t.completed_at < $3::timestamptz) AS distance_km
           FROM users u
          WHERE u.organization_id = $1::uuid AND u.role = 'employee'
          ORDER BY trips_completed DESC, rides_published DESC, u.name ASC
          LIMIT 10`,
        params,
      ),
    ]);

    const t = totals.rows[0] ?? {};
    const totalEmployees = num(t.total_employees);
    const activeParticipants = num(t.active_participants);

    const report: ParticipationReport = {
      totalEmployees,
      activeParticipants,
      participationRate: totalEmployees === 0 ? 0 : round2((activeParticipants / totalEmployees) * 100),
      publishers: num(t.publishers),
      requesters: num(t.requesters),
      completers: num(t.completers),
      weekly,
      monthly,
      topParticipants: top.rows.map((row) => ({
        id: String(row.id),
        name: String(row.name),
        department: (row.department as string | null) ?? null,
        ridesPublished: num(row.rides_published),
        ridesRequested: num(row.rides_requested),
        tripsCompleted: num(row.trips_completed),
        distanceKm: round2(num(row.distance_km)),
      })),
    };

    return ok(res, report);
  }),
);
