import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { errors } from './errors.js';
import type { UserRole } from '@carpool/shared';

export interface TokenPayload {
  sub: string;
  /**
   * Organization is stamped into the token at sign-in and re-verified against
   * the database on every request. Clients can never supply it.
   */
  org: string;
  role: UserRole;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signToken(payload: TokenPayload): { token: string; expiresAt: string } {
  const token = jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiresInSeconds });
  return {
    token,
    expiresAt: new Date(Date.now() + env.jwtExpiresInSeconds * 1000).toISOString(),
  };
}

export function verifyToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, env.jwtSecret) as TokenPayload;
    if (!decoded?.sub || !decoded?.org || !decoded?.role) throw new Error('malformed');
    return decoded;
  } catch (error) {
    const expired = (error as Error).name === 'TokenExpiredError';
    throw errors.unauthenticated(expired ? 'Your session has expired. Sign in again.' : 'Sign in to continue');
  }
}

export function randomToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString('base64url');
}
