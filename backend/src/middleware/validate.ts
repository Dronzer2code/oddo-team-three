import type { Request } from 'express';
import { ZodError, type ZodTypeAny, type z } from 'zod';
import { errors } from '../shared/errors.js';
import { uuidSchema } from '@carpool/shared';

function fieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Validates and returns the request body. Rejects unknown organization ids. */
export function parseBody<S extends ZodTypeAny>(req: Request, schema: S): z.infer<S> {
  guardOrganizationOverride(req.body);
  try {
    return schema.parse(req.body ?? {});
  } catch (error) {
    if (error instanceof ZodError) throw errors.validation('Please correct the highlighted fields', fieldErrors(error));
    throw error;
  }
}

export function parseQuery<S extends ZodTypeAny>(req: Request, schema: S): z.infer<S> {
  try {
    // Drop empty strings so optional filters behave like "not provided".
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(req.query)) {
      if (value === '' || value === undefined || value === null) continue;
      cleaned[key] = value;
    }
    return schema.parse(cleaned);
  } catch (error) {
    if (error instanceof ZodError) throw errors.validation('Invalid filter values', fieldErrors(error));
    throw error;
  }
}

export function parseId(value: unknown, label = 'identifier'): string {
  const result = uuidSchema.safeParse(value);
  if (!result.success) throw errors.validation(`Invalid ${label}`);
  return result.data;
}

/**
 * Defence in depth: a client that tries to smuggle `organizationId` into a body
 * is refused loudly rather than silently ignored, so the mistake is visible.
 */
function guardOrganizationOverride(body: unknown): void {
  if (!body || typeof body !== 'object') return;
  const keys = Object.keys(body as Record<string, unknown>);
  const offending = keys.find((k) => ['organizationid', 'organization_id', 'orgid', 'org_id'].includes(k.toLowerCase()));
  if (offending) {
    throw errors.forbidden('Organization scope is resolved from your session and cannot be supplied by the client');
  }
}
