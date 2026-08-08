import { Router } from 'express';
import {
  AUDIT_ACTION,
  organizationSettingsSchema,
  type Organization,
  type OrganizationSettings,
} from '@carpool/shared';
import { actorOf, authenticate, requireRole } from '../../middleware/auth.js';
import { parseBody } from '../../middleware/validate.js';
import { handler, ok } from '../../shared/http.js';
import { errors } from '../../shared/errors.js';
import { isoRequired, num, type Queryable } from '../../database/client.js';
import { diffFields, writeAudit } from '../../shared/audit.js';

export const adminOrganizationRouter = Router();
adminOrganizationRouter.use(authenticate, requireRole('admin'));

interface OrgRow extends Record<string, any> {}

function mapOrganization(row: OrgRow): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    logoUrl: row.logo_url ?? null,
    contactEmail: row.contact_email ?? null,
    contactPhone: row.contact_phone ?? null,
    address: row.address ?? null,
    timezone: row.timezone,
    currency: (row.currency ?? 'INR').trim(),
    distanceUnit: row.distance_unit,
    carpoolingEnabled: row.carpooling_enabled === true,
    status: row.status,
    createdAt: isoRequired(row.created_at),
  };
}

function mapSettings(row: OrgRow): OrganizationSettings {
  return {
    organizationId: row.organization_id,
    fuelCostPerLitre: num(row.fuel_cost_per_litre),
    travelCostPerKm: num(row.travel_cost_per_km),
    defaultMileageKmpl: num(row.default_mileage_kmpl),
    vehicleApprovalRequired: row.vehicle_approval_required === true,
    rideApprovalRequired: row.ride_approval_required === true,
    updatedAt: isoRequired(row.updated_at),
  };
}

async function load(db: Queryable, organizationId: string) {
  const org = await db.query<OrgRow>(
    `SELECT id, name, slug, logo_url, contact_email, contact_phone, address, timezone,
            currency, distance_unit::text AS distance_unit, carpooling_enabled,
            status::text AS status, created_at
       FROM organizations WHERE id = $1::uuid`,
    [organizationId],
  );
  const settings = await db.query<OrgRow>('SELECT * FROM org_settings WHERE organization_id = $1::uuid', [
    organizationId,
  ]);
  if (!org.rows[0] || !settings.rows[0]) throw errors.notFound('Organization not found');
  return { organization: mapOrganization(org.rows[0]), settings: mapSettings(settings.rows[0]) };
}

/** GET /api/admin/organization */
adminOrganizationRouter.get(
  '/',
  handler(async (req, res) => {
    const actor = actorOf(req);
    return ok(res, await load(req.db, actor.organizationId));
  }),
);

/**
 * PATCH /api/admin/organization/settings
 * Profile fields live on `organizations`, operational policy on `org_settings`;
 * both are written in one transaction with a single audit entry.
 */
adminOrganizationRouter.patch(
  '/settings',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const input = parseBody(req, organizationSettingsSchema);

    await req.db.transaction(async (tx) => {
      const orgResult = await tx.query<OrgRow>(
        `SELECT id, name, logo_url, contact_email, contact_phone, address, timezone, currency,
                distance_unit::text AS distance_unit, carpooling_enabled
           FROM organizations WHERE id = $1::uuid FOR UPDATE`,
        [actor.organizationId],
      );
      const before = orgResult.rows[0];
      if (!before) throw errors.notFound('Organization not found');

      const settingsResult = await tx.query<OrgRow>(
        'SELECT * FROM org_settings WHERE organization_id = $1::uuid FOR UPDATE',
        [actor.organizationId],
      );
      const settingsBefore = settingsResult.rows[0];

      const orgUpdates: string[] = [];
      const orgParams: unknown[] = [actor.organizationId];
      const pushOrg = (column: string, value: unknown, cast = '') => {
        orgParams.push(value);
        orgUpdates.push(`${column} = $${orgParams.length}${cast}`);
      };

      if (input.name !== undefined) pushOrg('name', input.name);
      if (input.logoUrl !== undefined) pushOrg('logo_url', input.logoUrl || null);
      if (input.contactEmail !== undefined) pushOrg('contact_email', input.contactEmail || null);
      if (input.contactPhone !== undefined) pushOrg('contact_phone', input.contactPhone || null);
      if (input.address !== undefined) pushOrg('address', input.address || null);
      if (input.timezone !== undefined) pushOrg('timezone', input.timezone);
      if (input.currency !== undefined) pushOrg('currency', input.currency.toUpperCase());
      if (input.distanceUnit !== undefined) pushOrg('distance_unit', input.distanceUnit, '::distance_unit');
      if (input.carpoolingEnabled !== undefined) pushOrg('carpooling_enabled', input.carpoolingEnabled, '::boolean');

      if (orgUpdates.length > 0) {
        await tx.query(`UPDATE organizations SET ${orgUpdates.join(', ')} WHERE id = $1::uuid`, orgParams);
      }

      const settingUpdates: string[] = [];
      const settingParams: unknown[] = [actor.organizationId];
      const pushSetting = (column: string, value: unknown, cast = '') => {
        settingParams.push(value);
        settingUpdates.push(`${column} = $${settingParams.length}${cast}`);
      };
      if (input.vehicleApprovalRequired !== undefined) {
        pushSetting('vehicle_approval_required', input.vehicleApprovalRequired, '::boolean');
      }
      if (input.rideApprovalRequired !== undefined) {
        pushSetting('ride_approval_required', input.rideApprovalRequired, '::boolean');
      }
      if (input.defaultMileageKmpl !== undefined) {
        pushSetting('default_mileage_kmpl', input.defaultMileageKmpl, '::numeric');
      }
      if (settingUpdates.length > 0) {
        await tx.query(
          `UPDATE org_settings SET ${settingUpdates.join(', ')} WHERE organization_id = $1::uuid`,
          settingParams,
        );
      }

      if (orgUpdates.length === 0 && settingUpdates.length === 0) throw errors.validation('Nothing to update');

      const { previous, next } = diffFields(
        {
          name: before.name,
          logoUrl: before.logo_url,
          contactEmail: before.contact_email,
          contactPhone: before.contact_phone,
          address: before.address,
          timezone: before.timezone,
          currency: (before.currency ?? '').trim(),
          distanceUnit: before.distance_unit,
          carpoolingEnabled: before.carpooling_enabled,
          vehicleApprovalRequired: settingsBefore?.vehicle_approval_required,
          rideApprovalRequired: settingsBefore?.ride_approval_required,
          defaultMileageKmpl: num(settingsBefore?.default_mileage_kmpl),
        },
        input as Record<string, unknown>,
      );

      await writeAudit(tx, {
        organizationId: actor.organizationId,
        actorId: actor.id,
        actorName: actor.name,
        action: AUDIT_ACTION.ORGANIZATION_SETTING_CHANGED,
        entityType: 'organization',
        entityId: actor.organizationId,
        previousValues: previous,
        newValues: next,
      });
    });

    return ok(res, await load(req.db, actor.organizationId), 'Organization settings saved');
  }),
);
