import { Router } from 'express';
import { auditLogQuerySchema, type AuditLogEntry, type Paginated } from '@carpool/shared';
import { actorOf, authenticate, requireRole } from '../../middleware/auth.js';
import { parseQuery } from '../../middleware/validate.js';
import { handler, ok, paginationMeta, resolvePage } from '../../shared/http.js';
import { num } from '../../database/client.js';
import { mapAuditLog } from '../../shared/mappers.js';

export const adminAuditLogsRouter = Router();
adminAuditLogsRouter.use(authenticate, requireRole('admin'));

/** GET /api/admin/audit-logs — organization-scoped, newest first. */
adminAuditLogsRouter.get(
  '/',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const query = parseQuery(req, auditLogQuerySchema);
    const page = resolvePage(query);

    const params: unknown[] = [actor.organizationId];
    const filters: string[] = [];

    if (query.action) {
      params.push(query.action);
      filters.push(`action = $${params.length}`);
    }
    if (query.entityType) {
      params.push(query.entityType);
      filters.push(`entity_type = $${params.length}`);
    }
    if (query.entityId) {
      params.push(query.entityId);
      filters.push(`entity_id = $${params.length}`);
    }
    if (query.actorId) {
      params.push(query.actorId);
      filters.push(`actor_id = $${params.length}::uuid`);
    }
    if (query.from) {
      params.push(query.from);
      filters.push(`created_at >= $${params.length}::timestamptz`);
    }
    if (query.to) {
      params.push(query.to);
      // Inclusive end-of-day boundary.
      filters.push(`created_at < ($${params.length}::date + INTERVAL '1 day')`);
    }

    const where = filters.map((f) => `AND ${f}`).join(' ');

    const countResult = await req.db.query<{ total: unknown }>(
      `SELECT COUNT(*) AS total FROM audit_logs WHERE organization_id = $1::uuid ${where}`,
      params,
    );

    const listParams = [...params, page.limit, page.offset];
    const { rows } = await req.db.query(
      `SELECT * FROM audit_logs WHERE organization_id = $1::uuid ${where}
        ORDER BY created_at DESC
        LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
      listParams,
    );

    const payload: Paginated<AuditLogEntry> = {
      items: rows.map((row) => mapAuditLog(row as Record<string, unknown>)),
      pagination: paginationMeta(page, num(countResult.rows[0]?.total)),
    };
    return ok(res, payload);
  }),
);

/** GET /api/admin/audit-logs/actions — distinct actions, for the filter list. */
adminAuditLogsRouter.get(
  '/actions',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const { rows } = await req.db.query<{ action: string }>(
      'SELECT DISTINCT action FROM audit_logs WHERE organization_id = $1::uuid ORDER BY action ASC',
      [actor.organizationId],
    );
    return ok(res, rows.map((r) => r.action));
  }),
);
