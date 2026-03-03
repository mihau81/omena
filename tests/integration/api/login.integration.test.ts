import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createRequest, callRouteHandler } from '@/tests/helpers/api';
import { getTestDb } from '@/tests/helpers/db';
import { createTestAdmin } from '@/tests/helpers/auth';

const mockAuth = vi.hoisted(() => {
  const _g = globalThis as Record<string, unknown>;
  if (!_g._omenaaMockAuth) {
    _g._omenaaMockSession = null;
    _g._omenaaMockAuth = vi.fn().mockImplementation(async () => _g._omenaaMockSession);
  }
  return _g._omenaaMockAuth as ReturnType<typeof vi.fn>;
});

// Mock auth
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

vi.mock('@/lib/rate-limiters', () => ({
  authLimiter: { check: () => ({ success: true, remaining: 99 }) },
  registrationLimiter: { check: () => ({ success: true, remaining: 99 }) },
  inviteLimiter: { check: () => ({ success: true, remaining: 99 }) },
}));

describe('POST /api/admin/login', () => {
  let admin: Awaited<ReturnType<typeof createTestAdmin>>;
  const db = getTestDb();

  beforeAll(async () => {
    admin = await createTestAdmin({
      email: `login-test-admin-${Date.now()}@example.com`,
      password: 'AdminPassword123!',
    });
  });

  afterAll(async () => {
    await db.execute(`DELETE FROM admins WHERE email LIKE 'login-test-admin-%@example.com'`);
  });

  it('returns success for valid credentials', async () => {
    const { POST } = await import('@/app/api/admin/login/route');

    const request = createRequest('POST', '/api/admin/login', {
      email: admin.email,
      password: 'AdminPassword123!',
    });

    const { status, data } = await callRouteHandler(POST, request);

    expect(status).toBe(200);
    expect(data).toHaveProperty('ok', true);
    expect(data).toHaveProperty('message', 'Signed in successfully');
  });

  it('returns 401 for wrong password', async () => {
    const { POST } = await import('@/app/api/admin/login/route');

    const request = createRequest('POST', '/api/admin/login', {
      email: admin.email,
      password: 'WrongPassword999!',
    });

    const { status, data } = await callRouteHandler(POST, request);

    expect(status).toBe(401);
    expect(data).toHaveProperty('error', 'Invalid email or password');
  });

  it('returns 401 for unknown email', async () => {
    const { POST } = await import('@/app/api/admin/login/route');

    const request = createRequest('POST', '/api/admin/login', {
      email: 'nonexistent@example.com',
      password: 'AdminPassword123!',
    });

    const { status, data } = await callRouteHandler(POST, request);

    expect(status).toBe(401);
    expect(data).toHaveProperty('error', 'Invalid email or password');
  });

  it('returns 400 when email is missing', async () => {
    const { POST } = await import('@/app/api/admin/login/route');

    const request = createRequest('POST', '/api/admin/login', {
      password: 'AdminPassword123!',
    });

    const { status, data } = await callRouteHandler(POST, request);

    expect(status).toBe(400);
    expect(data).toHaveProperty('error', 'Invalid input');
  });

  it('returns 401 for inactive admin', async () => {
    const { POST } = await import('@/app/api/admin/login/route');

    const inactiveAdmin = await createTestAdmin({
      email: `login-inactive-${Date.now()}@example.com`,
      password: 'AdminPassword123!',
      isActive: false,
    });

    const request = createRequest('POST', '/api/admin/login', {
      email: inactiveAdmin.email,
      password: 'AdminPassword123!',
    });

    const { status, data } = await callRouteHandler(POST, request);

    expect(status).toBe(401);
    expect(data).toHaveProperty('error', 'Invalid email or password');
  });

  it('returns requiresTOTP:true when TOTP is enabled but no code provided', async () => {
    const { POST } = await import('@/app/api/admin/login/route');
    const { admins } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');

    // Set totpEnabled=true on the admin
    await db.update(admins)
      .set({ totpEnabled: true, totpSecret: 'iv:encryptedSecret' })
      .where(eq(admins.id, admin.id));

    try {
      const request = createRequest('POST', '/api/admin/login', {
        email: admin.email,
        password: 'AdminPassword123!',
      });

      const { status, data } = await callRouteHandler(POST, request);

      expect(status).toBe(200);
      expect(data).toHaveProperty('requiresTOTP', true);
      expect(data).toHaveProperty('email', admin.email);
    } finally {
      // Restore admin
      await db.update(admins)
        .set({ totpEnabled: false, totpSecret: null })
        .where(eq(admins.id, admin.id));
    }
  });
});
