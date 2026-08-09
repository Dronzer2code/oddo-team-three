import { Router, type Request } from 'express';
import {
  AUDIT_ACTION,
  VEHICLE_STATUS,
  approvalDecisionSchema,
  paginationQuerySchema,
  type Paginated,
  type VehicleApproval,
  type VehicleStatus,
} from '@carpool/shared';
import { actorOf, authenticate, requireRole } from '../../middleware/auth.js';
import { parseBody, parseId, parseQuery } from '../../middleware/validate.js';
import { handler, ok, paginationMeta, resolvePage } from '../../shared/http.js';
import { errors } from '../../shared/errors.js';
import { isoRequired, num } from '../../database/client.js';
import { writeAudit } from '../../shared/audit.js';

/**
 * Vehicle approvals — the admin work queue for vehicles an employee submitted.
 * Approving is what grants that employee the driver context: only an approved
 * active vehicle may be used to publish a ride.
 */
export const adminVehicleApprovalsRouter = Router();
adminVehicleApprovalsRouter.use(authenticate, requireRole('admin'));

const APPROVAL_SELECT = `
SELECT v.id, v.organization_id, v.owner_id, v.make, v.model, v.registration_number,
       v.vehicle_type, v.seating_capacity, v.color, v.status, v.created_at,
       u.name AS owner_name, u.email AS owner_email,
       u.employee_code AS owner_employee_code, u.department AS owner_department
  FROM vehicles v
  JOIN users u ON u.id = v.owner_id
 WHERE v.organization_id = $1::uuid`;

function mapApproval(row: Record<string, any>): VehicleApproval {
  return {
    id: row.id,
    organizationId: row.organization_id,
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    ownerEmail: row.owner_email,
    ownerEmployeeCode: row.owner_employee_code ?? null,
    ownerDepartment: row.owner_department ?? null,
    make: row.make,
    model: row.model,
    registrationNumber: row.registration_number,
    vehicleType: row.vehicle_type,
    seatingCapacity: num(row.seating_capacity),
    color: row.color ?? null,
    status: row.status,
    submittedAt: isoRequired(row.created_at),
  };
}

/** GET /api/admin/vehicle-approvals — vehicles sitting in under_review. */
adminVehicleApprovalsRouter.get(
  '/',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const page = resolvePage(parseQuery(req, paginationQuerySchema));

    const countResult = await req.db.query<{ total: unknown }>(
      `SELECT COUNT(*) AS total FROM vehicles v
        WHERE v.organization_id = $1::uuid AND v.status = 'under_review'`,
      [actor.organizationId],
    );

    const { rows } = await req.db.query(
      `${APPROVAL_SELECT} AND v.status = 'under_review'
        ORDER BY v.created_at ASC LIMIT $2 OFFSET $3`,
      [actor.organizationId, page.limit, page.offset],
    );

    const payload: Paginated<VehicleApproval> = {
      items: rows.map((row) => mapApproval(row as Record<string, any>)),
      pagination: paginationMeta(page, num(countResult.rows[0]?.total)),
    };
    return ok(res, payload);
  }),
);

async function decide(
  req: Request,
  vehicleId: string,
  nextStatus: VehicleStatus,
  action: string,
  reason: string | null,
) {
  const actor = actorOf(req);
  return req.db.transaction(async (tx) => {
    const existing = await tx.query<{ status: string; registration_number: string }>(
      `SELECT status::text AS status, registration_number FROM vehicles
        WHERE id = $1::uuid AND organization_id = $2::uuid FOR UPDATE`,
      [vehicleId, actor.organizationId],
    );
    const before = existing.rows[0];
    if (!before) throw errors.notFound('That vehicle is not in your organization');
    if (before.status !== VEHICLE_STATUS.UNDER_REVIEW) {
      throw errors.ruleViolation(`This vehicle was already reviewed — it is ${before.status}`);
    }

    await tx.query('UPDATE vehicles SET status = $2::vehicle_status WHERE id = $1::uuid', [
      vehicleId,
      nextStatus,
    ]);

    await writeAudit(tx, {
      organizationId: actor.organizationId,
      actorId: actor.id,
      actorName: actor.name,
      action,
      entityType: 'vehicle',
      entityId: vehicleId,
      previousValues: { status: before.status },
      newValues: { status: nextStatus },
      metadata: { via: 'admin', registrationNumber: before.registration_number, reason },
    });

    const { rows } = await tx.query(`${APPROVAL_SELECT} AND v.id = $2::uuid`, [
      actor.organizationId,
      vehicleId,
    ]);
    return mapApproval(rows[0] as Record<string, any>);
  });
}

/** POST /api/admin/vehicle-approvals/:id/approve — vehicle becomes ACTIVE. */
adminVehicleApprovalsRouter.post(
  '/:id/approve',
  handler(async (req, res) => {
    const vehicleId = parseId(req.params.id, 'vehicle id');
    const input = parseBody(req, approvalDecisionSchema);
    const vehicle = await decide(
      req,
      vehicleId,
      VEHICLE_STATUS.ACTIVE,
      AUDIT_ACTION.VEHICLE_APPROVED,
      input.reason ?? null,
    );
    return ok(res, vehicle, 'Vehicle approved');
  }),
);

/** POST /api/admin/vehicle-approvals/:id/reject — vehicle becomes INACTIVE. */
adminVehicleApprovalsRouter.post(
  '/:id/reject',
  handler(async (req, res) => {
    const vehicleId = parseId(req.params.id, 'vehicle id');
    const input = parseBody(req, approvalDecisionSchema);
    const vehicle = await decide(
      req,
      vehicleId,
      VEHICLE_STATUS.INACTIVE,
      AUDIT_ACTION.VEHICLE_REJECTED,
      input.reason ?? null,
    );
    return ok(res, vehicle, 'Vehicle rejected');
  }),
);
