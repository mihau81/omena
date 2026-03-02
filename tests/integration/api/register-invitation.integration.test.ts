import { describe, it, expect, afterAll, vi } from 'vitest';
import { createRequest, callRouteHandler } from '@/tests/helpers/api';
import { createTestUser } from '@/tests/helpers/auth';
import { getTestDb } from '@/tests/helpers/db';

const mockAuth = vi.hoisted(() => {
  const _g = globalThis as Record<string, unknown>;
  if (!_g._omenaMockAuth) {
    _g._omenaMockSession = null;
    _g._omenaMockAuth = vi.fn().mockImplementation(async () => _g._omenaMockSession);
  }
  return _g._omenaMockAuth as ReturnType<typeof vi.fn>;
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

vi.mock('@/lib/rate-limiters', () => ({
  registrationLimiter: { check: () => ({ success: true, remaining: 99 }) },
  inviteLimiter: { check: () => ({ success: true, remaining: 99 }) },
}));

describe('POST /api/auth/register/invitation', () => {
  const db = getTestDb();
  const prefix = `rinv-${Date.now()}`;

  afterAll(async () => {
    await db.execute(`DELETE FROM users WHERE email LIKE '${prefix}%@example.com'`);
    await db.execute(`DELETE FROM user_invitations WHERE invited_email LIKE '${prefix}%@example.com'`);
  });

  async function createInvitation(invitedEmail: string, overrides: { expiresIn?: number; usedAt?: Date } = {}) {
    const { userInvitations } = await import('@/db/schema');
    const crypto = await import('crypto');
    const token = crypto.randomBytes(32).toString('hex');

    const inviter = await createTestUser({ email: `${prefix}-inviter-${Date.now()}@example.com` });

    const [inv] = await db
      .insert(userInvitations)
      .values({
        token,
        invitedBy: inviter.id,
        invitedEmail,
        expiresAt: new Date(Date.now() + (overrides.expiresIn ?? 72 * 60 * 60 * 1000)),
        usedAt: overrides.usedAt ?? null,
      })
      .returning();

    return { token, invitation: inv, inviter };
  }

  it('registers a user with valid invitation', async () => {
    const email = `${prefix}-ok@example.com`;
    const { token } = await createInvitation(email);
    const { POST } = await import('@/app/api/auth/register/invitation/route');

    const request = createRequest('POST', '/api/auth/register/invitation', {
      email,
      name: 'Invited User',
      invitationToken: token,
    });

    const { status, data } = await callRouteHandler(POST, request);

    expect(status).toBe(201);
    expect((data as Record<string, string>).message).toMatch(/check your email/i);
  });

  it('sets registrationSource to invitation', async () => {
    const email = `${prefix}-src@example.com`;
    const { token } = await createInvitation(email);
    const { POST } = await import('@/app/api/auth/register/invitation/route');
    const { users } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');

    await callRouteHandler(POST, createRequest('POST', '/api/auth/register/invitation', {
      email,
      name: 'Source Check',
      invitationToken: token,
    }));

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    expect(user.registrationSource).toBe('invitation');
  });

  it('returns 400 for invalid/used invitation token', async () => {
    const { POST } = await import('@/app/api/auth/register/invitation/route');

    const request = createRequest('POST', '/api/auth/register/invitation', {
      email: `${prefix}-bad@example.com`,
      name: 'Bad Token',
      invitationToken: 'nonexistent-token',
    });

    const { status, data } = await callRouteHandler(POST, request);
    expect(status).toBe(400);
    expect((data as Record<string, string>).error).toMatch(/invalid|already used/i);
  });

  it('returns 400 for expired invitation', async () => {
    const email = `${prefix}-exp@example.com`;
    const { token } = await createInvitation(email, { expiresIn: -86400000 }); // expired
    const { POST } = await import('@/app/api/auth/register/invitation/route');

    const request = createRequest('POST', '/api/auth/register/invitation', {
      email,
      name: 'Expired',
      invitationToken: token,
    });

    const { status, data } = await callRouteHandler(POST, request);
    expect(status).toBe(400);
    expect((data as Record<string, string>).error).toMatch(/expired/i);
  });

  it('returns 400 for email mismatch', async () => {
    const email = `${prefix}-match@example.com`;
    const { token } = await createInvitation(email);
    const { POST } = await import('@/app/api/auth/register/invitation/route');

    const request = createRequest('POST', '/api/auth/register/invitation', {
      email: `${prefix}-wrong@example.com`,
      name: 'Wrong Email',
      invitationToken: token,
    });

    const { status, data } = await callRouteHandler(POST, request);
    expect(status).toBe(400);
    expect((data as Record<string, string>).error).toMatch(/does not match/i);
  });

  it('returns 409 for duplicate email', async () => {
    const email = `${prefix}-dup@example.com`;

    // Create existing user
    await createTestUser({ email });

    const { token } = await createInvitation(email);
    const { POST } = await import('@/app/api/auth/register/invitation/route');

    const request = createRequest('POST', '/api/auth/register/invitation', {
      email,
      name: 'Duplicate',
      invitationToken: token,
    });

    const { status } = await callRouteHandler(POST, request);
    expect(status).toBe(409);
  });
});
