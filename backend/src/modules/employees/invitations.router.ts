import { Router } from 'express';
import {
  AUDIT_ACTION,
  INVITATION_STATUS,
  bulkInviteSchema,
  inviteEmployeeSchema,
  paginationQuerySchema,
  type Invitation,
  type Paginated,
} from '@carpool/shared';
import { actorOf, authenticate, requireRole } from '../../middleware/auth.js';
import { parseBody, parseId, parseQuery } from '../../middleware/validate.js';
import { created, handler, ok, paginationMeta, resolvePage } from '../../shared/http.js';
import { errors } from '../../shared/errors.js';
import { num } from '../../database/client.js';
import { randomToken } from '../../shared/security.js';
import { writeAudit } from '../../shared/audit.js';
import { mapInvitation } from '../../shared/mappers.js';
import { env } from '../../config/env.js';
import type { Queryable } from '../../database/client.js';

export const adminInvitationsRouter = Router();
adminInvitationsRouter.use(authenticate, requireRole('admin'));

const INVITATION_SELECT = `
SELECT i.*, inviter.name AS invited_by_name
  FROM invitations i LEFT JOIN users inviter ON inviter.id = i.invited_by`;

const INVITE_TTL_DAYS = 14;

function inviteLink(token: string): string {
  return `${env.employeeAppUrl}/invite/${token}`;
}

async function createInvitation(
  tx: Queryable,
  actor: { id: string; name: string; organizationId: string },
  input: { email: string; name: string; employeeCode?: string; department?: string },
): Promise<Invitation> {
  const existingUser = await tx.query('SELECT 1 FROM users WHERE lower(email) = lower($1)', [input.email]);
  if (existingUser.rows.length > 0) throw errors.conflict(`${input.email} already has an account`);

  const pending = await tx.query(
    `SELECT 1 FROM invitations
      WHERE organization_id = $1::uuid AND lower(email) = lower($2) AND status = 'pending'`,
    [actor.organizationId, input.email],
  );
  if (pending.rows.length > 0) throw errors.conflict(`An invitation is already pending for ${input.email}`);

  const token = randomToken();
  const expires = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  const inserted = await tx.query<{ id: string }>(
    `INSERT INTO invitations (organization_id, email, name, employee_code, department, token, invited_by, expires_at)
     VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::uuid, $8::timestamptz)
     RETURNING id`,
    [
      actor.organizationId,
      input.email,
      input.name,
      input.employeeCode ?? null,
      input.department ?? null,
      token,
      actor.id,
      expires.toISOString(),
    ],
  );

  await writeAudit(tx, {
    organizationId: actor.organizationId,
    actorId: actor.id,
    actorName: actor.name,
    action: AUDIT_ACTION.EMPLOYEE_INVITED,
    entityType: 'invitation',
    entityId: inserted.rows[0]!.id,
    newValues: { email: input.email, name: input.name, department: input.department ?? null },
  });

  const { rows } = await tx.query(`${INVITATION_SELECT} WHERE i.id = $1::uuid`, [inserted.rows[0]!.id]);
  return mapInvitation(rows[0] as Record<string, unknown>);
}

/** GET /api/admin/invitations */
adminInvitationsRouter.get(
  '/',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const page = resolvePage(parseQuery(req, paginationQuerySchema));

    // Lazily mark lapsed invitations so the list reflects reality.
    await req.db.query(
      `UPDATE invitations SET status = 'expired'::invitation_status
        WHERE organization_id = $1::uuid AND status = 'pending' AND expires_at < NOW()`,
      [actor.organizationId],
    );

    const countResult = await req.db.query<{ total: unknown }>(
      'SELECT COUNT(*) AS total FROM invitations WHERE organization_id = $1::uuid',
      [actor.organizationId],
    );
    const { rows } = await req.db.query(
      `${INVITATION_SELECT} WHERE i.organization_id = $1::uuid
        ORDER BY CASE i.status WHEN 'pending' THEN 0 ELSE 1 END, i.created_at DESC
        LIMIT $2 OFFSET $3`,
      [actor.organizationId, page.limit, page.offset],
    );

    const payload: Paginated<Invitation & { link: string }> = {
      items: rows.map((row) => {
        const invitation = mapInvitation(row as Record<string, unknown>);
        return { ...invitation, link: inviteLink(invitation.token) };
      }),
      pagination: paginationMeta(page, num(countResult.rows[0]?.total)),
    };
    return ok(res, payload);
  }),
);

/** POST /api/admin/invitations */
adminInvitationsRouter.post(
  '/',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const input = parseBody(req, inviteEmployeeSchema);
    const invitation = await req.db.transaction((tx) => createInvitation(tx, actor, input));
    return created(res, { ...invitation, link: inviteLink(invitation.token) }, `Invitation sent to ${invitation.email}`);
  }),
);

/** POST /api/admin/invitations/bulk — import several employees at once. */
adminInvitationsRouter.post(
  '/bulk',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const { invitations } = parseBody(req, bulkInviteSchema);

    const results: Array<{ email: string; ok: boolean; message?: string }> = [];
    for (const entry of invitations) {
      try {
        // Each invitation is its own transaction so one bad row cannot
        // discard the whole import.
        await req.db.transaction((tx) => createInvitation(tx, actor, entry));
        results.push({ email: entry.email, ok: true });
      } catch (error) {
        results.push({ email: entry.email, ok: false, message: (error as Error).message });
      }
    }

    const invited = results.filter((r) => r.ok).length;
    return ok(res, { invited, failed: results.length - invited, results }, `${invited} invitation(s) sent`);
  }),
);

/** POST /api/admin/invitations/:id/resend — new token, fresh expiry. */
adminInvitationsRouter.post(
  '/:id/resend',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const invitationId = parseId(req.params.id, 'invitation id');

    const invitation = await req.db.transaction(async (tx) => {
      const { rows } = await tx.query<{ id: string; status: string; email: string }>(
        `SELECT id, status::text AS status, email FROM invitations
          WHERE id = $1::uuid AND organization_id = $2::uuid FOR UPDATE`,
        [invitationId, actor.organizationId],
      );
      const existing = rows[0];
      if (!existing) throw errors.notFound('That invitation does not exist');
      if (existing.status === INVITATION_STATUS.ACCEPTED) throw errors.ruleViolation('This invitation was already accepted');

      const token = randomToken();
      await tx.query(
        `UPDATE invitations
            SET token = $2, status = 'pending'::invitation_status,
                expires_at = NOW() + ($3 || ' days')::interval
          WHERE id = $1::uuid`,
        [invitationId, token, String(INVITE_TTL_DAYS)],
      );

      await writeAudit(tx, {
        organizationId: actor.organizationId,
        actorId: actor.id,
        actorName: actor.name,
        action: AUDIT_ACTION.EMPLOYEE_INVITE_RESENT,
        entityType: 'invitation',
        entityId: invitationId,
        newValues: { email: existing.email, expiresInDays: INVITE_TTL_DAYS },
      });

      const refreshed = await tx.query(`${INVITATION_SELECT} WHERE i.id = $1::uuid`, [invitationId]);
      return mapInvitation(refreshed.rows[0] as Record<string, unknown>);
    });

    return ok(res, { ...invitation, link: inviteLink(invitation.token) }, 'Invitation resent');
  }),
);

/** POST /api/admin/invitations/:id/cancel */
adminInvitationsRouter.post(
  '/:id/cancel',
  handler(async (req, res) => {
    const actor = actorOf(req);
    const invitationId = parseId(req.params.id, 'invitation id');

    const invitation = await req.db.transaction(async (tx) => {
      const { rows } = await tx.query<{ status: string; email: string }>(
        `SELECT status::text AS status, email FROM invitations
          WHERE id = $1::uuid AND organization_id = $2::uuid FOR UPDATE`,
        [invitationId, actor.organizationId],
      );
      const existing = rows[0];
      if (!existing) throw errors.notFound('That invitation does not exist');
      if (existing.status !== INVITATION_STATUS.PENDING) {
        throw errors.ruleViolation(`This invitation is already ${existing.status}`);
      }

      await tx.query(`UPDATE invitations SET status = 'canceled'::invitation_status WHERE id = $1::uuid`, [invitationId]);

      await writeAudit(tx, {
        organizationId: actor.organizationId,
        actorId: actor.id,
        actorName: actor.name,
        action: AUDIT_ACTION.EMPLOYEE_INVITE_CANCELED,
        entityType: 'invitation',
        entityId: invitationId,
        previousValues: { status: INVITATION_STATUS.PENDING },
        newValues: { status: INVITATION_STATUS.CANCELED, email: existing.email },
      });

      const refreshed = await tx.query(`${INVITATION_SELECT} WHERE i.id = $1::uuid`, [invitationId]);
      return mapInvitation(refreshed.rows[0] as Record<string, unknown>);
    });

    return ok(res, invitation, 'Invitation canceled');
  }),
);
