import { Router } from 'express';
import { paginationQuerySchema, type DriverRow, type Paginated } from '@carpool/shared';
import { actorOf, authenticate, requireRole } from '../../middleware/auth.js';
import { parseQuery } from '../../middleware/validate.js';
import { handler, ok, paginationMeta, resolvePage } from '../../shared/http.js';
import { json, num, round2 } from '../../database/client.js';

export const adminDriversRouter = Router();
adminDriversRouter.use(authenticate, requireRole('admin'));

/**
 * GET /api/admin/drivers
 * Drivers are *derived*: an employee who owns at least one vehicle. There is
 * no driver account type — see the product rules.
 */
adminDriversRouter.get(
  '/',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const page = resolvePage(parseQuery(req, paginationQuerySchema));

    const countResult = await req.db.query<{ total: unknown }>(
      `SELECT COUNT(DISTINCT v.owner_id) AS total FROM vehicles v WHERE v.organization_id = $1::uuid`,
      [actor.organizationId],
    );

    const { rows } = await req.db.query<Record<string, any>>(
      `SELECT u.id AS employee_id, u.name, u.department, u.status AS account_status,
              COALESCE(json_agg(json_build_object(
                'id', v.id,
                'label', v.make || ' ' || v.model,
                'registrationNumber', v.registration_number,
                'seatingCapacity', v.seating_capacity,
                'status', v.status
              ) ORDER BY v.created_at) FILTER (WHERE v.id IS NOT NULL), '[]') AS vehicles,
              COALESCE(SUM(v.seating_capacity) FILTER (WHERE v.status = 'active'), 0) AS total_capacity,
              (SELECT COUNT(*) FROM rides r WHERE r.driver_id = u.id) AS rides_published,
              (SELECT COUNT(*) FROM trips t WHERE t.driver_id = u.id AND t.status = 'completed') AS trips_completed,
              (SELECT COALESCE(SUM(t.distance_km),0) FROM trips t WHERE t.driver_id = u.id AND t.status = 'completed') AS distance_km,
              (EXISTS (SELECT 1 FROM rides r WHERE r.driver_id = u.id AND r.created_at >= NOW() - INTERVAL '30 days')
               OR EXISTS (SELECT 1 FROM trips t WHERE t.driver_id = u.id AND t.status = 'completed'
                           AND t.completed_at >= NOW() - INTERVAL '30 days')) AS is_active_participant
         FROM users u
         JOIN vehicles v ON v.owner_id = u.id AND v.organization_id = u.organization_id
        WHERE u.organization_id = $1::uuid AND u.role = 'employee'
        GROUP BY u.id, u.name, u.department, u.status
        ORDER BY trips_completed DESC, u.name ASC
        LIMIT $2 OFFSET $3`,
      [actor.organizationId, page.limit, page.offset],
    );

    const payload: Paginated<DriverRow> = {
      items: rows.map((row) => ({
        employeeId: row.employee_id,
        name: row.name,
        department: row.department ?? null,
        accountStatus: row.account_status,
        vehicles: json(row.vehicles, [] as DriverRow['vehicles']),
        totalCapacity: num(row.total_capacity),
        ridesPublished: num(row.rides_published),
        tripsCompleted: num(row.trips_completed),
        distanceKm: round2(num(row.distance_km)),
        isActiveParticipant: row.is_active_participant === true,
      })),
      pagination: paginationMeta(page, num(countResult.rows[0]?.total)),
    };
    return ok(res, payload);
  }),
);
