import { describe, it, expect, afterAll, vi, beforeEach } from 'vitest';
import { createRequest, callRouteHandler } from '@/tests/helpers/api';
import { createTestAdmin } from '@/tests/helpers/auth';
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

describe('Admin Condition Reports API', () => {
  const db = getTestDb();

  beforeEach(async () => {
    const admin = await createTestAdmin({
      email: `cr-admin-${Date.now()}@example.com`,
      role: 'super_admin',
    });

    _g._omenaMockSession = {
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
    await db.execute(`DELETE FROM admins WHERE email LIKE 'cr-admin-%@example.com'`);
    _g._omenaMockSession = null;
  });

  describe('GET /api/admin/auctions/[id]/condition-reports', () => {
    it('returns 404 for non-existent auction', async () => {
      const { GET } = await import('@/app/api/admin/auctions/[id]/condition-reports/route');
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const request = createRequest('GET', `/api/admin/auctions/${fakeId}/condition-reports`);
      const context = { params: Promise.resolve({ id: fakeId }) };
      const response = await GET(request, context as never);

      expect(response.status).toBe(404);
    });

    it('returns 401 for unauthenticated', async () => {
      _g._omenaMockSession = null;
      const { GET } = await import('@/app/api/admin/auctions/[id]/condition-reports/route');
      const request = createRequest('GET', '/api/admin/auctions/fake/condition-reports');
      const context = { params: Promise.resolve({ id: 'fake' }) };
      const response = await GET(request, context as never);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/admin/lots/[id]/condition-report', () => {
    it('returns 404 for non-existent lot', async () => {
      const { GET } = await import('@/app/api/admin/lots/[id]/condition-report/route');
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const request = createRequest('GET', `/api/admin/lots/${fakeId}/condition-report`);
      const context = { params: Promise.resolve({ id: fakeId }) };
      const response = await GET(request, context as never);

      expect(response.status).toBe(404);
    });

    it('returns 401 for unauthenticated', async () => {
      _g._omenaMockSession = null;
      const { GET } = await import('@/app/api/admin/lots/[id]/condition-report/route');
      const request = createRequest('GET', '/api/admin/lots/fake/condition-report');
      const context = { params: Promise.resolve({ id: 'fake' }) };
      const response = await GET(request, context as never);

      expect(response.status).toBe(401);
    });
  });
});
