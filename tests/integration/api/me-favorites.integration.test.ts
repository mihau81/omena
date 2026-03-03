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

const _g = globalThis as Record<string, unknown>;

describe('/api/me/favorites', () => {
  const db = getTestDb();
  const prefix = `mef-${Date.now()}`;
  let user: Awaited<ReturnType<typeof createTestUser>>;

  beforeEach(async () => {
    user = await createTestUser({
      email: `${prefix}-user-${Date.now()}@example.com`,
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
    _g._omenaaMockSession = null;
  });

  describe('GET', () => {
    it('returns empty favorites for new user', async () => {
      const { GET } = await import('@/app/api/me/favorites/route');
      const { status, data } = await callRouteHandler(GET, createRequest('GET', '/api/me/favorites'));

      expect(status).toBe(200);
      expect((data as Record<string, unknown[]>).favorites).toEqual([]);
    });

    it('returns 401 for unauthenticated', async () => {
      _g._omenaaMockSession = null;
      const { GET } = await import('@/app/api/me/favorites/route');
      const { status } = await callRouteHandler(GET, createRequest('GET', '/api/me/favorites'));
      expect(status).toBe(401);
    });
  });

  describe('POST', () => {
    it('returns 400 for missing lotId', async () => {
      const { POST } = await import('@/app/api/me/favorites/route');
      const { status } = await callRouteHandler(POST, createRequest('POST', '/api/me/favorites', {}));
      expect(status).toBe(400);
    });

    it('returns 400 for non-string lotId', async () => {
      const { POST } = await import('@/app/api/me/favorites/route');
      const { status } = await callRouteHandler(POST, createRequest('POST', '/api/me/favorites', { lotId: 123 }));
      expect(status).toBe(400);
    });
  });

  describe('DELETE', () => {
    it('returns 400 for missing lotId', async () => {
      const { DELETE } = await import('@/app/api/me/favorites/route');
      // Note: DELETE needs body to be passed differently since createRequest skips body for DELETE
      const request = new Request('http://localhost:3002/api/me/favorites', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const response = await DELETE(request);
      expect(response.status).toBe(400);
    });
  });
});
