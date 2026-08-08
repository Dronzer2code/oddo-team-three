import { Router } from 'express';
import { updateProfileSchema, type EmployeeProfile } from '@carpool/shared';
import { actorOf, authenticate } from '../../middleware/auth.js';
import { parseBody } from '../../middleware/validate.js';
import { handler, ok } from '../../shared/http.js';
import { errors } from '../../shared/errors.js';
import { isProfileComplete } from '../../shared/activity.js';

export const employeeProfileRouter = Router();
employeeProfileRouter.use(authenticate);

const PROFILE_SELECT = `
SELECT u.id, u.organization_id, u.name, u.email, u.phone, u.employee_code, u.department,
       u.home_location, u.work_location, u.status,
       o.name AS organization_name, o.currency, o.distance_unit::text AS distance_unit
  FROM users u JOIN organizations o ON o.id = u.organization_id
 WHERE u.id = $1::uuid`;

function mapProfile(row: Record<string, any>): EmployeeProfile {
  return {
    id: row.id,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    name: row.name,
    email: row.email,
    phone: row.phone ?? null,
    employeeCode: row.employee_code ?? null,
    department: row.department ?? null,
    homeLocation: row.home_location ?? null,
    workLocation: row.work_location ?? null,
    status: row.status,
    profileComplete: isProfileComplete(row),
    currency: (row.currency ?? 'INR').trim(),
    distanceUnit: row.distance_unit ?? 'km',
  };
}

/** GET /api/employee/profile */
employeeProfileRouter.get(
  '/',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const { rows } = await req.db.query(PROFILE_SELECT, [actor.id]);
    if (!rows[0]) throw errors.notFound('Profile not found');
    return ok(res, mapProfile(rows[0] as Record<string, any>));
  }),
);

/**
 * PATCH /api/employee/profile
 * Employees own these fields. Email, role, status and organization are not
 * editable here — those are administrative concerns.
 */
employeeProfileRouter.patch(
  '/',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const input = parseBody(req, updateProfileSchema);

    const updates: string[] = [];
    const params: unknown[] = [actor.id];
    const push = (column: string, value: unknown) => {
      params.push(value);
      updates.push(`${column} = $${params.length}`);
    };

    if (input.name !== undefined) push('name', input.name);
    if (input.phone !== undefined) push('phone', input.phone);
    if (input.department !== undefined) push('department', input.department);
    if (input.employeeCode !== undefined) push('employee_code', input.employeeCode);
    if (input.homeLocation !== undefined) push('home_location', input.homeLocation);
    if (input.workLocation !== undefined) push('work_location', input.workLocation);

    if (updates.length === 0) throw errors.validation('Nothing to update');

    await req.db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $1::uuid`, params);

    const { rows } = await req.db.query(PROFILE_SELECT, [actor.id]);
    return ok(res, mapProfile(rows[0] as Record<string, any>), 'Profile updated');
  }),
);
