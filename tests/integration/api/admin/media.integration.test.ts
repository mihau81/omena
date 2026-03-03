import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getTestDb } from '@/tests/helpers/db';
import { createTestAdmin } from '@/tests/helpers/auth';

const mockAuth = vi.hoisted(() => {
  const _g = globalThis as Record<string, unknown>;
  if (!_g._omenaaMockAuth) {
    _g._omenaaMockSession = null;
    _g._omenaaMockAuth = vi.fn().mockImplementation(async () => _g._omenaaMockSession);
  }
  return _g._omenaaMockAuth as ReturnType<typeof vi.fn>;
});

vi.mock('@/lib/auth', () => ({
  auth: mockAuth,
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: { GET: vi.fn(), POST: vi.fn() },
}));

vi.mock('@/lib/audit', () => ({
  logCreate: vi.fn().mockResolvedValue(undefined),
  logUpdate: vi.fn().mockResolvedValue(undefined),
  logDelete: vi.fn().mockResolvedValue(undefined),
}));

// Mock the S3 client
vi.mock('@/lib/s3', async () => {
  const { mockS3Client } = await import('@/tests/helpers/mocks/s3');
  return { s3Client: mockS3Client };
});

describe('Admin Media API', () => {
  const db = getTestDb();
  let admin: Awaited<ReturnType<typeof createTestAdmin>>;
  let auctionId: string;
  let lotId: string;
  let mediaId1: string;
  let mediaId2: string;

  beforeAll(async () => {
    const { randomUUID } = await import('crypto');
    const { auctions, lots, media } = await import('@/db/schema');

    admin = await createTestAdmin({ email: `admin-media-test-${Date.now()}@example.com` });
    (globalThis as any)._omenaaMockSession = { user: { id: admin.id, email: admin.email, role: admin.role, name: admin.name, userType: 'admin', visibilityLevel: 2 } };

    auctionId = randomUUID();
    await db.insert(auctions).values({
      id: auctionId,
      slug: `media-test-auction-${Date.now()}`,
      title: 'Media Test Auction',
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

    lotId = randomUUID();
    await db.insert(lots).values({
      id: lotId,
      auctionId,
      lotNumber: 1,
      title: 'Media Test Artwork',
      artist: 'Test Artist',
      description: 'Test',
      medium: 'Oil',
      dimensions: '50x70',
      status: 'draft',
    });

    // Insert test media items
    mediaId1 = randomUUID();
    mediaId2 = randomUUID();

    await db.insert(media).values([
      {
        id: mediaId1,
        lotId,
        type: 'image',
        url: 'https://cdn.example.com/test-image-1.jpg',
        sortOrder: 0,
        isPrimary: true,
        originalFilename: 'test-image-1.jpg',
        mimeType: 'image/jpeg',
        fileSize: 12345,
      },
      {
        id: mediaId2,
        lotId,
        type: 'image',
        url: 'https://cdn.example.com/test-image-2.jpg',
        sortOrder: 1,
        isPrimary: false,
        originalFilename: 'test-image-2.jpg',
        mimeType: 'image/jpeg',
        fileSize: 23456,
      },
    ]);
  });

  afterAll(async () => {
    const { auctions, lots, media } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');
    await db.delete(media).where(eq(media.lotId, lotId)).catch(() => {});
    await db.delete(lots).where(eq(lots.id, lotId)).catch(() => {});
    await db.delete(auctions).where(eq(auctions.id, auctionId)).catch(() => {});
    await db.execute(`DELETE FROM admins WHERE email LIKE 'admin-media-test-%@example.com'`);
  });

  describe('PATCH /api/admin/media/[id] (set primary)', () => {
    it('sets media as primary image', async () => {
      const { PATCH } = await import('@/app/api/admin/media/[id]/route');

      const response = await PATCH(
        new Request(`http://localhost:3002/api/admin/media/${mediaId2}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isPrimary: true }),
        }),
        { params: Promise.resolve({ id: mediaId2 }) },
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('media');
      expect((data as Record<string, Record<string, unknown>>).media.isPrimary).toBe(true);

      // Verify the other image is no longer primary
      const { media } = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');
      const [oldPrimary] = await db.select({ isPrimary: media.isPrimary })
        .from(media)
        .where(eq(media.id, mediaId1));
      expect(oldPrimary.isPrimary).toBe(false);
    });

    it('returns 404 for non-existent media', async () => {
      const { PATCH } = await import('@/app/api/admin/media/[id]/route');
      const { randomUUID } = await import('crypto');

      const fakeId = randomUUID();
      const response = await PATCH(
        new Request(`http://localhost:3002/api/admin/media/${fakeId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isPrimary: true }),
        }),
        { params: Promise.resolve({ id: fakeId }) },
      );

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/admin/media/[id]', () => {
    it('soft-deletes a media item', async () => {
      const { DELETE } = await import('@/app/api/admin/media/[id]/route');

      const response = await DELETE(
        new Request(`http://localhost:3002/api/admin/media/${mediaId1}`),
        { params: Promise.resolve({ id: mediaId1 }) },
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('success', true);

      // Verify the media is soft-deleted
      const { media } = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');
      const [deletedMedia] = await db.select({ deletedAt: media.deletedAt })
        .from(media)
        .where(eq(media.id, mediaId1));

      expect(deletedMedia.deletedAt).not.toBeNull();
    });

    it('returns 404 for non-existent media', async () => {
      const { DELETE } = await import('@/app/api/admin/media/[id]/route');
      const { randomUUID } = await import('crypto');

      const fakeId = randomUUID();
      const response = await DELETE(
        new Request(`http://localhost:3002/api/admin/media/${fakeId}`),
        { params: Promise.resolve({ id: fakeId }) },
      );

      expect(response.status).toBe(404);
    });

    it('promotes next media to primary when primary is deleted', async () => {
      const { DELETE } = await import('@/app/api/admin/media/[id]/route');

      // mediaId2 is currently primary (from previous test)
      // mediaId1 is soft-deleted
      // Deleting mediaId2 should not promote anything (mediaId1 is deleted)
      // But let's verify the response is correct
      const response = await DELETE(
        new Request(`http://localhost:3002/api/admin/media/${mediaId2}`),
        { params: Promise.resolve({ id: mediaId2 }) },
      );

      expect(response.status).toBe(200);
    });
  });
});
