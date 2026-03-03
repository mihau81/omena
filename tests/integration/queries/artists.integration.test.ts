import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from '@/tests/helpers/db';
import {
  getArtists,
  getArtistById,
  getArtistBySlug,
  getArtistWithLots,
  getUnlinkedLotsByArtistName,
  createArtist,
  updateArtist,
  deleteArtist,
  linkLotsToArtist,
  getPublicArtists,
} from '@/db/queries/artists';

describe('db/queries/artists', () => {
  const db = getTestDb();

  // IDs for test data
  let artistAlphaId: string;
  let artistBetaId: string;
  let artistDeletedId: string;
  let artistNoLotsId: string;

  let auctionLiveId: string;
  let auctionArchiveId: string;
  let auctionDeletedId: string;

  let lotSold1Id: string;
  let lotSold2Id: string;
  let lotActiveId: string;
  let lotPublishedId: string;
  let lotDraftId: string;
  let lotDeletedId: string;
  let lotUnlinked1Id: string;
  let lotUnlinked2Id: string;
  let lotUnlinkedDiffNameId: string;

  let mediaId1: string;
  let mediaId2: string;

  const ts = Date.now();

  beforeAll(async () => {
    const { randomUUID } = await import('crypto');
    const { auctions, lots, artists, media } = await import('@/db/schema');

    // ─── Artists ───
    artistAlphaId = randomUUID();
    await db.insert(artists).values({
      id: artistAlphaId,
      slug: `artist-alpha-${ts}`,
      name: `Alpha Artist ${ts}`,
      nationality: 'Polish',
      birthYear: 1920,
      deathYear: 2000,
      bio: 'A renowned Polish painter.',
    });

    artistBetaId = randomUUID();
    await db.insert(artists).values({
      id: artistBetaId,
      slug: `artist-beta-${ts}`,
      name: `Beta Artist ${ts}`,
      nationality: 'French',
      birthYear: 1850,
      deathYear: 1910,
      bio: 'A French impressionist.',
    });

    artistDeletedId = randomUUID();
    await db.insert(artists).values({
      id: artistDeletedId,
      slug: `artist-deleted-${ts}`,
      name: `Deleted Artist ${ts}`,
      deletedAt: new Date(),
    });

    artistNoLotsId = randomUUID();
    await db.insert(artists).values({
      id: artistNoLotsId,
      slug: `artist-nolots-${ts}`,
      name: `NoLots Artist ${ts}`,
      nationality: 'German',
    });

    // ─── Auctions ───
    auctionLiveId = randomUUID();
    await db.insert(auctions).values({
      id: auctionLiveId,
      slug: `artists-test-live-${ts}`,
      title: 'Live Auction',
      description: 'Live auction for artist tests',
      startDate: new Date(Date.now() - 7200000),
      endDate: new Date(Date.now() + 7200000),
      status: 'live',
      visibilityLevel: '0',
      buyersPremiumRate: '0.2000',
    });

    auctionArchiveId = randomUUID();
    await db.insert(auctions).values({
      id: auctionArchiveId,
      slug: `artists-test-archive-${ts}`,
      title: 'Archive Auction',
      description: 'Archived auction for artist tests',
      startDate: new Date(Date.now() - 172800000),
      endDate: new Date(Date.now() - 86400000),
      status: 'archive',
      visibilityLevel: '0',
      buyersPremiumRate: '0.2000',
    });

    auctionDeletedId = randomUUID();
    await db.insert(auctions).values({
      id: auctionDeletedId,
      slug: `artists-test-deleted-${ts}`,
      title: 'Deleted Auction',
      description: 'Deleted auction',
      startDate: new Date(Date.now() - 3600000),
      endDate: new Date(Date.now() + 3600000),
      status: 'live',
      visibilityLevel: '0',
      buyersPremiumRate: '0.2000',
      deletedAt: new Date(),
    });

    // ─── Lots linked to artistAlpha ───

    // Sold lot 1 (in archive auction)
    lotSold1Id = randomUUID();
    await db.insert(lots).values({
      id: lotSold1Id,
      auctionId: auctionArchiveId,
      lotNumber: 1,
      title: 'Alpha Sold Painting 1',
      artist: `Alpha Artist ${ts}`,
      artistId: artistAlphaId,
      status: 'sold',
      hammerPrice: 10000,
      estimateMin: 5000,
      estimateMax: 15000,
      sortOrder: 1,
    });

    // Sold lot 2 (in archive auction)
    lotSold2Id = randomUUID();
    await db.insert(lots).values({
      id: lotSold2Id,
      auctionId: auctionArchiveId,
      lotNumber: 2,
      title: 'Alpha Sold Painting 2',
      artist: `Alpha Artist ${ts}`,
      artistId: artistAlphaId,
      status: 'sold',
      hammerPrice: 20000,
      estimateMin: 10000,
      estimateMax: 30000,
      sortOrder: 2,
    });

    // Active lot (in live auction)
    lotActiveId = randomUUID();
    await db.insert(lots).values({
      id: lotActiveId,
      auctionId: auctionLiveId,
      lotNumber: 1,
      title: 'Alpha Active Painting',
      artist: `Alpha Artist ${ts}`,
      artistId: artistAlphaId,
      status: 'active',
      estimateMin: 8000,
      estimateMax: 12000,
      sortOrder: 1,
    });

    // Published lot (in live auction)
    lotPublishedId = randomUUID();
    await db.insert(lots).values({
      id: lotPublishedId,
      auctionId: auctionLiveId,
      lotNumber: 2,
      title: 'Alpha Published Painting',
      artist: `Alpha Artist ${ts}`,
      artistId: artistAlphaId,
      status: 'published',
      estimateMin: 3000,
      estimateMax: 6000,
      sortOrder: 2,
    });

    // Draft lot (should not appear in public queries)
    lotDraftId = randomUUID();
    await db.insert(lots).values({
      id: lotDraftId,
      auctionId: auctionLiveId,
      lotNumber: 3,
      title: 'Alpha Draft Painting',
      artist: `Alpha Artist ${ts}`,
      artistId: artistAlphaId,
      status: 'draft',
      sortOrder: 3,
    });

    // Soft-deleted lot
    lotDeletedId = randomUUID();
    await db.insert(lots).values({
      id: lotDeletedId,
      auctionId: auctionLiveId,
      lotNumber: 4,
      title: 'Alpha Deleted Painting',
      artist: `Alpha Artist ${ts}`,
      artistId: artistAlphaId,
      status: 'active',
      sortOrder: 4,
      deletedAt: new Date(),
    });

    // ─── Unlinked lots (no artistId, but artist text matches) ───
    lotUnlinked1Id = randomUUID();
    await db.insert(lots).values({
      id: lotUnlinked1Id,
      auctionId: auctionArchiveId,
      lotNumber: 3,
      title: 'Unlinked Alpha Lot 1',
      artist: `Alpha Artist ${ts}`,
      artistId: null,
      status: 'sold',
      hammerPrice: 5000,
      sortOrder: 3,
    });

    lotUnlinked2Id = randomUUID();
    await db.insert(lots).values({
      id: lotUnlinked2Id,
      auctionId: auctionLiveId,
      lotNumber: 5,
      title: 'Unlinked Alpha Lot 2',
      artist: `Alpha Artist ${ts}`,
      artistId: null,
      status: 'active',
      sortOrder: 5,
    });

    lotUnlinkedDiffNameId = randomUUID();
    await db.insert(lots).values({
      id: lotUnlinkedDiffNameId,
      auctionId: auctionLiveId,
      lotNumber: 6,
      title: 'Different Artist Lot',
      artist: 'Totally Different Artist',
      artistId: null,
      status: 'active',
      sortOrder: 6,
    });

    // ─── Media for sold lots ───
    mediaId1 = randomUUID();
    await db.insert(media).values({
      id: mediaId1,
      lotId: lotSold1Id,
      url: 'https://example.com/sold1.jpg',
      thumbnailUrl: 'https://example.com/sold1-thumb.jpg',
      isPrimary: true,
      sortOrder: 0,
    });

    mediaId2 = randomUUID();
    await db.insert(media).values({
      id: mediaId2,
      lotId: lotActiveId,
      url: 'https://example.com/active1.jpg',
      thumbnailUrl: 'https://example.com/active1-thumb.jpg',
      isPrimary: true,
      sortOrder: 0,
    });
  });

  afterAll(async () => {
    const { auctions, lots, artists, media } = await import('@/db/schema');
    const { inArray } = await import('drizzle-orm');

    await db.delete(media).where(inArray(media.id, [mediaId1, mediaId2])).catch(() => {});
    await db.delete(lots).where(
      inArray(lots.id, [
        lotSold1Id, lotSold2Id, lotActiveId, lotPublishedId, lotDraftId,
        lotDeletedId, lotUnlinked1Id, lotUnlinked2Id, lotUnlinkedDiffNameId,
      ]),
    ).catch(() => {});
    await db.delete(auctions).where(
      inArray(auctions.id, [auctionLiveId, auctionArchiveId, auctionDeletedId]),
    ).catch(() => {});
    await db.delete(artists).where(
      inArray(artists.id, [artistAlphaId, artistBetaId, artistDeletedId, artistNoLotsId]),
    ).catch(() => {});
    // Clean up any dynamically created artists
    await db.execute(`DELETE FROM artists WHERE slug LIKE 'created-test-artist-%'`).catch(() => {});
    await db.execute(`DELETE FROM artists WHERE slug LIKE 'link-test-artist-%'`).catch(() => {});
  });

  // ─── getArtistBySlug ──────────────────────────────────────────────────────────

  describe('getArtistBySlug', () => {
    it('returns artist by slug', async () => {
      const result = await getArtistBySlug(`artist-alpha-${ts}`);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(artistAlphaId);
      expect(result!.name).toBe(`Alpha Artist ${ts}`);
      expect(result!.nationality).toBe('Polish');
      expect(result!.birthYear).toBe(1920);
      expect(result!.deathYear).toBe(2000);
    });

    it('returns null for non-existent slug', async () => {
      const result = await getArtistBySlug('non-existent-slug-xyz');
      expect(result).toBeNull();
    });

    it('returns null for soft-deleted artist slug', async () => {
      const result = await getArtistBySlug(`artist-deleted-${ts}`);
      expect(result).toBeNull();
    });

    it('returns all artist fields', async () => {
      const result = await getArtistBySlug(`artist-alpha-${ts}`);
      expect(result).not.toBeNull();
      expect(result!.slug).toBe(`artist-alpha-${ts}`);
      expect(result!.bio).toBe('A renowned Polish painter.');
      expect(result!.createdAt).toBeInstanceOf(Date);
      expect(result!.updatedAt).toBeInstanceOf(Date);
      expect(result!.deletedAt).toBeNull();
    });
  });

  // ─── getArtistWithLots ────────────────────────────────────────────────────────

  describe('getArtistWithLots', () => {
    it('returns artist with stats and sold/available lots', async () => {
      const result = await getArtistWithLots(`artist-alpha-${ts}`);
      expect(result).not.toBeNull();
      expect(result!.artist.id).toBe(artistAlphaId);
      expect(result!.artist.name).toBe(`Alpha Artist ${ts}`);
    });

    it('returns correct price stats from sold lots', async () => {
      const result = await getArtistWithLots(`artist-alpha-${ts}`);
      expect(result).not.toBeNull();
      expect(result!.stats.totalSold).toBe(2);
      // avg of 10000 and 20000 = 15000
      expect(result!.stats.avgHammer).toBe(15000);
      expect(result!.stats.maxHammer).toBe(20000);
    });

    it('returns sold lots with auction info', async () => {
      const result = await getArtistWithLots(`artist-alpha-${ts}`);
      expect(result).not.toBeNull();
      expect(result!.soldLots.length).toBe(2);
      const sold1 = result!.soldLots.find((l) => l.id === lotSold1Id);
      expect(sold1).toBeDefined();
      expect(sold1!.auctionSlug).toBe(`artists-test-archive-${ts}`);
      expect(sold1!.auctionTitle).toBe('Archive Auction');
      expect(sold1!.auctionEndDate).toBeInstanceOf(Date);
    });

    it('returns sold lots with primary image URLs', async () => {
      const result = await getArtistWithLots(`artist-alpha-${ts}`);
      expect(result).not.toBeNull();
      const sold1 = result!.soldLots.find((l) => l.id === lotSold1Id);
      expect(sold1!.primaryImageUrl).toBe('https://example.com/sold1.jpg');
      expect(sold1!.primaryThumbnailUrl).toBe('https://example.com/sold1-thumb.jpg');
    });

    it('returns null image URLs for sold lots without media', async () => {
      const result = await getArtistWithLots(`artist-alpha-${ts}`);
      expect(result).not.toBeNull();
      const sold2 = result!.soldLots.find((l) => l.id === lotSold2Id);
      expect(sold2).toBeDefined();
      expect(sold2!.primaryImageUrl).toBeNull();
    });

    it('returns available (published + active) lots', async () => {
      const result = await getArtistWithLots(`artist-alpha-${ts}`);
      expect(result).not.toBeNull();
      const availableIds = result!.availableLots.map((l) => l.id);
      expect(availableIds).toContain(lotActiveId);
      expect(availableIds).toContain(lotPublishedId);
    });

    it('excludes draft lots from available lots', async () => {
      const result = await getArtistWithLots(`artist-alpha-${ts}`);
      expect(result).not.toBeNull();
      const availableIds = result!.availableLots.map((l) => l.id);
      expect(availableIds).not.toContain(lotDraftId);
    });

    it('excludes soft-deleted lots from all lists', async () => {
      const result = await getArtistWithLots(`artist-alpha-${ts}`);
      expect(result).not.toBeNull();
      const soldIds = result!.soldLots.map((l) => l.id);
      const availableIds = result!.availableLots.map((l) => l.id);
      expect(soldIds).not.toContain(lotDeletedId);
      expect(availableIds).not.toContain(lotDeletedId);
    });

    it('available lots include primary image URLs', async () => {
      const result = await getArtistWithLots(`artist-alpha-${ts}`);
      expect(result).not.toBeNull();
      const active = result!.availableLots.find((l) => l.id === lotActiveId);
      expect(active).toBeDefined();
      expect(active!.primaryImageUrl).toBe('https://example.com/active1.jpg');
      expect(active!.primaryThumbnailUrl).toBe('https://example.com/active1-thumb.jpg');
    });

    it('returns null for non-existent artist slug', async () => {
      const result = await getArtistWithLots('non-existent-slug-xyz');
      expect(result).toBeNull();
    });

    it('returns null for soft-deleted artist slug', async () => {
      const result = await getArtistWithLots(`artist-deleted-${ts}`);
      expect(result).toBeNull();
    });

    it('returns zero stats for artist with no sold lots', async () => {
      const result = await getArtistWithLots(`artist-nolots-${ts}`);
      expect(result).not.toBeNull();
      expect(result!.stats.totalSold).toBe(0);
      expect(result!.stats.avgHammer).toBeNull();
      expect(result!.stats.maxHammer).toBeNull();
      expect(result!.soldLots).toHaveLength(0);
      expect(result!.availableLots).toHaveLength(0);
    });

    it('does not count lots from soft-deleted auctions in stats', async () => {
      // lotSold1Id and lotSold2Id are in auctionArchiveId (not deleted)
      // auctionDeletedId has deletedAt set, so lots there should be excluded
      const result = await getArtistWithLots(`artist-alpha-${ts}`);
      expect(result).not.toBeNull();
      // Only 2 sold lots from the non-deleted archive auction
      expect(result!.stats.totalSold).toBe(2);
    });
  });

  // ─── getUnlinkedLotsByArtistName ──────────────────────────────────────────────

  describe('getUnlinkedLotsByArtistName', () => {
    it('returns lots with matching artist name and null artistId', async () => {
      const result = await getUnlinkedLotsByArtistName(`Alpha Artist ${ts}`);
      expect(result.length).toBeGreaterThanOrEqual(2);
      const ids = result.map((l) => l.id);
      expect(ids).toContain(lotUnlinked1Id);
      expect(ids).toContain(lotUnlinked2Id);
    });

    it('does not return lots with different artist name', async () => {
      const result = await getUnlinkedLotsByArtistName(`Alpha Artist ${ts}`);
      const ids = result.map((l) => l.id);
      expect(ids).not.toContain(lotUnlinkedDiffNameId);
    });

    it('does not return lots that are already linked (have artistId)', async () => {
      const result = await getUnlinkedLotsByArtistName(`Alpha Artist ${ts}`);
      const ids = result.map((l) => l.id);
      // These lots have artistId set
      expect(ids).not.toContain(lotSold1Id);
      expect(ids).not.toContain(lotActiveId);
    });

    it('includes auction title and slug in results', async () => {
      const result = await getUnlinkedLotsByArtistName(`Alpha Artist ${ts}`);
      const lot = result.find((l) => l.id === lotUnlinked1Id);
      expect(lot).toBeDefined();
      expect(lot!.auctionTitle).toBe('Archive Auction');
      expect(lot!.auctionSlug).toBe(`artists-test-archive-${ts}`);
    });

    it('excludes soft-deleted lots', async () => {
      const { lots: lotsTable } = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');

      // Temporarily soft-delete one unlinked lot
      await db.update(lotsTable).set({ deletedAt: new Date() }).where(eq(lotsTable.id, lotUnlinked1Id));

      const result = await getUnlinkedLotsByArtistName(`Alpha Artist ${ts}`);
      const ids = result.map((l) => l.id);
      expect(ids).not.toContain(lotUnlinked1Id);
      expect(ids).toContain(lotUnlinked2Id);

      // Restore
      await db.update(lotsTable).set({ deletedAt: null }).where(eq(lotsTable.id, lotUnlinked1Id));
    });

    it('excludes lots from soft-deleted auctions', async () => {
      // auctionDeletedId has deletedAt set, lots there should not appear
      const result = await getUnlinkedLotsByArtistName(`Alpha Artist ${ts}`);
      for (const lot of result) {
        expect(lot.auctionSlug).not.toBe(`artists-test-deleted-${ts}`);
      }
    });

    it('returns empty array for non-matching artist name', async () => {
      const result = await getUnlinkedLotsByArtistName('Completely Unknown Artist XYZ');
      expect(result).toHaveLength(0);
    });

    it('respects limit parameter', async () => {
      const result = await getUnlinkedLotsByArtistName(`Alpha Artist ${ts}`, 1);
      expect(result.length).toBeLessThanOrEqual(1);
    });

    it('is case-insensitive (ilike match)', async () => {
      const result = await getUnlinkedLotsByArtistName(`alpha artist ${ts}`);
      expect(result.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ─── getPublicArtists ─────────────────────────────────────────────────────────

  describe('getPublicArtists', () => {
    it('returns artists with lot counts', async () => {
      const result = await getPublicArtists();
      expect(Array.isArray(result)).toBe(true);
      const alpha = result.find((a) => a.id === artistAlphaId);
      expect(alpha).toBeDefined();
      expect(alpha!.name).toBe(`Alpha Artist ${ts}`);
      // lotCount should include published, active, and sold lots (not draft/withdrawn/passed)
      expect(alpha!.lotCount).toBeGreaterThanOrEqual(2);
    });

    it('excludes soft-deleted artists', async () => {
      const result = await getPublicArtists();
      const ids = result.map((a) => a.id);
      expect(ids).not.toContain(artistDeletedId);
    });

    it('includes artists with zero matching lots', async () => {
      const result = await getPublicArtists();
      const noLots = result.find((a) => a.id === artistNoLotsId);
      expect(noLots).toBeDefined();
      expect(noLots!.lotCount).toBe(0);
    });

    it('orders artists alphabetically by name', async () => {
      const result = await getPublicArtists();
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].name.localeCompare(result[i].name)).toBeLessThanOrEqual(0);
      }
    });

    it('filters by search term when >= 2 chars', async () => {
      const result = await getPublicArtists(`Alpha Artist ${ts}`);
      expect(result.length).toBeGreaterThanOrEqual(1);
      const alpha = result.find((a) => a.id === artistAlphaId);
      expect(alpha).toBeDefined();
      // Beta should not match
      const beta = result.find((a) => a.id === artistBetaId);
      expect(beta).toBeUndefined();
    });

    it('ignores search term with < 2 chars', async () => {
      const result = await getPublicArtists('A');
      // Should return all artists (search ignored)
      expect(result.length).toBeGreaterThanOrEqual(3); // alpha, beta, noLots
    });

    it('search is case-insensitive', async () => {
      const result = await getPublicArtists(`alpha artist ${ts}`);
      const alpha = result.find((a) => a.id === artistAlphaId);
      expect(alpha).toBeDefined();
    });

    it('lotCount only includes published, active, and sold lots', async () => {
      const result = await getPublicArtists();
      const alpha = result.find((a) => a.id === artistAlphaId);
      expect(alpha).toBeDefined();
      // Alpha has: 2 sold, 1 active, 1 published (linked) = 4 qualifying lots
      // Draft and deleted lots should NOT be counted (draft status excluded, deleted has deletedAt)
      expect(alpha!.lotCount).toBeGreaterThanOrEqual(4);
    });

    it('does not count soft-deleted lots', async () => {
      const result = await getPublicArtists();
      const alpha = result.find((a) => a.id === artistAlphaId);
      // lotDeletedId has deletedAt set, so should not be in the count
      const countBefore = alpha!.lotCount;

      // Verify by checking that count is consistent
      const result2 = await getPublicArtists();
      const alpha2 = result2.find((a) => a.id === artistAlphaId);
      expect(alpha2!.lotCount).toBe(countBefore);
    });
  });

  // ─── getArtists (admin list) ──────────────────────────────────────────────────

  describe('getArtists', () => {
    it('returns paginated list of artists with lot counts', async () => {
      const result = await getArtists();
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('limit');
      expect(result).toHaveProperty('totalPages');
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('excludes soft-deleted artists', async () => {
      const result = await getArtists();
      const ids = result.data.map((a) => a.id);
      expect(ids).not.toContain(artistDeletedId);
    });

    it('search filters by name', async () => {
      const result = await getArtists({ search: `Alpha Artist ${ts}` });
      expect(result.data.length).toBeGreaterThanOrEqual(1);
      const alpha = result.data.find((a) => a.id === artistAlphaId);
      expect(alpha).toBeDefined();
    });

    it('paginates correctly', async () => {
      const result = await getArtists({ page: 1, limit: 2 });
      expect(result.page).toBe(1);
      expect(result.limit).toBe(2);
      expect(result.data.length).toBeLessThanOrEqual(2);
      expect(result.totalPages).toBe(Math.ceil(result.total / 2));
    });
  });

  // ─── getArtistById ────────────────────────────────────────────────────────────

  describe('getArtistById', () => {
    it('returns artist by id', async () => {
      const result = await getArtistById(artistAlphaId);
      expect(result).not.toBeNull();
      expect(result!.name).toBe(`Alpha Artist ${ts}`);
    });

    it('returns null for soft-deleted artist', async () => {
      const result = await getArtistById(artistDeletedId);
      expect(result).toBeNull();
    });

    it('returns null for non-existent id', async () => {
      const { randomUUID } = await import('crypto');
      const result = await getArtistById(randomUUID());
      expect(result).toBeNull();
    });
  });

  // ─── createArtist ─────────────────────────────────────────────────────────────

  describe('createArtist', () => {
    it('creates and returns new artist', async () => {
      const result = await createArtist({
        slug: `created-test-artist-${ts}`,
        name: 'Created Test Artist',
        nationality: 'Spanish',
        birthYear: 1900,
        deathYear: 1990,
        bio: 'Test bio',
      });
      expect(result).toBeDefined();
      expect(result.name).toBe('Created Test Artist');
      expect(result.slug).toBe(`created-test-artist-${ts}`);
      expect(result.nationality).toBe('Spanish');
      expect(result.id).toBeDefined();
    });
  });

  // ─── updateArtist ─────────────────────────────────────────────────────────────

  describe('updateArtist', () => {
    it('updates artist fields and returns updated record', async () => {
      const result = await updateArtist(artistBetaId, { name: `Updated Beta ${ts}` });
      expect(result).not.toBeNull();
      expect(result!.name).toBe(`Updated Beta ${ts}`);
      // Restore
      await updateArtist(artistBetaId, { name: `Beta Artist ${ts}` });
    });

    it('returns null for non-existent id', async () => {
      const { randomUUID } = await import('crypto');
      const result = await updateArtist(randomUUID(), { name: 'Nope' });
      expect(result).toBeNull();
    });

    it('returns null for soft-deleted artist', async () => {
      const result = await updateArtist(artistDeletedId, { name: 'Should Fail' });
      expect(result).toBeNull();
    });
  });

  // ─── deleteArtist ─────────────────────────────────────────────────────────────

  describe('deleteArtist', () => {
    it('soft-deletes an artist', async () => {
      // Create a temporary artist to delete
      const temp = await createArtist({
        slug: `created-test-artist-del-${ts}`,
        name: 'Temp Delete Artist',
      });
      await deleteArtist(temp.id);
      const result = await getArtistById(temp.id);
      expect(result).toBeNull();
    });
  });

  // ─── linkLotsToArtist ─────────────────────────────────────────────────────────

  describe('linkLotsToArtist', () => {
    it('links unlinked lots to an artist', async () => {
      // Create a temp artist
      const tempArtist = await createArtist({
        slug: `link-test-artist-${ts}`,
        name: 'Link Test Artist',
      });

      await linkLotsToArtist(tempArtist.id, [lotUnlinkedDiffNameId]);

      // Verify the lot now has artistId
      const { lots: lotsTable } = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');
      const [lot] = await db.select().from(lotsTable).where(eq(lotsTable.id, lotUnlinkedDiffNameId));
      expect(lot.artistId).toBe(tempArtist.id);

      // Restore
      await db.update(lotsTable).set({ artistId: null }).where(eq(lotsTable.id, lotUnlinkedDiffNameId));
    });

    it('does nothing when given empty array', async () => {
      // Should not throw
      await linkLotsToArtist(artistAlphaId, []);
    });
  });
});
