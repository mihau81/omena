import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createTestAdmin } from '@/tests/helpers/auth';
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

describe('Admin Analytics API', () => {
  const db = getTestDb();
  let admin: Awaited<ReturnType<typeof createTestAdmin>>;

  beforeAll(async () => {
    admin = await createTestAdmin({ email: `admin-analytics-test-${Date.now()}@example.com` });
    (globalThis as any)._omenaaMockSession = { user: { id: admin.id, email: admin.email, role: 'super_admin', name: admin.name, userType: 'admin', visibilityLevel: 2 } };
  });

  afterAll(async () => {
    await db.execute(`DELETE FROM admins WHERE email LIKE 'admin-analytics-test-%@example.com'`);
  });

  describe('GET /api/admin/analytics', () => {
    it('returns overview analytics', async () => {
      const { GET } = await import('@/app/api/admin/analytics/route');
      const { NextRequest } = await import('next/server');

      const request = new NextRequest('http://localhost:3002/api/admin/analytics?type=overview');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('totalRevenue');
      expect(data).toHaveProperty('totalLots');
      expect(data).toHaveProperty('soldLots');
      expect(data).toHaveProperty('activeUsers');
    });

    it('returns revenue trends', async () => {
      const { GET } = await import('@/app/api/admin/analytics/route');
      const { NextRequest } = await import('next/server');

      const request = new NextRequest('http://localhost:3002/api/admin/analytics?type=revenue&months=12');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('trends');
      expect(Array.isArray(data.trends)).toBe(true);
    });

    it('returns top artists', async () => {
      const { GET } = await import('@/app/api/admin/analytics/route');
      const { NextRequest } = await import('next/server');

      const request = new NextRequest('http://localhost:3002/api/admin/analytics?type=artists&limit=10');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('artists');
      expect(Array.isArray(data.artists)).toBe(true);
    });

    it('returns bid activity', async () => {
      const { GET } = await import('@/app/api/admin/analytics/route');
      const { NextRequest } = await import('next/server');

      const request = new NextRequest('http://localhost:3002/api/admin/analytics?type=activity&days=30');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Activity returns total and daily breakdown
      expect(data).toBeDefined();
    });

    it('returns user statistics', async () => {
      const { GET } = await import('@/app/api/admin/analytics/route');
      const { NextRequest } = await import('next/server');

      const request = new NextRequest('http://localhost:3002/api/admin/analytics?type=users');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('newUsersLast30Days');
      expect(data).toHaveProperty('activeBiddersLast30Days');
    });

    it('returns auction comparison', async () => {
      const { GET } = await import('@/app/api/admin/analytics/route');
      const { NextRequest } = await import('next/server');

      const request = new NextRequest('http://localhost:3002/api/admin/analytics?type=comparison');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('auctions');
      expect(Array.isArray(data.auctions)).toBe(true);
    });

    it('returns lot performance', async () => {
      const { GET } = await import('@/app/api/admin/analytics/route');
      const { NextRequest } = await import('next/server');

      const request = new NextRequest('http://localhost:3002/api/admin/analytics?type=lot-performance');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('performance');
    });

    it('returns 400 for unknown analytics type', async () => {
      const { GET } = await import('@/app/api/admin/analytics/route');
      const { NextRequest } = await import('next/server');

      const request = new NextRequest('http://localhost:3002/api/admin/analytics?type=unknown');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error', 'Unknown analytics type');
    });

    it('returns 401 without admin auth', async () => {
      const { GET } = await import('@/app/api/admin/analytics/route');
      const { NextRequest } = await import('next/server');

      (globalThis as any)._omenaaMockSession = null;

      const request = new NextRequest('http://localhost:3002/api/admin/analytics?type=overview');
      const response = await GET(request);

      expect(response.status).toBe(401);
      (globalThis as any)._omenaaMockSession = { user: { id: admin.id, email: admin.email, role: 'super_admin', name: admin.name, userType: 'admin', visibilityLevel: 2 } };
    });
  });
});
