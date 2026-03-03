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

describe('/api/me/notifications', () => {
  const db = getTestDb();
  const prefix = `men-${Date.now()}`;
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
    await db.execute(`DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE email LIKE '${prefix}%@example.com')`);
    _g._omenaaMockSession = null;
  });

  describe('GET /api/me/notifications', () => {
    it('returns notifications list with unread count', async () => {
      const { GET } = await import('@/app/api/me/notifications/route');
      const request = createRequest('GET', '/api/me/notifications');
      const { status, data } = await callRouteHandler(GET, request);

      expect(status).toBe(200);
      expect(data).toHaveProperty('notifications');
      expect(data).toHaveProperty('unreadCount');
      expect(Array.isArray((data as Record<string, unknown[]>).notifications)).toBe(true);
    });

    it('returns 401 for unauthenticated', async () => {
      _g._omenaaMockSession = null;
      const { GET } = await import('@/app/api/me/notifications/route');
      const { status } = await callRouteHandler(GET, createRequest('GET', '/api/me/notifications'));
      expect(status).toBe(401);
    });

    it('returns 403 for admin userType', async () => {
      _g._omenaaMockSession = {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          userType: 'admin',
          visibilityLevel: 2,
          role: 'admin',
        },
      };

      const { GET } = await import('@/app/api/me/notifications/route');
      const { status } = await callRouteHandler(GET, createRequest('GET', '/api/me/notifications'));
      expect(status).toBe(403);
    });
  });

  describe('POST /api/me/notifications/read-all', () => {
    it('marks all notifications as read', async () => {
      const { POST } = await import('@/app/api/me/notifications/read-all/route');
      const request = createRequest('POST', '/api/me/notifications/read-all');
      const { status, data } = await callRouteHandler(POST, request);

      expect(status).toBe(200);
      expect((data as Record<string, boolean>).ok).toBe(true);
    });

    it('returns 401 for unauthenticated', async () => {
      _g._omenaaMockSession = null;
      const { POST } = await import('@/app/api/me/notifications/read-all/route');
      const { status } = await callRouteHandler(POST, createRequest('POST', '/api/me/notifications/read-all'));
      expect(status).toBe(401);
    });
  });

  describe('POST /api/me/notifications/[id]/read', () => {
    it('returns 404 for non-existent notification', async () => {
      const { POST } = await import('@/app/api/me/notifications/[id]/read/route');
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const request = createRequest('POST', `/api/me/notifications/${fakeId}/read`);
      const context = { params: Promise.resolve({ id: fakeId }) };
      const response = await POST(request, context as never);

      expect(response.status).toBe(404);
    });

    it('returns 401 for unauthenticated', async () => {
      _g._omenaaMockSession = null;
      const { POST } = await import('@/app/api/me/notifications/[id]/read/route');
      const request = createRequest('POST', '/api/me/notifications/fake-id/read');
      const context = { params: Promise.resolve({ id: 'fake-id' }) };
      const response = await POST(request, context as never);
      expect(response.status).toBe(401);
    });
  });
});
