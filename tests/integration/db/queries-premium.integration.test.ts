import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from '@/tests/helpers/db';
import { getTiersForAuction, upsertTiers } from '@/db/queries/premium';

describe('db/queries/premium', () => {
  const db = getTestDb();
  let auctionId: string;

  beforeAll(async () => {
    const { randomUUID } = await import('crypto');
    const { auctions } = await import('@/db/schema');

    auctionId = randomUUID();
    await db.insert(auctions).values({
      id: auctionId,
      slug: `premium-test-${Date.now()}`,
      title: 'Premium Test Auction',
      description: 'Test',
      category: 'mixed',
      startDate: new Date(),
      endDate: new Date(Date.now() + 3600000),
      location: 'Warsaw',
      curator: 'Test',
      status: 'preview',
      visibilityLevel: '0',
      buyersPremiumRate: '0.2000',
    });
  });

  afterAll(async () => {
    const { auctions, premiumTiers } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');

    await db.delete(premiumTiers).where(eq(premiumTiers.auctionId, auctionId)).catch(() => {});
    await db.delete(auctions).where(eq(auctions.id, auctionId)).catch(() => {});
  });

  describe('getTiersForAuction', () => {
    it('returns empty array when no tiers exist', async () => {
      const result = await getTiersForAuction(auctionId);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('returns tiers after inserting them', async () => {
      await upsertTiers(auctionId, [
        { minAmount: 0, maxAmount: 1000, rate: '0.2500', sortOrder: 0 },
        { minAmount: 1000, maxAmount: null, rate: '0.2000', sortOrder: 1 },
      ]);

      const result = await getTiersForAuction(auctionId);
      expect(result.length).toBe(2);
    });

    it('returns tiers ordered by minAmount ascending', async () => {
      const result = await getTiersForAuction(auctionId);
      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].minAmount).toBeLessThanOrEqual(result[i + 1].minAmount);
      }
    });

    it('returns empty array for unknown auctionId', async () => {
      const { randomUUID } = await import('crypto');
      const result = await getTiersForAuction(randomUUID());
      expect(result).toEqual([]);
    });
  });

  describe('upsertTiers', () => {
    it('inserts tiers and returns them sorted by minAmount', async () => {
      const tiers = await upsertTiers(auctionId, [
        { minAmount: 5000, maxAmount: null, rate: '0.1500', sortOrder: 1 },
        { minAmount: 0, maxAmount: 5000, rate: '0.2500', sortOrder: 0 },
      ]);

      expect(tiers.length).toBe(2);
      expect(tiers[0].minAmount).toBe(0);
      expect(tiers[1].minAmount).toBe(5000);
    });

    it('replaces existing tiers atomically', async () => {
      // First upsert
      await upsertTiers(auctionId, [
        { minAmount: 0, maxAmount: 1000, rate: '0.2500' },
        { minAmount: 1000, maxAmount: null, rate: '0.2000' },
      ]);

      // Second upsert with different tiers
      const tiers = await upsertTiers(auctionId, [
        { minAmount: 0, maxAmount: null, rate: '0.1800' },
      ]);

      expect(tiers.length).toBe(1);
      expect(tiers[0].rate).toBe('0.1800');

      // Verify DB state
      const fromDb = await getTiersForAuction(auctionId);
      expect(fromDb.length).toBe(1);
    });

    it('removes all tiers when empty array is passed', async () => {
      // First ensure there are tiers
      await upsertTiers(auctionId, [
        { minAmount: 0, maxAmount: null, rate: '0.2000' },
      ]);

      const result = await upsertTiers(auctionId, []);

      expect(result).toEqual([]);

      const fromDb = await getTiersForAuction(auctionId);
      expect(fromDb.length).toBe(0);
    });

    it('uses index as sortOrder when sortOrder is not provided', async () => {
      const tiers = await upsertTiers(auctionId, [
        { minAmount: 0, maxAmount: 500, rate: '0.3000' },
        { minAmount: 500, maxAmount: null, rate: '0.2000' },
      ]);

      expect(tiers[0].sortOrder).toBe(0);
      expect(tiers[1].sortOrder).toBe(1);
    });

    it('stores correct rate and maxAmount values', async () => {
      const tiers = await upsertTiers(auctionId, [
        { minAmount: 0, maxAmount: 2000, rate: '0.2500', sortOrder: 0 },
        { minAmount: 2000, maxAmount: null, rate: '0.1500', sortOrder: 1 },
      ]);

      const tier0 = tiers.find((t) => t.minAmount === 0);
      const tier1 = tiers.find((t) => t.minAmount === 2000);

      expect(tier0?.maxAmount).toBe(2000);
      expect(tier0?.rate).toBe('0.2500');
      expect(tier1?.maxAmount).toBeNull();
      expect(tier1?.rate).toBe('0.1500');
    });

    it('each tier has auctionId set', async () => {
      const tiers = await upsertTiers(auctionId, [
        { minAmount: 0, maxAmount: null, rate: '0.2000' },
      ]);

      expect(tiers[0].auctionId).toBe(auctionId);
    });
  });
});
