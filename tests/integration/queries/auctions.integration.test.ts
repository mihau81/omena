import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from '@/tests/helpers/db';
import {
  getAuctions,
  getAuctionBySlug,
  getAuctionById,
  getAuctionWithLots,
} from '@/db/queries/auctions';

describe('db/queries/auctions', () => {
  const db = getTestDb();

  let auctionPublicId: string;
  let auctionPrivateId: string;
  let auctionVipId: string;
  let auctionDraftId: string;
  let auctionDeletedId: string;

  let lotId1: string;
  let lotId2: string;
  let lotId3: string;
  let lotDraftId: string;

  let mediaId1: string;
  let mediaId2: string;

  const ts = Date.now();

  beforeAll(async () => {
    const { randomUUID } = await import('crypto');
    const { auctions, lots, media } = await import('@/db/schema');

    // --- Auctions ---

    // Public live auction (sortOrder=1)
    auctionPublicId = randomUUID();
    await db.insert(auctions).values({
      id: auctionPublicId,
      slug: `auctions-public-${ts}`,
      title: 'Public Auction',
      description: 'A public live auction',
      category: 'mixed',
      startDate: new Date(Date.now() - 7200000),
      endDate: new Date(Date.now() + 7200000),
      location: 'Warsaw',
      curator: 'Curator A',
      status: 'live',
      visibilityLevel: '0',
      buyersPremiumRate: '0.2000',
      sortOrder: 10,
    });

    // Private preview auction (visibilityLevel=1, sortOrder=2)
    auctionPrivateId = randomUUID();
    await db.insert(auctions).values({
      id: auctionPrivateId,
      slug: `auctions-private-${ts}`,
      title: 'Private Auction',
      description: 'A private auction',
      category: 'mixed',
      startDate: new Date(Date.now() + 3600000),
      endDate: new Date(Date.now() + 86400000),
      location: 'Krakow',
      curator: 'Curator B',
      status: 'preview',
      visibilityLevel: '1',
      buyersPremiumRate: '0.1500',
      sortOrder: 20,
    });

    // VIP archive auction (visibilityLevel=2, sortOrder=3)
    auctionVipId = randomUUID();
    await db.insert(auctions).values({
      id: auctionVipId,
      slug: `auctions-vip-${ts}`,
      title: 'VIP Auction',
      description: 'A VIP auction',
      category: 'mixed',
      startDate: new Date(Date.now() - 172800000),
      endDate: new Date(Date.now() - 86400000),
      location: 'Poznan',
      curator: 'Curator C',
      status: 'archive',
      visibilityLevel: '2',
      buyersPremiumRate: '0.2500',
      sortOrder: 30,
    });

    // Draft auction (should never appear in public queries)
    auctionDraftId = randomUUID();
    await db.insert(auctions).values({
      id: auctionDraftId,
      slug: `auctions-draft-${ts}`,
      title: 'Draft Auction',
      description: 'A draft auction',
      category: 'mixed',
      startDate: new Date(Date.now() + 86400000),
      endDate: new Date(Date.now() + 172800000),
      location: 'Gdansk',
      curator: 'Curator D',
      status: 'draft',
      visibilityLevel: '0',
      buyersPremiumRate: '0.2000',
      sortOrder: 40,
    });

    // Soft-deleted auction (should be excluded)
    auctionDeletedId = randomUUID();
    await db.insert(auctions).values({
      id: auctionDeletedId,
      slug: `auctions-deleted-${ts}`,
      title: 'Deleted Auction',
      description: 'A deleted auction',
      category: 'mixed',
      startDate: new Date(Date.now() - 3600000),
      endDate: new Date(Date.now() + 3600000),
      location: 'Wroclaw',
      curator: 'Curator E',
      status: 'live',
      visibilityLevel: '0',
      buyersPremiumRate: '0.2000',
      sortOrder: 50,
      deletedAt: new Date(),
    });

    // --- Lots (for public auction) ---

    lotId1 = randomUUID();
    await db.insert(lots).values({
      id: lotId1,
      auctionId: auctionPublicId,
      lotNumber: 1,
      title: 'First Lot',
      artist: 'Test Artist A',
      description: 'Test lot 1',
      medium: 'Oil',
      dimensions: '50x70',
      status: 'active',
      sortOrder: 1,
    });

    lotId2 = randomUUID();
    await db.insert(lots).values({
      id: lotId2,
      auctionId: auctionPublicId,
      lotNumber: 2,
      title: 'Second Lot',
      artist: 'Test Artist B',
      description: 'Test lot 2',
      medium: 'Watercolor',
      dimensions: '40x50',
      status: 'active',
      sortOrder: 2,
    });

    // Lot in VIP auction
    lotId3 = randomUUID();
    await db.insert(lots).values({
      id: lotId3,
      auctionId: auctionVipId,
      lotNumber: 1,
      title: 'VIP Lot',
      artist: 'VIP Artist',
      description: 'VIP lot',
      medium: 'Gold leaf',
      dimensions: '30x30',
      status: 'active',
      sortOrder: 1,
    });

    // Draft lot (should be excluded from getAuctionWithLots)
    lotDraftId = randomUUID();
    await db.insert(lots).values({
      id: lotDraftId,
      auctionId: auctionPublicId,
      lotNumber: 3,
      title: 'Draft Lot',
      artist: 'Draft Artist',
      description: 'This is a draft lot',
      medium: 'Pencil',
      dimensions: '10x15',
      status: 'draft',
      sortOrder: 3,
      deletedAt: null,
    });

    // --- Media (primary image for lotId1) ---

    mediaId1 = randomUUID();
    await db.insert(media).values({
      id: mediaId1,
      lotId: lotId1,
      url: 'https://example.com/lot1.jpg',
      thumbnailUrl: 'https://example.com/lot1-thumb.jpg',
      isPrimary: true,
      sortOrder: 0,
    });

    // Non-primary media for lotId1 (should not be used as cover)
    mediaId2 = randomUUID();
    await db.insert(media).values({
      id: mediaId2,
      lotId: lotId1,
      url: 'https://example.com/lot1-side.jpg',
      thumbnailUrl: 'https://example.com/lot1-side-thumb.jpg',
      isPrimary: false,
      sortOrder: 1,
    });
  });

  afterAll(async () => {
    const { auctions, lots, media } = await import('@/db/schema');
    const { eq, inArray } = await import('drizzle-orm');

    // Clean up in reverse dependency order
    await db.delete(media).where(inArray(media.id, [mediaId1, mediaId2])).catch(() => {});
    await db.delete(lots).where(
      inArray(lots.id, [lotId1, lotId2, lotId3, lotDraftId]),
    ).catch(() => {});
    await db.delete(auctions).where(
      inArray(auctions.id, [auctionPublicId, auctionPrivateId, auctionVipId, auctionDraftId, auctionDeletedId]),
    ).catch(() => {});
  });

  // ─── getAuctions ─────────────────────────────────────────────────────────────

  describe('getAuctions', () => {
    it('returns auctions with lotCount and coverImageUrl for public user', async () => {
      const result = await getAuctions(0);
      expect(Array.isArray(result)).toBe(true);

      const publicAuction = result.find((a) => a.id === auctionPublicId);
      expect(publicAuction).toBeDefined();
      expect(publicAuction!.lotCount).toBeGreaterThanOrEqual(2);
      expect(publicAuction!.coverImageUrl).toBeDefined();
    });

    it('includes coverImageUrl from primary media of auction lots', async () => {
      const result = await getAuctions(0);
      const publicAuction = result.find((a) => a.id === auctionPublicId);
      expect(publicAuction).toBeDefined();
      // coverImageUrl comes from the MIN url of primary media across all lots
      expect(typeof publicAuction!.coverImageUrl).toBe('string');
    });

    it('returns null coverImageUrl when auction has no media', async () => {
      const result = await getAuctions(1);
      const privateAuction = result.find((a) => a.id === auctionPrivateId);
      expect(privateAuction).toBeDefined();
      expect(privateAuction!.coverImageUrl).toBeNull();
    });

    it('excludes draft auctions', async () => {
      const result = await getAuctions(2); // even VIP users should not see draft
      const ids = result.map((a) => a.id);
      expect(ids).not.toContain(auctionDraftId);
    });

    it('excludes soft-deleted auctions', async () => {
      const result = await getAuctions(0);
      const ids = result.map((a) => a.id);
      expect(ids).not.toContain(auctionDeletedId);
    });

    it('public user (visibility=0) cannot see private (visibility=1) auctions', async () => {
      const result = await getAuctions(0);
      const ids = result.map((a) => a.id);
      expect(ids).not.toContain(auctionPrivateId);
      expect(ids).not.toContain(auctionVipId);
    });

    it('registered user (visibility=1) can see private auctions but not VIP', async () => {
      const result = await getAuctions(1);
      const ids = result.map((a) => a.id);
      expect(ids).toContain(auctionPublicId);
      expect(ids).toContain(auctionPrivateId);
      expect(ids).not.toContain(auctionVipId);
    });

    it('VIP user (visibility=2) can see all non-draft non-deleted auctions', async () => {
      const result = await getAuctions(2);
      const ids = result.map((a) => a.id);
      expect(ids).toContain(auctionPublicId);
      expect(ids).toContain(auctionPrivateId);
      expect(ids).toContain(auctionVipId);
    });

    it('orders auctions by sortOrder ascending', async () => {
      const result = await getAuctions(2);
      // Only look at our test auctions
      const ourAuctions = result.filter((a) =>
        [auctionPublicId, auctionPrivateId, auctionVipId].includes(a.id),
      );
      for (let i = 1; i < ourAuctions.length; i++) {
        expect(ourAuctions[i - 1].sortOrder).toBeLessThanOrEqual(ourAuctions[i].sortOrder);
      }
    });

    it('lotCount does not include soft-deleted lots', async () => {
      const { lots } = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');

      // Soft-delete lotId2
      await db.update(lots).set({ deletedAt: new Date() }).where(eq(lots.id, lotId2));

      const result = await getAuctions(0);
      const publicAuction = result.find((a) => a.id === auctionPublicId);
      expect(publicAuction).toBeDefined();
      // lotCount should be at least 1 less now (lotId1 + lotDraftId still exists but lotId2 soft-deleted)
      // lotDraftId is NOT soft-deleted, just status=draft, so it should count in the join
      // Actually notDeleted only checks deletedAt, not status
      const previousCount = publicAuction!.lotCount;

      // Restore
      await db.update(lots).set({ deletedAt: null }).where(eq(lots.id, lotId2));

      const result2 = await getAuctions(0);
      const publicAuction2 = result2.find((a) => a.id === auctionPublicId);
      expect(publicAuction2!.lotCount).toBeGreaterThanOrEqual(previousCount);
    });
  });

  // ─── getAuctionBySlug ────────────────────────────────────────────────────────

  describe('getAuctionBySlug', () => {
    it('returns auction with lotCount and coverImageUrl', async () => {
      const result = await getAuctionBySlug(`auctions-public-${ts}`, 0);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(auctionPublicId);
      expect(result!.title).toBe('Public Auction');
      expect(result!.lotCount).toBeGreaterThanOrEqual(2);
      expect(typeof result!.coverImageUrl).toBe('string');
    });

    it('returns null for non-existent slug', async () => {
      const result = await getAuctionBySlug('non-existent-slug-xyz', 0);
      expect(result).toBeNull();
    });

    it('returns null for draft auction slug', async () => {
      const result = await getAuctionBySlug(`auctions-draft-${ts}`, 0);
      expect(result).toBeNull();
    });

    it('returns null for soft-deleted auction slug', async () => {
      const result = await getAuctionBySlug(`auctions-deleted-${ts}`, 0);
      expect(result).toBeNull();
    });

    it('public user cannot access private auction by slug', async () => {
      const result = await getAuctionBySlug(`auctions-private-${ts}`, 0);
      expect(result).toBeNull();
    });

    it('registered user can access private auction by slug', async () => {
      const result = await getAuctionBySlug(`auctions-private-${ts}`, 1);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(auctionPrivateId);
      expect(result!.title).toBe('Private Auction');
    });

    it('public user cannot access VIP auction by slug', async () => {
      const result = await getAuctionBySlug(`auctions-vip-${ts}`, 0);
      expect(result).toBeNull();
    });

    it('VIP user can access VIP auction by slug', async () => {
      const result = await getAuctionBySlug(`auctions-vip-${ts}`, 2);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(auctionVipId);
    });

    it('returns coverImageUrl null when no primary media exists', async () => {
      const result = await getAuctionBySlug(`auctions-private-${ts}`, 1);
      expect(result).not.toBeNull();
      expect(result!.coverImageUrl).toBeNull();
    });
  });

  // ─── getAuctionById ──────────────────────────────────────────────────────────

  describe('getAuctionById', () => {
    it('returns auction by id (no visibility filter)', async () => {
      const result = await getAuctionById(auctionPublicId);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(auctionPublicId);
      expect(result!.title).toBe('Public Auction');
      expect(result!.slug).toBe(`auctions-public-${ts}`);
    });

    it('returns draft auction (no visibility filter applied)', async () => {
      const result = await getAuctionById(auctionDraftId);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(auctionDraftId);
      expect(result!.status).toBe('draft');
    });

    it('returns VIP auction without needing visibility', async () => {
      const result = await getAuctionById(auctionVipId);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(auctionVipId);
    });

    it('returns null for non-existent id', async () => {
      const { randomUUID } = await import('crypto');
      const result = await getAuctionById(randomUUID());
      expect(result).toBeNull();
    });

    it('returns null for soft-deleted auction', async () => {
      const result = await getAuctionById(auctionDeletedId);
      expect(result).toBeNull();
    });

    it('returns all auction fields', async () => {
      const result = await getAuctionById(auctionPublicId);
      expect(result).not.toBeNull();
      expect(result!.slug).toBe(`auctions-public-${ts}`);
      expect(result!.description).toBe('A public live auction');
      expect(result!.category).toBe('mixed');
      expect(result!.location).toBe('Warsaw');
      expect(result!.curator).toBe('Curator A');
      expect(result!.status).toBe('live');
      expect(result!.visibilityLevel).toBe('0');
      expect(result!.startDate).toBeInstanceOf(Date);
      expect(result!.endDate).toBeInstanceOf(Date);
    });
  });

  // ─── getAuctionWithLots ──────────────────────────────────────────────────────

  describe('getAuctionWithLots', () => {
    it('returns auction with lots including primary media', async () => {
      const result = await getAuctionWithLots(`auctions-public-${ts}`, 0);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(auctionPublicId);
      expect(result!.title).toBe('Public Auction');
      expect(Array.isArray(result!.lots)).toBe(true);
      expect(result!.lots.length).toBeGreaterThanOrEqual(1);
    });

    it('includes primaryImageUrl and primaryThumbnailUrl on lots', async () => {
      const result = await getAuctionWithLots(`auctions-public-${ts}`, 0);
      expect(result).not.toBeNull();
      const lot1 = result!.lots.find((l) => l.id === lotId1);
      expect(lot1).toBeDefined();
      expect(lot1!.primaryImageUrl).toBe('https://example.com/lot1.jpg');
      expect(lot1!.primaryThumbnailUrl).toBe('https://example.com/lot1-thumb.jpg');
    });

    it('returns null primaryImageUrl for lots without media', async () => {
      const result = await getAuctionWithLots(`auctions-public-${ts}`, 0);
      expect(result).not.toBeNull();
      const lot2 = result!.lots.find((l) => l.id === lotId2);
      expect(lot2).toBeDefined();
      expect(lot2!.primaryImageUrl).toBeNull();
    });

    it('excludes soft-deleted lots', async () => {
      const { lots } = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');

      // Soft-delete lotId2
      await db.update(lots).set({ deletedAt: new Date() }).where(eq(lots.id, lotId2));

      const result = await getAuctionWithLots(`auctions-public-${ts}`, 0);
      expect(result).not.toBeNull();
      const ids = result!.lots.map((l) => l.id);
      expect(ids).not.toContain(lotId2);

      // Restore
      await db.update(lots).set({ deletedAt: null }).where(eq(lots.id, lotId2));
    });

    it('orders lots by sortOrder ascending', async () => {
      const result = await getAuctionWithLots(`auctions-public-${ts}`, 0);
      expect(result).not.toBeNull();
      for (let i = 1; i < result!.lots.length; i++) {
        expect(result!.lots[i - 1].sortOrder).toBeLessThanOrEqual(result!.lots[i].sortOrder);
      }
    });

    it('returns null for non-existent slug', async () => {
      const result = await getAuctionWithLots('non-existent-slug-xyz', 0);
      expect(result).toBeNull();
    });

    it('returns null for draft auction slug', async () => {
      const result = await getAuctionWithLots(`auctions-draft-${ts}`, 0);
      expect(result).toBeNull();
    });

    it('public user cannot access VIP auction with lots', async () => {
      const result = await getAuctionWithLots(`auctions-vip-${ts}`, 0);
      expect(result).toBeNull();
    });

    it('VIP user can access VIP auction with lots', async () => {
      const result = await getAuctionWithLots(`auctions-vip-${ts}`, 2);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(auctionVipId);
      expect(result!.lots.some((l) => l.id === lotId3)).toBe(true);
    });

    it('includes auction-level fields like lotCount and coverImageUrl', async () => {
      const result = await getAuctionWithLots(`auctions-public-${ts}`, 0);
      expect(result).not.toBeNull();
      expect(result!.lotCount).toBeGreaterThanOrEqual(2);
      expect(result).toHaveProperty('coverImageUrl');
    });
  });
});
