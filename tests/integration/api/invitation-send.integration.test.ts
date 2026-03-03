import { describe, it, expect, afterAll, vi, beforeEach } from 'vitest';
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

vi.mock('@/lib/rate-limiters', () => ({
  registrationLimiter: { check: () => ({ success: true, remaining: 99 }) },
  inviteLimiter: { check: () => ({ success: true, remaining: 99 }) },
}));

const _g = globalThis as Record<string, unknown>;

describe('POST /api/auth/register/invitation-send', () => {
  const db = getTestDb();
  const prefix = `isnd-${Date.now()}`;
  let user: Awaited<ReturnType<typeof createTestUser>>;

  beforeEach(async () => {
    user = await createTestUser({
      email: `${prefix}-sender-${Date.now()}@example.com`,
      accountStatus: 'approved',
    });

    _g._omenaaMockSession = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        userType: 'user',
        visibilityLevel: 0,
        role: null,
      },
    };
  });

  afterAll(async () => {
    await db.execute(`DELETE FROM users WHERE email LIKE '${prefix}%@example.com'`);
    await db.execute(`DELETE FROM user_invitations WHERE invited_email LIKE '${prefix}%@example.com'`);
    _g._omenaaMockSession = null;
  });

  it('sends invitation successfully', async () => {
    const { POST } = await import('@/app/api/auth/register/invitation-send/route');

    const request = createRequest('POST', '/api/auth/register/invitation-send', {
      email: `${prefix}-invited@example.com`,
    });

    const { status, data } = await callRouteHandler(POST, request);

    expect(status).toBe(201);
    expect((data as Record<string, string>).message).toMatch(/invitation sent/i);
  });

  it('creates invitation record in DB', async () => {
    const { POST } = await import('@/app/api/auth/register/invitation-send/route');
    const { userInvitations } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');

    const email = `${prefix}-dbcheck@example.com`;
    await callRouteHandler(POST, createRequest('POST', '/api/auth/register/invitation-send', { email }));

    const [inv] = await db.select().from(userInvitations).where(eq(userInvitations.invitedEmail, email)).limit(1);
    expect(inv).toBeDefined();
    expect(inv.invitedBy).toBe(user.id);
    expect(inv.token).toBeTruthy();
    expect(inv.usedAt).toBeNull();
  });

  it('sends email to invited address', async () => {
    const { POST } = await import('@/app/api/auth/register/invitation-send/route');
    const { sendEmail } = await import('@/lib/email');

    const email = `${prefix}-emailcheck@example.com`;
    await callRouteHandler(POST, createRequest('POST', '/api/auth/register/invitation-send', { email }));

    expect(sendEmail).toHaveBeenCalledWith(
      email,
      expect.stringContaining('invited'),
      expect.any(String),
    );
  });

  it('returns 409 if email already registered', async () => {
    const existingUser = await createTestUser({ email: `${prefix}-existing@example.com` });
    const { POST } = await import('@/app/api/auth/register/invitation-send/route');

    const request = createRequest('POST', '/api/auth/register/invitation-send', {
      email: existingUser.email,
    });

    const { status } = await callRouteHandler(POST, request);
    expect(status).toBe(409);
  });

  it('returns 400 for invalid email', async () => {
    const { POST } = await import('@/app/api/auth/register/invitation-send/route');

    const request = createRequest('POST', '/api/auth/register/invitation-send', {
      email: 'not-valid',
    });

    const { status } = await callRouteHandler(POST, request);
    expect(status).toBe(400);
  });

  it('returns 401 for unauthenticated request', async () => {
    _g._omenaaMockSession = null;
    const { POST } = await import('@/app/api/auth/register/invitation-send/route');

    const request = createRequest('POST', '/api/auth/register/invitation-send', {
      email: `${prefix}-unauth@example.com`,
    });

    const { status } = await callRouteHandler(POST, request);
    expect(status).toBe(401);
  });
});
