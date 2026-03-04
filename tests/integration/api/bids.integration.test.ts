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

// Mock auth
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

vi.mock('@/lib/absentee-service', () => ({
  processAbsenteeBids: vi.fn().mockResolvedValue(undefined),
}));

// Mock rate limiter to control rate limit behavior
const mockBidLimiter = {
  check: vi.fn().mockReturnValue({ success: true, resetMs: 0 }),
};

vi.mock('@/lib/rate-limiters', () => ({
  bidLimiter: mockBidLimiter,
}));

describe('POST /api/lots/[id]/bids', () => {
  const db = getTestDb();
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let auctionId: string;
  let lotId: string;
  let registrationId: string;

  beforeAll(async () => {
    const { randomUUID } = await import('crypto');
    const { auctions, lots, bidRegistrations } = await import('@/db/schema');

    user = await createTestUser({ email: `bids-test-user-${Date.now()}@example.com` });

    // Create live auction
    auctionId = randomUUID();
    await db.insert(auctions).values({
      id: auctionId,
      slug: `bids-test-auction-${Date.now()}`,
      title: 'Live Bid Test Auction',
      description: 'Test',
      category: 'mixed',
      startDate: new Date(Date.now() - 3600000),
      endDate: new Date(Date.now() + 3600000),
      location: 'Warsaw',
      curator: 'Test',
      status: 'live',
      visibilityLevel: '0',
      buyersPremiumRate: '0.2000',
    });

    // Create active lot
    lotId = randomUUID();
    await db.insert(lots).values({
      id: lotId,
      auctionId,
      lotNumber: 1,
      title: 'Test Artwork',
      artist: 'Test Artist',
      description: 'Test description',
      medium: 'Oil on canvas',
      dimensions: '50x70',
      year: 2020,
      estimateMin: 5000,
      estimateMax: 10000,
      status: 'active',
    });

    // Create approved registration
    registrationId = randomUUID();
    await db.insert(bidRegistrations).values({
      id: registrationId,
      userId: user.id,
      auctionId,
      paddleNumber: 1,
      isApproved: true,
      approvedAt: new Date(),
    });
  });

  afterAll(async () => {
    const { auctions, lots, bidRegistrations, bids } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');

    await db.delete(bids).where(eq(bids.lotId, lotId)).catch(() => {});
    await db.delete(bidRegistrations).where(eq(bidRegistrations.id, registrationId)).catch(() => {});
    await db.delete(lots).where(eq(lots.id, lotId)).catch(() => {});
    await db.delete(auctions).where(eq(auctions.id, auctionId)).catch(() => {});
    await db.execute(`DELETE FROM users WHERE email LIKE 'bids-test-user-%@example.com'`);
  });

  it('returns 401 when unauthenticated', async () => {
    const { POST } = await import('@/app/api/lots/[id]/bids/route');
    (globalThis as any)._omenaaMockSession = null;

    const request = createRequest('POST', `/api/lots/${lotId}/bids`, { amount: 5000 });
    const { status, data } = await callRouteHandler(POST, request, { params: Promise.resolve({ id: lotId }) });

    expect(status).toBe(401);
    expect(data).toHaveProperty('error');
  });

  it('places a bid successfully', async () => {
    const { POST } = await import('@/app/api/lots/[id]/bids/route');
    (globalThis as any)._omenaaMockSession = { user: { id: user.id, email: user.email, name: user.name, userType: 'user', visibilityLevel: 0, role: null } };

    const request = createRequest('POST', `/api/lots/${lotId}/bids`, { amount: 6000 });
    const { status, data } = await callRouteHandler(POST, request, { params: Promise.resolve({ id: lotId }) });

    expect(status).toBe(201);
    expect(data).toHaveProperty('bid');
    expect(data).toHaveProperty('nextMinBid');
    const bidData = data as Record<string, Record<string, unknown>>;
    expect(bidData.bid.amount).toBe(6000);
    expect(bidData.bid.isWinning).toBe(true);
  });

  it('returns 409 when user tries to self-outbid', async () => {
    const { POST } = await import('@/app/api/lots/[id]/bids/route');
    (globalThis as any)._omenaaMockSession = { user: { id: user.id, email: user.email, name: user.name, userType: 'user', visibilityLevel: 0, role: null } };

    // User is already the highest bidder from previous test
    const request = createRequest('POST', `/api/lots/${lotId}/bids`, { amount: 8000 });
    const { status, data } = await callRouteHandler(POST, request, { params: Promise.resolve({ id: lotId }) });

    expect(status).toBe(409);
    expect((data as Record<string, string>).code).toBe('ALREADY_WINNING');
  });

  it('returns 429 when rate limited', async () => {
    const { POST } = await import('@/app/api/lots/[id]/bids/route');
    (globalThis as any)._omenaaMockSession = { user: { id: user.id, email: user.email, name: user.name, userType: 'user', visibilityLevel: 0, role: null } };

    mockBidLimiter.check.mockReturnValueOnce({ success: false, resetMs: 3000 });

    const request = createRequest('POST', `/api/lots/${lotId}/bids`, { amount: 7000 });
    const { status } = await callRouteHandler(POST, request, { params: Promise.resolve({ id: lotId }) });

    expect(status).toBe(429);
    mockBidLimiter.check.mockReturnValue({ success: true, resetMs: 0 });
  });

  it('returns 400 for bid below minimum', async () => {
    const { POST } = await import('@/app/api/lots/[id]/bids/route');

    // Create another user who can bid (user2)
    const user2 = await createTestUser({ email: `bids-test-user2-${Date.now()}@example.com` });
    const { randomUUID } = await import('crypto');
    const { bidRegistrations } = await import('@/db/schema');
    await db.insert(bidRegistrations).values({
      id: randomUUID(),
      userId: user2.id,
      auctionId,
      paddleNumber: 2,
      isApproved: true,
      approvedAt: new Date(),
    });

    (globalThis as any)._omenaaMockSession = { user: { id: user2.id, email: user2.email, name: user2.name, userType: 'user', visibilityLevel: 0, role: null } };

    // Bid too low (minimum should be at least the increment above 6000)
    const request = createRequest('POST', `/api/lots/${lotId}/bids`, { amount: 100 });
    const { status, data } = await callRouteHandler(POST, request, { params: Promise.resolve({ id: lotId }) });

    expect(status).toBe(400);
    expect((data as Record<string, string>).code).toBe('BID_TOO_LOW');

    // Clean up: find all users matching pattern (including orphaned from prior runs),
    // delete their registrations first (FK constraint), then delete users
    const { users: usersTable } = await import('@/db/schema');
    const { ilike, inArray, eq: eqCleanup } = await import('drizzle-orm');
    const matchingUsers = await db.select({ id: usersTable.id }).from(usersTable)
      .where(ilike(usersTable.email, 'bids-test-user2-%@example.com'));
    if (matchingUsers.length > 0) {
      await db.delete(bidRegistrations)
        .where(inArray(bidRegistrations.userId, matchingUsers.map(u => u.id)))
        .catch(() => {});
    }
    await db.execute(`DELETE FROM users WHERE email LIKE 'bids-test-user2-%@example.com'`);
  });

});

describe('GET /api/lots/[id]/bids', () => {
  const db = getTestDb();
  let auctionId: string;
  let lotId: string;

  beforeAll(async () => {
    const { randomUUID } = await import('crypto');
    const { auctions, lots } = await import('@/db/schema');

    auctionId = randomUUID();
    await db.insert(auctions).values({
      id: auctionId,
      slug: `bids-get-test-${Date.now()}`,
      title: 'Bid History Test',
      description: 'Test',
      category: 'mixed',
      startDate: new Date(),
      endDate: new Date(Date.now() + 3600000),
      location: 'Warsaw',
      curator: 'Test',
      status: 'live',
      visibilityLevel: '0',
      buyersPremiumRate: '0.2000',
    });

    lotId = randomUUID();
    await db.insert(lots).values({
      id: lotId,
      auctionId,
      lotNumber: 1,
      title: 'Test Artwork',
      artist: 'Test Artist',
      description: 'Test',
      medium: 'Oil',
      dimensions: '50x70',
      status: 'active',
    });
  });

  afterAll(async () => {
    const { auctions, lots } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');
    await db.delete(lots).where(eq(lots.id, lotId)).catch(() => {});
    await db.delete(auctions).where(eq(auctions.id, auctionId)).catch(() => {});
  });

  it('returns bid history for a lot', async () => {
    const { GET } = await import('@/app/api/lots/[id]/bids/route');

    const request = createRequest('GET', `/api/lots/${lotId}/bids`);
    const { status, data } = await callRouteHandler(GET, request, { params: Promise.resolve({ id: lotId }) });

    expect(status).toBe(200);
    expect(data).toHaveProperty('bids');
    expect(data).toHaveProperty('currentHighestBid');
    expect(data).toHaveProperty('nextMinBid');
    expect(data).toHaveProperty('totalBids');
    expect(Array.isArray((data as Record<string, unknown>).bids)).toBe(true);
  });
});
