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

describe('POST /api/admin/auctions/reorder', () => {
  const db = getTestDb();

  beforeEach(async () => {
    const admin = await createTestAdmin({
      email: `reorder-admin-${Date.now()}@example.com`,
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
    await db.execute(`DELETE FROM admins WHERE email LIKE 'reorder-admin-%@example.com'`);
    _g._omenaMockSession = null;
  });

  it('returns 400 for invalid input', async () => {
    const { POST } = await import('@/app/api/admin/auctions/reorder/route');

    const request = createRequest('POST', '/api/admin/auctions/reorder', {
      items: 'not-an-array',
    });

    const { status } = await callRouteHandler(POST, request);
    expect(status).toBe(400);
  });

  it('succeeds with empty items array', async () => {
    const { POST } = await import('@/app/api/admin/auctions/reorder/route');

    const request = createRequest('POST', '/api/admin/auctions/reorder', {
      items: [],
    });

    const { status, data } = await callRouteHandler(POST, request);
    expect(status).toBe(200);
    expect((data as Record<string, number>).updated).toBe(0);
  });

  it('returns 401 for unauthenticated', async () => {
    _g._omenaMockSession = null;
    const { POST } = await import('@/app/api/admin/auctions/reorder/route');

    const { status } = await callRouteHandler(POST, createRequest('POST', '/api/admin/auctions/reorder', { items: [] }));
    expect(status).toBe(401);
  });
});
