import { describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import {
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiresAt,
  signAccessToken,
  verifyAccessToken,
} from './tokens.js';

describe('access tokens', () => {
  it('round-trips the user id through sign and verify', () => {
    const token = signAccessToken('user-123');
    expect(verifyAccessToken(token)).toEqual({ sub: 'user-123' });
  });

  it('rejects a garbage token', () => {
    expect(() => verifyAccessToken('not-a-real-token')).toThrow();
  });

  it('rejects a token signed with a different secret', () => {
    const forged = jwt.sign({ sub: 'user-123' }, 'a-completely-different-secret');
    expect(() => verifyAccessToken(forged)).toThrow();
  });
});

describe('refresh tokens', () => {
  it('generates a token whose hash matches hashRefreshToken(token)', () => {
    const { token, hash } = generateRefreshToken();
    expect(hashRefreshToken(token)).toBe(hash);
  });

  it('generates a different token (and hash) every time', () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a.token).not.toBe(b.token);
    expect(a.hash).not.toBe(b.hash);
  });

  it('hashes the same token to the same value', () => {
    const { token } = generateRefreshToken();
    expect(hashRefreshToken(token)).toBe(hashRefreshToken(token));
  });
});

describe('refreshTokenExpiresAt', () => {
  it('returns a date in the future', () => {
    expect(refreshTokenExpiresAt().getTime()).toBeGreaterThan(Date.now());
  });
});
