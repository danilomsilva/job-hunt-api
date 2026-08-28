/**
 * Application error types.
 *
 * Anything thrown inside a route that is an `AppError` is translated by the
 * central error handler into the API's single, consistent error response
 * shape. Everything else is treated as an unexpected 500.
 */
import type { ContentfulStatusCode } from 'hono/utils/http-status';

export class AppError extends Error {
  readonly status: ContentfulStatusCode;
  readonly code: string;
  readonly details: unknown;

  constructor(status: ContentfulStatusCode, code: string, message: string, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** 400 — the request was malformed in a way validation did not catch. */
export class BadRequestError extends AppError {
  constructor(message = 'The request is malformed', details?: unknown) {
    super(400, 'BAD_REQUEST', message, details);
  }
}

/** 401 — no valid credentials were provided. */
export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication is required', details?: unknown) {
    super(401, 'UNAUTHORIZED', message, details);
  }
}

/** 403 — authenticated, but not allowed to touch this resource. */
export class ForbiddenError extends AppError {
  constructor(message = 'You do not have access to this resource', details?: unknown) {
    super(403, 'FORBIDDEN', message, details);
  }
}

/** 404 — the resource does not exist (or must appear not to). */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details?: unknown) {
    super(404, 'NOT_FOUND', message, details);
  }
}

/** 409 — the request conflicts with the current state of the resource. */
export class ConflictError extends AppError {
  constructor(message = 'The resource already exists', details?: unknown) {
    super(409, 'CONFLICT', message, details);
  }
}

/** 400 — the request was well-formed but failed validation. */
export class ValidationError extends AppError {
  constructor(message = 'The request payload failed validation', details?: unknown) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}
