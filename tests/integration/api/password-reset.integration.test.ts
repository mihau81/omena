import { describe, it, expect, afterAll, vi } from 'vitest';
import { createRequest, callRouteHandler } from '@/tests/helpers/api';
import { createTestUser } from '@/tests/helpers/auth';
import { getTestDb } from '@/tests/helpers/db';

const mockAuth = vi.hoisted(() => {
  const _g = globalThis as Record<string, unknown>;
  if (!_g._omenaaMockAuth) {
    _g._omenaaMockSession = null;
    _g._omenaaMockAuth = vi.fn().mockImplementation(async () => _g._omenaaMockSession);
  }
  return _g._omenaaMockAuth as ReturnType<typeof vi.fn>;
});

vi.mock('@/lib/auth', () => ({
  auth: mockAuth,
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: { GET: vi.fn(), POST: vi.fn() },
}));

vi.mock('@/lib/audit', () => ({
  logCreate: vi.fn().mockResolvedValue(undefined),
  logUpdate: vi.fn().mockResolvedValue(undefined),
  logDelete: vi.fn().mockResolvedValue(undefined),
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
}));

describe('Password reset flow', () => {
  const db = getTestDb();

  afterAll(async () => {
    await db.execute(`DELETE FROM users WHERE email LIKE 'pwreset-test-%@example.com'`);
    await db.execute(`DELETE FROM verification_tokens WHERE identifier LIKE 'pwreset-test-%@example.com'`);
  });

  describe('POST /api/auth/password-reset (request)', () => {
    it('returns success message for existing approved user', async () => {
      const email = `pwreset-test-${Date.now()}@example.com`;
      await createTestUser({ email, accountStatus: 'approved' });

      const { POST } = await import('@/app/api/auth/password-reset/route');

      const { status, data } = await callRouteHandler(
        POST,
        createRequest('POST', '/api/auth/password-reset', { email }),
      );

      expect(status).toBe(200);
      expect((data as Record<string, string>).message).toMatch(/password reset link/i);
    });

    it('returns same message for non-existent user (no leak)', async () => {
      const { POST } = await import('@/app/api/auth/password-reset/route');

      const { status, data } = await callRouteHandler(
        POST,
        createRequest('POST', '/api/auth/password-reset', { email: 'nonexistent@example.com' }),
      );

      expect(status).toBe(200);
      expect((data as Record<string, string>).message).toMatch(/password reset link/i);
    });

    it('creates password_reset token in DB', async () => {
      const email = `pwreset-test-token-${Date.now()}@example.com`;
      await createTestUser({ email, accountStatus: 'approved' });

      const { POST } = await import('@/app/api/auth/password-reset/route');
      await callRouteHandler(POST, createRequest('POST', '/api/auth/password-reset', { email }));

      const { verificationTokens } = await import('@/db/schema');
      const { eq, and } = await import('drizzle-orm');

      const [token] = await db
        .select()
        .from(verificationTokens)
        .where(and(eq(verificationTokens.identifier, email), eq(verificationTokens.purpose, 'password_reset')))
        .limit(1);

      expect(token).toBeDefined();
      expect(token.usedAt).toBeNull();
    });

    it('returns 400 for invalid email', async () => {
      const { POST } = await import('@/app/api/auth/password-reset/route');

      const { status } = await callRouteHandler(
        POST,
        createRequest('POST', '/api/auth/password-reset', { email: 'not-valid' }),
      );

      expect(status).toBe(400);
    });
  });

  describe('POST /api/auth/password-reset/confirm', () => {
    it('resets password with valid token', async () => {
      const email = `pwreset-test-confirm-${Date.now()}@example.com`;
      await createTestUser({ email, password: 'OldPassword123!', accountStatus: 'approved' });

      // Create token directly
      const { createVerificationToken } = await import('@/lib/token-service');
      const token = await createVerificationToken(email, 'password_reset', 60 * 60 * 1000);

      const { POST } = await import('@/app/api/auth/password-reset/confirm/route');

      const { status, data } = await callRouteHandler(
        POST,
        createRequest('POST', '/api/auth/password-reset/confirm', {
          token,
          newPassword: 'NewSecurePass123!',
        }),
      );

      expect(status).toBe(200);
      expect((data as Record<string, string>).message).toMatch(/reset successfully/i);
    });

    it('returns 400 for invalid token', async () => {
      const { POST } = await import('@/app/api/auth/password-reset/confirm/route');

      const { status, data } = await callRouteHandler(
        POST,
        createRequest('POST', '/api/auth/password-reset/confirm', {
          token: 'invalid-token-value',
          newPassword: 'NewSecurePass123!',
        }),
      );

      expect(status).toBe(400);
      expect((data as Record<string, string>).error).toMatch(/invalid|expired|used/i);
    });

    it('returns 400 for already-used token', async () => {
      const email = `pwreset-test-used-${Date.now()}@example.com`;
      await createTestUser({ email, accountStatus: 'approved' });

      const { createVerificationToken } = await import('@/lib/token-service');
      const token = await createVerificationToken(email, 'password_reset', 60 * 60 * 1000);

      const { POST } = await import('@/app/api/auth/password-reset/confirm/route');

      // First use — should succeed
      await callRouteHandler(POST, createRequest('POST', '/api/auth/password-reset/confirm', {
        token,
        newPassword: 'NewPassword1!',
      }));

      // Second use — should fail
      const { status, data } = await callRouteHandler(
        POST,
        createRequest('POST', '/api/auth/password-reset/confirm', {
          token,
          newPassword: 'AnotherPassword1!',
        }),
      );

      expect(status).toBe(400);
      expect((data as Record<string, string>).error).toMatch(/invalid|expired|used/i);
    });

    it('returns 400 for too-short password', async () => {
      const { POST } = await import('@/app/api/auth/password-reset/confirm/route');

      const { status } = await callRouteHandler(
        POST,
        createRequest('POST', '/api/auth/password-reset/confirm', {
          token: 'some-token',
          newPassword: 'short',
        }),
      );

      expect(status).toBe(400);
    });

    it('updates the password hash in the database', async () => {
      const email = `pwreset-test-hash-${Date.now()}@example.com`;
      await createTestUser({ email, password: 'OldPassword123!', accountStatus: 'approved' });

      const { users } = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');

      const [before] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.email, email));

      const { createVerificationToken } = await import('@/lib/token-service');
      const token = await createVerificationToken(email, 'password_reset', 60 * 60 * 1000);

      const { POST } = await import('@/app/api/auth/password-reset/confirm/route');
      await callRouteHandler(POST, createRequest('POST', '/api/auth/password-reset/confirm', {
        token,
        newPassword: 'CompletelyNewPass1!',
      }));

      const [after] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.email, email));

      expect(after.passwordHash).not.toBe(before.passwordHash);
      expect(after.passwordHash).toMatch(/^\$2[ab]\$\d+\$/);
    });
  });
});
