import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from '@/tests/helpers/db';
import { createTestUser } from '@/tests/helpers/auth';
import {
  getSalesSummary,
  getUserActivitySummary,
  getRevenueByAuction,
  getOverallStats,
} from '@/db/queries/reports';

describe('db/queries/reports', () => {
  const db = getTestDb();
  let auctionId: string;
  let lotId1: string;
  let lotId2: string;
  let userId: string;

  beforeAll(async () => {
    const { randomUUID } = await import('crypto');
    const { auctions, lots, bids, bidRegistrations } = await import('@/db/schema');

    const user = await createTestUser({
      email: `db-reports-user-${Date.now()}@example.com`,
    });
    userId = user.id;

    auctionId = randomUUID();
    await db.insert(auctions).values({
      id: auctionId,
      slug: `reports-test-${Date.now()}`,
      title: 'Reports Test Auction',
      description: 'Test',
      category: 'mixed',
      startDate: new Date(Date.now() - 7200000),
      endDate: new Date(Date.now() - 3600000),
      location: 'Warsaw',
      curator: 'Test',
      status: 'archive',
      visibilityLevel: '0',
      buyersPremiumRate: '0.2000',
    });

    lotId1 = randomUUID();
    lotId2 = randomUUID();

    await db.insert(lots).values([
      {
        id: lotId1,
        auctionId,
        lotNumber: 1,
        title: 'Sold Lot',
        artist: 'Artist A',
        description: 'Test',
        medium: 'Oil',
        dimensions: '50x70',
        status: 'sold',
        startingBid: 1000,
        hammerPrice: 2000,
      },
      {
        id: lotId2,
        auctionId,
        lotNumber: 2,
        title: 'Unsold Lot',
        artist: 'Artist B',
        description: 'Test',
        medium: 'Oil',
        dimensions: '50x70',
        status: 'passed',
        startingBid: 500,
        hammerPrice: null,
      },
    ]);

    // Add a registration
    await db.insert(bidRegistrations).values({
      id: randomUUID(),
      userId,
      auctionId,
      paddleNumber: 1,
      isApproved: false,
    });

    // Add a bid for "active bidder" count
    await db.insert(bids).values({
      id: randomUUID(),
      lotId: lotId1,
      userId,
      amount: 2000,
      bidType: 'online',
      isWinning: true,
    });
  });

  afterAll(async () => {
    const { auctions, lots, bids, bidRegistrations, users } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');

    await db.delete(bids).where(eq(bids.lotId, lotId1)).catch(() => {});
    await db.delete(bids).where(eq(bids.lotId, lotId2)).catch(() => {});
    await db.delete(bidRegistrations).where(eq(bidRegistrations.auctionId, auctionId)).catch(() => {});
    await db.delete(lots).where(eq(lots.auctionId, auctionId)).catch(() => {});
    await db.delete(auctions).where(eq(auctions.id, auctionId)).catch(() => {});
    await db.delete(users).where(eq(users.id, userId)).catch(() => {});
  });

  describe('getSalesSummary', () => {
    it('returns array of sale summaries for all auctions', async () => {
      const result = await getSalesSummary();
      expect(Array.isArray(result)).toBe(true);
    });

    it('returns summary for specific auction', async () => {
      const result = await getSalesSummary(auctionId);
      expect(result.length).toBeGreaterThanOrEqual(1);

      const summary = result.find((r) => r.auctionId === auctionId);
      expect(summary).toBeDefined();
      expect(summary!.auctionTitle).toBe('Reports Test Auction');
      expect(summary!.auctionSlug).toContain('reports-test');
    });

    it('calculates lotCount and soldCount correctly', async () => {
      const result = await getSalesSummary(auctionId);
      const summary = result.find((r) => r.auctionId === auctionId)!;

      expect(summary.lotCount).toBe(2);
      expect(summary.soldCount).toBe(1);
    });

    it('calculates sellThroughRate correctly', async () => {
      const result = await getSalesSummary(auctionId);
      const summary = result.find((r) => r.auctionId === auctionId)!;

      // 1 sold / 2 total = 50%
      expect(summary.sellThroughRate).toBe(50);
    });

    it('calculates totalHammerPrice correctly', async () => {
      const result = await getSalesSummary(auctionId);
      const summary = result.find((r) => r.auctionId === auctionId)!;

      expect(summary.totalHammerPrice).toBe(2000);
    });

    it('returns buyersPremiumRate as number', async () => {
      const result = await getSalesSummary(auctionId);
      const summary = result.find((r) => r.auctionId === auctionId)!;

      expect(typeof summary.buyersPremiumRate).toBe('number');
      expect(summary.buyersPremiumRate).toBeCloseTo(0.2, 2);
    });

    it('returns 0 for sellThroughRate when no lots exist (unknown auction)', async () => {
      const { randomUUID } = await import('crypto');
      const result = await getSalesSummary(randomUUID());
      expect(result.length).toBe(0);
    });

    it('does not include soft-deleted auctions', async () => {
      const { auctions } = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');
      const { randomUUID } = await import('crypto');

      const deletedAuctionId = randomUUID();
      await db.insert(auctions).values({
        id: deletedAuctionId,
        slug: `deleted-auction-${Date.now()}`,
        title: 'Deleted Auction',
        description: 'Test',
        category: 'mixed',
        startDate: new Date(),
        endDate: new Date(Date.now() + 3600000),
        location: 'Warsaw',
        curator: 'Test',
        status: 'preview',
        visibilityLevel: '0',
        buyersPremiumRate: '0.2000',
        deletedAt: new Date(),
      });

      const result = await getSalesSummary(deletedAuctionId);
      expect(result.length).toBe(0);

      await db.delete(auctions).where(eq(auctions.id, deletedAuctionId));
    });
  });

  describe('getUserActivitySummary', () => {
    it('returns totalUsers, activeBidders, pendingRegistrations', async () => {
      const result = await getUserActivitySummary();
      expect(result).toHaveProperty('totalUsers');
      expect(result).toHaveProperty('activeBidders');
      expect(result).toHaveProperty('pendingRegistrations');
    });

    it('returns numeric values', async () => {
      const result = await getUserActivitySummary();
      expect(typeof result.totalUsers).toBe('number');
      expect(typeof result.activeBidders).toBe('number');
      expect(typeof result.pendingRegistrations).toBe('number');
    });

    it('totalUsers is at least 1 (our test user)', async () => {
      const result = await getUserActivitySummary();
      expect(result.totalUsers).toBeGreaterThanOrEqual(1);
    });

    it('activeBidders is at least 1 (our test user placed a bid)', async () => {
      const result = await getUserActivitySummary();
      expect(result.activeBidders).toBeGreaterThanOrEqual(1);
    });

    it('pendingRegistrations is at least 1 (our unapproved registration)', async () => {
      const result = await getUserActivitySummary();
      expect(result.pendingRegistrations).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getRevenueByAuction', () => {
    it('returns revenue data for all auctions', async () => {
      const result = await getRevenueByAuction();
      expect(Array.isArray(result)).toBe(true);
    });

    it('returns revenue data for specific auction', async () => {
      const result = await getRevenueByAuction(auctionId);
      expect(result.length).toBeGreaterThanOrEqual(1);

      const row = result.find((r) => r.auctionId === auctionId);
      expect(row).toBeDefined();
    });

    it('calculates hammerPrice, buyersPremium, and totalRevenue', async () => {
      const result = await getRevenueByAuction(auctionId);
      const row = result.find((r) => r.auctionId === auctionId)!;

      expect(row.hammerPrice).toBe(2000);
      // 20% premium: 2000 * 0.2 = 400
      expect(row.buyersPremium).toBe(400);
      expect(row.totalRevenue).toBe(2400);
    });

    it('returns lot count', async () => {
      const result = await getRevenueByAuction(auctionId);
      const row = result.find((r) => r.auctionId === auctionId)!;
      expect(row.lotCount).toBe(2);
    });

    it('returns auction title and slug', async () => {
      const result = await getRevenueByAuction(auctionId);
      const row = result.find((r) => r.auctionId === auctionId)!;
      expect(row.auctionTitle).toBe('Reports Test Auction');
      expect(typeof row.auctionSlug).toBe('string');
    });

    it('returns empty array for unknown auction', async () => {
      const { randomUUID } = await import('crypto');
      const result = await getRevenueByAuction(randomUUID());
      expect(result).toEqual([]);
    });
  });

  describe('getOverallStats', () => {
    it('returns all required stats fields', async () => {
      const result = await getOverallStats();
      expect(result).toHaveProperty('totalRevenue');
      expect(result).toHaveProperty('totalLots');
      expect(result).toHaveProperty('soldLots');
      expect(result).toHaveProperty('overallSellThroughRate');
      expect(result).toHaveProperty('activeUsers');
      expect(result).toHaveProperty('pendingRegistrations');
    });

    it('returns numeric values for all fields', async () => {
      const result = await getOverallStats();
      expect(typeof result.totalRevenue).toBe('number');
      expect(typeof result.totalLots).toBe('number');
      expect(typeof result.soldLots).toBe('number');
      expect(typeof result.overallSellThroughRate).toBe('number');
      expect(typeof result.activeUsers).toBe('number');
      expect(typeof result.pendingRegistrations).toBe('number');
    });

    it('totalLots is at least 2 (our test lots)', async () => {
      const result = await getOverallStats();
      expect(result.totalLots).toBeGreaterThanOrEqual(2);
    });

    it('soldLots is at least 1 (our test sold lot)', async () => {
      const result = await getOverallStats();
      expect(result.soldLots).toBeGreaterThanOrEqual(1);
    });

    it('overallSellThroughRate is between 0 and 100', async () => {
      const result = await getOverallStats();
      expect(result.overallSellThroughRate).toBeGreaterThanOrEqual(0);
      expect(result.overallSellThroughRate).toBeLessThanOrEqual(100);
    });

    it('totalRevenue is at least as high as our test auction revenue', async () => {
      const result = await getOverallStats();
      // Our test auction has 2400 revenue
      expect(result.totalRevenue).toBeGreaterThanOrEqual(2400);
    });
  });
});
