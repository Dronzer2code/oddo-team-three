import type { Queryable } from '../database/client.js';

export interface AuditEntry {
  organizationId: string;
  actorId: string | null;
  actorName: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  previousValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Writes one administrative audit record. Always called inside the same
 * transaction as the change it describes, so an audited action either lands
 * with its log entry or not at all.
 */
export async function writeAudit(db: Queryable, entry: AuditEntry): Promise<void> {
  await db.query(
    `INSERT INTO audit_logs
       (organization_id, actor_id, actor_name, action, entity_type, entity_id,
        previous_values, new_values, metadata)
     VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb)`,
    [
      entry.organizationId,
      entry.actorId,
      entry.actorName,
      entry.action,
      entry.entityType,
      entry.entityId ?? null,
      entry.previousValues ? JSON.stringify(entry.previousValues) : null,
      entry.newValues ? JSON.stringify(entry.newValues) : null,
      entry.metadata ? JSON.stringify(entry.metadata) : null,
    ],
  );
}

/** Returns only the keys that actually changed, for compact audit diffs. */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): { previous: Record<string, unknown>; next: Record<string, unknown> } {
  const previous: Record<string, unknown> = {};
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(after)) {
    if (value === undefined) continue;
    if (before[key] !== value) {
      previous[key] = before[key] ?? null;
      next[key] = value;
    }
  }
  return { previous, next };
}
