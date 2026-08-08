import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ERROR_CODE } from '@carpool/shared';
import { AppError } from '../shared/errors.js';
import { env } from '../config/env.js';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: { code: ERROR_CODE.RESOURCE_NOT_FOUND, message: `No API route matches ${req.method} ${req.path}` },
  });
};

/** Translates unique-constraint noise from PostgreSQL into product language. */
function translateDatabaseError(message: string): { status: number; code: string; message: string } | null {
  if (message.includes('vehicles_registration_number_unique')) {
    return { status: 409, code: ERROR_CODE.CONFLICT, message: 'That registration number already exists in your organization' };
  }
  if (message.includes('users_email_unique')) {
    return { status: 409, code: ERROR_CODE.CONFLICT, message: 'An account with that email already exists' };
  }
  if (message.includes('users_employee_code_unique')) {
    return { status: 409, code: ERROR_CODE.CONFLICT, message: 'That employee ID is already used in your organization' };
  }
  if (message.includes('invitations_pending_email_unique')) {
    return { status: 409, code: ERROR_CODE.CONFLICT, message: 'An invitation is already pending for that email' };
  }
  if (message.includes('ride_requests_live_unique')) {
    return { status: 409, code: ERROR_CODE.CONFLICT, message: 'You already have an open request for this ride' };
  }
  if (message.includes('trips_ride_unique')) {
    return { status: 409, code: ERROR_CODE.CONFLICT, message: 'A trip already exists for this ride' };
  }
  if (message.includes('rides_seats_taken_valid')) {
    return { status: 409, code: ERROR_CODE.RULE_VIOLATION, message: 'That would exceed the seats offered for this ride' };
  }
  return null;
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof AppError) {
    res.status(error.status).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    });
    return;
  }

  const message = error instanceof Error ? error.message : String(error);
  const translated = translateDatabaseError(message);
  if (translated) {
    res.status(translated.status).json({
      success: false,
      error: { code: translated.code, message: translated.message },
    });
    return;
  }

  if (!env.isTest) console.error('[unhandled]', error);
  res.status(500).json({
    success: false,
    error: {
      code: ERROR_CODE.INTERNAL_ERROR,
      message: 'Something went wrong on our side. Please try again.',
      ...(env.isProduction ? {} : { details: message }),
    },
  });
};
