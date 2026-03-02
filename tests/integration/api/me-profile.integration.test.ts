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

describe('/api/me/profile', () => {
  const db = getTestDb();
  const prefix = `mep-${Date.now()}`;
  let user: Awaited<ReturnType<typeof createTestUser>>;

  beforeEach(async () => {
    user = await createTestUser({
      email: `${prefix}-user-${Date.now()}@example.com`,
      name: 'Profile User',
      phone: '+48 111 222 333',
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

  describe('GET', () => {
    it('returns user profile', async () => {
      const { GET } = await import('@/app/api/me/profile/route');
      const request = createRequest('GET', '/api/me/profile');
      const { status, data } = await callRouteHandler(GET, request);

      expect(status).toBe(200);
      const profile = (data as Record<string, Record<string, unknown>>).profile;
      expect(profile.email).toBe(user.email);
      expect(profile.name).toBe('Profile User');
      expect(profile.hasPassword).toBe(true);
    });

    it('returns 401 for unauthenticated', async () => {
      _g._omenaMockSession = null;
      const { GET } = await import('@/app/api/me/profile/route');
      const { status } = await callRouteHandler(GET, createRequest('GET', '/api/me/profile'));
      expect(status).toBe(401);
    });
  });

  describe('PATCH', () => {
    it('updates profile fields', async () => {
      const { PATCH } = await import('@/app/api/me/profile/route');

      const request = createRequest('PATCH', '/api/me/profile', {
        name: 'Updated Name',
        city: 'Warsaw',
        country: 'Poland',
      });

      const { status, data } = await callRouteHandler(PATCH, request);
      expect(status).toBe(200);
      expect((data as Record<string, boolean>).ok).toBe(true);

      // Verify in DB
      const { users } = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');
      const [updated] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
      expect(updated.name).toBe('Updated Name');
      expect(updated.city).toBe('Warsaw');
    });

    it('returns 400 for empty update', async () => {
      const { PATCH } = await import('@/app/api/me/profile/route');
      const { status } = await callRouteHandler(PATCH, createRequest('PATCH', '/api/me/profile', {}));
      expect(status).toBe(400);
    });

    it('returns 400 for too short name', async () => {
      const { PATCH } = await import('@/app/api/me/profile/route');
      const { status } = await callRouteHandler(PATCH, createRequest('PATCH', '/api/me/profile', { name: 'A' }));
      expect(status).toBe(400);
    });
  });
});
