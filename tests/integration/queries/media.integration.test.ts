import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from '@/tests/helpers/db';
import { getMediaForLot, getPrimaryMedia } from '@/db/queries/media';

describe('db/queries/media', () => {
  const db = getTestDb();
  let auctionId: string;
  let lotId: string;
  let lotIdEmpty: string;
  let mediaId1: string;
  let mediaId2: string;
  let mediaId3: string;
  let mediaIdDeleted: string;
  let mediaIdPrimary: string;

  beforeAll(async () => {
    const { randomUUID } = await import('crypto');
    const { auctions, lots, media } = await import('@/db/schema');

    // Create auction
    auctionId = randomUUID();
    await db.insert(auctions).values({
      id: auctionId,
      slug: `media-test-auction-${Date.now()}`,
      title: 'Media Test Auction',
      description: 'Test auction for media queries',
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
    lotId = randomUUID();
    await db.insert(lots).values({
      id: lotId,
      auctionId,
      lotNumber: 1,
      title: 'Media Test Lot',
      artist: 'Test Artist',
      description: 'Lot with media',
      medium: 'Oil',
      dimensions: '50x70',
      status: 'active',
    });

    lotIdEmpty = randomUUID();
    await db.insert(lots).values({
      id: lotIdEmpty,
      auctionId,
      lotNumber: 2,
      title: 'Media Empty Lot',
      artist: 'Test Artist',
      description: 'Lot without media',
      medium: 'Acrylic',
      dimensions: '30x40',
      status: 'active',
    });

    // Create media items with different sort orders
    mediaId1 = randomUUID();
    await db.insert(media).values({
      id: mediaId1,
      lotId,
      auctionId,
      mediaType: 'image',
      url: 'https://example.com/image1.jpg',
      thumbnailUrl: 'https://example.com/thumb1.jpg',
      originalFilename: 'image1.jpg',
      mimeType: 'image/jpeg',
      fileSize: 102400,
      width: 800,
      height: 600,
      altText: 'First image',
      sortOrder: 2,
      isPrimary: false,
    });

    mediaId2 = randomUUID();
    await db.insert(media).values({
      id: mediaId2,
      lotId,
      auctionId,
      mediaType: 'image',
      url: 'https://example.com/image2.jpg',
      thumbnailUrl: 'https://example.com/thumb2.jpg',
      originalFilename: 'image2.jpg',
      mimeType: 'image/jpeg',
      fileSize: 204800,
      width: 1024,
      height: 768,
      altText: 'Second image',
      sortOrder: 1,
      isPrimary: false,
    });

    mediaId3 = randomUUID();
    await db.insert(media).values({
      id: mediaId3,
      lotId,
      auctionId,
      mediaType: 'youtube',
      url: 'https://youtube.com/watch?v=test123',
      altText: 'YouTube video',
      sortOrder: 3,
      isPrimary: false,
    });

    // Create a soft-deleted media item
    mediaIdDeleted = randomUUID();
    await db.insert(media).values({
      id: mediaIdDeleted,
      lotId,
      auctionId,
      mediaType: 'image',
      url: 'https://example.com/deleted.jpg',
      altText: 'Deleted image',
      sortOrder: 0,
      isPrimary: false,
      deletedAt: new Date(),
    });

    // Create a primary media item (will be used for getPrimaryMedia tests)
    mediaIdPrimary = randomUUID();
    await db.insert(media).values({
      id: mediaIdPrimary,
      lotId,
      auctionId,
      mediaType: 'image',
      url: 'https://example.com/primary.jpg',
      thumbnailUrl: 'https://example.com/thumb-primary.jpg',
      originalFilename: 'primary.jpg',
      mimeType: 'image/jpeg',
      altText: 'Primary image',
      sortOrder: 10,
      isPrimary: true,
    });
  });

  afterAll(async () => {
    const { auctions, lots, media } = await import('@/db/schema');
    const { eq, inArray } = await import('drizzle-orm');

    await db.delete(media).where(inArray(media.id, [mediaId1, mediaId2, mediaId3, mediaIdDeleted, mediaIdPrimary])).catch(() => {});
    await db.delete(lots).where(inArray(lots.id, [lotId, lotIdEmpty])).catch(() => {});
    await db.delete(auctions).where(eq(auctions.id, auctionId)).catch(() => {});
  });

  // ─── getMediaForLot ─────────────────────────────────────────────────────────

  describe('getMediaForLot', () => {
    it('returns all non-deleted media for a lot', async () => {
      const result = await getMediaForLot(lotId);
      // 3 normal + 1 primary = 4, excluding 1 deleted
      expect(result.length).toBe(4);
    });

    it('excludes soft-deleted media', async () => {
      const result = await getMediaForLot(lotId);
      const ids = result.map((m) => m.id);
      expect(ids).not.toContain(mediaIdDeleted);
    });

    it('returns media ordered by sortOrder ascending', async () => {
      const result = await getMediaForLot(lotId);
      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].sortOrder).toBeLessThanOrEqual(result[i + 1].sortOrder);
      }
    });

    it('returns empty array for lot with no media', async () => {
      const result = await getMediaForLot(lotIdEmpty);
      expect(result).toEqual([]);
    });

    it('returns empty array for unknown lot id', async () => {
      const { randomUUID } = await import('crypto');
      const result = await getMediaForLot(randomUUID());
      expect(result).toEqual([]);
    });

    it('includes all media fields', async () => {
      const result = await getMediaForLot(lotId);
      const img = result.find((m) => m.id === mediaId1);
      expect(img).toBeDefined();
      expect(img!.url).toBe('https://example.com/image1.jpg');
      expect(img!.thumbnailUrl).toBe('https://example.com/thumb1.jpg');
      expect(img!.originalFilename).toBe('image1.jpg');
      expect(img!.mimeType).toBe('image/jpeg');
      expect(img!.fileSize).toBe(102400);
      expect(img!.width).toBe(800);
      expect(img!.height).toBe(600);
      expect(img!.altText).toBe('First image');
      expect(img!.mediaType).toBe('image');
    });

    it('includes youtube media type entries', async () => {
      const result = await getMediaForLot(lotId);
      const yt = result.find((m) => m.id === mediaId3);
      expect(yt).toBeDefined();
      expect(yt!.mediaType).toBe('youtube');
      expect(yt!.url).toBe('https://youtube.com/watch?v=test123');
    });

    it('includes the primary media item', async () => {
      const result = await getMediaForLot(lotId);
      const primary = result.find((m) => m.id === mediaIdPrimary);
      expect(primary).toBeDefined();
      expect(primary!.isPrimary).toBe(true);
    });
  });

  // ─── getPrimaryMedia ────────────────────────────────────────────────────────

  describe('getPrimaryMedia', () => {
    it('returns the media item marked as primary', async () => {
      const result = await getPrimaryMedia(lotId);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(mediaIdPrimary);
      expect(result!.isPrimary).toBe(true);
    });

    it('falls back to first by sort order when no primary exists', async () => {
      const { media } = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');

      // Temporarily unmark primary
      await db.update(media).set({ isPrimary: false }).where(eq(media.id, mediaIdPrimary));

      const result = await getPrimaryMedia(lotId);
      expect(result).not.toBeNull();
      // Should be mediaId2 (sortOrder=1), the lowest non-deleted sort order
      expect(result!.id).toBe(mediaId2);

      // Restore
      await db.update(media).set({ isPrimary: true }).where(eq(media.id, mediaIdPrimary));
    });

    it('does not return soft-deleted primary media', async () => {
      const { randomUUID } = await import('crypto');
      const { lots, media } = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');

      // Create a lot with only a deleted primary
      const tmpLotId = randomUUID();
      await db.insert(lots).values({
        id: tmpLotId,
        auctionId,
        lotNumber: 50,
        title: 'Deleted Primary Lot',
        artist: 'Test',
        description: 'Test',
        medium: 'Test',
        dimensions: '10x10',
        status: 'active',
      });

      const tmpMediaId = randomUUID();
      await db.insert(media).values({
        id: tmpMediaId,
        lotId: tmpLotId,
        mediaType: 'image',
        url: 'https://example.com/deleted-primary.jpg',
        isPrimary: true,
        sortOrder: 0,
        deletedAt: new Date(),
      });

      const result = await getPrimaryMedia(tmpLotId);
      expect(result).toBeNull();

      // Cleanup
      await db.delete(media).where(eq(media.id, tmpMediaId));
      await db.delete(lots).where(eq(lots.id, tmpLotId));
    });

    it('returns null for lot with no media', async () => {
      const result = await getPrimaryMedia(lotIdEmpty);
      expect(result).toBeNull();
    });

    it('returns null for unknown lot id', async () => {
      const { randomUUID } = await import('crypto');
      const result = await getPrimaryMedia(randomUUID());
      expect(result).toBeNull();
    });

    it('returns primary even if its sort order is high', async () => {
      // mediaIdPrimary has sortOrder=10, higher than others
      const result = await getPrimaryMedia(lotId);
      expect(result!.id).toBe(mediaIdPrimary);
      expect(result!.sortOrder).toBe(10);
    });
  });
});
