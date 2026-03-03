import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from '@/tests/helpers/db';
import { createTestUser, createTestAdmin } from '@/tests/helpers/auth';
import { getBidsForLot, getHighestBid, getUserBids } from '@/db/queries/bids';

describe('db/queries/bids', () => {
  const db = getTestDb();
  let userId1: string;
  let userId2: string;
  let adminId: string;
  let auctionId: string;
  let lotId1: string;
  let lotId2: string;
  let bidId1: string;
  let bidId2: string;
  let bidId3: string;
  let bidId4: string;
  let retractionId: string;

  beforeAll(async () => {
    const { randomUUID } = await import('crypto');
    const { auctions, lots, bids, bidRetractions } = await import('@/db/schema');

    // Create test users and admin
    const user1 = await createTestUser({
      email: `bids-test-user1-${Date.now()}@example.com`,
      name: 'Bids Test User 1',
    });
    userId1 = user1.id;

    const user2 = await createTestUser({
      email: `bids-test-user2-${Date.now()}@example.com`,
      name: 'Bids Test User 2',
    });
    userId2 = user2.id;

    const admin = await createTestAdmin({
      email: `bids-test-admin-${Date.now()}@example.com`,
      name: 'Bids Test Admin',
    });
    adminId = admin.id;

    // Create auction
    auctionId = randomUUID();
    await db.insert(auctions).values({
      id: auctionId,
      slug: `bids-test-auction-${Date.now()}`,
      title: 'Bids Test Auction',
      description: 'Test auction for bids queries',
      category: 'mixed',
      startDate: new Date(),
      endDate: new Date(Date.now() + 3600000),
      location: 'Warsaw',
      curator: 'Test',
      status: 'live',
      visibilityLevel: '0',
      buyersPremiumRate: '0.2000',
    });

    // Create lots
    lotId1 = randomUUID();
    await db.insert(lots).values({
      id: lotId1,
      auctionId,
      lotNumber: 1,
      title: 'Bids Test Lot 1',
      artist: 'Test Artist 1',
      description: 'First test lot',
      medium: 'Oil on canvas',
      dimensions: '50x70',
      status: 'active',
      startingBid: 500,
    });

    lotId2 = randomUUID();
    await db.insert(lots).values({
      id: lotId2,
      auctionId,
      lotNumber: 2,
      title: 'Bids Test Lot 2',
      artist: 'Test Artist 2',
      description: 'Second test lot',
      medium: 'Watercolor',
      dimensions: '30x40',
      status: 'active',
      startingBid: 200,
    });

    // Create bids on lot1
    bidId1 = randomUUID();
    await db.insert(bids).values({
      id: bidId1,
      lotId: lotId1,
      userId: userId1,
      amount: 1000,
      bidType: 'online',
      isWinning: false,
      createdAt: new Date(Date.now() - 60000),
    });

    bidId2 = randomUUID();
    await db.insert(bids).values({
      id: bidId2,
      lotId: lotId1,
      userId: userId2,
      amount: 1500,
      bidType: 'online',
      isWinning: false,
      createdAt: new Date(Date.now() - 30000),
    });

    bidId3 = randomUUID();
    await db.insert(bids).values({
      id: bidId3,
      lotId: lotId1,
      userId: userId1,
      amount: 2000,
      bidType: 'online',
      isWinning: true,
      createdAt: new Date(),
    });

    // Create a bid on lot2 by user1
    bidId4 = randomUUID();
    await db.insert(bids).values({
      id: bidId4,
      lotId: lotId2,
      userId: userId1,
      amount: 300,
      bidType: 'phone',
      isWinning: true,
      createdAt: new Date(),
    });

    // Create a retraction for bidId3 (the highest bid on lot1)
    retractionId = randomUUID();
    await db.insert(bidRetractions).values({
      id: retractionId,
      bidId: bidId3,
      reason: 'Fraudulent bid',
      retractedBy: adminId,
    });
  });

  afterAll(async () => {
    const { auctions, lots, bids, bidRetractions, users, admins } = await import('@/db/schema');
    const { eq, inArray } = await import('drizzle-orm');

    await db.delete(bidRetractions).where(eq(bidRetractions.id, retractionId)).catch(() => {});
    await db.delete(bids).where(inArray(bids.id, [bidId1, bidId2, bidId3, bidId4])).catch(() => {});
    await db.delete(lots).where(inArray(lots.id, [lotId1, lotId2])).catch(() => {});
    await db.delete(auctions).where(eq(auctions.id, auctionId)).catch(() => {});
    await db.delete(users).where(inArray(users.id, [userId1, userId2])).catch(() => {});
    await db.delete(admins).where(eq(admins.id, adminId)).catch(() => {});
  });

  // ─── getBidsForLot ──────────────────────────────────────────────────────────

  describe('getBidsForLot', () => {
    it('returns all bids for a lot', async () => {
      const result = await getBidsForLot(lotId1);
      expect(result.length).toBe(3);
    });

    it('returns bids ordered by amount descending', async () => {
      const result = await getBidsForLot(lotId1);
      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].bid.amount).toBeGreaterThanOrEqual(result[i + 1].bid.amount);
      }
    });

    it('includes retraction data when a bid is retracted', async () => {
      const result = await getBidsForLot(lotId1);
      const retractedBid = result.find((r) => r.bid.id === bidId3);
      expect(retractedBid).toBeDefined();
      expect(retractedBid!.retraction).not.toBeNull();
      expect(retractedBid!.retraction!.reason).toBe('Fraudulent bid');
    });

    it('has null retraction for non-retracted bids', async () => {
      const result = await getBidsForLot(lotId1);
      const normalBid = result.find((r) => r.bid.id === bidId1);
      expect(normalBid).toBeDefined();
      expect(normalBid!.retraction).toBeNull();
    });

    it('includes bidder name from users table', async () => {
      const result = await getBidsForLot(lotId1);
      const bid = result.find((r) => r.bid.id === bidId1);
      expect(bid).toBeDefined();
      expect(bid!.bidderName).toBe('Bids Test User 1');
    });

    it('returns empty array for lot with no bids', async () => {
      const { randomUUID } = await import('crypto');
      const result = await getBidsForLot(randomUUID());
      expect(result).toEqual([]);
    });

    it('returns empty array for unknown lot id', async () => {
      const { randomUUID } = await import('crypto');
      const result = await getBidsForLot(randomUUID());
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });

  // ─── getHighestBid ──────────────────────────────────────────────────────────

  describe('getHighestBid', () => {
    it('returns the highest non-retracted bid amount', async () => {
      // bidId3 (2000) is retracted, so highest should be bidId2 (1500)
      const result = await getHighestBid(lotId1);
      expect(result).toBe(1500);
    });

    it('excludes retracted bids from the result', async () => {
      // bidId3 is 2000 but retracted, so it should NOT be the highest
      const result = await getHighestBid(lotId1);
      expect(result).not.toBe(2000);
    });

    it('returns the bid amount for lot with single non-retracted bid', async () => {
      const result = await getHighestBid(lotId2);
      expect(result).toBe(300);
    });

    it('returns null for lot with no bids', async () => {
      const { randomUUID } = await import('crypto');
      const result = await getHighestBid(randomUUID());
      expect(result).toBeNull();
    });

    it('returns null when all bids on a lot are retracted', async () => {
      const { randomUUID } = await import('crypto');
      const { lots, bids, bidRetractions } = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');

      // Create a separate lot with only retracted bids
      const tmpLotId = randomUUID();
      await db.insert(lots).values({
        id: tmpLotId,
        auctionId,
        lotNumber: 99,
        title: 'All Retracted Lot',
        artist: 'Test',
        description: 'Test',
        medium: 'Test',
        dimensions: '10x10',
        status: 'active',
      });

      const tmpBidId = randomUUID();
      await db.insert(bids).values({
        id: tmpBidId,
        lotId: tmpLotId,
        userId: userId1,
        amount: 500,
        bidType: 'online',
      });

      const tmpRetractionId = randomUUID();
      await db.insert(bidRetractions).values({
        id: tmpRetractionId,
        bidId: tmpBidId,
        reason: 'Test retraction',
        retractedBy: adminId,
      });

      const result = await getHighestBid(tmpLotId);
      expect(result).toBeNull();

      // Cleanup
      await db.delete(bidRetractions).where(eq(bidRetractions.id, tmpRetractionId));
      await db.delete(bids).where(eq(bids.id, tmpBidId));
      await db.delete(lots).where(eq(lots.id, tmpLotId));
    });
  });

  // ─── getUserBids ────────────────────────────────────────────────────────────

  describe('getUserBids', () => {
    it('returns all bids for a user', async () => {
      const result = await getUserBids(userId1);
      // user1 has bidId1, bidId3 (lot1) and bidId4 (lot2)
      expect(result.length).toBe(3);
    });

    it('returns bids ordered by createdAt descending', async () => {
      const result = await getUserBids(userId1);
      for (let i = 0; i < result.length - 1; i++) {
        const t1 = new Date(result[i].bid.createdAt).getTime();
        const t2 = new Date(result[i + 1].bid.createdAt).getTime();
        expect(t1).toBeGreaterThanOrEqual(t2);
      }
    });

    it('includes lot title in the result', async () => {
      const result = await getUserBids(userId1);
      const bid = result.find((r) => r.bid.id === bidId1);
      expect(bid).toBeDefined();
      expect(bid!.lotTitle).toBe('Bids Test Lot 1');
    });

    it('includes lot number in the result', async () => {
      const result = await getUserBids(userId1);
      const bid = result.find((r) => r.bid.id === bidId1);
      expect(bid!.lotNumber).toBe(1);
    });

    it('includes auction slug and title in the result', async () => {
      const result = await getUserBids(userId1);
      const bid = result.find((r) => r.bid.id === bidId1);
      expect(bid!.auctionSlug).toBeDefined();
      expect(bid!.auctionTitle).toBe('Bids Test Auction');
    });

    it('marks retracted bids with isRetracted=true', async () => {
      const result = await getUserBids(userId1);
      const retracted = result.find((r) => r.bid.id === bidId3);
      expect(retracted).toBeDefined();
      // isRetracted is a SQL boolean expression
      expect(retracted!.isRetracted).toBeTruthy();
    });

    it('marks non-retracted bids with isRetracted=false', async () => {
      const result = await getUserBids(userId1);
      const normal = result.find((r) => r.bid.id === bidId1);
      expect(normal).toBeDefined();
      expect(normal!.isRetracted).toBeFalsy();
    });

    it('returns empty array for user with no bids', async () => {
      const { randomUUID } = await import('crypto');
      const result = await getUserBids(randomUUID());
      expect(result).toEqual([]);
    });

    it('does not include bids for soft-deleted lots', async () => {
      const { lots } = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');

      // Soft-delete lot2
      await db.update(lots).set({ deletedAt: new Date() }).where(eq(lots.id, lotId2));

      const result = await getUserBids(userId1);
      const deletedLotBids = result.filter((r) => r.bid.lotId === lotId2);
      expect(deletedLotBids.length).toBe(0);

      // Restore
      await db.update(lots).set({ deletedAt: null }).where(eq(lots.id, lotId2));
    });

    it('does not include bids for soft-deleted auctions', async () => {
      const { auctions } = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');

      // Soft-delete auction
      await db.update(auctions).set({ deletedAt: new Date() }).where(eq(auctions.id, auctionId));

      const result = await getUserBids(userId1);
      expect(result.length).toBe(0);

      // Restore
      await db.update(auctions).set({ deletedAt: null }).where(eq(auctions.id, auctionId));
    });

    it('returns correct bids for user2 (different user)', async () => {
      const result = await getUserBids(userId2);
      // user2 only has bidId2 on lot1
      expect(result.length).toBe(1);
      expect(result[0].bid.id).toBe(bidId2);
      expect(result[0].bid.amount).toBe(1500);
    });
  });
});
