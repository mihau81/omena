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

describe('GET /api/me/registrations', () => {
  const db = getTestDb();
  const prefix = `mer-${Date.now()}`;
  let user: Awaited<ReturnType<typeof createTestUser>>;

  beforeEach(async () => {
    user = await createTestUser({
      email: `${prefix}-user-${Date.now()}@example.com`,
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

  it('returns empty registrations for new user', async () => {
    const { GET } = await import('@/app/api/me/registrations/route');
    const { status, data } = await callRouteHandler(GET, createRequest('GET', '/api/me/registrations'));

    expect(status).toBe(200);
    expect((data as Record<string, unknown[]>).registrations).toEqual([]);
  });

  it('returns 401 for unauthenticated', async () => {
    _g._omenaMockSession = null;
    const { GET } = await import('@/app/api/me/registrations/route');
    const { status } = await callRouteHandler(GET, createRequest('GET', '/api/me/registrations'));
    expect(status).toBe(401);
  });

  it('returns 403 for admin userType', async () => {
    _g._omenaMockSession = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        userType: 'admin',
        visibilityLevel: 2,
        role: 'admin',
      },
    };

    const { GET } = await import('@/app/api/me/registrations/route');
    const { status } = await callRouteHandler(GET, createRequest('GET', '/api/me/registrations'));
    expect(status).toBe(403);
  });
});
