import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from '@/tests/helpers/db';
import { notDeleted, auctionVisibilityFilter, lotVisibilityFilter } from '@/db/helpers';

describe('db/helpers', () => {
  const db = getTestDb();
  let auctionId: string;
  let lotId: string;
  let draftAuctionId: string;
  let draftLotId: string;
  let deletedAuctionId: string;
  let deletedLotId: string;
  let level1AuctionId: string;
  let level1LotId: string;

  beforeAll(async () => {
    const { randomUUID } = await import('crypto');
    const { auctions, lots } = await import('@/db/schema');

    // Public auction (level 0)
    auctionId = randomUUID();
    await db.insert(auctions).values({
      id: auctionId,
      slug: `helpers-test-${Date.now()}`,
      title: 'Helpers Test Auction',
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

    // Level 1 auction (restricted)
    level1AuctionId = randomUUID();
    await db.insert(auctions).values({
      id: level1AuctionId,
      slug: `helpers-level1-${Date.now()}`,
      title: 'Level 1 Auction',
      description: 'Test',
      category: 'mixed',
      startDate: new Date(),
      endDate: new Date(Date.now() + 3600000),
      location: 'Warsaw',
      curator: 'Test',
      status: 'live',
      visibilityLevel: '1',
      buyersPremiumRate: '0.2000',
    });

    // Draft auction (should be excluded by auctionVisibilityFilter)
    draftAuctionId = randomUUID();
    await db.insert(auctions).values({
      id: draftAuctionId,
      slug: `helpers-draft-${Date.now()}`,
      title: 'Draft Auction',
      description: 'Test',
      category: 'mixed',
      startDate: new Date(),
      endDate: new Date(Date.now() + 3600000),
      location: 'Warsaw',
      curator: 'Test',
      status: 'draft',
      visibilityLevel: '0',
      buyersPremiumRate: '0.2000',
    });

    // Soft-deleted auction
    deletedAuctionId = randomUUID();
    await db.insert(auctions).values({
      id: deletedAuctionId,
      slug: `helpers-deleted-${Date.now()}`,
      title: 'Deleted Auction',
      description: 'Test',
      category: 'mixed',
      startDate: new Date(),
      endDate: new Date(Date.now() + 3600000),
      location: 'Warsaw',
      curator: 'Test',
      status: 'live',
      visibilityLevel: '0',
      buyersPremiumRate: '0.2000',
      deletedAt: new Date(),
    });

    // Active lot in public auction
    lotId = randomUUID();
    await db.insert(lots).values({
      id: lotId,
      auctionId,
      lotNumber: 1,
      title: 'Active Lot',
      artist: 'Test',
      description: 'Test',
      medium: 'Oil',
      dimensions: '50x70',
      status: 'active',
      startingBid: 500,
    });

    // Level 1 lot in level 1 auction
    level1LotId = randomUUID();
    await db.insert(lots).values({
      id: level1LotId,
      auctionId: level1AuctionId,
      lotNumber: 1,
      title: 'Level 1 Lot',
      artist: 'Test',
      description: 'Test',
      medium: 'Oil',
      dimensions: '50x70',
      status: 'active',
      startingBid: 500,
    });

    // Draft lot (should be excluded)
    draftLotId = randomUUID();
    await db.insert(lots).values({
      id: draftLotId,
      auctionId,
      lotNumber: 2,
      title: 'Draft Lot',
      artist: 'Test',
      description: 'Test',
      medium: 'Oil',
      dimensions: '50x70',
      status: 'draft',
      startingBid: 500,
    });

    // Soft-deleted lot
    deletedLotId = randomUUID();
    await db.insert(lots).values({
      id: deletedLotId,
      auctionId,
      lotNumber: 3,
      title: 'Deleted Lot',
      artist: 'Test',
      description: 'Test',
      medium: 'Oil',
      dimensions: '50x70',
      status: 'active',
      startingBid: 500,
      deletedAt: new Date(),
    });
  });

  afterAll(async () => {
    const { auctions, lots } = await import('@/db/schema');
    const { eq, inArray } = await import('drizzle-orm');

    await db.delete(lots).where(
      inArray(lots.id, [lotId, draftLotId, deletedLotId, level1LotId]),
    ).catch(() => {});
    await db.delete(auctions).where(
      inArray(auctions.id, [auctionId, draftAuctionId, deletedAuctionId, level1AuctionId]),
    ).catch(() => {});
  });

  describe('notDeleted', () => {
    it('returns non-deleted auctions', async () => {
      const { auctions } = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');

      const result = await db
        .select({ id: auctions.id })
        .from(auctions)
        .where(notDeleted(auctions));

      const ids = result.map((r) => r.id);
      expect(ids).toContain(auctionId);
    });

    it('excludes soft-deleted auctions', async () => {
      const { auctions } = await import('@/db/schema');

      const result = await db
        .select({ id: auctions.id })
        .from(auctions)
        .where(notDeleted(auctions));

      const ids = result.map((r) => r.id);
      expect(ids).not.toContain(deletedAuctionId);
    });

    it('works with lots table', async () => {
      const { lots } = await import('@/db/schema');

      const result = await db
        .select({ id: lots.id })
        .from(lots)
        .where(notDeleted(lots));

      const ids = result.map((r) => r.id);
      expect(ids).toContain(lotId);
      expect(ids).not.toContain(deletedLotId);
    });
  });

  describe('auctionVisibilityFilter', () => {
    it('returns public auctions for level 0 user', async () => {
      const { auctions } = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');

      const result = await db
        .select({ id: auctions.id, visibilityLevel: auctions.visibilityLevel })
        .from(auctions)
        .where(auctionVisibilityFilter(0));

      const ids = result.map((r) => r.id);
      expect(ids).toContain(auctionId);
    });

    it('excludes level 1 auctions for level 0 user', async () => {
      const { auctions } = await import('@/db/schema');

      const result = await db
        .select({ id: auctions.id })
        .from(auctions)
        .where(auctionVisibilityFilter(0));

      const ids = result.map((r) => r.id);
      expect(ids).not.toContain(level1AuctionId);
    });

    it('includes level 1 auctions for level 1 user', async () => {
      const { auctions } = await import('@/db/schema');

      const result = await db
        .select({ id: auctions.id })
        .from(auctions)
        .where(auctionVisibilityFilter(1));

      const ids = result.map((r) => r.id);
      expect(ids).toContain(auctionId);
      expect(ids).toContain(level1AuctionId);
    });

    it('excludes draft auctions', async () => {
      const { auctions } = await import('@/db/schema');

      const result = await db
        .select({ id: auctions.id })
        .from(auctions)
        .where(auctionVisibilityFilter(2));

      const ids = result.map((r) => r.id);
      expect(ids).not.toContain(draftAuctionId);
    });

    it('excludes soft-deleted auctions', async () => {
      const { auctions } = await import('@/db/schema');

      const result = await db
        .select({ id: auctions.id })
        .from(auctions)
        .where(auctionVisibilityFilter(2));

      const ids = result.map((r) => r.id);
      expect(ids).not.toContain(deletedAuctionId);
    });
  });

  describe('lotVisibilityFilter', () => {
    it('returns active lots in public auctions for level 0 user', async () => {
      const { lots, auctions } = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');

      const result = await db
        .select({ id: lots.id })
        .from(lots)
        .innerJoin(auctions, eq(lots.auctionId, auctions.id))
        .where(lotVisibilityFilter(0));

      const ids = result.map((r) => r.id);
      expect(ids).toContain(lotId);
    });

    it('excludes draft lots', async () => {
      const { lots, auctions } = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');

      const result = await db
        .select({ id: lots.id })
        .from(lots)
        .innerJoin(auctions, eq(lots.auctionId, auctions.id))
        .where(lotVisibilityFilter(2));

      const ids = result.map((r) => r.id);
      expect(ids).not.toContain(draftLotId);
    });

    it('excludes soft-deleted lots', async () => {
      const { lots, auctions } = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');

      const result = await db
        .select({ id: lots.id })
        .from(lots)
        .innerJoin(auctions, eq(lots.auctionId, auctions.id))
        .where(lotVisibilityFilter(2));

      const ids = result.map((r) => r.id);
      expect(ids).not.toContain(deletedLotId);
    });

    it('excludes lots in level 1 auctions for level 0 user', async () => {
      const { lots, auctions } = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');

      const result = await db
        .select({ id: lots.id })
        .from(lots)
        .innerJoin(auctions, eq(lots.auctionId, auctions.id))
        .where(lotVisibilityFilter(0));

      const ids = result.map((r) => r.id);
      expect(ids).not.toContain(level1LotId);
    });

    it('includes level 1 lots for level 1 user', async () => {
      const { lots, auctions } = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');

      const result = await db
        .select({ id: lots.id })
        .from(lots)
        .innerJoin(auctions, eq(lots.auctionId, auctions.id))
        .where(lotVisibilityFilter(1));

      const ids = result.map((r) => r.id);
      expect(ids).toContain(level1LotId);
    });

    it('handles lot visibilityOverride — overrides auction visibility', async () => {
      const { lots, auctions } = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');
      const { randomUUID } = await import('crypto');

      // Create a lot with visibilityOverride=2 in a public auction
      const overrideLotId = randomUUID();
      await db.insert(lots).values({
        id: overrideLotId,
        auctionId,
        lotNumber: 99,
        title: 'Override Lot',
        artist: 'Test',
        description: 'Test',
        medium: 'Oil',
        dimensions: '50x70',
        status: 'active',
        startingBid: 500,
        visibilityOverride: '2', // Only visible to level 2 users
      });

      // Level 0 user should NOT see this lot
      const level0Result = await db
        .select({ id: lots.id })
        .from(lots)
        .innerJoin(auctions, eq(lots.auctionId, auctions.id))
        .where(lotVisibilityFilter(0));

      expect(level0Result.map((r) => r.id)).not.toContain(overrideLotId);

      // Level 2 user SHOULD see this lot
      const level2Result = await db
        .select({ id: lots.id })
        .from(lots)
        .innerJoin(auctions, eq(lots.auctionId, auctions.id))
        .where(lotVisibilityFilter(2));

      expect(level2Result.map((r) => r.id)).toContain(overrideLotId);

      // Cleanup
      await db.delete(lots).where(eq(lots.id, overrideLotId));
    });
  });
});
