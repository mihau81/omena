/**
 * Unit tests for GET /api/v1/lots/[id]
 * Coverage target: public API — single lot detail with images, bid stats
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock API key auth ──────────────────────────────────────────────────────

const mockValidateApiKey = vi.fn();

class MockApiKeyError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 401) {
    super(message);
    this.name = 'ApiKeyError';
    this.statusCode = statusCode;
  }
}

vi.mock('@/lib/api-key-auth', () => ({
  validateApiKey: (...args: unknown[]) => mockValidateApiKey(...args),
  ApiKeyError: MockApiKeyError,
}));

// ─── Mock DB ────────────────────────────────────────────────────────────────
// The route makes 3 sequential db.select() calls:
//   0) lot+auction join query -> resolves (terminal at .limit)
//   1) media query -> resolves (terminal at .orderBy)
//   2) bid stats query -> resolves (terminal at .where)
// We use a Proxy-based approach that resolves when awaited.

let selectCallIndex = 0;
const queryResults: unknown[][] = [];
let shouldThrowOnSelect = false;

function buildChain(callIdx: number): unknown {
  const handler: ProxyHandler<object> = {
    get(_target, prop: string) {
      if (prop === 'then') {
        return (resolve: (v: unknown) => void) => resolve(queryResults[callIdx] ?? []);
      }
      return (..._args: unknown[]) => new Proxy({}, handler);
    },
  };
  return new Proxy({}, handler);
}

const mockDbProxy = new Proxy({}, {
  get(_target, prop: string) {
    if (prop === 'select') {
      return (..._args: unknown[]) => {
        if (shouldThrowOnSelect) {
          throw new Error('DB connection failed');
        }
        const idx = selectCallIndex++;
        return buildChain(idx);
      };
    }
    return vi.fn();
  },
});

vi.mock('@/db/connection', () => ({ db: mockDbProxy }));

vi.mock('@/db/schema', () => ({
  auctions: { id: 'id', slug: 'slug', visibilityLevel: 'visibilityLevel', deletedAt: 'deletedAt', status: 'status', title: 'title', startDate: 'startDate', endDate: 'endDate' },
  lots: { id: 'id', auctionId: 'auctionId', deletedAt: 'deletedAt', status: 'status', visibilityOverride: 'visibilityOverride', sortOrder: 'sortOrder', lotNumber: 'lotNumber', title: 'title', artist: 'artist', description: 'description', medium: 'medium', dimensions: 'dimensions', year: 'year', estimateMin: 'estimateMin', estimateMax: 'estimateMax', startingBid: 'startingBid', hammerPrice: 'hammerPrice', provenance: 'provenance', exhibitions: 'exhibitions', literature: 'literature', createdAt: 'createdAt', updatedAt: 'updatedAt' },
  media: { id: 'id', lotId: 'lotId', mediaType: 'mediaType', url: 'url', thumbnailUrl: 'thumbnailUrl', mediumUrl: 'mediumUrl', largeUrl: 'largeUrl', altText: 'altText', width: 'width', height: 'height', isPrimary: 'isPrimary', sortOrder: 'sortOrder', deletedAt: 'deletedAt' },
  bids: { id: 'id', lotId: 'lotId', amount: 'amount' },
  bidRetractions: { id: 'id', bidId: 'bidId' },
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(id: string) {
  const { NextRequest } = require('next/server');
  return new NextRequest(`http://localhost:3000/api/v1/lots/${id}`);
}

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

const sampleLot = {
  id: 'lot-1',
  auctionId: 'auction-1',
  lotNumber: 1,
  title: 'Sunset Painting',
  artist: 'Turner',
  description: 'A beautiful sunset',
  medium: 'Oil on canvas',
  dimensions: '100x80cm',
  year: '1840',
  estimateMin: 5000,
  estimateMax: 10000,
  startingBid: 3000,
  hammerPrice: null,
  status: 'active',
  provenance: 'Private collection',
  exhibitions: null,
  literature: null,
  sortOrder: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  auctionSlug: 'spring-2026',
  auctionTitle: 'Spring Auction 2026',
  auctionStatus: 'live',
  auctionStartDate: new Date(),
  auctionEndDate: new Date(),
};

describe('GET /api/v1/lots/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectCallIndex = 0;
    queryResults.length = 0;
    shouldThrowOnSelect = false;
    mockValidateApiKey.mockResolvedValue({ id: 'key-1', name: 'test' });
  });

  it('returns 401 when API key is missing', async () => {
    mockValidateApiKey.mockRejectedValue(new MockApiKeyError('Missing or invalid Authorization header', 401));

    const { GET } = await import('@/app/api/v1/lots/[id]/route');
    const res = await GET(makeRequest('lot-1'), makeContext('lot-1'));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toContain('Missing or invalid');
  });

  it('returns 429 when API key rate limited', async () => {
    mockValidateApiKey.mockRejectedValue(new MockApiKeyError('Rate limit exceeded', 429));

    const { GET } = await import('@/app/api/v1/lots/[id]/route');
    const res = await GET(makeRequest('lot-1'), makeContext('lot-1'));
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error).toContain('Rate limit');
  });

  it('returns 401 on unexpected auth error', async () => {
    mockValidateApiKey.mockRejectedValue(new Error('Unexpected'));

    const { GET } = await import('@/app/api/v1/lots/[id]/route');
    const res = await GET(makeRequest('lot-1'), makeContext('lot-1'));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication failed');
  });

  it('returns 404 when lot not found', async () => {
    // select(0): lot+auction join -> empty
    queryResults[0] = [];

    const { GET } = await import('@/app/api/v1/lots/[id]/route');
    const res = await GET(makeRequest('nonexistent'), makeContext('nonexistent'));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Lot not found');
  });

  it('returns lot detail with images and bid stats', async () => {
    // select(0): lot query
    queryResults[0] = [sampleLot];
    // select(1): media query
    queryResults[1] = [
      { id: 'media-1', mediaType: 'image', url: 'http://img.jpg', thumbnailUrl: 'http://thumb.jpg', mediumUrl: 'http://medium.jpg', largeUrl: 'http://large.jpg', altText: 'Sunset', width: 1000, height: 800, isPrimary: true, sortOrder: 0 },
    ];
    // select(2): bid stats query
    queryResults[2] = [{ bidCount: 3, currentBid: 7000 }];

    const { GET } = await import('@/app/api/v1/lots/[id]/route');
    const res = await GET(makeRequest('lot-1'), makeContext('lot-1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.id).toBe('lot-1');
    expect(body.data.title).toBe('Sunset Painting');
    expect(body.data.images).toHaveLength(1);
    expect(body.data.images[0].isPrimary).toBe(true);
    expect(body.data.bidCount).toBe(3);
    expect(body.data.currentBid).toBe(7000);
    expect(body.data.auctionSlug).toBe('spring-2026');
    expect(body.data.auctionTitle).toBe('Spring Auction 2026');
  });

  it('returns zero bids when no bids exist', async () => {
    queryResults[0] = [sampleLot];
    queryResults[1] = [];
    queryResults[2] = [{ bidCount: 0, currentBid: null }];

    const { GET } = await import('@/app/api/v1/lots/[id]/route');
    const res = await GET(makeRequest('lot-1'), makeContext('lot-1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.bidCount).toBe(0);
    expect(body.data.currentBid).toBeNull();
    expect(body.data.images).toEqual([]);
  });

  it('handles empty bid stats gracefully (no rows)', async () => {
    queryResults[0] = [sampleLot];
    queryResults[1] = [];
    // bid stats returns empty array
    queryResults[2] = [];

    const { GET } = await import('@/app/api/v1/lots/[id]/route');
    const res = await GET(makeRequest('lot-1'), makeContext('lot-1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.bidCount).toBe(0);
    expect(body.data.currentBid).toBeNull();
  });

  it('returns lot with multiple images', async () => {
    queryResults[0] = [sampleLot];
    queryResults[1] = [
      { id: 'media-1', isPrimary: true, sortOrder: 0, url: 'http://1.jpg' },
      { id: 'media-2', isPrimary: false, sortOrder: 1, url: 'http://2.jpg' },
      { id: 'media-3', isPrimary: false, sortOrder: 2, mediaType: 'youtube', url: 'http://youtube.com/watch?v=123' },
    ];
    queryResults[2] = [{ bidCount: 1, currentBid: 5000 }];

    const { GET } = await import('@/app/api/v1/lots/[id]/route');
    const res = await GET(makeRequest('lot-1'), makeContext('lot-1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.images).toHaveLength(3);
  });

  it('returns 500 on unexpected DB error', async () => {
    shouldThrowOnSelect = true;

    const { GET } = await import('@/app/api/v1/lots/[id]/route');
    const res = await GET(makeRequest('lot-1'), makeContext('lot-1'));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
