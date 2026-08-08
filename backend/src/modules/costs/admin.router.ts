import { Router } from 'express';
import { AUDIT_ACTION, COST_CONFIG_TYPE, costConfigurationSchema, type CostConfiguration } from '@carpool/shared';
import { actorOf, authenticate, requireRole } from '../../middleware/auth.js';
import { parseBody, parseId } from '../../middleware/validate.js';
import { created, handler, ok } from '../../shared/http.js';
import { errors } from '../../shared/errors.js';
import { mapCostConfiguration } from '../../shared/mappers.js';
import { writeAudit } from '../../shared/audit.js';
import { resolveCostBasis } from '../../shared/cost.js';

export const adminCostsRouter = Router();
adminCostsRouter.use(authenticate, requireRole('admin'));

const COST_SELECT = `
SELECT c.*, u.name AS created_by_name
  FROM cost_configurations c LEFT JOIN users u ON u.id = c.created_by
 WHERE c.organization_id = $1::uuid`;

/** GET /api/admin/costs — full version history plus the basis in force now. */
adminCostsRouter.get(
  '/',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const { rows } = await req.db.query(`${COST_SELECT} ORDER BY c.effective_from DESC, c.created_at DESC`, [
      actor.organizationId,
    ]);
    const configurations: CostConfiguration[] = rows.map((row) => mapCostConfiguration(row as Record<string, unknown>));
    const current = await resolveCostBasis(req.db, actor.organizationId);
    return ok(res, { configurations, current });
  }),
);

/**
 * POST /api/admin/costs
 * Creates a *new version*. The previous open-ended version of the same type is
 * closed at the new start date — historical trips keep their own snapshot, so
 * completed reports never move.
 */
adminCostsRouter.post(
  '/',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const input = parseBody(req, costConfigurationSchema);

    const effectiveFrom = new Date(input.effectiveFrom);
    if (Number.isNaN(effectiveFrom.getTime())) {
      throw errors.validation('Enter a valid start date', { effectiveFrom: 'Invalid date' });
    }
    const effectiveUntil = input.effectiveUntil ? new Date(input.effectiveUntil) : null;
    if (effectiveUntil && Number.isNaN(effectiveUntil.getTime())) {
      throw errors.validation('Enter a valid end date', { effectiveUntil: 'Invalid date' });
    }
    if (effectiveUntil && effectiveUntil <= effectiveFrom) {
      throw errors.validation('The end date must be after the start date', { effectiveUntil: 'Must be later' });
    }
    if (input.type === COST_CONFIG_TYPE.FUEL_PRICE && !input.mileageKmpl) {
      throw errors.validation('Fuel efficiency is required for a fuel price version', {
        mileageKmpl: 'Enter km per litre',
      });
    }

    const configuration = await req.db.transaction(async (tx) => {
      // Close the previous open version of this type.
      const closed = await tx.query<{ id: string; effective_from: unknown }>(
        `UPDATE cost_configurations
            SET effective_until = $3::timestamptz
          WHERE organization_id = $1::uuid AND type = $2::cost_config_type
            AND effective_until IS NULL AND effective_from < $3::timestamptz
          RETURNING id, effective_from`,
        [actor.organizationId, input.type, effectiveFrom.toISOString()],
      );

      const inserted = await tx.query<{ id: string }>(
        `INSERT INTO cost_configurations
           (organization_id, type, value, unit, currency, mileage_kmpl, effective_from, effective_until, note, created_by)
         VALUES ($1::uuid, $2::cost_config_type, $3::numeric, $4, $5, $6::numeric,
                 $7::timestamptz, $8::timestamptz, $9, $10::uuid)
         RETURNING id`,
        [
          actor.organizationId,
          input.type,
          input.value,
          input.unit,
          input.currency.toUpperCase(),
          input.mileageKmpl ?? null,
          effectiveFrom.toISOString(),
          effectiveUntil ? effectiveUntil.toISOString() : null,
          input.note ?? null,
          actor.id,
        ],
      );

      // Keep org_settings aligned so brand-new rides estimate with the latest
      // published numbers even before any trip has been taken.
      if (input.type === COST_CONFIG_TYPE.FUEL_PRICE) {
        await tx.query(
          `UPDATE org_settings SET fuel_cost_per_litre = $2::numeric,
                                   default_mileage_kmpl = COALESCE($3::numeric, default_mileage_kmpl)
            WHERE organization_id = $1::uuid`,
          [actor.organizationId, input.value, input.mileageKmpl ?? null],
        );
      } else {
        await tx.query('UPDATE org_settings SET travel_cost_per_km = $2::numeric WHERE organization_id = $1::uuid', [
          actor.organizationId,
          input.value,
        ]);
      }

      await writeAudit(tx, {
        organizationId: actor.organizationId,
        actorId: actor.id,
        actorName: actor.name,
        action: AUDIT_ACTION.COST_CONFIGURATION_CREATED,
        entityType: 'cost_configuration',
        entityId: inserted.rows[0]!.id,
        newValues: {
          type: input.type,
          value: input.value,
          unit: input.unit,
          currency: input.currency.toUpperCase(),
          mileageKmpl: input.mileageKmpl ?? null,
          effectiveFrom: effectiveFrom.toISOString(),
          effectiveUntil: effectiveUntil ? effectiveUntil.toISOString() : null,
        },
        metadata: closed.rows[0] ? { closedVersionId: closed.rows[0].id } : null,
      });

      const { rows } = await tx.query(`${COST_SELECT} AND c.id = $2::uuid`, [
        actor.organizationId,
        inserted.rows[0]!.id,
      ]);
      return mapCostConfiguration(rows[0] as Record<string, unknown>);
    });

    return created(res, configuration, 'New cost version published');
  }),
);

/**
 * POST /api/admin/costs/:id/close
 * Ends an open version. Versions are never edited or deleted.
 */
adminCostsRouter.post(
  '/:id/close',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const configurationId = parseId(req.params.id, 'configuration id');

    const configuration = await req.db.transaction(async (tx) => {
      const { rows } = await tx.query<{ id: string; effective_until: unknown; type: string }>(
        `SELECT id, effective_until, type::text AS type FROM cost_configurations
          WHERE id = $1::uuid AND organization_id = $2::uuid FOR UPDATE`,
        [configurationId, actor.organizationId],
      );
      const existing = rows[0];
      if (!existing) throw errors.notFound('That cost version does not exist');
      if (existing.effective_until) throw errors.ruleViolation('This version is already closed');

      await tx.query('UPDATE cost_configurations SET effective_until = NOW() WHERE id = $1::uuid', [configurationId]);

      await writeAudit(tx, {
        organizationId: actor.organizationId,
        actorId: actor.id,
        actorName: actor.name,
        action: AUDIT_ACTION.COST_CONFIGURATION_CLOSED,
        entityType: 'cost_configuration',
        entityId: configurationId,
        previousValues: { effectiveUntil: null },
        newValues: { effectiveUntil: new Date().toISOString() },
      });

      const refreshed = await tx.query(`${COST_SELECT} AND c.id = $2::uuid`, [actor.organizationId, configurationId]);
      return mapCostConfiguration(refreshed.rows[0] as Record<string, unknown>);
    });

    return ok(res, configuration, 'Cost version closed');
  }),
);
