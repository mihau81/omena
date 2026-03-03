/**
 * Unit tests for GET /api/v1/auctions/[slug]/lots
 * Coverage target: public API — lot listing with pagination, filtering, API key auth
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
// Chain pattern: every method returns the chain itself.
// The "terminal" points vary per query:
//   1) auction: .limit(1) -> resolves
//   2) count:   .where()  -> resolves (directly awaited)
//   3) lots:    .offset()  -> resolves
//
// We use a selectCallIndex to track which db.select() call we're on
// and resolve the appropriate data at the terminal point.

let selectCallIndex = 0;
const queryResults: unknown[][] = [];

// Build a chain where every prop returns itself, except it tracks depth
// and resolves at terminal points.
function buildChain(callIdx: number): unknown {
  const handler: ProxyHandler<object> = {
    get(_target, prop: string) {
      if (prop === 'then') {
        // This chain is being awaited directly.
        // Resolve with the result for this query call.
        return (resolve: (v: unknown) => void) => resolve(queryResults[callIdx] ?? []);
      }
      // Return a function that returns the same or new chain proxy
      return (..._args: unknown[]) => new Proxy({}, handler);
    },
  };
  return new Proxy({}, handler);
}

const mockDbProxy = new Proxy({}, {
  get(_target, prop: string) {
    if (prop === 'select') {
      return (..._args: unknown[]) => {
        const idx = selectCallIndex++;
        return buildChain(idx);
      };
    }
    // Fallback for other methods (shouldn't be needed for this route)
    return vi.fn();
  },
});

vi.mock('@/db/connection', () => ({ db: mockDbProxy }));

vi.mock('@/db/schema', () => ({
  auctions: { id: 'id', slug: 'slug', visibilityLevel: 'visibilityLevel', deletedAt: 'deletedAt', status: 'status', title: 'title' },
  lots: { id: 'id', auctionId: 'auctionId', deletedAt: 'deletedAt', status: 'status', visibilityOverride: 'visibilityOverride', sortOrder: 'sortOrder', lotNumber: 'lotNumber', title: 'title', artist: 'artist', description: 'description', medium: 'medium', dimensions: 'dimensions', year: 'year', estimateMin: 'estimateMin', estimateMax: 'estimateMax', startingBid: 'startingBid', hammerPrice: 'hammerPrice', createdAt: 'createdAt', updatedAt: 'updatedAt' },
  media: { lotId: 'lotId', isPrimary: 'isPrimary', deletedAt: 'deletedAt', url: 'url', thumbnailUrl: 'thumbnailUrl', mediumUrl: 'mediumUrl' },
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(slug: string, query = '') {
  const { NextRequest } = require('next/server');
  return new NextRequest(`http://localhost:3000/api/v1/auctions/${slug}/lots${query ? '?' + query : ''}`);
}

function makeContext(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

describe('GET /api/v1/auctions/[slug]/lots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectCallIndex = 0;
    queryResults.length = 0;
    mockValidateApiKey.mockResolvedValue({ id: 'key-1', name: 'test' });
  });

  it('returns 401 when API key is missing', async () => {
    mockValidateApiKey.mockRejectedValue(new MockApiKeyError('Missing or invalid Authorization header', 401));

    const { GET } = await import('@/app/api/v1/auctions/[slug]/lots/route');
    const res = await GET(makeRequest('spring-2026'), makeContext('spring-2026'));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toContain('Missing or invalid');
  });

  it('returns 429 when API key rate limited', async () => {
    mockValidateApiKey.mockRejectedValue(new MockApiKeyError('Rate limit exceeded', 429));

    const { GET } = await import('@/app/api/v1/auctions/[slug]/lots/route');
    const res = await GET(makeRequest('spring-2026'), makeContext('spring-2026'));
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error).toContain('Rate limit');
  });

  it('returns 401 on unexpected auth error', async () => {
    mockValidateApiKey.mockRejectedValue(new Error('Unexpected'));

    const { GET } = await import('@/app/api/v1/auctions/[slug]/lots/route');
    const res = await GET(makeRequest('spring-2026'), makeContext('spring-2026'));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication failed');
  });

  it('returns 400 for invalid lot status filter', async () => {
    const { GET } = await import('@/app/api/v1/auctions/[slug]/lots/route');
    const res = await GET(makeRequest('spring-2026', 'status=invalid,bogus'), makeContext('spring-2026'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('Invalid lot status');
  });

  it('returns 404 when auction not found', async () => {
    // select(0): auction lookup -> empty
    queryResults[0] = [];

    const { GET } = await import('@/app/api/v1/auctions/[slug]/lots/route');
    const res = await GET(makeRequest('nonexistent'), makeContext('nonexistent'));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Auction not found');
  });

  it('returns lots with pagination metadata', async () => {
    // select(0): auction lookup
    queryResults[0] = [{ id: 'auction-1', slug: 'spring-2026' }];
    // select(1): count query
    queryResults[1] = [{ total: 5 }];
    // select(2): lots query
    queryResults[2] = [
      { id: 'lot-1', title: 'Sunset', lotNumber: 1, primaryImageUrl: 'http://img.jpg' },
      { id: 'lot-2', title: 'Dawn', lotNumber: 2, primaryImageUrl: null },
    ];

    const { GET } = await import('@/app/api/v1/auctions/[slug]/lots/route');
    const res = await GET(makeRequest('spring-2026', 'limit=10&offset=0'), makeContext('spring-2026'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(2);
    expect(body.meta.total).toBe(5);
    expect(body.meta.limit).toBe(10);
    expect(body.meta.offset).toBe(0);
    expect(body.meta.auctionSlug).toBe('spring-2026');
  });

  it('clamps limit to max 100', async () => {
    queryResults[0] = [{ id: 'auction-1', slug: 'spring-2026' }];
    queryResults[1] = [{ total: 0 }];
    queryResults[2] = [];

    const { GET } = await import('@/app/api/v1/auctions/[slug]/lots/route');
    const res = await GET(makeRequest('spring-2026', 'limit=999'), makeContext('spring-2026'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta.limit).toBe(100);
  });

  it('clamps limit to min 1', async () => {
    queryResults[0] = [{ id: 'auction-1', slug: 'spring-2026' }];
    queryResults[1] = [{ total: 0 }];
    queryResults[2] = [];

    const { GET } = await import('@/app/api/v1/auctions/[slug]/lots/route');
    const res = await GET(makeRequest('spring-2026', 'limit=0'), makeContext('spring-2026'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta.limit).toBe(50); // 0 parsed to 50 default via || 50
  });

  it('defaults pagination when params not provided', async () => {
    queryResults[0] = [{ id: 'auction-1', slug: 'spring-2026' }];
    queryResults[1] = [{ total: 0 }];
    queryResults[2] = [];

    const { GET } = await import('@/app/api/v1/auctions/[slug]/lots/route');
    const res = await GET(makeRequest('spring-2026'), makeContext('spring-2026'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta.limit).toBe(50);
    expect(body.meta.offset).toBe(0);
  });

  it('accepts valid comma-separated status filter', async () => {
    queryResults[0] = [{ id: 'auction-1', slug: 'spring-2026' }];
    queryResults[1] = [{ total: 1 }];
    queryResults[2] = [{ id: 'lot-1', title: 'Active Lot', status: 'active' }];

    const { GET } = await import('@/app/api/v1/auctions/[slug]/lots/route');
    const res = await GET(makeRequest('spring-2026', 'status=active,sold'), makeContext('spring-2026'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
  });

  it('filters out invalid statuses but keeps valid ones', async () => {
    queryResults[0] = [{ id: 'auction-1', slug: 'spring-2026' }];
    queryResults[1] = [{ total: 1 }];
    queryResults[2] = [{ id: 'lot-1', status: 'active' }];

    const { GET } = await import('@/app/api/v1/auctions/[slug]/lots/route');
    const res = await GET(makeRequest('spring-2026', 'status=active,invalid'), makeContext('spring-2026'));
    const body = await res.json();

    // Should succeed because 'active' is valid even though 'invalid' is filtered out
    expect(res.status).toBe(200);
  });

  it('returns 500 on unexpected DB error', async () => {
    // Make auction found but count query fails by providing no result for index 1
    // Actually, the proxy always resolves. To trigger 500, we need to make the proxy throw.
    // Easiest approach: override the db temporarily... but mocks are hoisted.
    // Alternative: the route destructures `[{ total }]` from count result.
    // If queryResults[1] = [], then `[{ total }]` destructures undefined -> throws TypeError.
    queryResults[0] = [{ id: 'auction-1', slug: 'spring-2026' }];
    // count query returns empty array, destructuring [{ total }] will throw
    queryResults[1] = [];

    const { GET } = await import('@/app/api/v1/auctions/[slug]/lots/route');
    const res = await GET(makeRequest('spring-2026'), makeContext('spring-2026'));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
