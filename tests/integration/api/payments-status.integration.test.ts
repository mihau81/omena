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

vi.mock('@/lib/payment-service', () => ({
  getPaymentStatus: vi.fn().mockResolvedValue(null),
}));

const _g = globalThis as Record<string, unknown>;

describe('GET /api/payments/status', () => {
  const db = getTestDb();
  const prefix = `ps-${Date.now()}`;
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

  it('returns 400 for missing invoiceId', async () => {
    const { GET } = await import('@/app/api/payments/status/route');
    const request = createRequest('GET', '/api/payments/status');
    const { status } = await callRouteHandler(GET, request);

    expect(status).toBe(400);
  });

  it('returns 404 for non-existent invoice', async () => {
    const { GET } = await import('@/app/api/payments/status/route');
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const request = createRequest('GET', `/api/payments/status?invoiceId=${fakeId}`);
    const { status } = await callRouteHandler(GET, request);

    expect(status).toBe(404);
  });

  it('returns 401 for unauthenticated', async () => {
    _g._omenaaMockSession = null;
    const { GET } = await import('@/app/api/payments/status/route');
    const request = createRequest('GET', '/api/payments/status?invoiceId=fake');
    const { status } = await callRouteHandler(GET, request);

    expect(status).toBe(401);
  });
});
