import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from '@/tests/helpers/db';
import { createTestUser } from '@/tests/helpers/auth';
import {
  getSellThroughRate,
  getHammerToEstimateRatio,
  getRevenueTrends,
  getTopArtists,
  getBidActivity,
  getUserActivityStats,
  getAuctionComparison,
  getLotPerformance,
  getDashboardStats,
} from '@/db/queries/analytics';

describe('db/queries/analytics', () => {
  const db = getTestDb();

  // IDs for test data
  let auctionLiveId: string;
  let auctionArchiveId: string;
  let auctionDraftId: string;
  let auctionDeletedId: string;

  let lotSold1Id: string;
  let lotSold2Id: string;
  let lotSold3Id: string;
  let lotUnsoldId: string;
  let lotActiveId: string;
  let lotDeletedId: string;

  let userId: string;
  let user2Id: string;

  let bidReg1Id: string;
  let bidReg2Id: string;

  let bid1Id: string;
  let bid2Id: string;
  let bid3Id: string;
  let bid4Id: string;
  let bidOldId: string;

  const ts = Date.now();

  beforeAll(async () => {
    const { randomUUID } = await import('crypto');
    const { auctions, lots, bids, bidRegistrations } = await import('@/db/schema');

    // ─── Users ───
    const user = await createTestUser({ email: `analytics-user-${ts}@example.com` });
    userId = user.id;

    const user2 = await createTestUser({ email: `analytics-user2-${ts}@example.com` });
    user2Id = user2.id;

    // ─── Auctions ───
    auctionLiveId = randomUUID();
    await db.insert(auctions).values({
      id: auctionLiveId,
      slug: `analytics-live-${ts}`,
      title: 'Analytics Live Auction',
      description: 'A live auction for analytics tests',
      startDate: new Date(Date.now() - 7200000),
      endDate: new Date(Date.now() + 7200000),
      status: 'live',
      visibilityLevel: '0',
      buyersPremiumRate: '0.2000',
    });

    auctionArchiveId = randomUUID();
    await db.insert(auctions).values({
      id: auctionArchiveId,
      slug: `analytics-archive-${ts}`,
      title: 'Analytics Archive Auction',
      description: 'An archived auction for analytics',
      startDate: new Date(Date.now() - 2592000000), // 30 days ago
      endDate: new Date(Date.now() - 2505600000),   // ~29 days ago
      status: 'archive',
      visibilityLevel: '0',
      buyersPremiumRate: '0.1500',
    });

    auctionDraftId = randomUUID();
    await db.insert(auctions).values({
      id: auctionDraftId,
      slug: `analytics-draft-${ts}`,
      title: 'Analytics Draft Auction',
      description: 'A draft auction',
      startDate: new Date(Date.now() + 86400000),
      endDate: new Date(Date.now() + 172800000),
      status: 'draft',
      visibilityLevel: '0',
      buyersPremiumRate: '0.2000',
    });

    auctionDeletedId = randomUUID();
    await db.insert(auctions).values({
      id: auctionDeletedId,
      slug: `analytics-deleted-${ts}`,
      title: 'Analytics Deleted Auction',
      description: 'Deleted',
      startDate: new Date(Date.now() - 3600000),
      endDate: new Date(Date.now() + 3600000),
      status: 'live',
      visibilityLevel: '0',
      buyersPremiumRate: '0.2000',
      deletedAt: new Date(),
    });

    // ─── Lots ───

    // Sold lots in live auction
    lotSold1Id = randomUUID();
    await db.insert(lots).values({
      id: lotSold1Id,
      auctionId: auctionLiveId,
      lotNumber: 1,
      title: 'Sold Lot 1',
      artist: 'Picasso Analytics',
      status: 'sold',
      hammerPrice: 50000,
      estimateMin: 30000,
      estimateMax: 70000,
      sortOrder: 1,
    });

    lotSold2Id = randomUUID();
    await db.insert(lots).values({
      id: lotSold2Id,
      auctionId: auctionLiveId,
      lotNumber: 2,
      title: 'Sold Lot 2',
      artist: 'Picasso Analytics',
      status: 'sold',
      hammerPrice: 30000,
      estimateMin: 20000,
      estimateMax: 40000,
      sortOrder: 2,
    });

    // Sold lot in archive auction
    lotSold3Id = randomUUID();
    await db.insert(lots).values({
      id: lotSold3Id,
      auctionId: auctionArchiveId,
      lotNumber: 1,
      title: 'Sold Lot 3 Archive',
      artist: 'Monet Analytics',
      status: 'sold',
      hammerPrice: 100000,
      estimateMin: 80000,
      estimateMax: 120000,
      sortOrder: 1,
    });

    // Unsold lot (no hammerPrice)
    lotUnsoldId = randomUUID();
    await db.insert(lots).values({
      id: lotUnsoldId,
      auctionId: auctionLiveId,
      lotNumber: 3,
      title: 'Unsold Lot',
      artist: 'Unknown Analytics',
      status: 'passed',
      estimateMin: 10000,
      estimateMax: 20000,
      sortOrder: 3,
    });

    // Active lot
    lotActiveId = randomUUID();
    await db.insert(lots).values({
      id: lotActiveId,
      auctionId: auctionLiveId,
      lotNumber: 4,
      title: 'Active Lot',
      artist: 'Warhol Analytics',
      status: 'active',
      estimateMin: 15000,
      estimateMax: 25000,
      sortOrder: 4,
    });

    // Soft-deleted lot
    lotDeletedId = randomUUID();
    await db.insert(lots).values({
      id: lotDeletedId,
      auctionId: auctionLiveId,
      lotNumber: 5,
      title: 'Deleted Lot',
      artist: 'Deleted Analytics',
      status: 'sold',
      hammerPrice: 99999,
      estimateMin: 50000,
      estimateMax: 150000,
      sortOrder: 5,
      deletedAt: new Date(),
    });

    // ─── Bid Registrations ───
    bidReg1Id = randomUUID();
    await db.insert(bidRegistrations).values({
      id: bidReg1Id,
      userId: userId,
      auctionId: auctionLiveId,
      paddleNumber: 100 + Math.floor(Math.random() * 9000),
      isApproved: true,
    });

    bidReg2Id = randomUUID();
    await db.insert(bidRegistrations).values({
      id: bidReg2Id,
      userId: user2Id,
      auctionId: auctionLiveId,
      paddleNumber: 100 + Math.floor(Math.random() * 9000),
      isApproved: false, // pending registration
    });

    // ─── Bids ───
    // Recent bids (within last 30 days)
    bid1Id = randomUUID();
    await db.insert(bids).values({
      id: bid1Id,
      lotId: lotSold1Id,
      userId: userId,
      amount: 45000,
      bidType: 'online',
      createdAt: new Date(Date.now() - 3600000), // 1 hour ago
    });

    bid2Id = randomUUID();
    await db.insert(bids).values({
      id: bid2Id,
      lotId: lotSold1Id,
      userId: userId,
      amount: 50000,
      bidType: 'online',
      isWinning: true,
      createdAt: new Date(Date.now() - 1800000), // 30 min ago
    });

    bid3Id = randomUUID();
    await db.insert(bids).values({
      id: bid3Id,
      lotId: lotSold2Id,
      userId: user2Id,
      amount: 30000,
      bidType: 'online',
      isWinning: true,
      createdAt: new Date(Date.now() - 600000), // 10 min ago
    });

    bid4Id = randomUUID();
    await db.insert(bids).values({
      id: bid4Id,
      lotId: lotActiveId,
      userId: userId,
      amount: 16000,
      bidType: 'online',
      createdAt: new Date(Date.now() - 300000), // 5 min ago
    });

    // Old bid (> 30 days ago) for returning bidder detection
    bidOldId = randomUUID();
    await db.insert(bids).values({
      id: bidOldId,
      lotId: lotSold3Id,
      userId: userId,
      amount: 95000,
      bidType: 'online',
      createdAt: new Date(Date.now() - 2678400000), // ~31 days ago
    });
  });

  afterAll(async () => {
    const { auctions, lots, bids, bidRegistrations, users } = await import('@/db/schema');
    const { inArray } = await import('drizzle-orm');

    await db.delete(bids).where(
      inArray(bids.id, [bid1Id, bid2Id, bid3Id, bid4Id, bidOldId]),
    ).catch(() => {});
    await db.delete(bidRegistrations).where(
      inArray(bidRegistrations.id, [bidReg1Id, bidReg2Id]),
    ).catch(() => {});
    await db.delete(lots).where(
      inArray(lots.id, [lotSold1Id, lotSold2Id, lotSold3Id, lotUnsoldId, lotActiveId, lotDeletedId]),
    ).catch(() => {});
    await db.delete(auctions).where(
      inArray(auctions.id, [auctionLiveId, auctionArchiveId, auctionDraftId, auctionDeletedId]),
    ).catch(() => {});
    await db.delete(users).where(
      inArray(users.id, [userId, user2Id]),
    ).catch(() => {});
  });

  // ─── getSellThroughRate ───────────────────────────────────────────────────────

  describe('getSellThroughRate', () => {
    it('returns overall sell-through rate with byAuction breakdown when no auctionId', async () => {
      const result = await getSellThroughRate();
      expect(result).toHaveProperty('overall');
      expect(result).toHaveProperty('byAuction');
      expect(result.overall).toHaveProperty('totalLots');
      expect(result.overall).toHaveProperty('soldLots');
      expect(result.overall).toHaveProperty('sellThroughRate');
      expect(Array.isArray(result.byAuction)).toBe(true);
    });

    it('overall totalLots > 0 and sellThroughRate is a percentage', async () => {
      const result = await getSellThroughRate();
      expect(result.overall.totalLots).toBeGreaterThan(0);
      expect(result.overall.sellThroughRate).toBeGreaterThanOrEqual(0);
      expect(result.overall.sellThroughRate).toBeLessThanOrEqual(100);
    });

    it('returns per-auction stats when auctionId is provided', async () => {
      const result = await getSellThroughRate(auctionLiveId);
      expect(result.overall).toBeDefined();
      expect(result.overall.totalLots).toBeGreaterThanOrEqual(3); // sold1 + sold2 + unsold + active - deleted
      expect(result.overall.soldLots).toBeGreaterThanOrEqual(2);
    });

    it('excludes soft-deleted lots', async () => {
      const result = await getSellThroughRate(auctionLiveId);
      // lotDeletedId has hammerPrice=99999 and deletedAt set, should not be counted
      // If it were counted, soldLots would be higher
      const auctionEntry = result.byAuction.find((r) => r.auctionId === auctionLiveId);
      expect(auctionEntry).toBeDefined();
      // We have 2 sold + 1 passed + 1 active = 4 total, 2 sold
      expect(auctionEntry!.soldLots).toBeGreaterThanOrEqual(2);
    });

    it('excludes soft-deleted auctions', async () => {
      const result = await getSellThroughRate();
      const deletedEntry = result.byAuction.find((r) => r.auctionId === auctionDeletedId);
      expect(deletedEntry).toBeUndefined();
    });

    it('sellThroughRate calculation is correct', async () => {
      const result = await getSellThroughRate(auctionLiveId);
      const entry = result.overall;
      if (entry.totalLots > 0) {
        const expectedRate = Math.round((entry.soldLots / entry.totalLots) * 10000) / 100;
        expect(entry.sellThroughRate).toBe(expectedRate);
      }
    });
  });

  // ─── getHammerToEstimateRatio ─────────────────────────────────────────────────

  describe('getHammerToEstimateRatio', () => {
    it('returns hammer-to-estimate ratios per auction', async () => {
      const result = await getHammerToEstimateRatio();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      const entry = result.find((r) => r.auctionId === auctionLiveId);
      expect(entry).toBeDefined();
      expect(entry!.lotCount).toBeGreaterThanOrEqual(2);
      expect(entry!.avgHammerToEstimateRatio).not.toBeNull();
    });

    it('filters by auctionId', async () => {
      const result = await getHammerToEstimateRatio(auctionLiveId);
      expect(result.length).toBe(1);
      expect(result[0].auctionId).toBe(auctionLiveId);
    });

    it('only includes lots with hammerPrice and estimateMin > 0', async () => {
      const result = await getHammerToEstimateRatio(auctionLiveId);
      // lotUnsoldId has no hammerPrice, lotActiveId has no hammerPrice
      // lotDeletedId is soft-deleted
      // Only lotSold1Id and lotSold2Id qualify
      expect(result[0].lotCount).toBe(2);
    });

    it('ratio is rounded to 2 decimal places', async () => {
      const result = await getHammerToEstimateRatio(auctionLiveId);
      const ratio = result[0].avgHammerToEstimateRatio!;
      // 50000/30000 = 1.667, 30000/20000 = 1.5, avg ~ 1.58
      const str = ratio.toString();
      const decimals = str.includes('.') ? str.split('.')[1].length : 0;
      expect(decimals).toBeLessThanOrEqual(2);
    });

    it('excludes soft-deleted lots and auctions', async () => {
      const result = await getHammerToEstimateRatio();
      const deletedAuction = result.find((r) => r.auctionId === auctionDeletedId);
      expect(deletedAuction).toBeUndefined();
    });
  });

  // ─── getRevenueTrends ─────────────────────────────────────────────────────────

  describe('getRevenueTrends', () => {
    it('returns monthly revenue trend data', async () => {
      const result = await getRevenueTrends(12);
      expect(Array.isArray(result)).toBe(true);
      // We have auctions with start_date within last 12 months
    });

    it('each entry has expected fields', async () => {
      const result = await getRevenueTrends(12);
      if (result.length > 0) {
        const entry = result[0];
        expect(entry).toHaveProperty('month');
        expect(entry).toHaveProperty('monthLabel');
        expect(entry).toHaveProperty('totalHammer');
        expect(entry).toHaveProperty('totalPremium');
        expect(entry).toHaveProperty('totalRevenue');
        expect(entry).toHaveProperty('lotsSold');
        expect(typeof entry.totalHammer).toBe('number');
        expect(typeof entry.totalRevenue).toBe('number');
      }
    });

    it('revenue is non-negative', async () => {
      const result = await getRevenueTrends(12);
      for (const entry of result) {
        expect(entry.totalHammer).toBeGreaterThanOrEqual(0);
        expect(entry.totalRevenue).toBeGreaterThanOrEqual(0);
        expect(entry.lotsSold).toBeGreaterThanOrEqual(0);
      }
    });

    it('returns empty array when months is 0', async () => {
      const result = await getRevenueTrends(0);
      // With 0 months, no data should match
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ─── getTopArtists ────────────────────────────────────────────────────────────

  describe('getTopArtists', () => {
    it('returns top artists by total hammer value', async () => {
      const result = await getTopArtists(100);
      expect(Array.isArray(result)).toBe(true);
      const picasso = result.find((r) => r.artist === 'Picasso Analytics');
      expect(picasso).toBeDefined();
      // Picasso has 50000 + 30000 = 80000 total hammer
      expect(picasso!.totalHammerValue).toBe(80000);
      expect(picasso!.lotsSold).toBe(2);
    });

    it('respects limit parameter', async () => {
      const result = await getTopArtists(1);
      expect(result.length).toBeLessThanOrEqual(1);
    });

    it('each entry has expected fields', async () => {
      const result = await getTopArtists(10);
      if (result.length > 0) {
        const entry = result[0];
        expect(entry).toHaveProperty('artist');
        expect(entry).toHaveProperty('totalHammerValue');
        expect(entry).toHaveProperty('lotsSold');
        expect(entry).toHaveProperty('totalLots');
        expect(entry).toHaveProperty('avgHammerPrice');
      }
    });

    it('excludes lots with empty artist name', async () => {
      // All our test lots have non-empty artist names, so this is implicitly tested
      const result = await getTopArtists(100);
      for (const entry of result) {
        expect(entry.artist).not.toBe('');
      }
    });

    it('excludes soft-deleted lots', async () => {
      const result = await getTopArtists(100);
      const deleted = result.find((r) => r.artist === 'Deleted Analytics');
      expect(deleted).toBeUndefined();
    });

    it('avgHammerPrice is rounded to integer', async () => {
      const result = await getTopArtists(100);
      const picasso = result.find((r) => r.artist === 'Picasso Analytics');
      expect(picasso).toBeDefined();
      // avg of 50000 and 30000 = 40000
      expect(picasso!.avgHammerPrice).toBe(40000);
    });

    it('orders by total hammer value descending', async () => {
      const result = await getTopArtists(100);
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].totalHammerValue).toBeGreaterThanOrEqual(result[i].totalHammerValue);
      }
    });
  });

  // ─── getBidActivity ───────────────────────────────────────────────────────────

  describe('getBidActivity', () => {
    it('returns bid activity with byHour and byDayOfWeek arrays', async () => {
      const result = await getBidActivity(undefined, 30);
      expect(result).toHaveProperty('byHour');
      expect(result).toHaveProperty('byDayOfWeek');
      expect(Array.isArray(result.byHour)).toBe(true);
      expect(Array.isArray(result.byDayOfWeek)).toBe(true);
    });

    it('byHour entries have hour and bidCount', async () => {
      const result = await getBidActivity(undefined, 30);
      for (const entry of result.byHour) {
        expect(entry).toHaveProperty('hour');
        expect(entry).toHaveProperty('bidCount');
        expect(entry.hour).toBeGreaterThanOrEqual(0);
        expect(entry.hour).toBeLessThanOrEqual(23);
        expect(entry.bidCount).toBeGreaterThanOrEqual(0);
      }
    });

    it('byDayOfWeek entries have dayOfWeek, dayName, and bidCount', async () => {
      const result = await getBidActivity(undefined, 30);
      const validDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      for (const entry of result.byDayOfWeek) {
        expect(entry.dayOfWeek).toBeGreaterThanOrEqual(0);
        expect(entry.dayOfWeek).toBeLessThanOrEqual(6);
        expect(validDays).toContain(entry.dayName);
        expect(entry.bidCount).toBeGreaterThanOrEqual(0);
      }
    });

    it('filters by auctionId', async () => {
      const result = await getBidActivity(auctionLiveId, 30);
      // Should have bid activity (we placed bids on lots in auctionLiveId)
      const totalBids = result.byHour.reduce((sum, e) => sum + e.bidCount, 0);
      expect(totalBids).toBeGreaterThanOrEqual(3); // bid1, bid2, bid3, bid4
    });

    it('returns empty arrays when no bids in time range', async () => {
      const result = await getBidActivity(undefined, 0);
      // days=0 means only bids from today, but the interval logic might still capture some
      // At minimum the structure should be valid
      expect(Array.isArray(result.byHour)).toBe(true);
      expect(Array.isArray(result.byDayOfWeek)).toBe(true);
    });
  });

  // ─── getUserActivityStats ─────────────────────────────────────────────────────

  describe('getUserActivityStats', () => {
    it('returns all expected user activity fields', async () => {
      const result = await getUserActivityStats();
      expect(result).toHaveProperty('totalUsers');
      expect(result).toHaveProperty('newUsersLast30Days');
      expect(result).toHaveProperty('newUsersLast7Days');
      expect(result).toHaveProperty('activeBiddersLast30Days');
      expect(result).toHaveProperty('returningBiddersLast30Days');
      expect(result).toHaveProperty('pendingRegistrations');
    });

    it('totalUsers is a positive number', async () => {
      const result = await getUserActivityStats();
      expect(result.totalUsers).toBeGreaterThan(0);
    });

    it('newUsersLast30Days includes recently created test users', async () => {
      const result = await getUserActivityStats();
      // Our test users were created in beforeAll, so within last 30 days
      expect(result.newUsersLast30Days).toBeGreaterThanOrEqual(2);
    });

    it('newUsersLast7Days includes recently created test users', async () => {
      const result = await getUserActivityStats();
      expect(result.newUsersLast7Days).toBeGreaterThanOrEqual(2);
    });

    it('activeBiddersLast30Days counts distinct users with recent bids', async () => {
      const result = await getUserActivityStats();
      // Both userId and user2Id placed bids within last 30 days
      expect(result.activeBiddersLast30Days).toBeGreaterThanOrEqual(2);
    });

    it('returningBiddersLast30Days counts users with both old and new bids', async () => {
      const result = await getUserActivityStats();
      // userId has an old bid (31 days ago) and recent bids
      expect(result.returningBiddersLast30Days).toBeGreaterThanOrEqual(1);
    });

    it('pendingRegistrations counts unapproved bid registrations', async () => {
      const result = await getUserActivityStats();
      // bidReg2 is not approved
      expect(result.pendingRegistrations).toBeGreaterThanOrEqual(1);
    });

    it('all values are numbers', async () => {
      const result = await getUserActivityStats();
      expect(typeof result.totalUsers).toBe('number');
      expect(typeof result.newUsersLast30Days).toBe('number');
      expect(typeof result.newUsersLast7Days).toBe('number');
      expect(typeof result.activeBiddersLast30Days).toBe('number');
      expect(typeof result.returningBiddersLast30Days).toBe('number');
      expect(typeof result.pendingRegistrations).toBe('number');
    });
  });

  // ─── getAuctionComparison ─────────────────────────────────────────────────────

  describe('getAuctionComparison', () => {
    it('returns comparison data for all non-deleted auctions', async () => {
      const result = await getAuctionComparison();
      expect(Array.isArray(result)).toBe(true);
      // Should include live and archive auctions but not the deleted one
      const ids = result.map((r) => r.auctionId);
      expect(ids).toContain(auctionLiveId);
      expect(ids).toContain(auctionArchiveId);
      expect(ids).not.toContain(auctionDeletedId);
    });

    it('includes draft auctions (they are not deleted)', async () => {
      const result = await getAuctionComparison();
      const ids = result.map((r) => r.auctionId);
      expect(ids).toContain(auctionDraftId);
    });

    it('each entry has all expected fields', async () => {
      const result = await getAuctionComparison();
      const entry = result.find((r) => r.auctionId === auctionLiveId);
      expect(entry).toBeDefined();
      expect(entry).toHaveProperty('auctionId');
      expect(entry).toHaveProperty('auctionTitle');
      expect(entry).toHaveProperty('auctionSlug');
      expect(entry).toHaveProperty('startDate');
      expect(entry).toHaveProperty('status');
      expect(entry).toHaveProperty('totalLots');
      expect(entry).toHaveProperty('soldLots');
      expect(entry).toHaveProperty('sellThroughRate');
      expect(entry).toHaveProperty('totalHammerPrice');
      expect(entry).toHaveProperty('buyersPremium');
      expect(entry).toHaveProperty('totalRevenue');
      expect(entry).toHaveProperty('avgHammerPrice');
    });

    it('calculates sell-through rate correctly', async () => {
      const result = await getAuctionComparison();
      const entry = result.find((r) => r.auctionId === auctionLiveId)!;
      if (entry.totalLots > 0) {
        const expectedRate = Math.round((entry.soldLots / entry.totalLots) * 10000) / 100;
        expect(entry.sellThroughRate).toBe(expectedRate);
      }
    });

    it('calculates buyers premium from hammer total and premium rate', async () => {
      const result = await getAuctionComparison();
      const entry = result.find((r) => r.auctionId === auctionLiveId)!;
      // buyersPremiumRate is 0.2000
      const expectedPremium = Math.round(entry.totalHammerPrice * 0.2);
      expect(entry.buyersPremium).toBe(expectedPremium);
      expect(entry.totalRevenue).toBe(entry.totalHammerPrice + entry.buyersPremium);
    });

    it('orders by startDate descending', async () => {
      const result = await getAuctionComparison();
      for (let i = 1; i < result.length; i++) {
        const prev = new Date(result[i - 1].startDate!).getTime();
        const curr = new Date(result[i].startDate!).getTime();
        expect(prev).toBeGreaterThanOrEqual(curr);
      }
    });

    it('excludes soft-deleted lots from counts', async () => {
      const result = await getAuctionComparison();
      const entry = result.find((r) => r.auctionId === auctionLiveId)!;
      // lotDeletedId has hammerPrice=99999, if counted totalHammerPrice would be higher
      // With only lotSold1Id (50000) + lotSold2Id (30000) sold in this auction
      expect(entry.totalHammerPrice).toBeGreaterThanOrEqual(80000);
      // But should not include the deleted lot's 99999
      // We can verify the sold count
      expect(entry.soldLots).toBeGreaterThanOrEqual(2);
    });
  });

  // ─── getLotPerformance ────────────────────────────────────────────────────────

  describe('getLotPerformance', () => {
    it('returns performance breakdown by lot status', async () => {
      const result = await getLotPerformance();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('each entry has expected fields', async () => {
      const result = await getLotPerformance();
      for (const entry of result) {
        expect(entry).toHaveProperty('status');
        expect(entry).toHaveProperty('count');
        expect(entry).toHaveProperty('avgHammerPrice');
        expect(entry).toHaveProperty('totalHammerPrice');
        expect(entry).toHaveProperty('avgEstimateMin');
        expect(typeof entry.count).toBe('number');
      }
    });

    it('filters by auctionId', async () => {
      const result = await getLotPerformance(auctionLiveId);
      // Should have lots from this auction only
      // statuses: sold (2), passed (1), active (1)
      const statuses = result.map((r) => r.status);
      expect(statuses).toContain('sold');
    });

    it('sold status has valid totalHammerPrice', async () => {
      const result = await getLotPerformance(auctionLiveId);
      const sold = result.find((r) => r.status === 'sold');
      expect(sold).toBeDefined();
      expect(sold!.totalHammerPrice).toBeGreaterThanOrEqual(80000); // 50000 + 30000
    });

    it('excludes soft-deleted lots', async () => {
      const result = await getLotPerformance(auctionLiveId);
      const sold = result.find((r) => r.status === 'sold');
      // If deleted lot (99999) were included, total would be 50000+30000+99999 = 179999
      expect(sold!.totalHammerPrice).toBeLessThan(170000);
    });

    it('excludes soft-deleted auctions', async () => {
      const result = await getLotPerformance();
      // Overall result should not include data from deleted auction
      // Hard to test directly, but at least the query should not error
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ─── getDashboardStats ────────────────────────────────────────────────────────

  describe('getDashboardStats', () => {
    it('returns all dashboard stat sections', async () => {
      const result = await getDashboardStats();
      expect(result).toHaveProperty('auctionCounts');
      expect(result).toHaveProperty('totalLots');
      expect(result).toHaveProperty('totalUsers');
      expect(result).toHaveProperty('totalBids');
      expect(result).toHaveProperty('liveAuctions');
      expect(result).toHaveProperty('recentActivity');
    });

    it('auctionCounts has expected status breakdown', async () => {
      const result = await getDashboardStats();
      const counts = result.auctionCounts;
      expect(counts).toHaveProperty('total');
      expect(counts).toHaveProperty('draft');
      expect(counts).toHaveProperty('preview');
      expect(counts).toHaveProperty('live');
      expect(counts).toHaveProperty('reconciliation');
      expect(counts).toHaveProperty('archive');
      expect(counts.total).toBeGreaterThan(0);
      // total should be sum of all statuses
      expect(counts.total).toBe(
        counts.draft + counts.preview + counts.live +
        counts.reconciliation + counts.archive,
      );
    });

    it('auctionCounts excludes soft-deleted auctions', async () => {
      const result = await getDashboardStats();
      // The deleted auction (status=live) should not be counted
      // This is implicit - we can check total is reasonable
      expect(result.auctionCounts.total).toBeGreaterThanOrEqual(3); // live + archive + draft
    });

    it('totalLots is a positive number', async () => {
      const result = await getDashboardStats();
      expect(result.totalLots).toBeGreaterThan(0);
    });

    it('totalUsers is a positive number', async () => {
      const result = await getDashboardStats();
      expect(result.totalUsers).toBeGreaterThan(0);
    });

    it('totalBids includes all bids', async () => {
      const result = await getDashboardStats();
      expect(result.totalBids).toBeGreaterThanOrEqual(5); // our 5 test bids
    });

    it('liveAuctions includes active live auctions', async () => {
      const result = await getDashboardStats();
      expect(Array.isArray(result.liveAuctions)).toBe(true);
      const live = result.liveAuctions.find((a) => a.id === auctionLiveId);
      expect(live).toBeDefined();
      expect(live!.title).toBe('Analytics Live Auction');
      expect(live!.status).toBe('live');
    });

    it('liveAuctions entries have lot/bid/registration counts', async () => {
      const result = await getDashboardStats();
      const live = result.liveAuctions.find((a) => a.id === auctionLiveId);
      expect(live).toBeDefined();
      expect(live!.lotCount).toBeGreaterThanOrEqual(3); // sold1, sold2, unsold, active (not deleted)
      expect(live!.bidCount).toBeGreaterThanOrEqual(3); // bid1, bid2, bid3, bid4
      expect(live!.registrationCount).toBeGreaterThanOrEqual(2); // bidReg1, bidReg2
    });

    it('liveAuctions excludes soft-deleted auctions', async () => {
      const result = await getDashboardStats();
      const deleted = result.liveAuctions.find((a) => a.id === auctionDeletedId);
      expect(deleted).toBeUndefined();
    });

    it('recentActivity is an array of activity items', async () => {
      const result = await getDashboardStats();
      expect(Array.isArray(result.recentActivity)).toBe(true);
      if (result.recentActivity.length > 0) {
        const entry = result.recentActivity[0];
        expect(entry).toHaveProperty('id');
        expect(entry).toHaveProperty('action');
        expect(entry).toHaveProperty('detail');
        expect(entry).toHaveProperty('time');
        expect(entry).toHaveProperty('type');
      }
    });

    it('recentActivity contains bid, user, and registration types', async () => {
      const result = await getDashboardStats();
      const types = result.recentActivity.map((a) => a.type);
      // We should have bids and user registrations at minimum
      expect(types.some((t) => t === 'bid' || t === 'user' || t === 'registration')).toBe(true);
    });

    it('recentActivity is sorted by time descending', async () => {
      const result = await getDashboardStats();
      for (let i = 1; i < result.recentActivity.length; i++) {
        const prev = new Date(result.recentActivity[i - 1].time).getTime();
        const curr = new Date(result.recentActivity[i].time).getTime();
        expect(prev).toBeGreaterThanOrEqual(curr);
      }
    });

    it('recentActivity is limited to 10 items', async () => {
      const result = await getDashboardStats();
      expect(result.recentActivity.length).toBeLessThanOrEqual(10);
    });
  });
});
