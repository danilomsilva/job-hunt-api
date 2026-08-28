/**
 * Shared request-body validation, so every route fails the same way.
 */
import type { ZodType } from 'zod';
import { ValidationError } from './errors.js';

export function parseBody<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError('The request payload failed validation', result.error.flatten());
  }
  return result.data;
}
