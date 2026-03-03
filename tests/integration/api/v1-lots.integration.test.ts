import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getTestDb } from '@/tests/helpers/db';

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

vi.mock('@/lib/api-key-auth', () => ({
  validateApiKey: vi.fn().mockResolvedValue(undefined),
  ApiKeyError: class ApiKeyError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 401) {
      super(message);
      this.statusCode = statusCode;
    }
  },
  generateApiKey: vi.fn().mockResolvedValue({
    plainKey: 'test_key',
    keyHash: 'hashed',
    keyPrefix: 'test_',
  }),
}));

describe('GET /api/v1/lots/[id]', () => {
  const db = getTestDb();
  let auctionId: string;
  let lotId: string;

  beforeAll(async () => {
    const { randomUUID } = await import('crypto');
    const { auctions, lots } = await import('@/db/schema');

    auctionId = randomUUID();
    await db.insert(auctions).values({
      id: auctionId,
      slug: `v1-lots-test-${Date.now()}`,
      title: 'V1 Lots Test Auction',
      description: 'Test',
      category: 'paintings',
      startDate: new Date(),
      endDate: new Date(Date.now() + 3600000),
      location: 'Warsaw',
      curator: 'Test',
      status: 'live',
      visibilityLevel: '0',
      buyersPremiumRate: '0.2000',
    });

    lotId = randomUUID();
    await db.insert(lots).values({
      id: lotId,
      auctionId,
      lotNumber: 1,
      title: 'Test Artwork for API',
      artist: 'Famous Artist',
      description: 'A beautiful painting',
      medium: 'Oil on canvas',
      dimensions: '100 x 150 cm',
      year: 2020,
      estimateMin: 5000,
      estimateMax: 10000,
      status: 'active',
    });
  });

  afterAll(async () => {
    const { auctions, lots } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');
    await db.delete(lots).where(eq(lots.id, lotId)).catch(() => {});
    await db.delete(auctions).where(eq(auctions.id, auctionId)).catch(() => {});
  });

  it('returns lot detail by ID', async () => {
    const { GET } = await import('@/app/api/v1/lots/[id]/route');
    const { NextRequest } = await import('next/server');

    const request = new NextRequest(`http://localhost:3002/api/v1/lots/${lotId}`, {
      headers: { Authorization: 'Bearer test_key' },
    });

    const response = await GET(request, { params: Promise.resolve({ id: lotId }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('data');
    expect((data as Record<string, Record<string, unknown>>).data.id).toBe(lotId);
    expect((data as Record<string, Record<string, unknown>>).data.title).toBe('Test Artwork for API');
  });

  it('returns 404 for non-existent lot', async () => {
    const { GET } = await import('@/app/api/v1/lots/[id]/route');
    const { NextRequest } = await import('next/server');
    const { randomUUID } = await import('crypto');

    const fakeId = randomUUID();
    const request = new NextRequest(`http://localhost:3002/api/v1/lots/${fakeId}`, {
      headers: { Authorization: 'Bearer test_key' },
    });

    const response = await GET(request, { params: Promise.resolve({ id: fakeId }) });

    expect(response.status).toBe(404);
  });
});

describe('GET /api/v1/auctions/[slug]/lots', () => {
  const db = getTestDb();
  let auctionId: string;
  let auctionSlug: string;

  beforeAll(async () => {
    const { randomUUID } = await import('crypto');
    const { auctions, lots } = await import('@/db/schema');

    auctionSlug = `v1-slug-test-${Date.now()}`;
    auctionId = randomUUID();
    await db.insert(auctions).values({
      id: auctionId,
      slug: auctionSlug,
      title: 'V1 Slug Test Auction',
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

    // Insert some lots
    await db.insert(lots).values([
      {
        id: randomUUID(),
        auctionId,
        lotNumber: 1,
        title: 'Lot One',
        artist: 'Artist One',
        description: 'First lot',
        medium: 'Oil',
        dimensions: '50x70',
        status: 'published',
      },
      {
        id: randomUUID(),
        auctionId,
        lotNumber: 2,
        title: 'Lot Two',
        artist: 'Artist Two',
        description: 'Second lot',
        medium: 'Watercolor',
        dimensions: '30x40',
        status: 'published',
      },
    ]);
  });

  afterAll(async () => {
    const { auctions, lots } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');
    await db.delete(lots).where(eq(lots.auctionId, auctionId)).catch(() => {});
    await db.delete(auctions).where(eq(auctions.id, auctionId)).catch(() => {});
  });

  it('returns lots for auction by slug', async () => {
    const { GET } = await import('@/app/api/v1/auctions/[slug]/lots/route');
    const { NextRequest } = await import('next/server');

    const request = new NextRequest(`http://localhost:3002/api/v1/auctions/${auctionSlug}/lots`, {
      headers: { Authorization: 'Bearer test_key' },
    });

    const response = await GET(request, { params: Promise.resolve({ slug: auctionSlug }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('data');
    expect(Array.isArray((data as Record<string, unknown>).data)).toBe(true);
    expect((data as Record<string, unknown[]>).data.length).toBeGreaterThanOrEqual(2);
  });

  it('returns 404 for unknown auction slug', async () => {
    const { GET } = await import('@/app/api/v1/auctions/[slug]/lots/route');
    const { NextRequest } = await import('next/server');

    const request = new NextRequest('http://localhost:3002/api/v1/auctions/nonexistent-slug/lots', {
      headers: { Authorization: 'Bearer test_key' },
    });

    const response = await GET(request, { params: Promise.resolve({ slug: 'nonexistent-slug' }) });

    expect(response.status).toBe(404);
  });
});
