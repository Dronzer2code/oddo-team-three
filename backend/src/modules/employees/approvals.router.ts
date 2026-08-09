import { Router, type Request } from 'express';
import {
  ACCOUNT_STATUS,
  AUDIT_ACTION,
  approvalDecisionSchema,
  paginationQuerySchema,
  type EmployeeApproval,
  type Paginated,
} from '@carpool/shared';
import { actorOf, authenticate, requireRole } from '../../middleware/auth.js';
import { parseBody, parseId, parseQuery } from '../../middleware/validate.js';
import { handler, ok, paginationMeta, resolvePage } from '../../shared/http.js';
import { errors } from '../../shared/errors.js';
import { isoRequired, num } from '../../database/client.js';
import { writeAudit } from '../../shared/audit.js';

/**
 * Employee approvals — the admin work queue for accounts that registered and
 * are waiting to be let into the organization. Approving flips the account to
 * ACTIVE (which is what grants the passenger panel); rejecting deactivates it.
 */
export const adminEmployeeApprovalsRouter = Router();
adminEmployeeApprovalsRouter.use(authenticate, requireRole('admin'));

const APPROVAL_SELECT = `
SELECT u.id, u.name, u.email, u.phone, u.employee_code, u.department, u.status, u.created_at,
       (SELECT COUNT(*) FROM vehicles v WHERE v.owner_id = u.id) AS vehicle_count
  FROM users u
 WHERE u.organization_id = $1::uuid AND u.role = 'employee' AND u.status = 'pending'`;

function mapApproval(row: Record<string, any>): EmployeeApproval {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone ?? null,
    employeeCode: row.employee_code ?? null,
    department: row.department ?? null,
    status: row.status,
    vehicleCount: num(row.vehicle_count),
    requestedAt: isoRequired(row.created_at),
  };
}

/** GET /api/admin/employee-approvals */
adminEmployeeApprovalsRouter.get(
  '/',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const page = resolvePage(parseQuery(req, paginationQuerySchema));

    const countResult = await req.db.query<{ total: unknown }>(
      `SELECT COUNT(*) AS total FROM users u
        WHERE u.organization_id = $1::uuid AND u.role = 'employee' AND u.status = 'pending'`,
      [actor.organizationId],
    );

    const { rows } = await req.db.query(
      `${APPROVAL_SELECT} ORDER BY u.created_at ASC LIMIT $2 OFFSET $3`,
      [actor.organizationId, page.limit, page.offset],
    );

    const payload: Paginated<EmployeeApproval> = {
      items: rows.map((row) => mapApproval(row as Record<string, any>)),
      pagination: paginationMeta(page, num(countResult.rows[0]?.total)),
    };
    return ok(res, payload);
  }),
);

/** Shared body for both decisions — only the target status and audit differ. */
async function decide(
  req: Request,
  employeeId: string,
  nextStatus: typeof ACCOUNT_STATUS.ACTIVE | typeof ACCOUNT_STATUS.DEACTIVATED,
  action: string,
  reason: string | null,
) {
  const actor = actorOf(req);
  return req.db.transaction(async (tx) => {
    const existing = await tx.query<{ status: string; name: string }>(
      `SELECT status::text AS status, name FROM users
        WHERE id = $1::uuid AND organization_id = $2::uuid AND role = 'employee' FOR UPDATE`,
      [employeeId, actor.organizationId],
    );
    const before = existing.rows[0];
    if (!before) throw errors.notFound('That employee is not in your organization');
    if (before.status !== ACCOUNT_STATUS.PENDING) {
      throw errors.ruleViolation(`This registration was already reviewed — the account is ${before.status}`);
    }

    await tx.query('UPDATE users SET status = $2::account_status WHERE id = $1::uuid', [
      employeeId,
      nextStatus,
    ]);

    await writeAudit(tx, {
      organizationId: actor.organizationId,
      actorId: actor.id,
      actorName: actor.name,
      action,
      entityType: 'employee',
      entityId: employeeId,
      previousValues: { status: before.status },
      newValues: { status: nextStatus },
      metadata: { via: 'admin', employeeName: before.name, reason },
    });

    const { rows } = await tx.query(
      `SELECT u.id, u.name, u.email, u.phone, u.employee_code, u.department, u.status, u.created_at,
              (SELECT COUNT(*) FROM vehicles v WHERE v.owner_id = u.id) AS vehicle_count
         FROM users u WHERE u.id = $1::uuid`,
      [employeeId],
    );
    return mapApproval(rows[0] as Record<string, any>);
  });
}

/** POST /api/admin/employee-approvals/:id/approve */
adminEmployeeApprovalsRouter.post(
  '/:id/approve',
  handler(async (req, res) => {
    const employeeId = parseId(req.params.id, 'employee id');
    const input = parseBody(req, approvalDecisionSchema);
    const employee = await decide(
      req,
      employeeId,
      ACCOUNT_STATUS.ACTIVE,
      AUDIT_ACTION.EMPLOYEE_APPROVED,
      input.reason ?? null,
    );
    return ok(res, employee, 'Employee approved');
  }),
);

/** POST /api/admin/employee-approvals/:id/reject */
adminEmployeeApprovalsRouter.post(
  '/:id/reject',
  handler(async (req, res) => {
    const employeeId = parseId(req.params.id, 'employee id');
    const input = parseBody(req, approvalDecisionSchema);
    const employee = await decide(
      req,
      employeeId,
      ACCOUNT_STATUS.DEACTIVATED,
      AUDIT_ACTION.EMPLOYEE_REJECTED,
      input.reason ?? null,
    );
    return ok(res, employee, 'Employee rejected');
  }),
);
