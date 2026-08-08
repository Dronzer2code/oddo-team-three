import { Router } from 'express';
import {
  AUDIT_ACTION,
  VEHICLE_STATUS,
  createVehicleSchema,
  updateVehicleSchema,
  vehicleStatusSchema,
} from '@carpool/shared';
import { actorOf, authenticate, requireOperationalAccount, requireRole } from '../../middleware/auth.js';
import { parseBody, parseId } from '../../middleware/validate.js';
import { created, handler, ok } from '../../shared/http.js';
import { errors } from '../../shared/errors.js';
import { mapVehicle } from '../../shared/mappers.js';
import { writeAudit } from '../../shared/audit.js';
import type { Queryable } from '../../database/client.js';

export const employeeVehiclesRouter = Router();
employeeVehiclesRouter.use(authenticate, requireRole('employee'));

const VEHICLE_SELECT = `
SELECT v.*, u.name AS owner_name
  FROM vehicles v JOIN users u ON u.id = v.owner_id`;

async function loadOwnVehicle(db: Queryable, organizationId: string, ownerId: string, vehicleId: string) {
  const { rows } = await db.query(
    `${VEHICLE_SELECT} WHERE v.id = $1::uuid AND v.organization_id = $2::uuid`,
    [vehicleId, organizationId],
  );
  const row = rows[0] as Record<string, any> | undefined;
  if (!row) throw errors.notFound('That vehicle is not registered in your organization');
  if (row.owner_id !== ownerId) throw errors.forbidden('You can only manage your own vehicles');
  return row;
}

/** GET /api/employee/vehicles — my vehicles. */
employeeVehiclesRouter.get(
  '/',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const { rows } = await req.db.query(
      `${VEHICLE_SELECT} WHERE v.owner_id = $1::uuid AND v.organization_id = $2::uuid ORDER BY v.created_at DESC`,
      [actor.id, actor.organizationId],
    );
    return ok(res, rows.map((row) => mapVehicle(row as Record<string, any>)));
  }),
);

/**
 * POST /api/employee/vehicles
 * Whether a new vehicle is immediately usable depends on the organization's
 * approval policy — the client does not get to choose.
 */
employeeVehiclesRouter.post(
  '/',
  requireOperationalAccount,
  handler(async (req, res) => {
    const actor = actorOf(req);
    const input = parseBody(req, createVehicleSchema);

    const vehicle = await req.db.transaction(async (tx) => {
      const settings = await tx.query<{ vehicle_approval_required: boolean }>(
        'SELECT vehicle_approval_required FROM org_settings WHERE organization_id = $1::uuid',
        [actor.organizationId],
      );
      const approvalRequired = settings.rows[0]?.vehicle_approval_required !== false;
      const status = approvalRequired ? VEHICLE_STATUS.UNDER_REVIEW : VEHICLE_STATUS.ACTIVE;

      const inserted = await tx.query<{ id: string }>(
        `INSERT INTO vehicles (organization_id, owner_id, make, model, registration_number,
                               vehicle_type, color, seating_capacity, status)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::vehicle_type, $7, $8::int, $9::vehicle_status)
         RETURNING id`,
        [
          actor.organizationId,
          actor.id,
          input.make,
          input.model,
          input.registrationNumber,
          input.vehicleType,
          input.color ?? null,
          input.seatingCapacity,
          status,
        ],
      );

      await writeAudit(tx, {
        organizationId: actor.organizationId,
        actorId: actor.id,
        actorName: actor.name,
        action: AUDIT_ACTION.VEHICLE_CREATED,
        entityType: 'vehicle',
        entityId: inserted.rows[0]!.id,
        newValues: {
          make: input.make,
          model: input.model,
          registrationNumber: input.registrationNumber,
          seatingCapacity: input.seatingCapacity,
          status,
        },
        metadata: { via: 'employee' },
      });

      const { rows } = await tx.query(`${VEHICLE_SELECT} WHERE v.id = $1::uuid`, [inserted.rows[0]!.id]);
      return mapVehicle(rows[0] as Record<string, any>);
    });

    return created(
      res,
      vehicle,
      vehicle.status === VEHICLE_STATUS.UNDER_REVIEW
        ? 'Vehicle submitted for review'
        : 'Vehicle registered and ready to use',
    );
  }),
);

/** PATCH /api/employee/vehicles/:id */
employeeVehiclesRouter.patch(
  '/:id',
  requireOperationalAccount,
  handler(async (req, res) => {
    const actor = actorOf(req);
    const vehicleId = parseId(req.params.id, 'vehicle id');
    const input = parseBody(req, updateVehicleSchema);

    const before = await loadOwnVehicle(req.db, actor.organizationId, actor.id, vehicleId);

    const updates: string[] = [];
    const params: unknown[] = [vehicleId];
    const push = (column: string, value: unknown, cast = '') => {
      params.push(value);
      updates.push(`${column} = $${params.length}${cast}`);
    };
    if (input.make !== undefined) push('make', input.make);
    if (input.model !== undefined) push('model', input.model);
    if (input.registrationNumber !== undefined) push('registration_number', input.registrationNumber);
    if (input.vehicleType !== undefined) push('vehicle_type', input.vehicleType, '::vehicle_type');
    if (input.color !== undefined) push('color', input.color);
    if (input.seatingCapacity !== undefined) push('seating_capacity', input.seatingCapacity, '::int');
    if (updates.length === 0) throw errors.validation('Nothing to update');

    const vehicle = await req.db.transaction(async (tx) => {
      await tx.query(`UPDATE vehicles SET ${updates.join(', ')} WHERE id = $1::uuid`, params);
      await writeAudit(tx, {
        organizationId: actor.organizationId,
        actorId: actor.id,
        actorName: actor.name,
        action: AUDIT_ACTION.VEHICLE_UPDATED,
        entityType: 'vehicle',
        entityId: vehicleId,
        previousValues: {
          make: before.make,
          model: before.model,
          registrationNumber: before.registration_number,
          seatingCapacity: before.seating_capacity,
        },
        newValues: input as Record<string, unknown>,
        metadata: { via: 'employee' },
      });
      const { rows } = await tx.query(`${VEHICLE_SELECT} WHERE v.id = $1::uuid`, [vehicleId]);
      return mapVehicle(rows[0] as Record<string, any>);
    });

    return ok(res, vehicle, 'Vehicle updated');
  }),
);

/**
 * POST /api/employee/vehicles/:id/status
 * Employees may retire their own vehicle or return it for review; only an
 * administrator can approve a vehicle for use.
 */
employeeVehiclesRouter.post(
  '/:id/status',
  requireOperationalAccount,
  handler(async (req, res) => {
    const actor = actorOf(req);
    const vehicleId = parseId(req.params.id, 'vehicle id');
    const input = parseBody(req, vehicleStatusSchema);

    if (input.status === VEHICLE_STATUS.ACTIVE) {
      throw errors.forbidden('Only an administrator can approve a vehicle for use');
    }

    const before = await loadOwnVehicle(req.db, actor.organizationId, actor.id, vehicleId);
    if (before.status === input.status) return ok(res, mapVehicle(before), 'No change');

    const vehicle = await req.db.transaction(async (tx) => {
      await tx.query('UPDATE vehicles SET status = $2::vehicle_status WHERE id = $1::uuid', [vehicleId, input.status]);
      await writeAudit(tx, {
        organizationId: actor.organizationId,
        actorId: actor.id,
        actorName: actor.name,
        action: AUDIT_ACTION.VEHICLE_STATUS_CHANGED,
        entityType: 'vehicle',
        entityId: vehicleId,
        previousValues: { status: before.status },
        newValues: { status: input.status },
        metadata: { via: 'employee', reason: input.reason ?? null },
      });
      const { rows } = await tx.query(`${VEHICLE_SELECT} WHERE v.id = $1::uuid`, [vehicleId]);
      return mapVehicle(rows[0] as Record<string, any>);
    });

    return ok(res, vehicle, 'Vehicle status updated');
  }),
);
