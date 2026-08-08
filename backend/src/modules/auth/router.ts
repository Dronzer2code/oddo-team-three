import { Router } from 'express';
import {
  ACCOUNT_STATUS,
  AUDIT_ACTION,
  INVITATION_STATUS,
  USER_ROLE,
  acceptInvitationSchema,
  changePasswordSchema,
  loginSchema,
  registerSchema,
  type AccountStatus,
  type AuthSession,
  type AuthUser,
  type UserRole,
} from '@carpool/shared';
import { handler, ok } from '../../shared/http.js';
import { parseBody } from '../../middleware/validate.js';
import { errors } from '../../shared/errors.js';
import { hashPassword, signToken, verifyPassword } from '../../shared/security.js';
import { actorOf, authenticate } from '../../middleware/auth.js';
import { isProfileComplete, touchActivity } from '../../shared/activity.js';
import { writeAudit } from '../../shared/audit.js';
import { isoRequired } from '../../database/client.js';

interface UserRow {
  id: string;
  organization_id: string;
  name: string;
  email: string;
  phone: string | null;
  password_hash: string;
  role: UserRole;
  status: AccountStatus;
  home_location: string | null;
  work_location: string | null;
  organization_name: string;
  organization_status: string;
}

function toAuthUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    profileComplete: isProfileComplete(row),
  };
}

export const authRouter = Router();

/**
 * POST /api/auth/login
 * Authenticates, then verifies the account and organization are usable before
 * a token is ever issued.
 */
authRouter.post(
  '/login',
  handler(async (req, res) => {
    const input = parseBody(req, loginSchema);

    const { rows } = await req.db.query<UserRow>(
      `SELECT u.*, o.name AS organization_name, o.status::text AS organization_status
         FROM users u JOIN organizations o ON o.id = u.organization_id
        WHERE lower(u.email) = lower($1)`,
      [input.email],
    );

    const row = rows[0];
    // Constant-ish response: never reveal whether the email exists.
    if (!row || !(await verifyPassword(input.password, row.password_hash))) {
      throw errors.invalidCredentials();
    }
    if (row.organization_status !== 'active') {
      throw errors.forbidden('This organization is suspended. Contact your administrator.');
    }
    if (row.status === ACCOUNT_STATUS.DEACTIVATED) {
      throw errors.accountNotOperational('This account has been deactivated by your administrator.');
    }

    const { token, expiresAt } = signToken({ sub: row.id, org: row.organization_id, role: row.role });
    await touchActivity(req.db, row.id);

    const session: AuthSession = { token, expiresAt, user: toAuthUser(row) };
    return ok(res, session, 'Signed in');
  }),
);

/**
 * POST /api/auth/register
 * Organization-scoped self registration. New employees land in PENDING and
 * cannot publish or request rides until an administrator activates them.
 */
authRouter.post(
  '/register',
  handler(async (req, res) => {
    const input = parseBody(req, registerSchema);

    const org = await req.db.query<{ id: string; name: string; status: string }>(
      `SELECT id, name, status::text AS status FROM organizations WHERE slug = lower($1)`,
      [input.organizationSlug],
    );
    const organization = org.rows[0];
    if (!organization) throw errors.notFound('We could not find that organization code');
    if (organization.status !== 'active') throw errors.forbidden('This organization is not accepting new accounts');

    const existing = await req.db.query('SELECT 1 FROM users WHERE lower(email) = lower($1)', [input.email]);
    if (existing.rows.length > 0) throw errors.conflict('An account with that email already exists');

    const passwordHash = await hashPassword(input.password);

    const inserted = await req.db.query<UserRow>(
      `INSERT INTO users (organization_id, name, email, phone, password_hash, role, status, employee_code, department)
       VALUES ($1::uuid, $2, $3, $4, $5, 'employee'::user_role, 'pending'::account_status, $6, $7)
       RETURNING *, '' AS organization_name, 'active' AS organization_status`,
      [
        organization.id,
        input.name,
        input.email,
        input.phone ?? null,
        passwordHash,
        input.employeeCode ?? null,
        input.department ?? null,
      ],
    );

    const row = { ...inserted.rows[0]!, organization_name: organization.name };
    const { token, expiresAt } = signToken({ sub: row.id, org: row.organization_id, role: row.role });

    const session: AuthSession = { token, expiresAt, user: toAuthUser(row) };
    return ok(res, session, 'Account created. An administrator will activate your access.', 201);
  }),
);

/** GET /api/auth/invitations/:token — public preview for the accept screen. */
authRouter.get(
  '/invitations/:token',
  handler(async (req, res) => {
    const { rows } = await req.db.query<{
      email: string;
      name: string;
      department: string | null;
      status: string;
      expires_at: unknown;
      organization_name: string;
    }>(
      `SELECT i.email, i.name, i.department, i.status::text AS status, i.expires_at, o.name AS organization_name
         FROM invitations i JOIN organizations o ON o.id = i.organization_id
        WHERE i.token = $1`,
      [req.params.token],
    );

    const invite = rows[0];
    if (!invite) throw errors.notFound('This invitation link is not valid');
    if (invite.status !== INVITATION_STATUS.PENDING) throw errors.ruleViolation('This invitation is no longer available');
    if (new Date(isoRequired(invite.expires_at)).getTime() < Date.now()) {
      throw errors.ruleViolation('This invitation has expired. Ask your administrator to resend it.');
    }

    return ok(res, {
      email: invite.email,
      name: invite.name,
      department: invite.department,
      organizationName: invite.organization_name,
      expiresAt: isoRequired(invite.expires_at),
    });
  }),
);

/**
 * POST /api/auth/invitations/accept
 * Invited employees are activated immediately — the organization already
 * vouched for them by sending the invitation.
 */
authRouter.post(
  '/invitations/accept',
  handler(async (req, res) => {
    const input = parseBody(req, acceptInvitationSchema);

    const session = await req.db.transaction(async (tx) => {
      const { rows } = await tx.query<{
        id: string;
        organization_id: string;
        email: string;
        name: string;
        employee_code: string | null;
        department: string | null;
        status: string;
        expires_at: unknown;
        invited_by: string | null;
        organization_name: string;
      }>(
        `SELECT i.*, o.name AS organization_name
           FROM invitations i JOIN organizations o ON o.id = i.organization_id
          WHERE i.token = $1 FOR UPDATE`,
        [input.token],
      );

      const invite = rows[0];
      if (!invite) throw errors.notFound('This invitation link is not valid');
      if (invite.status !== INVITATION_STATUS.PENDING) throw errors.ruleViolation('This invitation is no longer available');
      if (new Date(isoRequired(invite.expires_at)).getTime() < Date.now()) {
        await tx.query(`UPDATE invitations SET status = 'expired'::invitation_status WHERE id = $1::uuid`, [invite.id]);
        throw errors.ruleViolation('This invitation has expired. Ask your administrator to resend it.');
      }

      const clash = await tx.query('SELECT 1 FROM users WHERE lower(email) = lower($1)', [invite.email]);
      if (clash.rows.length > 0) throw errors.conflict('An account with that email already exists');

      const passwordHash = await hashPassword(input.password);
      const inserted = await tx.query<UserRow>(
        `INSERT INTO users (organization_id, name, email, phone, password_hash, role, status, employee_code, department)
         VALUES ($1::uuid, $2, $3, $4, $5, 'employee'::user_role, 'active'::account_status, $6, $7)
         RETURNING *, '' AS organization_name, 'active' AS organization_status`,
        [
          invite.organization_id,
          input.name ?? invite.name,
          invite.email,
          input.phone ?? null,
          passwordHash,
          invite.employee_code,
          invite.department,
        ],
      );
      const user = { ...inserted.rows[0]!, organization_name: invite.organization_name };

      await tx.query(
        `UPDATE invitations SET status = 'accepted'::invitation_status, accepted_user_id = $2::uuid WHERE id = $1::uuid`,
        [invite.id, user.id],
      );

      await writeAudit(tx, {
        organizationId: invite.organization_id,
        actorId: user.id,
        actorName: user.name,
        action: AUDIT_ACTION.EMPLOYEE_ACTIVATED,
        entityType: 'employee',
        entityId: user.id,
        newValues: { status: ACCOUNT_STATUS.ACTIVE, via: 'invitation' },
      });

      const { token, expiresAt } = signToken({ sub: user.id, org: user.organization_id, role: user.role });
      return { token, expiresAt, user: toAuthUser(user) } satisfies AuthSession;
    });

    return ok(res, session, 'Welcome aboard', 201);
  }),
);

/** GET /api/auth/me — re-resolves the session against current server state. */
authRouter.get(
  '/me',
  authenticate,
  handler(async (req, res) => {
    const actor = actorOf(req);
    const { rows } = await req.db.query<UserRow>(
      `SELECT u.*, o.name AS organization_name, o.status::text AS organization_status
         FROM users u JOIN organizations o ON o.id = u.organization_id
        WHERE u.id = $1::uuid`,
      [actor.id],
    );
    const row = rows[0];
    if (!row) throw errors.unauthenticated('Your account no longer exists');
    return ok(res, toAuthUser(row));
  }),
);

/** POST /api/auth/change-password */
authRouter.post(
  '/change-password',
  authenticate,
  handler(async (req, res) => {
    const actor = actorOf(req);
    const input = parseBody(req, changePasswordSchema);

    const { rows } = await req.db.query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE id = $1::uuid',
      [actor.id],
    );
    const row = rows[0];
    if (!row || !(await verifyPassword(input.currentPassword, row.password_hash))) {
      throw errors.validation('Your current password is incorrect', { currentPassword: 'Incorrect password' });
    }

    const hash = await hashPassword(input.newPassword);
    await req.db.transaction(async (tx) => {
      await tx.query('UPDATE users SET password_hash = $2 WHERE id = $1::uuid', [actor.id, hash]);
      if (actor.role === USER_ROLE.ADMIN) {
        await writeAudit(tx, {
          organizationId: actor.organizationId,
          actorId: actor.id,
          actorName: actor.name,
          action: 'admin.account_setting_changed',
          entityType: 'admin',
          entityId: actor.id,
          newValues: { password: 'changed' },
        });
      }
    });

    return ok(res, { changed: true }, 'Password updated');
  }),
);
