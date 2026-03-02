import { describe, it, expect, afterAll, vi, beforeEach } from 'vitest';
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

const _g = globalThis as Record<string, unknown>;

describe('POST /api/me/password', () => {
  const db = getTestDb();
  const prefix = `mepw-${Date.now()}`;
  let user: Awaited<ReturnType<typeof createTestUser>>;

  beforeEach(async () => {
    user = await createTestUser({
      email: `${prefix}-user-${Date.now()}@example.com`,
      password: 'OldPassword123!',
      accountStatus: 'approved',
    });

    _g._omenaMockSession = {
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
    _g._omenaMockSession = null;
  });

  it('changes password with correct current password', async () => {
    const { POST } = await import('@/app/api/me/password/route');

    const request = createRequest('POST', '/api/me/password', {
      currentPassword: 'OldPassword123!',
      newPassword: 'NewSecure456!',
    });

    const { status, data } = await callRouteHandler(POST, request);
    expect(status).toBe(200);
    expect((data as Record<string, boolean>).ok).toBe(true);

    // Verify hash changed
    const { users } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');
    const [updated] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, user.id)).limit(1);
    expect(updated.passwordHash).toBeTruthy();
    expect(updated.passwordHash).not.toBe('OldPassword123!');
  });

  it('returns 400 for incorrect current password', async () => {
    const { POST } = await import('@/app/api/me/password/route');

    const { status, data } = await callRouteHandler(POST, createRequest('POST', '/api/me/password', {
      currentPassword: 'WrongPassword!',
      newPassword: 'NewSecure456!',
    }));

    expect(status).toBe(400);
    expect((data as Record<string, string>).error).toMatch(/incorrect/i);
  });

  it('returns 400 for validation error (short password)', async () => {
    const { POST } = await import('@/app/api/me/password/route');

    const { status } = await callRouteHandler(POST, createRequest('POST', '/api/me/password', {
      currentPassword: 'OldPassword123!',
      newPassword: 'abc',
    }));

    expect(status).toBe(400);
  });

  it('returns 401 for unauthenticated', async () => {
    _g._omenaMockSession = null;
    const { POST } = await import('@/app/api/me/password/route');

    const { status } = await callRouteHandler(POST, createRequest('POST', '/api/me/password', {
      currentPassword: 'Old',
      newPassword: 'NewSecure456!',
    }));

    expect(status).toBe(401);
  });
});
