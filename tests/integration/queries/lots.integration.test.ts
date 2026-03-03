import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from '@/tests/helpers/db';
import { createTestUser } from '@/tests/helpers/auth';
import {
  getLotsByAuction,
  getLotById,
  getLotByAuctionAndNumber,
  searchLots,
  getSoldLots,
  getAuctionsForResults,
  getDistinctArtists,
} from '@/db/queries/lots';

describe('db/queries/lots', () => {
  const db = getTestDb();

  // IDs for test data
  let auctionLiveId: string;
  let auctionArchiveId: string;
  let auctionDraftId: string;
  let auctionVipId: string;

  let lotActiveId: string;
  let lotSoldId: string;
  let lotWithdrawnId: string;
  let lotDraftId: string;
  let lotVipId: string;
  let lotActive2Id: string;

  let mediaId: string;
  let media2Id: string;
  let bidId: string;
  let userId: string;
  let translationId: string;

  const ts = Date.now();

  beforeAll(async () => {
    const { randomUUID } = await import('crypto');
    const { auctions, lots, media, bids, lotTranslations } = await import('@/db/schema');

    const user = await createTestUser({
      email: `lots-test-user-${ts}@example.com`,
    });
    userId = user.id;

    // --- Auctions ---

    // Live auction, public visibility
    auctionLiveId = randomUUID();
    await db.insert(auctions).values({
      id: auctionLiveId,
      slug: `lots-live-${ts}`,
      title: 'Live Auction',
      description: 'Live auction for testing',
      category: 'mixed',
      startDate: new Date(Date.now() - 7200000),
      endDate: new Date(Date.now() + 7200000),
      location: 'Warsaw',
      curator: 'Curator A',
      status: 'live',
      visibilityLevel: '0',
      buyersPremiumRate: '0.2000',
      sortOrder: 1,
    });

    // Archive auction, public visibility (for getSoldLots / getAuctionsForResults)
    auctionArchiveId = randomUUID();
    await db.insert(auctions).values({
      id: auctionArchiveId,
      slug: `lots-archive-${ts}`,
      title: 'Archive Auction',
      description: 'Archived auction',
      category: 'mixed',
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() - 3600000),
      location: 'Krakow',
      curator: 'Curator B',
      status: 'archive',
      visibilityLevel: '0',
      buyersPremiumRate: '0.2000',
      sortOrder: 2,
    });

    // Draft auction (should be hidden from public queries)
    auctionDraftId = randomUUID();
    await db.insert(auctions).values({
      id: auctionDraftId,
      slug: `lots-draft-${ts}`,
      title: 'Draft Auction',
      description: 'Draft auction',
      category: 'mixed',
      startDate: new Date(Date.now() + 86400000),
      endDate: new Date(Date.now() + 172800000),
      location: 'Gdansk',
      curator: 'Curator C',
      status: 'draft',
      visibilityLevel: '0',
      buyersPremiumRate: '0.2000',
      sortOrder: 3,
    });

    // VIP auction (visibilityLevel '2')
    auctionVipId = randomUUID();
    await db.insert(auctions).values({
      id: auctionVipId,
      slug: `lots-vip-${ts}`,
      title: 'VIP Auction',
      description: 'VIP only auction',
      category: 'mixed',
      startDate: new Date(Date.now() - 3600000),
      endDate: new Date(Date.now() + 3600000),
      location: 'Poznan',
      curator: 'Curator D',
      status: 'live',
      visibilityLevel: '2',
      buyersPremiumRate: '0.1500',
      sortOrder: 4,
    });

    // --- Lots ---

    // Active lot in live auction (painting, Artist Alpha)
    lotActiveId = randomUUID();
    await db.insert(lots).values({
      id: lotActiveId,
      auctionId: auctionLiveId,
      lotNumber: 1,
      title: 'Beautiful Painting',
      artist: 'Artist Alpha',
      description: 'A stunning oil painting',
      medium: 'Oil on canvas',
      dimensions: '60x80',
      status: 'active',
      category: 'malarstwo',
      estimateMin: 5000,
      estimateMax: 10000,
      startingBid: 4000,
      sortOrder: 1,
    });

    // Second active lot in live auction (sculpture, Artist Beta)
    lotActive2Id = randomUUID();
    await db.insert(lots).values({
      id: lotActive2Id,
      auctionId: auctionLiveId,
      lotNumber: 2,
      title: 'Bronze Sculpture',
      artist: 'Artist Beta',
      description: 'A fine bronze sculpture',
      medium: 'Bronze',
      dimensions: '30x40x20',
      status: 'active',
      category: 'rzezba',
      estimateMin: 8000,
      estimateMax: 15000,
      startingBid: 7000,
      sortOrder: 2,
    });

    // Sold lot in archive auction
    lotSoldId = randomUUID();
    await db.insert(lots).values({
      id: lotSoldId,
      auctionId: auctionArchiveId,
      lotNumber: 1,
      title: 'Sold Artwork',
      artist: 'Artist Alpha',
      description: 'An artwork that was sold',
      medium: 'Watercolor',
      dimensions: '40x50',
      status: 'sold',
      category: 'malarstwo',
      estimateMin: 3000,
      estimateMax: 6000,
      hammerPrice: 5500,
      startingBid: 2000,
      sortOrder: 1,
    });

    // Withdrawn lot in live auction
    lotWithdrawnId = randomUUID();
    await db.insert(lots).values({
      id: lotWithdrawnId,
      auctionId: auctionLiveId,
      lotNumber: 3,
      title: 'Withdrawn Piece',
      artist: 'Artist Gamma',
      description: 'Withdrawn',
      medium: 'Acrylic',
      dimensions: '50x70',
      status: 'withdrawn',
      sortOrder: 3,
    });

    // Draft lot in live auction (should not be visible to public)
    lotDraftId = randomUUID();
    await db.insert(lots).values({
      id: lotDraftId,
      auctionId: auctionLiveId,
      lotNumber: 4,
      title: 'Draft Lot',
      artist: 'Artist Delta',
      description: 'Not yet published',
      medium: 'Oil',
      dimensions: '20x30',
      status: 'draft',
      sortOrder: 4,
    });

    // VIP lot (in VIP auction)
    lotVipId = randomUUID();
    await db.insert(lots).values({
      id: lotVipId,
      auctionId: auctionVipId,
      lotNumber: 1,
      title: 'VIP Exclusive',
      artist: 'Artist Epsilon',
      description: 'A VIP-only piece',
      medium: 'Mixed media',
      dimensions: '100x120',
      status: 'active',
      category: 'inne',
      estimateMin: 50000,
      estimateMax: 100000,
      sortOrder: 1,
    });

    // --- Media ---

    // Primary image for lotActiveId
    mediaId = randomUUID();
    await db.insert(media).values({
      id: mediaId,
      lotId: lotActiveId,
      url: 'https://example.com/painting.jpg',
      thumbnailUrl: 'https://example.com/painting-thumb.jpg',
      isPrimary: true,
      sortOrder: 0,
    });

    // Non-primary media for lotActiveId
    media2Id = randomUUID();
    await db.insert(media).values({
      id: media2Id,
      lotId: lotActiveId,
      url: 'https://example.com/painting-side.jpg',
      thumbnailUrl: 'https://example.com/painting-side-thumb.jpg',
      isPrimary: false,
      sortOrder: 1,
    });

    // --- Bids ---

    bidId = randomUUID();
    await db.insert(bids).values({
      id: bidId,
      lotId: lotActiveId,
      userId,
      amount: 5000,
      bidType: 'online',
      isWinning: true,
    });

    // --- Translation for lotActiveId (English) ---
    translationId = randomUUID();
    await db.insert(lotTranslations).values({
      id: translationId,
      lotId: lotActiveId,
      locale: 'en',
      title: 'Beautiful Painting (EN)',
      description: 'A stunning oil painting (EN)',
      medium: 'Oil on canvas (EN)',
      provenance: ['Private collection, London'],
      exhibitions: ['Tate Modern 2024'],
      conditionNotes: 'Excellent condition',
    });
  });

  afterAll(async () => {
    const { auctions, lots, media, bids, users, lotTranslations } = await import('@/db/schema');
    const { eq, inArray } = await import('drizzle-orm');

    // Clean up in reverse dependency order
    await db.delete(lotTranslations).where(eq(lotTranslations.id, translationId)).catch(() => {});
    await db.delete(bids).where(eq(bids.id, bidId)).catch(() => {});
    await db.delete(media).where(inArray(media.id, [mediaId, media2Id])).catch(() => {});
    await db.delete(lots).where(
      inArray(lots.id, [lotActiveId, lotActive2Id, lotSoldId, lotWithdrawnId, lotDraftId, lotVipId]),
    ).catch(() => {});
    await db.delete(auctions).where(
      inArray(auctions.id, [auctionLiveId, auctionArchiveId, auctionDraftId, auctionVipId]),
    ).catch(() => {});
    await db.delete(users).where(eq(users.id, userId)).catch(() => {});
  });

  // ─── getLotsByAuction ────────────────────────────────────────────────────────

  describe('getLotsByAuction', () => {
    it('returns lots for a given auction ordered by sortOrder', async () => {
      const result = await getLotsByAuction(auctionLiveId, 0);
      expect(Array.isArray(result)).toBe(true);
      // Should include active and withdrawn, but NOT draft/catalogued
      const ids = result.map((r) => r.id);
      expect(ids).toContain(lotActiveId);
      expect(ids).toContain(lotActive2Id);
      expect(ids).not.toContain(lotDraftId);
    });

    it('includes primaryImageUrl and primaryThumbnailUrl', async () => {
      const result = await getLotsByAuction(auctionLiveId, 0);
      const lot = result.find((r) => r.id === lotActiveId);
      expect(lot).toBeDefined();
      expect(lot!.primaryImageUrl).toBe('https://example.com/painting.jpg');
      expect(lot!.primaryThumbnailUrl).toBe('https://example.com/painting-thumb.jpg');
    });

    it('returns null primaryImageUrl for lots without media', async () => {
      const result = await getLotsByAuction(auctionLiveId, 0);
      const lot = result.find((r) => r.id === lotActive2Id);
      expect(lot).toBeDefined();
      expect(lot!.primaryImageUrl).toBeNull();
    });

    it('returns empty array for non-existent auction', async () => {
      const { randomUUID } = await import('crypto');
      const result = await getLotsByAuction(randomUUID(), 0);
      expect(result).toEqual([]);
    });

    it('filters by visibility level: public user cannot see VIP auction lots', async () => {
      const result = await getLotsByAuction(auctionVipId, 0);
      expect(result).toEqual([]);
    });

    it('VIP user can see VIP auction lots', async () => {
      const result = await getLotsByAuction(auctionVipId, 2);
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some((r) => r.id === lotVipId)).toBe(true);
    });

    it('does not return lots from draft auctions', async () => {
      const result = await getLotsByAuction(auctionDraftId, 0);
      expect(result).toEqual([]);
    });
  });

  // ─── getLotById ──────────────────────────────────────────────────────────────

  describe('getLotById', () => {
    it('returns lot with auction info, media, and bid stats', async () => {
      const result = await getLotById(lotActiveId, 0);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(lotActiveId);
      expect(result!.auctionSlug).toBe(`lots-live-${ts}`);
      expect(result!.auctionTitle).toBe('Live Auction');
      expect(Array.isArray(result!.media)).toBe(true);
      // Two media items (primary + non-primary), both non-deleted
      expect(result!.media.length).toBe(2);
    });

    it('includes bid count and highest bid', async () => {
      const result = await getLotById(lotActiveId, 0);
      expect(result).not.toBeNull();
      expect(result!.bidCount).toBe(1);
      expect(result!.highestBid).toBe(5000);
    });

    it('returns bidCount 0 and highestBid null when no bids exist', async () => {
      const result = await getLotById(lotActive2Id, 0);
      expect(result).not.toBeNull();
      expect(result!.bidCount).toBe(0);
      expect(result!.highestBid).toBeNull();
    });

    it('returns null for non-existent lot', async () => {
      const { randomUUID } = await import('crypto');
      const result = await getLotById(randomUUID(), 0);
      expect(result).toBeNull();
    });

    it('returns null for draft lot (visibility filter)', async () => {
      const result = await getLotById(lotDraftId, 0);
      expect(result).toBeNull();
    });

    it('public user cannot see VIP lot', async () => {
      const result = await getLotById(lotVipId, 0);
      expect(result).toBeNull();
    });

    it('VIP user can see VIP lot', async () => {
      const result = await getLotById(lotVipId, 2);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(lotVipId);
    });

    it('overlays English translation when locale="en"', async () => {
      const result = await getLotById(lotActiveId, 0, 'en');
      expect(result).not.toBeNull();
      expect(result!.title).toBe('Beautiful Painting (EN)');
      expect(result!.description).toBe('A stunning oil painting (EN)');
      expect(result!.medium).toBe('Oil on canvas (EN)');
      expect(result!.conditionNotes).toBe('Excellent condition');
    });

    it('overlays translation provenance and exhibitions when available', async () => {
      const result = await getLotById(lotActiveId, 0, 'en');
      expect(result).not.toBeNull();
      expect(result!.provenance).toEqual(['Private collection, London']);
      expect(result!.exhibitions).toEqual(['Tate Modern 2024']);
    });

    it('returns Polish base lot when locale="pl"', async () => {
      const result = await getLotById(lotActiveId, 0, 'pl');
      expect(result).not.toBeNull();
      expect(result!.title).toBe('Beautiful Painting');
    });

    it('returns base lot when translation for locale does not exist', async () => {
      const result = await getLotById(lotActiveId, 0, 'de');
      expect(result).not.toBeNull();
      expect(result!.title).toBe('Beautiful Painting');
    });
  });

  // ─── getLotByAuctionAndNumber ────────────────────────────────────────────────

  describe('getLotByAuctionAndNumber', () => {
    it('returns lot by auction slug and lot number', async () => {
      const result = await getLotByAuctionAndNumber(`lots-live-${ts}`, 1, 0);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(lotActiveId);
      expect(result!.auctionSlug).toBe(`lots-live-${ts}`);
      expect(result!.auctionTitle).toBe('Live Auction');
    });

    it('includes media ordered by sortOrder', async () => {
      const result = await getLotByAuctionAndNumber(`lots-live-${ts}`, 1, 0);
      expect(result).not.toBeNull();
      expect(Array.isArray(result!.media)).toBe(true);
      expect(result!.media.length).toBe(2);
      // Check sortOrder — primary (0) before non-primary (1)
      expect(result!.media[0].sortOrder).toBeLessThanOrEqual(result!.media[1].sortOrder);
    });

    it('includes bid stats', async () => {
      const result = await getLotByAuctionAndNumber(`lots-live-${ts}`, 1, 0);
      expect(result).not.toBeNull();
      expect(result!.bidCount).toBe(1);
      expect(result!.highestBid).toBe(5000);
    });

    it('returns null for non-existent lot number', async () => {
      const result = await getLotByAuctionAndNumber(`lots-live-${ts}`, 999, 0);
      expect(result).toBeNull();
    });

    it('returns null for non-existent auction slug', async () => {
      const result = await getLotByAuctionAndNumber('non-existent-slug', 1, 0);
      expect(result).toBeNull();
    });

    it('respects visibility: public user cannot see VIP lot', async () => {
      const result = await getLotByAuctionAndNumber(`lots-vip-${ts}`, 1, 0);
      expect(result).toBeNull();
    });

    it('VIP user can see VIP lot by auction and number', async () => {
      const result = await getLotByAuctionAndNumber(`lots-vip-${ts}`, 1, 2);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(lotVipId);
    });
  });

  // ─── searchLots ──────────────────────────────────────────────────────────────

  describe('searchLots', () => {
    it('returns paginated search results with matching lots', async () => {
      const result = await searchLots({
        query: 'Beautiful Painting',
        userVisibility: 0,
      });
      expect(result).toHaveProperty('lots');
      expect(result).toHaveProperty('pagination');
      expect(result.pagination).toHaveProperty('page', 1);
      expect(result.pagination).toHaveProperty('limit', 20);
      expect(result.pagination).toHaveProperty('total');
      expect(result.pagination).toHaveProperty('pages');
    });

    it('finds lots by title', async () => {
      const result = await searchLots({
        query: 'Beautiful Painting',
        userVisibility: 0,
      });
      const ids = result.lots.map((l) => l.id);
      expect(ids).toContain(lotActiveId);
    });

    it('finds lots by artist name', async () => {
      const result = await searchLots({
        query: 'Artist Beta',
        userVisibility: 0,
      });
      const ids = result.lots.map((l) => l.id);
      expect(ids).toContain(lotActive2Id);
    });

    it('returns empty results for no-match query', async () => {
      const result = await searchLots({
        query: 'zzNonExistentQuery999zz',
        userVisibility: 0,
      });
      expect(result.lots.length).toBe(0);
      expect(result.pagination.total).toBe(0);
    });

    it('filters by auctionId', async () => {
      const result = await searchLots({
        query: '',
        userVisibility: 0,
        auctionId: auctionLiveId,
      });
      // All results belong to live auction
      result.lots.forEach((lot) => {
        expect(lot.auctionId).toBe(auctionLiveId);
      });
    });

    it('filters by category', async () => {
      const result = await searchLots({
        query: '',
        userVisibility: 0,
        categories: ['rzezba'],
      });
      result.lots.forEach((lot) => {
        expect(lot.category).toBe('rzezba');
      });
      expect(result.lots.some((l) => l.id === lotActive2Id)).toBe(true);
    });

    it('filters by estimateMin', async () => {
      const result = await searchLots({
        query: '',
        userVisibility: 0,
        estimateMin: 7000,
      });
      // Only lots with estimateMin >= 7000
      result.lots.forEach((lot) => {
        expect(lot.estimateMin).toBeGreaterThanOrEqual(7000);
      });
    });

    it('filters by estimateMax', async () => {
      const result = await searchLots({
        query: '',
        userVisibility: 0,
        estimateMax: 12000,
      });
      result.lots.forEach((lot) => {
        expect(lot.estimateMax).toBeLessThanOrEqual(12000);
      });
    });

    it('respects pagination page and limit', async () => {
      const result = await searchLots({
        query: '',
        userVisibility: 0,
        page: 1,
        limit: 1,
      });
      expect(result.lots.length).toBeLessThanOrEqual(1);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(1);
    });

    it('sorts by estimate_asc', async () => {
      const result = await searchLots({
        query: '',
        userVisibility: 0,
        auctionId: auctionLiveId,
        sortBy: 'estimate_asc',
      });
      if (result.lots.length >= 2) {
        expect(result.lots[0].estimateMin).toBeLessThanOrEqual(result.lots[1].estimateMin);
      }
    });

    it('sorts by estimate_desc', async () => {
      const result = await searchLots({
        query: '',
        userVisibility: 0,
        auctionId: auctionLiveId,
        sortBy: 'estimate_desc',
      });
      if (result.lots.length >= 2) {
        expect(result.lots[0].estimateMin).toBeGreaterThanOrEqual(result.lots[1].estimateMin);
      }
    });

    it('includes auctionSlug, auctionTitle, primaryImageUrl', async () => {
      const result = await searchLots({
        query: 'Beautiful',
        userVisibility: 0,
      });
      const lot = result.lots.find((l) => l.id === lotActiveId);
      expect(lot).toBeDefined();
      expect(lot!.auctionSlug).toBe(`lots-live-${ts}`);
      expect(lot!.auctionTitle).toBe('Live Auction');
      expect(lot!.primaryImageUrl).toBe('https://example.com/painting.jpg');
      expect(lot!.primaryThumbnailUrl).toBe('https://example.com/painting-thumb.jpg');
    });

    it('does not return VIP lots to public user', async () => {
      const result = await searchLots({
        query: 'VIP Exclusive',
        userVisibility: 0,
      });
      const ids = result.lots.map((l) => l.id);
      expect(ids).not.toContain(lotVipId);
    });

    it('VIP user can find VIP lots via search', async () => {
      const result = await searchLots({
        query: 'VIP Exclusive',
        userVisibility: 2,
      });
      const ids = result.lots.map((l) => l.id);
      expect(ids).toContain(lotVipId);
    });

    it('does not return draft lots', async () => {
      const result = await searchLots({
        query: 'Draft Lot',
        userVisibility: 2,
      });
      const ids = result.lots.map((l) => l.id);
      expect(ids).not.toContain(lotDraftId);
    });
  });

  // ─── getSoldLots ─────────────────────────────────────────────────────────────

  describe('getSoldLots', () => {
    it('returns sold lots with pagination', async () => {
      const result = await getSoldLots({});
      expect(result).toHaveProperty('lots');
      expect(result).toHaveProperty('pagination');
      expect(Array.isArray(result.lots)).toBe(true);
      expect(result.pagination).toHaveProperty('page', 1);
      expect(result.pagination).toHaveProperty('limit', 24);
    });

    it('only returns lots with status=sold in reconciliation/archive auctions', async () => {
      const result = await getSoldLots({});
      result.lots.forEach((lot) => {
        expect(lot.status).toBe('sold');
      });
      // Our sold lot should be present
      expect(result.lots.some((l) => l.id === lotSoldId)).toBe(true);
    });

    it('does not return active lots (non-sold)', async () => {
      const result = await getSoldLots({});
      const ids = result.lots.map((l) => l.id);
      expect(ids).not.toContain(lotActiveId);
      expect(ids).not.toContain(lotActive2Id);
    });

    it('filters by artistQuery', async () => {
      const result = await getSoldLots({ artistQuery: 'Artist Alpha' });
      result.lots.forEach((lot) => {
        expect(lot.artist.toLowerCase()).toContain('artist alpha');
      });
      expect(result.lots.some((l) => l.id === lotSoldId)).toBe(true);
    });

    it('filters by auctionId', async () => {
      const result = await getSoldLots({ auctionId: auctionArchiveId });
      result.lots.forEach((lot) => {
        expect(lot.auctionId).toBe(auctionArchiveId);
      });
    });

    it('returns empty when auctionId has no sold lots', async () => {
      const result = await getSoldLots({ auctionId: auctionLiveId });
      // Live auction has no sold lots
      const ourLots = result.lots.filter((l) => l.auctionId === auctionLiveId);
      expect(ourLots.length).toBe(0);
    });

    it('filters by priceMin (hammerPrice)', async () => {
      const result = await getSoldLots({ priceMin: 5000 });
      result.lots.forEach((lot) => {
        expect(lot.hammerPrice).toBeGreaterThanOrEqual(5000);
      });
    });

    it('filters by priceMax (hammerPrice)', async () => {
      const result = await getSoldLots({ priceMax: 6000 });
      result.lots.forEach((lot) => {
        expect(lot.hammerPrice).toBeLessThanOrEqual(6000);
      });
    });

    it('filters by categories', async () => {
      const result = await getSoldLots({ categories: ['malarstwo'] });
      result.lots.forEach((lot) => {
        expect(lot.category).toBe('malarstwo');
      });
    });

    it('includes auctionSlug, auctionTitle, auctionEndDate', async () => {
      const result = await getSoldLots({ auctionId: auctionArchiveId });
      const sold = result.lots.find((l) => l.id === lotSoldId);
      expect(sold).toBeDefined();
      expect(sold!.auctionSlug).toBe(`lots-archive-${ts}`);
      expect(sold!.auctionTitle).toBe('Archive Auction');
      expect(sold!.auctionEndDate).toBeDefined();
    });

    it('respects pagination', async () => {
      const result = await getSoldLots({ page: 1, limit: 1 });
      expect(result.lots.length).toBeLessThanOrEqual(1);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(1);
    });
  });

  // ─── getAuctionsForResults ───────────────────────────────────────────────────

  describe('getAuctionsForResults', () => {
    it('returns auctions with reconciliation or archive status', async () => {
      const result = await getAuctionsForResults();
      expect(Array.isArray(result)).toBe(true);
      // Our archive auction should be present
      expect(result.some((a) => a.id === auctionArchiveId)).toBe(true);
    });

    it('does not include live or draft auctions', async () => {
      const result = await getAuctionsForResults();
      const ids = result.map((a) => a.id);
      expect(ids).not.toContain(auctionLiveId);
      expect(ids).not.toContain(auctionDraftId);
    });

    it('returns id, slug, title, endDate for each auction', async () => {
      const result = await getAuctionsForResults();
      const archive = result.find((a) => a.id === auctionArchiveId);
      expect(archive).toBeDefined();
      expect(archive!.slug).toBe(`lots-archive-${ts}`);
      expect(archive!.title).toBe('Archive Auction');
      expect(archive!.endDate).toBeDefined();
    });

    it('orders by endDate descending', async () => {
      const result = await getAuctionsForResults();
      for (let i = 1; i < result.length; i++) {
        const prev = new Date(result[i - 1].endDate).getTime();
        const curr = new Date(result[i].endDate).getTime();
        expect(prev).toBeGreaterThanOrEqual(curr);
      }
    });

    it('does not include soft-deleted auctions', async () => {
      const { auctions } = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');

      // Soft-delete the archive auction
      await db.update(auctions).set({ deletedAt: new Date() }).where(eq(auctions.id, auctionArchiveId));

      const result = await getAuctionsForResults();
      expect(result.some((a) => a.id === auctionArchiveId)).toBe(false);

      // Restore
      await db.update(auctions).set({ deletedAt: null }).where(eq(auctions.id, auctionArchiveId));
    });
  });

  // ─── getDistinctArtists ──────────────────────────────────────────────────────

  describe('getDistinctArtists', () => {
    it('returns distinct artist names', async () => {
      const result = await getDistinctArtists();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(1);
      // All entries should be strings
      result.forEach((artist) => {
        expect(typeof artist).toBe('string');
      });
    });

    it('includes artists from our test data', async () => {
      const result = await getDistinctArtists();
      expect(result).toContain('Artist Alpha');
      expect(result).toContain('Artist Beta');
    });

    it('filters by query (case insensitive)', async () => {
      const result = await getDistinctArtists('alpha');
      expect(result).toContain('Artist Alpha');
      expect(result).not.toContain('Artist Beta');
    });

    it('returns empty for non-matching query', async () => {
      const result = await getDistinctArtists('zzNonExistent999zz');
      expect(result).toEqual([]);
    });

    it('limits results to 20', async () => {
      const result = await getDistinctArtists();
      expect(result.length).toBeLessThanOrEqual(20);
    });

    it('returns alphabetically sorted results', async () => {
      const result = await getDistinctArtists();
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].localeCompare(result[i])).toBeLessThanOrEqual(0);
      }
    });

    it('does not include artists from soft-deleted lots', async () => {
      const { lots } = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');

      // Soft-delete a lot with unique artist
      await db.update(lots).set({ deletedAt: new Date() }).where(eq(lots.id, lotWithdrawnId));

      const result = await getDistinctArtists('Artist Gamma');
      expect(result).not.toContain('Artist Gamma');

      // Restore
      await db.update(lots).set({ deletedAt: null }).where(eq(lots.id, lotWithdrawnId));
    });
  });
});
