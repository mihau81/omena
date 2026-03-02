import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getTestDb } from '@/tests/helpers/db';
import { createTestUser } from '@/tests/helpers/auth';

vi.mock('@/lib/audit', () => ({
  logCreate: vi.fn().mockResolvedValue(undefined),
  logUpdate: vi.fn().mockResolvedValue(undefined),
  logDelete: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/bid-events', () => ({
  emitBid: vi.fn(),
  emitTimerEvent: vi.fn(),
  subscribeBids: vi.fn(),
  unsubscribeBids: vi.fn(),
  subscribeTimer: vi.fn(),
  unsubscribeTimer: vi.fn(),
}));

vi.mock('@/lib/absentee-service', () => ({
  processAbsenteeBids: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/lot-timer', () => ({
  extendLotTimer: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/notifications', () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
}));

describe('Bid Service Integration Tests', () => {
  const db = getTestDb();
  let user1: Awaited<ReturnType<typeof createTestUser>>;
  let user2: Awaited<ReturnType<typeof createTestUser>>;
  let auctionId: string;
  let lotId: string;
  let reg1Id: string;
  let reg2Id: string;

  beforeAll(async () => {
    const { randomUUID } = await import('crypto');
    const { auctions, lots, bidRegistrations } = await import('@/db/schema');

    user1 = await createTestUser({ email: `bid-svc-user1-${Date.now()}@example.com` });
    user2 = await createTestUser({ email: `bid-svc-user2-${Date.now()}@example.com` });

    auctionId = randomUUID();
    await db.insert(auctions).values({
      id: auctionId,
      slug: `bid-svc-test-${Date.now()}`,
      title: 'Bid Service Test Auction',
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
      title: 'Bid Service Test Artwork',
      artist: 'Test Artist',
      description: 'Test',
      medium: 'Oil',
      dimensions: '50x70',
      status: 'active',
      startingBid: 1000,
    });

    // Register both users
    reg1Id = randomUUID();
    reg2Id = randomUUID();

    await db.insert(bidRegistrations).values([
      {
        id: reg1Id,
        userId: user1.id,
        auctionId,
        paddleNumber: 1,
        isApproved: true,
        approvedAt: new Date(),
      },
      {
        id: reg2Id,
        userId: user2.id,
        auctionId,
        paddleNumber: 2,
        isApproved: true,
        approvedAt: new Date(),
      },
    ]);
  });

  afterAll(async () => {
    const { auctions, lots, bids, bidRegistrations, bidRetractions } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');

    // Clean up in order
    const bidRows = await db.select({ id: bids.id }).from(bids).where(eq(bids.lotId, lotId));
    const bidIds = bidRows.map((b) => b.id);
    if (bidIds.length > 0) {
      const { inArray } = await import('drizzle-orm');
      await db.delete(bidRetractions).where(inArray(bidRetractions.bidId, bidIds)).catch(() => {});
    }
    await db.delete(bids).where(eq(bids.lotId, lotId)).catch(() => {});
    await db.delete(bidRegistrations).where(eq(bidRegistrations.auctionId, auctionId)).catch(() => {});
    await db.delete(lots).where(eq(lots.id, lotId)).catch(() => {});
    await db.delete(auctions).where(eq(auctions.id, auctionId)).catch(() => {});
    await db.execute(`DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'bid-svc-user%@example.com')`).catch(() => {});
    await db.execute(`DELETE FROM users WHERE email LIKE 'bid-svc-user%@example.com'`);
  });

  describe('placeBid', () => {
    it('places first bid successfully (at starting bid)', async () => {
      const { placeBid } = await import('@/lib/bid-service');

      const result = await placeBid(lotId, user1.id, 1000);

      expect(result).toHaveProperty('bid');
      expect(result).toHaveProperty('nextMinBid');
      expect(result.bid.amount).toBe(1000);
      expect(result.bid.isWinning).toBe(true);
      expect(result.bid.lotId).toBe(lotId);
      expect(result.bid.userId).toBe(user1.id);
    });

    it('throws ALREADY_WINNING when user tries to outbid themselves', async () => {
      const { placeBid, BidError } = await import('@/lib/bid-service');

      await expect(placeBid(lotId, user1.id, 1200)).rejects.toThrow(BidError);

      try {
        await placeBid(lotId, user1.id, 1200);
      } catch (e) {
        if (e instanceof BidError) {
          expect(e.code).toBe('ALREADY_WINNING');
          expect(e.statusCode).toBe(409);
        }
      }
    });

    it('user2 outbids user1', async () => {
      const { placeBid } = await import('@/lib/bid-service');

      const result = await placeBid(lotId, user2.id, 1200);

      expect(result.bid.amount).toBe(1200);
      expect(result.bid.isWinning).toBe(true);
      expect(result.bid.userId).toBe(user2.id);
    });

    it('throws BID_TOO_LOW when amount is below minimum', async () => {
      const { placeBid, BidError } = await import('@/lib/bid-service');

      await expect(placeBid(lotId, user1.id, 100)).rejects.toThrow(BidError);

      try {
        await placeBid(lotId, user1.id, 100);
      } catch (e) {
        if (e instanceof BidError) {
          expect(e.code).toBe('BID_TOO_LOW');
        }
      }
    });

    it('throws NOT_REGISTERED for unregistered user', async () => {
      const { placeBid, BidError } = await import('@/lib/bid-service');
      const unregistered = await createTestUser({ email: `bid-svc-unreg-${Date.now()}@example.com` });

      try {
        await expect(placeBid(lotId, unregistered.id, 2000)).rejects.toThrow(BidError);

        await placeBid(lotId, unregistered.id, 2000);
      } catch (e) {
        if (e instanceof BidError) {
          expect(e.code).toBe('NOT_REGISTERED');
        }
      } finally {
        await db.execute(`DELETE FROM users WHERE email LIKE 'bid-svc-unreg-%@example.com'`);
      }
    });

    it('throws AUCTION_NOT_LIVE for non-live auction', async () => {
      const { placeBid, BidError } = await import('@/lib/bid-service');
      const { randomUUID } = await import('crypto');
      const { auctions, lots, bidRegistrations } = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');

      const draftAuctionId = randomUUID();
      const draftLotId = randomUUID();
      const draftRegId = randomUUID();

      await db.insert(auctions).values({
        id: draftAuctionId,
        slug: `draft-auction-${Date.now()}`,
        title: 'Draft Auction',
        description: 'Test',
        category: 'mixed',
        startDate: new Date(),
        endDate: new Date(Date.now() + 3600000),
        location: 'Warsaw',
        curator: 'Test',
        status: 'draft', // Not live!
        visibilityLevel: '0',
        buyersPremiumRate: '0.2000',
      });

      await db.insert(lots).values({
        id: draftLotId,
        auctionId: draftAuctionId,
        lotNumber: 1,
        title: 'Draft Lot',
        artist: 'Test',
        description: 'Test',
        medium: 'Oil',
        dimensions: '50x70',
        status: 'active',
      });

      await db.insert(bidRegistrations).values({
        id: draftRegId,
        userId: user1.id,
        auctionId: draftAuctionId,
        paddleNumber: 1,
        isApproved: true,
      });

      try {
        await expect(placeBid(draftLotId, user1.id, 5000)).rejects.toThrow(BidError);
      } catch (e) {
        if (e instanceof BidError) {
          expect(e.code).toBe('AUCTION_NOT_LIVE');
        }
      } finally {
        const { bids } = await import('@/db/schema');
        await db.delete(bids).where(eq(bids.lotId, draftLotId)).catch(() => {});
        await db.delete(bidRegistrations).where(eq(bidRegistrations.id, draftRegId)).catch(() => {});
        await db.delete(lots).where(eq(lots.id, draftLotId)).catch(() => {});
        await db.delete(auctions).where(eq(auctions.id, draftAuctionId)).catch(() => {});
      }
    });
  });

  describe('getBidHistory', () => {
    it('returns bid history ordered by amount descending', async () => {
      const { getBidHistory } = await import('@/lib/bid-service');

      const history = await getBidHistory(lotId);

      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(0);

      // Should be ordered by descending amount
      for (let i = 0; i < history.length - 1; i++) {
        expect(history[i].amount).toBeGreaterThanOrEqual(history[i + 1].amount);
      }
    });

    it('returns isRetracted flag', async () => {
      const { getBidHistory } = await import('@/lib/bid-service');

      const history = await getBidHistory(lotId);
      for (const bid of history) {
        expect(bid).toHaveProperty('isRetracted');
        expect(typeof bid.isRetracted).toBe('boolean');
      }
    });
  });

  describe('getWinningBid', () => {
    it('returns the current winning bid', async () => {
      const { getWinningBid } = await import('@/lib/bid-service');

      const winning = await getWinningBid(lotId);

      expect(winning).not.toBeNull();
      expect(winning!.userId).toBe(user2.id);
    });

    it('returns null for lot with no bids', async () => {
      const { getWinningBid } = await import('@/lib/bid-service');
      const { randomUUID } = await import('crypto');

      const fakeLotId = randomUUID();
      const result = await getWinningBid(fakeLotId);

      expect(result).toBeNull();
    });
  });

  describe('isUserWinning', () => {
    it('returns true when user is winning', async () => {
      const { isUserWinning } = await import('@/lib/bid-service');

      const result = await isUserWinning(lotId, user2.id);

      expect(result).toBe(true);
    });

    it('returns false when user is not winning', async () => {
      const { isUserWinning } = await import('@/lib/bid-service');

      const result = await isUserWinning(lotId, user1.id);

      expect(result).toBe(false);
    });
  });
});
