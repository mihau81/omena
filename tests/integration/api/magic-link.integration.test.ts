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

const mockSendEmail = vi.fn().mockResolvedValue(true);
vi.mock('@/lib/email', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

describe('POST /api/auth/magic-link', () => {
  const db = getTestDb();
  let approvedUser: Awaited<ReturnType<typeof createTestUser>>;

  afterAll(async () => {
    await db.execute(`DELETE FROM users WHERE email LIKE 'magic-link-test-%@example.com'`);
    await db.execute(`DELETE FROM verification_tokens WHERE identifier LIKE 'magic-link-test-%@example.com'`);
  });

  it('returns success message for existing approved user', async () => {
    approvedUser = await createTestUser({
      email: `magic-link-test-${Date.now()}@example.com`,
      accountStatus: 'approved',
    });

    const { POST } = await import('@/app/api/auth/magic-link/route');

    const { status, data } = await callRouteHandler(
      POST,
      createRequest('POST', '/api/auth/magic-link', { email: approvedUser.email }),
    );

    expect(status).toBe(200);
    expect((data as Record<string, string>).message).toMatch(/sign-in link has been sent/i);
  });

  it('sends email with magic link URL', async () => {
    mockSendEmail.mockClear();
    const email = `magic-link-test-email-${Date.now()}@example.com`;
    await createTestUser({ email, accountStatus: 'approved' });

    const { POST } = await import('@/app/api/auth/magic-link/route');
    await callRouteHandler(POST, createRequest('POST', '/api/auth/magic-link', { email }));

    expect(mockSendEmail).toHaveBeenCalledOnce();
    expect(mockSendEmail.mock.calls[0][0]).toBe(email);
    expect(mockSendEmail.mock.calls[0][1]).toMatch(/sign in|zaloguj/i);
  });

  it('creates a verification token in DB', async () => {
    const email = `magic-link-test-token-${Date.now()}@example.com`;
    await createTestUser({ email, accountStatus: 'approved' });

    const { POST } = await import('@/app/api/auth/magic-link/route');
    await callRouteHandler(POST, createRequest('POST', '/api/auth/magic-link', { email }));

    const { verificationTokens } = await import('@/db/schema');
    const { eq, and } = await import('drizzle-orm');

    const [token] = await db
      .select()
      .from(verificationTokens)
      .where(and(eq(verificationTokens.identifier, email), eq(verificationTokens.purpose, 'magic_link')))
      .limit(1);

    expect(token).toBeDefined();
    expect(token.usedAt).toBeNull();
    expect(token.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('returns same success message for non-existent user (no leak)', async () => {
    const { POST } = await import('@/app/api/auth/magic-link/route');

    const { status, data } = await callRouteHandler(
      POST,
      createRequest('POST', '/api/auth/magic-link', { email: 'nonexistent@example.com' }),
    );

    expect(status).toBe(200);
    expect((data as Record<string, string>).message).toMatch(/sign-in link has been sent/i);
  });

  it('returns same success message for pending user (not approved)', async () => {
    const email = `magic-link-test-pending-${Date.now()}@example.com`;
    await createTestUser({ email, accountStatus: 'pending_approval' });

    const { POST } = await import('@/app/api/auth/magic-link/route');

    const { status, data } = await callRouteHandler(
      POST,
      createRequest('POST', '/api/auth/magic-link', { email }),
    );

    expect(status).toBe(200);
    expect((data as Record<string, string>).message).toMatch(/sign-in link has been sent/i);
  });

  it('returns 400 for invalid email', async () => {
    const { POST } = await import('@/app/api/auth/magic-link/route');

    const { status, data } = await callRouteHandler(
      POST,
      createRequest('POST', '/api/auth/magic-link', { email: 'bad' }),
    );

    expect(status).toBe(400);
    expect(data).toHaveProperty('error', 'Validation failed');
  });
});
