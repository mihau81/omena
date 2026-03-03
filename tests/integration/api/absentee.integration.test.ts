import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createRequest, callRouteHandler } from '@/tests/helpers/api';
import { getTestDb } from '@/tests/helpers/db';
import { createTestUser } from '@/tests/helpers/auth';

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

vi.mock('@/lib/bid-events', () => ({
  emitBid: vi.fn(),
}));

describe('Absentee Bids /api/lots/[id]/absentee', () => {
  const db = getTestDb();
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let auctionId: string;
  let lotId: string;

  beforeAll(async () => {
    const { randomUUID } = await import('crypto');
    const { auctions, lots, bidRegistrations } = await import('@/db/schema');

    user = await createTestUser({ email: `absentee-user-${Date.now()}@example.com` });

    auctionId = randomUUID();
    await db.insert(auctions).values({
      id: auctionId,
      slug: `absentee-test-${Date.now()}`,
      title: 'Absentee Test Auction',
      description: 'Test',
      category: 'mixed',
      startDate: new Date(Date.now() - 3600000),
      endDate: new Date(Date.now() + 3600000),
      location: 'Warsaw',
      curator: 'Test',
      status: 'preview',
      visibilityLevel: '0',
      buyersPremiumRate: '0.2000',
    });

    lotId = randomUUID();
    await db.insert(lots).values({
      id: lotId,
      auctionId,
      lotNumber: 1,
      title: 'Absentee Test Artwork',
      artist: 'Test Artist',
      description: 'Test',
      medium: 'Oil',
      dimensions: '50x70',
      status: 'published',
      startingBid: 1000,
    });

    // Approved registration
    await db.insert(bidRegistrations).values({
      id: randomUUID(),
      userId: user.id,
      auctionId,
      paddleNumber: 1,
      isApproved: true,
      approvedAt: new Date(),
    });
  });

  afterAll(async () => {
    const { auctions, lots, bidRegistrations, absenteeBids } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');
    await db.delete(absenteeBids).where(eq(absenteeBids.lotId, lotId)).catch(() => {});
    await db.delete(bidRegistrations).where(eq(bidRegistrations.auctionId, auctionId)).catch(() => {});
    await db.delete(lots).where(eq(lots.id, lotId)).catch(() => {});
    await db.delete(auctions).where(eq(auctions.id, auctionId)).catch(() => {});
    await db.execute(`DELETE FROM users WHERE email LIKE 'absentee-user-%@example.com'`);
  });

  it('creates an absentee bid successfully', async () => {
    const { POST } = await import('@/app/api/lots/[id]/absentee/route');
    (globalThis as any)._omenaaMockSession = { user: { id: user.id, email: user.email, name: user.name, userType: 'user', visibilityLevel: 0, role: null } };

    const request = createRequest('POST', `/api/lots/${lotId}/absentee`, { maxAmount: 5000 });
    const { status, data } = await callRouteHandler(POST, request, { params: Promise.resolve({ id: lotId }) });

    expect(status).toBe(201);
    expect(data).toHaveProperty('message', 'Absentee bid set successfully');
    expect(data).toHaveProperty('id');
  });

  it('returns hasAbsenteeBid:true when user has an absentee bid', async () => {
    const { GET } = await import('@/app/api/lots/[id]/absentee/route');
    (globalThis as any)._omenaaMockSession = { user: { id: user.id, email: user.email, name: user.name, userType: 'user', visibilityLevel: 0, role: null } };

    const request = createRequest('GET', `/api/lots/${lotId}/absentee`);
    const { status, data } = await callRouteHandler(GET, request, { params: Promise.resolve({ id: lotId }) });

    expect(status).toBe(200);
    expect(data).toHaveProperty('hasAbsenteeBid', true);
  });

  it('updates absentee bid when called again with new maxAmount', async () => {
    const { POST } = await import('@/app/api/lots/[id]/absentee/route');
    (globalThis as any)._omenaaMockSession = { user: { id: user.id, email: user.email, name: user.name, userType: 'user', visibilityLevel: 0, role: null } };

    const request = createRequest('POST', `/api/lots/${lotId}/absentee`, { maxAmount: 8000 });
    const { status, data } = await callRouteHandler(POST, request, { params: Promise.resolve({ id: lotId }) });

    expect(status).toBe(201);
    expect(data).toHaveProperty('message', 'Absentee bid set successfully');
  });

  it('cancels an absentee bid', async () => {
    const { DELETE } = await import('@/app/api/lots/[id]/absentee/route');
    (globalThis as any)._omenaaMockSession = { user: { id: user.id, email: user.email, name: user.name, userType: 'user', visibilityLevel: 0, role: null } };

    const request = createRequest('DELETE', `/api/lots/${lotId}/absentee`);
    const { status, data } = await callRouteHandler(DELETE, request, { params: Promise.resolve({ id: lotId }) });

    expect(status).toBe(200);
    expect(data).toHaveProperty('message', 'Absentee bid cancelled');
  });

  it('returns hasAbsenteeBid:false after cancellation', async () => {
    const { GET } = await import('@/app/api/lots/[id]/absentee/route');
    (globalThis as any)._omenaaMockSession = { user: { id: user.id, email: user.email, name: user.name, userType: 'user', visibilityLevel: 0, role: null } };

    const request = createRequest('GET', `/api/lots/${lotId}/absentee`);
    const { status, data } = await callRouteHandler(GET, request, { params: Promise.resolve({ id: lotId }) });

    expect(status).toBe(200);
    expect(data).toHaveProperty('hasAbsenteeBid', false);
  });

  it('returns 401 for unauthenticated POST', async () => {
    const { POST } = await import('@/app/api/lots/[id]/absentee/route');
    (globalThis as any)._omenaaMockSession = null;

    const request = createRequest('POST', `/api/lots/${lotId}/absentee`, { maxAmount: 5000 });
    const { status } = await callRouteHandler(POST, request, { params: Promise.resolve({ id: lotId }) });

    expect(status).toBe(401);
  });

  it('returns error for amount below minimum', async () => {
    const { POST } = await import('@/app/api/lots/[id]/absentee/route');
    (globalThis as any)._omenaaMockSession = { user: { id: user.id, email: user.email, name: user.name, userType: 'user', visibilityLevel: 0, role: null } };

    const request = createRequest('POST', `/api/lots/${lotId}/absentee`, { maxAmount: 1 });
    const { status } = await callRouteHandler(POST, request, { params: Promise.resolve({ id: lotId }) });

    expect(status).toBeGreaterThanOrEqual(400);
  });
});
