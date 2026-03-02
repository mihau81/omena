import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getTestDb } from '@/tests/helpers/db';
import { createTestAdmin, createTestUser } from '@/tests/helpers/auth';

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
}));

vi.mock('@/lib/bid-events', () => ({
  emitBid: vi.fn(),
}));

describe('Admin Bids API', () => {
  const db = getTestDb();
  let admin: Awaited<ReturnType<typeof createTestAdmin>>;
  let auctionId: string;
  let lotId: string;
  let bidId: string;

  beforeAll(async () => {
    const { randomUUID } = await import('crypto');
    const { auctions, lots, bids } = await import('@/db/schema');

    admin = await createTestAdmin({ email: `admin-bids-test-${Date.now()}@example.com` });
    (globalThis as any)._omenaMockSession = { user: { id: admin.id, email: admin.email, role: admin.role, name: admin.name, userType: 'admin', visibilityLevel: 2 } };

    auctionId = randomUUID();
    await db.insert(auctions).values({
      id: auctionId,
      slug: `admin-bids-test-${Date.now()}`,
      title: 'Admin Bids Test Auction',
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

    lotId = randomUUID();
    await db.insert(lots).values({
      id: lotId,
      auctionId,
      lotNumber: 1,
      title: 'Admin Bids Test Artwork',
      artist: 'Test Artist',
      description: 'Test',
      medium: 'Oil',
      dimensions: '50x70',
      status: 'active',
    });

    // Create a winning bid
    bidId = randomUUID();
    await db.insert(bids).values({
      id: bidId,
      lotId,
      userId: null,
      amount: 5000,
      bidType: 'floor',
      paddleNumber: 1,
      isWinning: true,
    });
  });

  afterAll(async () => {
    const { auctions, lots, bids, bidRetractions } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');
    await db.delete(bidRetractions).where(eq(bidRetractions.bidId, bidId)).catch(() => {});
    await db.delete(bids).where(eq(bids.lotId, lotId)).catch(() => {});
    await db.delete(lots).where(eq(lots.id, lotId)).catch(() => {});
    await db.delete(auctions).where(eq(auctions.id, auctionId)).catch(() => {});
    await db.execute(`DELETE FROM admins WHERE email LIKE 'admin-bids-test-%@example.com'`);
  });

  describe('GET /api/admin/lots/[id]/bids', () => {
    it('returns bid history for a lot (with user info)', async () => {
      const { GET } = await import('@/app/api/admin/lots/[id]/bids/route');

      const response = await GET(
        new Request(`http://localhost:3002/api/admin/lots/${lotId}/bids`),
        { params: Promise.resolve({ id: lotId }) },
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('bids');
      expect(data).toHaveProperty('nextMinBid');
      expect(data).toHaveProperty('currentHighestBid');
      expect(Array.isArray(data.bids)).toBe(true);
      expect(data.bids.length).toBeGreaterThanOrEqual(1);
    });

    it('returns 404 for non-existent lot', async () => {
      const { GET } = await import('@/app/api/admin/lots/[id]/bids/route');
      const { randomUUID } = await import('crypto');

      const fakeId = randomUUID();
      const response = await GET(
        new Request(`http://localhost:3002/api/admin/lots/${fakeId}/bids`),
        { params: Promise.resolve({ id: fakeId }) },
      );

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/admin/lots/[id]/bids (enter phone/floor bid)', () => {
    it('enters a floor bid on behalf of a client', async () => {
      const { POST } = await import('@/app/api/admin/lots/[id]/bids/route');

      const response = await POST(
        new Request(`http://localhost:3002/api/admin/lots/${lotId}/bids`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: 7000, bidType: 'floor', paddleNumber: 2 }),
        }),
        { params: Promise.resolve({ id: lotId }) },
      );
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toHaveProperty('bid');
      expect(data).toHaveProperty('nextMinBid');
      expect(data.bid.amount).toBe(7000);
      expect(data.bid.bidType).toBe('floor');
    });

    it('enters a phone bid', async () => {
      const { POST } = await import('@/app/api/admin/lots/[id]/bids/route');

      const response = await POST(
        new Request(`http://localhost:3002/api/admin/lots/${lotId}/bids`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: 10000, bidType: 'phone', paddleNumber: 3 }),
        }),
        { params: Promise.resolve({ id: lotId }) },
      );
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.bid.bidType).toBe('phone');
    });

    it('returns 400 for bid below minimum', async () => {
      const { POST } = await import('@/app/api/admin/lots/[id]/bids/route');

      const response = await POST(
        new Request(`http://localhost:3002/api/admin/lots/${lotId}/bids`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: 100, bidType: 'floor' }),
        }),
        { params: Promise.resolve({ id: lotId }) },
      );

      expect(response.status).toBe(400);
    });

    it('returns 400 for invalid bidType', async () => {
      const { POST } = await import('@/app/api/admin/lots/[id]/bids/route');

      const response = await POST(
        new Request(`http://localhost:3002/api/admin/lots/${lotId}/bids`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: 7000, bidType: 'online' }), // online not allowed for admin entry
        }),
        { params: Promise.resolve({ id: lotId }) },
      );

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/admin/bids/[bidId]/retract', () => {
    it('retracts a bid with a reason', async () => {
      const { POST } = await import('@/app/api/admin/bids/[bidId]/retract/route');

      const response = await POST(
        new Request(`http://localhost:3002/api/admin/bids/${bidId}/retract`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'Testing bid retraction' }),
        }),
        { params: Promise.resolve({ bidId }) },
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('newWinningAmount');
    });

    it('returns 409 when bid is already retracted', async () => {
      const { POST } = await import('@/app/api/admin/bids/[bidId]/retract/route');

      // bidId is already retracted from previous test
      const response = await POST(
        new Request(`http://localhost:3002/api/admin/bids/${bidId}/retract`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'Duplicate retraction' }),
        }),
        { params: Promise.resolve({ bidId }) },
      );

      expect(response.status).toBe(409);
    });

    it('returns 400 when reason is missing', async () => {
      const { POST } = await import('@/app/api/admin/bids/[bidId]/retract/route');

      const response = await POST(
        new Request(`http://localhost:3002/api/admin/bids/${bidId}/retract`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: '' }),
        }),
        { params: Promise.resolve({ bidId }) },
      );

      expect(response.status).toBe(400);
    });

    it('returns 404 for non-existent bid', async () => {
      const { POST } = await import('@/app/api/admin/bids/[bidId]/retract/route');
      const { randomUUID } = await import('crypto');

      const fakeBidId = randomUUID();
      const response = await POST(
        new Request(`http://localhost:3002/api/admin/bids/${fakeBidId}/retract`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'Test reason' }),
        }),
        { params: Promise.resolve({ bidId: fakeBidId }) },
      );

      expect(response.status).toBe(404);
    });
  });
});
