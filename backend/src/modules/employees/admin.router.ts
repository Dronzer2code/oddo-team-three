import { Router } from 'express';
import {
  ACCOUNT_STATUS,
  AUDIT_ACTION,
  adminUpdateEmployeeSchema,
  employeeListQuerySchema,
  employeeStatusSchema,
  type EmployeeDetail,
  type EmployeeSummary,
  type Paginated,
} from '@carpool/shared';
import { actorOf, authenticate, requireRole } from '../../middleware/auth.js';
import { parseBody, parseId, parseQuery } from '../../middleware/validate.js';
import { handler, ok, paginationMeta, resolvePage } from '../../shared/http.js';
import { errors } from '../../shared/errors.js';
import { iso, isoRequired, num, round2 } from '../../database/client.js';
import { diffFields, writeAudit } from '../../shared/audit.js';
import { mapAuditLog, mapVehicle } from '../../shared/mappers.js';

export const adminEmployeesRouter = Router();
adminEmployeesRouter.use(authenticate, requireRole('admin'));

/**
 * Employee projection with the derived counters the admin list needs.
 * `is_active_participant` follows the product definition: published,
 * requested, or completed a ride in the last 30 days.
 */
const EMPLOYEE_SELECT = `
SELECT u.id, u.name, u.email, u.phone, u.employee_code, u.department, u.role, u.status,
       u.created_at, u.last_activity_at, u.organization_id,
       (SELECT COUNT(*) FROM vehicles v WHERE v.owner_id = u.id) AS vehicle_count,
       (SELECT COUNT(*) FROM rides r WHERE r.driver_id = u.id) AS rides_published,
       (SELECT COUNT(*) FROM ride_requests rq WHERE rq.passenger_id = u.id) AS rides_requested,
       (SELECT COUNT(*) FROM trip_participants tp JOIN trips t ON t.id = tp.trip_id
         WHERE tp.user_id = u.id AND t.status = 'completed') AS trips_completed,
       (SELECT COALESCE(SUM(t.distance_km), 0) FROM trip_participants tp JOIN trips t ON t.id = tp.trip_id
         WHERE tp.user_id = u.id AND t.status = 'completed') AS distance_km,
       (EXISTS (SELECT 1 FROM rides r WHERE r.driver_id = u.id AND r.created_at >= NOW() - INTERVAL '30 days')
        OR EXISTS (SELECT 1 FROM ride_requests rq WHERE rq.passenger_id = u.id AND rq.created_at >= NOW() - INTERVAL '30 days')
        OR EXISTS (SELECT 1 FROM trip_participants tp JOIN trips t ON t.id = tp.trip_id
                    WHERE tp.user_id = u.id AND t.status = 'completed'
                      AND t.completed_at >= NOW() - INTERVAL '30 days')) AS is_active_participant
  FROM users u
 WHERE u.organization_id = $1::uuid AND u.role = 'employee'`;

function mapEmployee(row: Record<string, any>): EmployeeSummary {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone ?? null,
    employeeCode: row.employee_code ?? null,
    department: row.department ?? null,
    role: row.role,
    status: row.status,
    vehicleCount: num(row.vehicle_count),
    ridesPublished: num(row.rides_published),
    tripsCompleted: num(row.trips_completed),
    isActiveParticipant: row.is_active_participant === true,
    createdAt: isoRequired(row.created_at),
    lastActivityAt: iso(row.last_activity_at),
  };
}

/** GET /api/admin/employees */
adminEmployeesRouter.get(
  '/',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const query = parseQuery(req, employeeListQuerySchema);
    const page = resolvePage(query);

    const params: unknown[] = [actor.organizationId];
    const filters: string[] = [];

    if (query.search) {
      params.push(`%${query.search}%`);
      filters.push(
        `(u.name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR COALESCE(u.employee_code,'') ILIKE $${params.length})`,
      );
    }
    if (query.status) {
      params.push(query.status);
      filters.push(`u.status = $${params.length}::account_status`);
    }
    if (query.department) {
      params.push(query.department);
      filters.push(`u.department = $${params.length}`);
    }

    const where = filters.map((f) => `AND ${f}`).join(' ');

    // Participation is a derived predicate, so it is filtered on the outer query.
    const participationFilter =
      query.participation === 'active'
        ? 'WHERE e.is_active_participant'
        : query.participation === 'inactive'
          ? 'WHERE NOT e.is_active_participant'
          : '';

    const sortColumn =
      query.sort === 'createdAt' ? 'e.created_at' : query.sort === 'lastActivityAt' ? 'e.last_activity_at' : 'e.name';
    const direction = query.direction === 'desc' ? 'DESC' : 'ASC';
    const nullsOrder = query.sort === 'lastActivityAt' ? ' NULLS LAST' : '';

    const countResult = await req.db.query<{ total: unknown }>(
      `SELECT COUNT(*) AS total FROM (${EMPLOYEE_SELECT} ${where}) e ${participationFilter}`,
      params,
    );

    const listParams = [...params, page.limit, page.offset];
    const { rows } = await req.db.query(
      `SELECT * FROM (${EMPLOYEE_SELECT} ${where}) e ${participationFilter}
        ORDER BY ${sortColumn} ${direction}${nullsOrder}
        LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams,
    );

    const payload: Paginated<EmployeeSummary> = {
      items: rows.map((row) => mapEmployee(row as Record<string, any>)),
      pagination: paginationMeta(page, num(countResult.rows[0]?.total)),
    };
    return ok(res, payload);
  }),
);

/** GET /api/admin/employees/departments — filter options. */
adminEmployeesRouter.get(
  '/departments',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const { rows } = await req.db.query<{ department: string }>(
      `SELECT DISTINCT department FROM users
        WHERE organization_id = $1::uuid AND department IS NOT NULL AND department <> ''
        ORDER BY department ASC`,
      [actor.organizationId],
    );
    return ok(res, rows.map((r) => r.department));
  }),
);

/** GET /api/admin/employees/:id */
adminEmployeesRouter.get(
  '/:id',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const employeeId = parseId(req.params.id, 'employee id');

    const { rows } = await req.db.query(`${EMPLOYEE_SELECT} AND u.id = $2::uuid`, [actor.organizationId, employeeId]);
    const row = rows[0] as Record<string, any> | undefined;
    // Scoped by organization in SQL, so a cross-organization id simply 404s.
    if (!row) throw errors.notFound('That employee is not in your organization');

    const vehicles = await req.db.query(
      `SELECT v.*, u.name AS owner_name FROM vehicles v JOIN users u ON u.id = v.owner_id
        WHERE v.owner_id = $1::uuid ORDER BY v.created_at DESC`,
      [employeeId],
    );

    const detail: EmployeeDetail = {
      ...mapEmployee(row),
      organizationId: row.organization_id,
      organizationName: actor.organizationName,
      totalDistanceKm: round2(num(row.distance_km)),
      ridesRequested: num(row.rides_requested),
      vehicles: vehicles.rows.map((v) => mapVehicle(v as Record<string, any>)),
    };
    return ok(res, detail);
  }),
);

/** GET /api/admin/employees/:id/audit-logs — history for one employee. */
adminEmployeesRouter.get(
  '/:id/audit-logs',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const employeeId = parseId(req.params.id, 'employee id');
    const { rows } = await req.db.query(
      `SELECT * FROM audit_logs
        WHERE organization_id = $1::uuid AND entity_type = 'employee' AND entity_id = $2
        ORDER BY created_at DESC LIMIT 50`,
      [actor.organizationId, employeeId],
    );
    return ok(res, rows.map((row) => mapAuditLog(row as Record<string, unknown>)));
  }),
);

/**
 * POST /api/admin/employees/:id/status
 * Activate / suspend / deactivate. Employees are never hard-deleted because
 * rides, trips and payments reference them.
 */
adminEmployeesRouter.post(
  '/:id/status',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const employeeId = parseId(req.params.id, 'employee id');
    const input = parseBody(req, employeeStatusSchema);

    await req.db.transaction(async (tx) => {
      const { rows } = await tx.query<{ id: string; status: string; name: string; role: string }>(
        `SELECT id, status::text AS status, name, role::text AS role FROM users
          WHERE id = $1::uuid AND organization_id = $2::uuid FOR UPDATE`,
        [employeeId, actor.organizationId],
      );
      const employee = rows[0];
      if (!employee) throw errors.notFound('That employee is not in your organization');
      if (employee.role !== 'employee') throw errors.forbidden('Administrator accounts are managed in Admin Settings');
      if (employee.status === input.status) throw errors.ruleViolation(`This employee is already ${input.status}`);

      await tx.query('UPDATE users SET status = $2::account_status WHERE id = $1::uuid', [employeeId, input.status]);

      const action =
        input.status === ACCOUNT_STATUS.SUSPENDED
          ? AUDIT_ACTION.EMPLOYEE_SUSPENDED
          : input.status === ACCOUNT_STATUS.DEACTIVATED
            ? AUDIT_ACTION.EMPLOYEE_DEACTIVATED
            : employee.status === ACCOUNT_STATUS.SUSPENDED
              ? AUDIT_ACTION.EMPLOYEE_REACTIVATED
              : AUDIT_ACTION.EMPLOYEE_ACTIVATED;

      await writeAudit(tx, {
        organizationId: actor.organizationId,
        actorId: actor.id,
        actorName: actor.name,
        action,
        entityType: 'employee',
        entityId: employeeId,
        previousValues: { status: employee.status },
        newValues: { status: input.status },
        metadata: input.reason ? { reason: input.reason } : null,
      });
    });

    const { rows } = await req.db.query(`${EMPLOYEE_SELECT} AND u.id = $2::uuid`, [actor.organizationId, employeeId]);
    return ok(res, mapEmployee(rows[0] as Record<string, any>), 'Employee access updated');
  }),
);

/** PATCH /api/admin/employees/:id — permitted administrative fields only. */
adminEmployeesRouter.patch(
  '/:id',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const employeeId = parseId(req.params.id, 'employee id');
    const input = parseBody(req, adminUpdateEmployeeSchema);

    await req.db.transaction(async (tx) => {
      const { rows } = await tx.query<Record<string, any>>(
        `SELECT id, name, phone, department, employee_code, role::text AS role FROM users
          WHERE id = $1::uuid AND organization_id = $2::uuid FOR UPDATE`,
        [employeeId, actor.organizationId],
      );
      const before = rows[0];
      if (!before) throw errors.notFound('That employee is not in your organization');
      if (before.role !== 'employee') throw errors.forbidden('Administrator accounts are managed in Admin Settings');

      const updates: string[] = [];
      const params: unknown[] = [employeeId];
      const push = (column: string, value: unknown) => {
        params.push(value);
        updates.push(`${column} = $${params.length}`);
      };
      if (input.name !== undefined) push('name', input.name);
      if (input.phone !== undefined) push('phone', input.phone);
      if (input.department !== undefined) push('department', input.department);
      if (input.employeeCode !== undefined) push('employee_code', input.employeeCode);
      if (updates.length === 0) throw errors.validation('Nothing to update');

      await tx.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $1::uuid`, params);

      const { previous, next } = diffFields(
        {
          name: before.name,
          phone: before.phone,
          department: before.department,
          employeeCode: before.employee_code,
        },
        input as Record<string, unknown>,
      );

      await writeAudit(tx, {
        organizationId: actor.organizationId,
        actorId: actor.id,
        actorName: actor.name,
        action: AUDIT_ACTION.EMPLOYEE_UPDATED,
        entityType: 'employee',
        entityId: employeeId,
        previousValues: previous,
        newValues: next,
      });
    });

    const { rows } = await req.db.query(`${EMPLOYEE_SELECT} AND u.id = $2::uuid`, [actor.organizationId, employeeId]);
    return ok(res, mapEmployee(rows[0] as Record<string, any>), 'Employee updated');
  }),
);
