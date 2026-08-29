/**
 * Shared request-body validation, so every route fails the same way.
 */
import { type ZodType, treeifyError } from 'zod';
import { ValidationError } from './errors.js';

export function parseInput<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError('The request payload failed validation', treeifyError(result.error));
  }
  return result.data;
}
