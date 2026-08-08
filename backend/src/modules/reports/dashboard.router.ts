import { Router } from 'express';
import type { AuditLogEntry, DashboardSummary, TrendPoint } from '@carpool/shared';
import { actorOf, authenticate, requireRole } from '../../middleware/auth.js';
import { handler, ok } from '../../shared/http.js';
import { num, round2 } from '../../database/client.js';
import { mapAuditLog } from '../../shared/mappers.js';

export const adminDashboardRouter = Router();
adminDashboardRouter.use(authenticate, requireRole('admin'));

/**
 * GET /api/admin/dashboard
 * Deliberately split from /trend and /activity so one slow aggregate never
 * blocks the whole dashboard.
 */
adminDashboardRouter.get(
  '/',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const org = actor.organizationId;

    const { rows } = await req.db.query<Record<string, unknown>>(
      `SELECT
         (SELECT COUNT(*) FROM users WHERE organization_id = $1::uuid AND role = 'employee') AS employees_total,
         (SELECT COUNT(*) FROM users WHERE organization_id = $1::uuid AND role = 'employee' AND status = 'active') AS employees_active,
         (SELECT COUNT(*) FROM users WHERE organization_id = $1::uuid AND role = 'employee' AND status = 'pending') AS employees_pending,
         (SELECT COUNT(*) FROM users WHERE organization_id = $1::uuid AND role = 'employee' AND status = 'suspended') AS employees_suspended,
         (SELECT COUNT(*) FROM users WHERE organization_id = $1::uuid AND role = 'employee'
                 AND created_at >= date_trunc('month', NOW())) AS employees_new,
         (SELECT COUNT(*) FROM vehicles WHERE organization_id = $1::uuid) AS vehicles_total,
         (SELECT COUNT(*) FROM vehicles WHERE organization_id = $1::uuid AND status = 'active') AS vehicles_active,
         (SELECT COUNT(*) FROM vehicles WHERE organization_id = $1::uuid AND status = 'under_review') AS vehicles_review,
         (SELECT COUNT(*) FROM rides WHERE organization_id = $1::uuid) AS rides_total,
         (SELECT COUNT(*) FROM rides WHERE organization_id = $1::uuid AND status = 'published') AS rides_published,
         (SELECT COUNT(*) FROM rides WHERE organization_id = $1::uuid AND status = 'canceled') AS rides_canceled,
         (SELECT COUNT(*) FROM trips WHERE organization_id = $1::uuid AND status = 'completed') AS trips_completed,
         (SELECT COUNT(*) FROM trips WHERE organization_id = $1::uuid AND status = 'in_progress') AS trips_active,
         (SELECT COUNT(*) FROM trips WHERE organization_id = $1::uuid AND status = 'completed'
                 AND completed_at >= date_trunc('month', NOW())) AS trips_completed_month,
         (SELECT COALESCE(SUM(distance_km), 0) FROM trips WHERE organization_id = $1::uuid AND status = 'completed') AS distance_total,
         (SELECT COALESCE(SUM(distance_km), 0) FROM trips WHERE organization_id = $1::uuid AND status = 'completed'
                 AND completed_at >= date_trunc('month', NOW())) AS distance_month,
         (SELECT COALESCE(SUM(fuel_consumed_litres), 0) FROM trips WHERE organization_id = $1::uuid AND status = 'completed') AS fuel_total,
         (SELECT COALESCE(SUM(total_cost), 0) FROM trips WHERE organization_id = $1::uuid AND status = 'completed') AS cost_total,
         (SELECT COUNT(DISTINCT u.id) FROM users u
            WHERE u.organization_id = $1::uuid AND u.role = 'employee'
              AND (EXISTS (SELECT 1 FROM rides r WHERE r.driver_id = u.id AND r.created_at >= NOW() - INTERVAL '30 days')
                OR EXISTS (SELECT 1 FROM ride_requests rq WHERE rq.passenger_id = u.id AND rq.created_at >= NOW() - INTERVAL '30 days')
                OR EXISTS (SELECT 1 FROM trip_participants tp JOIN trips t ON t.id = tp.trip_id
                            WHERE tp.user_id = u.id AND t.status = 'completed'
                              AND t.completed_at >= NOW() - INTERVAL '30 days'))) AS active_participants`,
      [org],
    );

    const r = rows[0] ?? {};
    const employeesTotal = num(r.employees_total);
    const activeParticipants = num(r.active_participants);
    const distanceTotal = round2(num(r.distance_total));
    const costTotal = round2(num(r.cost_total));

    const summary: DashboardSummary = {
      employees: {
        total: employeesTotal,
        active: num(r.employees_active),
        pending: num(r.employees_pending),
        suspended: num(r.employees_suspended),
        newThisMonth: num(r.employees_new),
      },
      vehicles: {
        total: num(r.vehicles_total),
        active: num(r.vehicles_active),
        underReview: num(r.vehicles_review),
      },
      participation: {
        activeParticipants,
        participationRate: employeesTotal === 0 ? 0 : round2((activeParticipants / employeesTotal) * 100),
      },
      rides: {
        total: num(r.rides_total),
        published: num(r.rides_published),
        canceled: num(r.rides_canceled),
      },
      trips: {
        completed: num(r.trips_completed),
        inProgress: num(r.trips_active),
        completedThisMonth: num(r.trips_completed_month),
      },
      distance: { totalKm: distanceTotal, thisMonthKm: round2(num(r.distance_month)) },
      fuel: { litres: round2(num(r.fuel_total)) },
      cost: {
        total: costTotal,
        perKm: distanceTotal > 0 ? round2(costTotal / distanceTotal) : 0,
        currency: actor.organizationCurrency,
      },
    };

    return ok(res, summary);
  }),
);

/** GET /api/admin/dashboard/trend — last 6 months of trips/distance/participation. */
adminDashboardRouter.get(
  '/trend',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const { rows } = await req.db.query<Record<string, unknown>>(
      `WITH months AS (
         SELECT date_trunc('month', NOW()) - (n || ' month')::interval AS month
           FROM generate_series(5, 0, -1) AS n
       )
       SELECT to_char(m.month, 'YYYY-MM') AS period,
              to_char(m.month, 'Mon') AS label,
              COALESCE(t.trips, 0) AS trips,
              COALESCE(t.distance_km, 0) AS distance_km,
              COALESCE(t.cost, 0) AS cost,
              COALESCE(p.participants, 0) AS participants
         FROM months m
         LEFT JOIN (
           SELECT date_trunc('month', completed_at) AS month,
                  COUNT(*) AS trips,
                  SUM(distance_km) AS distance_km,
                  SUM(total_cost) AS cost
             FROM trips
            WHERE organization_id = $1::uuid AND status = 'completed' AND completed_at IS NOT NULL
            GROUP BY 1
         ) t ON t.month = m.month
         LEFT JOIN (
           SELECT date_trunc('month', t2.completed_at) AS month,
                  COUNT(DISTINCT tp.user_id) AS participants
             FROM trip_participants tp JOIN trips t2 ON t2.id = tp.trip_id
            WHERE t2.organization_id = $1::uuid AND t2.status = 'completed' AND t2.completed_at IS NOT NULL
            GROUP BY 1
         ) p ON p.month = m.month
        ORDER BY m.month ASC`,
      [actor.organizationId],
    );

    const trend: TrendPoint[] = rows.map((row) => ({
      period: String(row.period),
      label: String(row.label).trim(),
      trips: num(row.trips),
      distanceKm: round2(num(row.distance_km)),
      participants: num(row.participants),
      cost: round2(num(row.cost)),
    }));

    return ok(res, trend);
  }),
);

/** GET /api/admin/dashboard/activity — recent administrative activity. */
adminDashboardRouter.get(
  '/activity',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const { rows } = await req.db.query(
      `SELECT * FROM audit_logs WHERE organization_id = $1::uuid ORDER BY created_at DESC LIMIT 8`,
      [actor.organizationId],
    );
    const entries: AuditLogEntry[] = rows.map((row) => mapAuditLog(row as Record<string, unknown>));
    return ok(res, entries);
  }),
);
