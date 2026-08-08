import { ERROR_CODE, type ErrorCode } from '@carpool/shared';

/** Every deliberate failure in the API is one of these. */
export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode | string;
  readonly details?: unknown;

  constructor(status: number, code: ErrorCode | string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const errors = {
  validation: (message = 'The submitted data is invalid', details?: unknown) =>
    new AppError(422, ERROR_CODE.VALIDATION_ERROR, message, details),

  unauthenticated: (message = 'Sign in to continue') =>
    new AppError(401, ERROR_CODE.UNAUTHENTICATED, message),

  invalidCredentials: (message = 'Email or password is incorrect') =>
    new AppError(401, ERROR_CODE.INVALID_CREDENTIALS, message),

  forbidden: (message = 'You do not have permission to perform this action') =>
    new AppError(403, ERROR_CODE.FORBIDDEN, message),

  /** Suspended / deactivated / pending accounts hitting protected actions. */
  accountNotOperational: (message: string) =>
    new AppError(403, ERROR_CODE.ACCOUNT_NOT_OPERATIONAL, message),

  notFound: (message = 'The requested resource was not found') =>
    new AppError(404, ERROR_CODE.RESOURCE_NOT_FOUND, message),

  conflict: (message: string, details?: unknown) =>
    new AppError(409, ERROR_CODE.CONFLICT, message, details),

  /** A business rule refused the operation. */
  ruleViolation: (message: string, details?: unknown) =>
    new AppError(409, ERROR_CODE.RULE_VIOLATION, message, details),

  internal: (message = 'Something went wrong on our side') =>
    new AppError(500, ERROR_CODE.INTERNAL_ERROR, message),
};
