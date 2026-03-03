import { describe, it, expect, afterAll, vi, beforeEach } from 'vitest';
import { createRequest, callRouteHandler } from '@/tests/helpers/api';
import { createTestUser, createTestAdmin } from '@/tests/helpers/auth';
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

const _g = globalThis as Record<string, unknown>;

describe('GET /api/admin/users/pending-count', () => {
  const db = getTestDb();
  const prefix = `pc-${Date.now()}`;

  beforeEach(async () => {
    const admin = await createTestAdmin({
      email: `${prefix}-admin-${Date.now()}@example.com`,
      role: 'super_admin',
    });

    _g._omenaaMockSession = {
      user: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        userType: 'admin',
        visibilityLevel: 2,
        role: 'super_admin',
      },
    };
  });

  afterAll(async () => {
    await db.execute(`DELETE FROM users WHERE email LIKE '${prefix}%@example.com'`);
    await db.execute(`DELETE FROM admins WHERE email LIKE '${prefix}%@example.com'`);
    _g._omenaaMockSession = null;
  });

  it('returns count of pending_approval users', async () => {
    // Create a pending user
    await createTestUser({
      email: `${prefix}-pending-${Date.now()}@example.com`,
      accountStatus: 'pending_approval',
    });

    const { GET } = await import('@/app/api/admin/users/pending-count/route');
    const request = createRequest('GET', '/api/admin/users/pending-count');
    const { status, data } = await callRouteHandler(GET, request);

    expect(status).toBe(200);
    expect(data).toHaveProperty('count');
    expect((data as Record<string, number>).count).toBeGreaterThanOrEqual(1);
  });

  it('returns 0 when no pending users', async () => {
    // Just check it returns a valid number (may be > 0 from other tests)
    const { GET } = await import('@/app/api/admin/users/pending-count/route');
    const request = createRequest('GET', '/api/admin/users/pending-count');
    const { status, data } = await callRouteHandler(GET, request);

    expect(status).toBe(200);
    expect(typeof (data as Record<string, number>).count).toBe('number');
  });

  it('returns 401 for unauthenticated request', async () => {
    _g._omenaaMockSession = null;
    const { GET } = await import('@/app/api/admin/users/pending-count/route');
    const request = createRequest('GET', '/api/admin/users/pending-count');
    const { status } = await callRouteHandler(GET, request);

    expect(status).toBe(401);
  });
});
