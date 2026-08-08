import type { Queryable } from '../database/client.js';

/** Records that an employee actually used the platform (drives the admin "last activity" column). */
export async function touchActivity(db: Queryable, userId: string): Promise<void> {
  await db.query('UPDATE users SET last_activity_at = NOW() WHERE id = $1::uuid', [userId]);
}

/** A profile is complete once the employee can actually be picked up. */
export function isProfileComplete(row: {
  phone?: string | null;
  home_location?: string | null;
  work_location?: string | null;
}): boolean {
  return Boolean(row.phone && row.home_location && row.work_location);
}
