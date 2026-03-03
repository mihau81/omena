import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createRequest, callRouteHandler } from '@/tests/helpers/api';
import { getTestDb } from '@/tests/helpers/db';
import { createTestUser, createTestAdmin } from '@/tests/helpers/auth';

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

describe('Push Subscription API (/api/me/push-subscription)', () => {
  const db = getTestDb();
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let admin: Awaited<ReturnType<typeof createTestAdmin>>;
  const testEndpoints: string[] = [];

  const validSubscription = () => ({
    endpoint: `https://fcm.googleapis.com/fcm/send/test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    keys: {
      p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8p8REfXSo',
      auth: 'tBHItJI5svbpC7sCyF24Dg',
    },
  });

  beforeAll(async () => {
    const ts = Date.now();
    user = await createTestUser({ email: `push-test-user-${ts}@example.com` });
    admin = await createTestAdmin({ email: `push-test-admin-${ts}@example.com` });

    (globalThis as any)._omenaaMockSession = {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        userType: 'user',
        visibilityLevel: user.visibilityLevel,
      },
    };
  });

  afterAll(async () => {
    // Clean up push subscriptions by endpoint
    const { pushSubscriptions } = await import('@/db/schema');
    const { inArray } = await import('drizzle-orm');
    if (testEndpoints.length > 0) {
      await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.endpoint, testEndpoints)).catch(() => {});
    }
    await db.execute(`DELETE FROM users WHERE email LIKE 'push-test-user-%@example.com'`);
    await db.execute(`DELETE FROM admins WHERE email LIKE 'push-test-admin-%@example.com'`);
  });

  describe('GET /api/me/push-subscription', () => {
    it('returns VAPID public key and subscription status for user', async () => {
      const { GET } = await import('@/app/api/me/push-subscription/route');

      const request = createRequest('GET', '/api/me/push-subscription');
      const { status, data } = await callRouteHandler(GET, request);

      expect(status).toBe(200);
      expect(data).toHaveProperty('vapidPublicKey');
      expect(data).toHaveProperty('isSubscribed');
      expect(typeof (data as Record<string, unknown>).vapidPublicKey).toBe('string');
      expect((data as Record<string, unknown>).isSubscribed).toBe(false); // no subscription yet
    });

    it('returns 401 when unauthenticated', async () => {
      const { GET } = await import('@/app/api/me/push-subscription/route');
      (globalThis as any)._omenaaMockSession = null;

      const request = createRequest('GET', '/api/me/push-subscription');
      const { status } = await callRouteHandler(GET, request);

      expect(status).toBe(401);

      // Restore session
      (globalThis as any)._omenaaMockSession = {
        user: { id: user.id, email: user.email, role: user.role, name: user.name, userType: 'user', visibilityLevel: user.visibilityLevel },
      };
    });

    it('returns 403 for admin users', async () => {
      const { GET } = await import('@/app/api/me/push-subscription/route');
      (globalThis as any)._omenaaMockSession = {
        user: { id: admin.id, email: admin.email, role: admin.role, name: admin.name, userType: 'admin', visibilityLevel: 2 },
      };

      const request = createRequest('GET', '/api/me/push-subscription');
      const { status } = await callRouteHandler(GET, request);

      expect(status).toBe(403);

      // Restore user session
      (globalThis as any)._omenaaMockSession = {
        user: { id: user.id, email: user.email, role: user.role, name: user.name, userType: 'user', visibilityLevel: user.visibilityLevel },
      };
    });
  });

  describe('POST /api/me/push-subscription', () => {
    it('saves a push subscription successfully', async () => {
      const { POST } = await import('@/app/api/me/push-subscription/route');

      const sub = validSubscription();
      testEndpoints.push(sub.endpoint);

      const request = createRequest('POST', '/api/me/push-subscription', sub);
      const { status, data } = await callRouteHandler(POST, request);

      expect(status).toBe(201);
      expect((data as Record<string, boolean>).ok).toBe(true);
    });

    it('shows isSubscribed=true after subscribing', async () => {
      const { GET } = await import('@/app/api/me/push-subscription/route');

      const request = createRequest('GET', '/api/me/push-subscription');
      const { status, data } = await callRouteHandler(GET, request);

      expect(status).toBe(200);
      expect((data as Record<string, unknown>).isSubscribed).toBe(true);
    });

    it('returns 400 for missing endpoint', async () => {
      const { POST } = await import('@/app/api/me/push-subscription/route');

      const request = createRequest('POST', '/api/me/push-subscription', {
        keys: { p256dh: 'key', auth: 'auth' },
      });
      const { status, data } = await callRouteHandler(POST, request);

      expect(status).toBe(400);
      expect((data as Record<string, string>).error).toContain('Invalid subscription');
    });

    it('returns 400 for missing keys', async () => {
      const { POST } = await import('@/app/api/me/push-subscription/route');

      const request = createRequest('POST', '/api/me/push-subscription', {
        endpoint: 'https://fcm.googleapis.com/fcm/send/test-nokeys',
      });
      const { status, data } = await callRouteHandler(POST, request);

      expect(status).toBe(400);
      expect((data as Record<string, string>).error).toContain('Invalid subscription');
    });

    it('returns 400 for missing p256dh key', async () => {
      const { POST } = await import('@/app/api/me/push-subscription/route');

      const request = createRequest('POST', '/api/me/push-subscription', {
        endpoint: 'https://fcm.googleapis.com/fcm/send/test-nop256dh',
        keys: { auth: 'auth-only' },
      });
      const { status, data } = await callRouteHandler(POST, request);

      expect(status).toBe(400);
      expect((data as Record<string, string>).error).toContain('Invalid subscription');
    });

    it('returns 401 when unauthenticated', async () => {
      const { POST } = await import('@/app/api/me/push-subscription/route');
      (globalThis as any)._omenaaMockSession = null;

      const request = createRequest('POST', '/api/me/push-subscription', validSubscription());
      const { status } = await callRouteHandler(POST, request);

      expect(status).toBe(401);

      // Restore session
      (globalThis as any)._omenaaMockSession = {
        user: { id: user.id, email: user.email, role: user.role, name: user.name, userType: 'user', visibilityLevel: user.visibilityLevel },
      };
    });

    it('returns 403 for admin users', async () => {
      const { POST } = await import('@/app/api/me/push-subscription/route');
      (globalThis as any)._omenaaMockSession = {
        user: { id: admin.id, email: admin.email, role: admin.role, name: admin.name, userType: 'admin', visibilityLevel: 2 },
      };

      const request = createRequest('POST', '/api/me/push-subscription', validSubscription());
      const { status } = await callRouteHandler(POST, request);

      expect(status).toBe(403);

      // Restore user session
      (globalThis as any)._omenaaMockSession = {
        user: { id: user.id, email: user.email, role: user.role, name: user.name, userType: 'user', visibilityLevel: user.visibilityLevel },
      };
    });
  });

  describe('DELETE /api/me/push-subscription', () => {
    it('removes a push subscription', async () => {
      const { POST, DELETE: DEL, GET } = await import('@/app/api/me/push-subscription/route');

      // Create a subscription to delete
      const sub = validSubscription();
      testEndpoints.push(sub.endpoint);
      await callRouteHandler(POST, createRequest('POST', '/api/me/push-subscription', sub));

      // Delete it
      const { NextRequest } = await import('next/server');
      const delRequest = new NextRequest('http://localhost:3002/api/me/push-subscription', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      const { status, data } = await callRouteHandler(DEL, delRequest);

      expect(status).toBe(200);
      expect((data as Record<string, boolean>).ok).toBe(true);
    });

    it('returns 400 when endpoint is missing', async () => {
      const { DELETE: DEL } = await import('@/app/api/me/push-subscription/route');

      const { NextRequest } = await import('next/server');
      const request = new NextRequest('http://localhost:3002/api/me/push-subscription', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const { status, data } = await callRouteHandler(DEL, request);

      expect(status).toBe(400);
      expect((data as Record<string, string>).error).toContain('endpoint required');
    });

    it('returns 401 when unauthenticated', async () => {
      const { DELETE: DEL } = await import('@/app/api/me/push-subscription/route');
      (globalThis as any)._omenaaMockSession = null;

      const { NextRequest } = await import('next/server');
      const request = new NextRequest('http://localhost:3002/api/me/push-subscription', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: 'https://example.com' }),
      });
      const { status } = await callRouteHandler(DEL, request);

      expect(status).toBe(401);

      // Restore session
      (globalThis as any)._omenaaMockSession = {
        user: { id: user.id, email: user.email, role: user.role, name: user.name, userType: 'user', visibilityLevel: user.visibilityLevel },
      };
    });
  });
});
