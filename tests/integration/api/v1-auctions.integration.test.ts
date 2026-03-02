import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getTestDb } from '@/tests/helpers/db';

const mockAuth = vi.hoisted(() => {
  const _g = globalThis as Record<string, unknown>;
  if (!_g._omenaMockAuth) {
    _g._omenaMockSession = null;
    _g._omenaMockAuth = vi.fn().mockImplementation(async () => _g._omenaMockSession);
  }
  return _g._omenaMockAuth as ReturnType<typeof vi.fn>;
});

vi.mock('@/lib/auth', () => ({
  auth: mockAuth,
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: { GET: vi.fn(), POST: vi.fn() },
}));

// Mock the API key validation
const mockValidateApiKey = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/api-key-auth', () => ({
  validateApiKey: mockValidateApiKey,
  ApiKeyError: class ApiKeyError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 401) {
      super(message);
      this.name = 'ApiKeyError';
      this.statusCode = statusCode;
    }
  },
  generateApiKey: vi.fn().mockResolvedValue({
    plainKey: 'test_key_plain',
    keyHash: '$2b$10$hashedkey',
    keyPrefix: 'test_key',
  }),
}));

describe('GET /api/v1/auctions', () => {
  const db = getTestDb();
  let auctionId1: string;
  let auctionId2: string;

  beforeAll(async () => {
    const { randomUUID } = await import('crypto');
    const { auctions } = await import('@/db/schema');

    auctionId1 = randomUUID();
    auctionId2 = randomUUID();

    await db.insert(auctions).values([
      {
        id: auctionId1,
        slug: `v1-public-auction-${Date.now()}`,
        title: 'Public Live Auction',
        description: 'A public live auction',
        category: 'paintings',
        startDate: new Date(Date.now() - 3600000),
        endDate: new Date(Date.now() + 3600000),
        location: 'Warsaw',
        curator: 'Test',
        status: 'live',
        visibilityLevel: '0', // Public
        buyersPremiumRate: '0.2000',
      },
      {
        id: auctionId2,
        slug: `v1-preview-auction-${Date.now()}`,
        title: 'Preview Auction',
        description: 'A preview auction',
        category: 'mixed',
        startDate: new Date(Date.now() + 86400000),
        endDate: new Date(Date.now() + 90000000),
        location: 'Krakow',
        curator: 'Test',
        status: 'preview',
        visibilityLevel: '0', // Public
        buyersPremiumRate: '0.2000',
      },
    ]);
  });

  afterAll(async () => {
    const { auctions } = await import('@/db/schema');
    const { inArray } = await import('drizzle-orm');
    await db.delete(auctions).where(inArray(auctions.id, [auctionId1, auctionId2])).catch(() => {});
  });

  it('returns auctions when API key is valid', async () => {
    const { GET } = await import('@/app/api/v1/auctions/route');
    const { NextRequest } = await import('next/server');

    const request = new NextRequest('http://localhost:3002/api/v1/auctions', {
      headers: { Authorization: 'Bearer test_api_key_123' },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('data');
    expect(data).toHaveProperty('meta');
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.meta).toHaveProperty('total');
    expect(data.meta).toHaveProperty('limit');
    expect(data.meta).toHaveProperty('offset');
  });

  it('returns 401 when API key is invalid', async () => {
    const { GET } = await import('@/app/api/v1/auctions/route');
    const { ApiKeyError } = await import('@/lib/api-key-auth');
    const { NextRequest } = await import('next/server');

    mockValidateApiKey.mockRejectedValueOnce(new ApiKeyError('Invalid API key', 401));

    const request = new NextRequest('http://localhost:3002/api/v1/auctions', {
      headers: { Authorization: 'Bearer invalid_key' },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toHaveProperty('error');

    mockValidateApiKey.mockResolvedValue(undefined);
  });

  it('filters by status parameter', async () => {
    const { GET } = await import('@/app/api/v1/auctions/route');
    const { NextRequest } = await import('next/server');

    const request = new NextRequest('http://localhost:3002/api/v1/auctions?status=live', {
      headers: { Authorization: 'Bearer test_api_key_123' },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    // All returned auctions should have status 'live'
    for (const auction of data.data) {
      expect(auction.status).toBe('live');
    }
  });

  it('supports pagination with limit and offset', async () => {
    const { GET } = await import('@/app/api/v1/auctions/route');
    const { NextRequest } = await import('next/server');

    const request = new NextRequest('http://localhost:3002/api/v1/auctions?limit=1&offset=0', {
      headers: { Authorization: 'Bearer test_api_key_123' },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.length).toBeLessThanOrEqual(1);
    expect(data.meta.limit).toBe(1);
    expect(data.meta.offset).toBe(0);
  });

  it('returns 400 for invalid status filter', async () => {
    const { GET } = await import('@/app/api/v1/auctions/route');
    const { NextRequest } = await import('next/server');

    const request = new NextRequest('http://localhost:3002/api/v1/auctions?status=invalid_status', {
      headers: { Authorization: 'Bearer test_api_key_123' },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toHaveProperty('error');
  });

  it('only returns publicly visible auctions (visibilityLevel=0)', async () => {
    const { GET } = await import('@/app/api/v1/auctions/route');
    const { NextRequest } = await import('next/server');

    // Create a private auction
    const { randomUUID } = await import('crypto');
    const { auctions } = await import('@/db/schema');
    const privateId = randomUUID();
    await db.insert(auctions).values({
      id: privateId,
      slug: `v1-private-${Date.now()}`,
      title: 'Private Live Auction',
      description: 'Private',
      category: 'mixed',
      startDate: new Date(),
      endDate: new Date(Date.now() + 3600000),
      location: 'Warsaw',
      curator: 'Test',
      status: 'live',
      visibilityLevel: '2', // Private
      buyersPremiumRate: '0.2000',
    });

    try {
      const request = new NextRequest('http://localhost:3002/api/v1/auctions?status=live', {
        headers: { Authorization: 'Bearer test_api_key_123' },
      });

      const response = await GET(request);
      const data = await response.json();

      // The private auction should not be in results
      const found = data.data.find((a: Record<string, string>) => a.id === privateId);
      expect(found).toBeUndefined();
    } finally {
      const { eq } = await import('drizzle-orm');
      await db.delete(auctions).where(eq(auctions.id, privateId)).catch(() => {});
    }
  });
});
