import { Router } from 'express';
import {
  AUDIT_ACTION,
  adminCreateVehicleSchema,
  adminUpdateVehicleSchema,
  vehicleListQuerySchema,
  vehicleStatusSchema,
  type Paginated,
  type Vehicle,
  type VehicleDetail,
} from '@carpool/shared';
import { actorOf, authenticate, requireRole } from '../../middleware/auth.js';
import { parseBody, parseId, parseQuery } from '../../middleware/validate.js';
import { created, handler, ok, paginationMeta, resolvePage } from '../../shared/http.js';
import { errors } from '../../shared/errors.js';
import { num, round2 } from '../../database/client.js';
import { diffFields, writeAudit } from '../../shared/audit.js';
import { mapAuditLog, mapVehicle } from '../../shared/mappers.js';

export const adminVehiclesRouter = Router();
adminVehiclesRouter.use(authenticate, requireRole('admin'));

const VEHICLE_SELECT = `
SELECT v.*, u.name AS owner_name
  FROM vehicles v JOIN users u ON u.id = v.owner_id
 WHERE v.organization_id = $1::uuid`;

/** GET /api/admin/vehicles */
adminVehiclesRouter.get(
  '/',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const query = parseQuery(req, vehicleListQuerySchema);
    const page = resolvePage(query);

    const params: unknown[] = [actor.organizationId];
    const filters: string[] = [];

    if (query.search) {
      params.push(`%${query.search}%`);
      filters.push(
        `(v.model ILIKE $${params.length} OR v.make ILIKE $${params.length} OR v.registration_number ILIKE $${params.length})`,
      );
    }
    if (query.status) {
      params.push(query.status);
      filters.push(`v.status = $${params.length}::vehicle_status`);
    }
    if (query.ownerId) {
      params.push(query.ownerId);
      filters.push(`v.owner_id = $${params.length}::uuid`);
    }
    const where = filters.map((f) => `AND ${f}`).join(' ');

    const countResult = await req.db.query<{ total: unknown }>(
      `SELECT COUNT(*) AS total FROM vehicles v WHERE v.organization_id = $1::uuid ${where}`,
      params,
    );

    const listParams = [...params, page.limit, page.offset];
    const { rows } = await req.db.query(
      `${VEHICLE_SELECT} ${where} ORDER BY v.created_at DESC LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams,
    );

    const payload: Paginated<Vehicle> = {
      items: rows.map((row) => mapVehicle(row as Record<string, any>)),
      pagination: paginationMeta(page, num(countResult.rows[0]?.total)),
    };
    return ok(res, payload);
  }),
);

/** GET /api/admin/vehicles/:id — vehicle profile with lifetime usage. */
adminVehiclesRouter.get(
  '/:id',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const vehicleId = parseId(req.params.id, 'vehicle id');

    const { rows } = await req.db.query(`${VEHICLE_SELECT} AND v.id = $2::uuid`, [actor.organizationId, vehicleId]);
    const row = rows[0] as Record<string, any> | undefined;
    if (!row) throw errors.notFound('That vehicle is not in your organization');

    const usage = await req.db.query<Record<string, unknown>>(
      `SELECT
         (SELECT COUNT(*) FROM rides r WHERE r.vehicle_id = $1::uuid) AS rides_published,
         (SELECT COUNT(*) FROM trips t JOIN rides r ON r.id = t.ride_id
           WHERE r.vehicle_id = $1::uuid AND t.status = 'completed') AS trips_completed,
         (SELECT COALESCE(SUM(t.distance_km),0) FROM trips t JOIN rides r ON r.id = t.ride_id
           WHERE r.vehicle_id = $1::uuid AND t.status = 'completed') AS distance_km,
         (SELECT COALESCE(SUM(t.total_cost),0) FROM trips t JOIN rides r ON r.id = t.ride_id
           WHERE r.vehicle_id = $1::uuid AND t.status = 'completed') AS total_cost`,
      [vehicleId],
    );
    const u = usage.rows[0] ?? {};

    const detail: VehicleDetail = {
      ...mapVehicle(row),
      ridesPublished: num(u.rides_published),
      tripsCompleted: num(u.trips_completed),
      totalDistanceKm: round2(num(u.distance_km)),
      totalCost: round2(num(u.total_cost)),
    };
    return ok(res, detail);
  }),
);

/** GET /api/admin/vehicles/:id/audit-logs */
adminVehiclesRouter.get(
  '/:id/audit-logs',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const vehicleId = parseId(req.params.id, 'vehicle id');
    const { rows } = await req.db.query(
      `SELECT * FROM audit_logs
        WHERE organization_id = $1::uuid AND entity_type = 'vehicle' AND entity_id = $2
        ORDER BY created_at DESC LIMIT 50`,
      [actor.organizationId, vehicleId],
    );
    return ok(res, rows.map((row) => mapAuditLog(row as Record<string, unknown>)));
  }),
);

/** POST /api/admin/vehicles — register a company vehicle against an employee. */
adminVehiclesRouter.post(
  '/',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const input = parseBody(req, adminCreateVehicleSchema);

    const vehicle = await req.db.transaction(async (tx) => {
      const owner = await tx.query<{ id: string; status: string }>(
        `SELECT id, status::text AS status FROM users
          WHERE id = $1::uuid AND organization_id = $2::uuid AND role = 'employee'`,
        [input.ownerId, actor.organizationId],
      );
      if (!owner.rows[0]) throw errors.validation('Select an employee from your organization', { ownerId: 'Unknown employee' });

      const inserted = await tx.query<{ id: string }>(
        `INSERT INTO vehicles (organization_id, owner_id, make, model, registration_number,
                               vehicle_type, color, seating_capacity, status)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::vehicle_type, $7, $8::int, $9::vehicle_status)
         RETURNING id`,
        [
          actor.organizationId,
          input.ownerId,
          input.make,
          input.model,
          input.registrationNumber,
          input.vehicleType,
          input.color ?? null,
          input.seatingCapacity,
          input.status ?? 'active',
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
          ownerId: input.ownerId,
          status: input.status ?? 'active',
        },
        metadata: { via: 'admin' },
      });

      const { rows } = await tx.query(`${VEHICLE_SELECT} AND v.id = $2::uuid`, [
        actor.organizationId,
        inserted.rows[0]!.id,
      ]);
      return mapVehicle(rows[0] as Record<string, any>);
    });

    return created(res, vehicle, 'Vehicle registered');
  }),
);

/** PATCH /api/admin/vehicles/:id */
adminVehiclesRouter.patch(
  '/:id',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const vehicleId = parseId(req.params.id, 'vehicle id');
    const input = parseBody(req, adminUpdateVehicleSchema);

    const vehicle = await req.db.transaction(async (tx) => {
      const existing = await tx.query<Record<string, any>>(
        `SELECT * FROM vehicles WHERE id = $1::uuid AND organization_id = $2::uuid FOR UPDATE`,
        [vehicleId, actor.organizationId],
      );
      const before = existing.rows[0];
      if (!before) throw errors.notFound('That vehicle is not in your organization');

      if (input.ownerId) {
        const owner = await tx.query(
          `SELECT 1 FROM users WHERE id = $1::uuid AND organization_id = $2::uuid AND role = 'employee'`,
          [input.ownerId, actor.organizationId],
        );
        if (owner.rows.length === 0) {
          throw errors.validation('Select an employee from your organization', { ownerId: 'Unknown employee' });
        }
      }

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
      if (input.ownerId !== undefined) push('owner_id', input.ownerId, '::uuid');
      if (input.status !== undefined) push('status', input.status, '::vehicle_status');
      if (updates.length === 0) throw errors.validation('Nothing to update');

      await tx.query(`UPDATE vehicles SET ${updates.join(', ')} WHERE id = $1::uuid`, params);

      const { previous, next } = diffFields(
        {
          make: before.make,
          model: before.model,
          registrationNumber: before.registration_number,
          vehicleType: before.vehicle_type,
          color: before.color,
          seatingCapacity: num(before.seating_capacity),
          ownerId: before.owner_id,
          status: before.status,
        },
        input as Record<string, unknown>,
      );

      await writeAudit(tx, {
        organizationId: actor.organizationId,
        actorId: actor.id,
        actorName: actor.name,
        action: input.status !== undefined ? AUDIT_ACTION.VEHICLE_STATUS_CHANGED : AUDIT_ACTION.VEHICLE_UPDATED,
        entityType: 'vehicle',
        entityId: vehicleId,
        previousValues: previous,
        newValues: next,
        metadata: { via: 'admin' },
      });

      const { rows } = await tx.query(`${VEHICLE_SELECT} AND v.id = $2::uuid`, [actor.organizationId, vehicleId]);
      return mapVehicle(rows[0] as Record<string, any>);
    });

    return ok(res, vehicle, 'Vehicle updated');
  }),
);

/** POST /api/admin/vehicles/:id/status — approve, retire, or re-review. */
adminVehiclesRouter.post(
  '/:id/status',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const vehicleId = parseId(req.params.id, 'vehicle id');
    const input = parseBody(req, vehicleStatusSchema);

    const vehicle = await req.db.transaction(async (tx) => {
      const existing = await tx.query<{ status: string }>(
        `SELECT status::text AS status FROM vehicles
          WHERE id = $1::uuid AND organization_id = $2::uuid FOR UPDATE`,
        [vehicleId, actor.organizationId],
      );
      const before = existing.rows[0];
      if (!before) throw errors.notFound('That vehicle is not in your organization');
      if (before.status === input.status) throw errors.ruleViolation(`This vehicle is already ${input.status}`);

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
        metadata: { via: 'admin', reason: input.reason ?? null },
      });

      const { rows } = await tx.query(`${VEHICLE_SELECT} AND v.id = $2::uuid`, [actor.organizationId, vehicleId]);
      return mapVehicle(rows[0] as Record<string, any>);
    });

    return ok(res, vehicle, 'Vehicle status updated');
  }),
);
