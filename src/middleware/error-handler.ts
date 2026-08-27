/**
 * Central error and not-found handlers.
 *
 * Every error response the API produces has the same shape:
 *
 *   {
 *     "error": {
 *       "code": "NOT_FOUND",
 *       "message": "Application not found",
 *       "details": { ... }   // optional
 *     },
 *     "requestId": "..."
 *   }
 */
import type { ErrorHandler, NotFoundHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { env } from '../env.js';
import { AppError } from '../lib/errors.js';

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  requestId: string;
}

function buildBody(
  c: Parameters<ErrorHandler>[1],
  code: string,
  message: string,
  details?: unknown,
): ErrorResponse {
  const body: ErrorResponse = {
    error: { code, message },
    requestId: c.get('requestId'),
  };
  if (details !== undefined) {
    body.error.details = details;
  }
  return body;
}

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof AppError) {
    return c.json(buildBody(c, err.code, err.message, err.details), err.status);
  }

  if (err instanceof HTTPException) {
    return c.json(buildBody(c, 'HTTP_EXCEPTION', err.message), err.status);
  }

  console.error('Unhandled error:', err);

  const message =
    env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err instanceof Error
        ? err.message
        : 'Unknown error';

  return c.json(buildBody(c, 'INTERNAL_SERVER_ERROR', message), 500);
};

export const notFoundHandler: NotFoundHandler = (c) => {
  return c.json(
    buildBody(c, 'NOT_FOUND', `Route ${c.req.method} ${c.req.path} does not exist`),
    404,
  );
};
