import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ACCOUNT_STATUS, USER_ROLE, type AccountStatus, type UserRole } from '@carpool/shared';
import { errors } from '../shared/errors.js';
import { verifyToken } from '../shared/security.js';
import type { RequestActor } from '../types/express.js';

interface ActorRow {
  id: string;
  organization_id: string;
  name: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  organization_name: string;
  organization_status: string;
  organization_currency: string;
}

/**
 * Step 1-3 of the protected-request contract: authenticate, resolve role, and
 * resolve the organization *from trusted server-side state*. The token carries
 * an organization claim, but it is re-checked against the stored user row so a
 * forged or stale claim cannot widen access.
 */
export const authenticate: RequestHandler = (req, res, next) => {
  void (async () => {
    const header = req.header('authorization') ?? '';
    const [scheme, token] = header.split(' ');
    if (!token || scheme?.toLowerCase() !== 'bearer') {
      throw errors.unauthenticated();
    }

    const payload = verifyToken(token.trim());

    const { rows } = await req.db.query<ActorRow>(
      `SELECT u.id, u.organization_id, u.name, u.email, u.role, u.status,
              o.name AS organization_name,
              o.status::text AS organization_status,
              o.currency AS organization_currency
         FROM users u
         JOIN organizations o ON o.id = u.organization_id
        WHERE u.id = $1::uuid`,
      [payload.sub],
    );

    const row = rows[0];
    if (!row) throw errors.unauthenticated('Your account no longer exists');
    if (row.organization_id !== payload.org) throw errors.forbidden('Session organization mismatch');
    if (row.role !== payload.role) throw errors.forbidden('Your access level changed. Sign in again.');
    if (row.organization_status !== 'active') {
      throw errors.forbidden('This organization is suspended. Contact your administrator.');
    }
    if (row.status === ACCOUNT_STATUS.DEACTIVATED) {
      throw errors.accountNotOperational('This account has been deactivated by your administrator.');
    }

    const actor: RequestActor = {
      id: row.id,
      organizationId: row.organization_id,
      organizationName: row.organization_name,
      organizationCurrency: row.organization_currency?.trim() || 'INR',
      name: row.name,
      email: row.email,
      role: row.role,
      status: row.status,
    };
    req.actor = actor;
  })()
    .then(() => next())
    .catch(next);
};

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.actor) return next(errors.unauthenticated());
    if (!roles.includes(req.actor.role)) {
      return next(
        errors.forbidden(
          req.actor.role === USER_ROLE.EMPLOYEE
            ? 'This area is restricted to organization administrators.'
            : 'This area is restricted to employees.',
        ),
      );
    }
    return next();
  };
}

/**
 * Suspended and pending accounts can read their own profile but must not
 * publish, request, or otherwise operate. Applied per-route, not globally.
 */
export const requireOperationalAccount: RequestHandler = (req, _res, next) => {
  if (!req.actor) return next(errors.unauthenticated());
  if (req.actor.status === ACCOUNT_STATUS.ACTIVE) return next();

  const reason =
    req.actor.status === ACCOUNT_STATUS.SUSPENDED
      ? 'Your account is suspended. Contact your administrator to restore carpooling access.'
      : 'Complete your profile to start carpooling.';
  return next(errors.accountNotOperational(reason));
};

/** Resolves the caller's organization. Never read an org id from the client. */
export function actorOf(req: Request): RequestActor {
  if (!req.actor) throw errors.unauthenticated();
  return req.actor;
}
