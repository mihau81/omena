import { describe, it, expect, afterAll, vi, beforeEach } from 'vitest';
import { createRequest, callRouteHandler } from '@/tests/helpers/api';
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

vi.mock('@/lib/audit', () => ({
  logCreate: vi.fn().mockResolvedValue(undefined),
  logUpdate: vi.fn().mockResolvedValue(undefined),
  logDelete: vi.fn().mockResolvedValue(undefined),
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

const _g = globalThis as Record<string, unknown>;

describe('Admin Premium Tiers API', () => {
  const db = getTestDb();

  beforeEach(async () => {
    const admin = await createTestAdmin({
      email: `pt-admin-${Date.now()}@example.com`,
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
    await db.execute(`DELETE FROM admins WHERE email LIKE 'pt-admin-%@example.com'`);
    _g._omenaaMockSession = null;
  });

  describe('GET /api/admin/auctions/[id]/premium-tiers', () => {
    it('returns 404 for non-existent auction', async () => {
      const { GET } = await import('@/app/api/admin/auctions/[id]/premium-tiers/route');
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const request = createRequest('GET', `/api/admin/auctions/${fakeId}/premium-tiers`);
      const context = { params: Promise.resolve({ id: fakeId }) };
      const response = await GET(request, context as never);

      expect(response.status).toBe(404);
    });

    it('returns 401 for unauthenticated', async () => {
      _g._omenaaMockSession = null;
      const { GET } = await import('@/app/api/admin/auctions/[id]/premium-tiers/route');
      const request = createRequest('GET', '/api/admin/auctions/fake/premium-tiers');
      const context = { params: Promise.resolve({ id: 'fake' }) };
      const response = await GET(request, context as never);

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/admin/auctions/[id]/premium-tiers', () => {
    it('returns 404 for non-existent auction', async () => {
      const { PUT } = await import('@/app/api/admin/auctions/[id]/premium-tiers/route');
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const request = new Request(`http://localhost:3002/api/admin/auctions/${fakeId}/premium-tiers`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tiers: [] }),
      });
      const context = { params: Promise.resolve({ id: fakeId }) };
      const response = await PUT(request, context as never);

      expect(response.status).toBe(404);
    });

    it('returns error for non-existent auction with invalid tier data', async () => {
      const { PUT } = await import('@/app/api/admin/auctions/[id]/premium-tiers/route');
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const request = new Request(`http://localhost:3002/api/admin/auctions/${fakeId}/premium-tiers`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tiers: [{ minAmount: -1, rate: 'invalid' }] }),
      });
      const context = { params: Promise.resolve({ id: fakeId }) };
      const response = await PUT(request, context as never);

      // Route checks auction existence before body validation
      expect(response.status).toBe(404);
    });
  });
});
