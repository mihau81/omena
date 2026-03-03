/**
 * Unit tests for /api/admin/auctions/[id]/lots (GET, POST)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock auth ──────────────────────────────────────────────────────────────

const mockRequireAdmin = vi.fn();

vi.mock('@/lib/auth-utils', () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
  AuthError: class AuthError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 401) {
      super(message);
      this.name = 'AuthError';
      this.statusCode = statusCode;
    }
  },
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: { GET: vi.fn(), POST: vi.fn() },
}));

// ─── Mock DB with flexible chaining ─────────────────────────────────────────

let queryResults: unknown[][] = [];
let updateResults: unknown[][] = [];

function createChainedProxy(): Record<string, unknown> {
  const proxy: Record<string, unknown> = {};
  const chainMethods = ['select', 'from', 'innerJoin', 'leftJoin'];

  for (const m of chainMethods) {
    proxy[m] = vi.fn().mockImplementation(() => proxy);
  }

  proxy.limit = vi.fn().mockImplementation(() => {
    const result = queryResults.shift() ?? [];
    return Promise.resolve(result);
  });

  // orderBy is terminal for some queries
  proxy.orderBy = vi.fn().mockImplementation(() => {
    const thenableProxy = { ...proxy };
    thenableProxy.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
      const result = queryResults.shift() ?? [];
      return Promise.resolve(result).then(resolve, reject);
    };
    return thenableProxy;
  });

  proxy.where = vi.fn().mockImplementation(() => {
    const thenableProxy = { ...proxy };
    thenableProxy.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
      const result = queryResults.shift() ?? [];
      return Promise.resolve(result).then(resolve, reject);
    };
    thenableProxy.limit = proxy.limit;
    thenableProxy.orderBy = proxy.orderBy;
    return thenableProxy;
  });

  proxy.update = vi.fn().mockImplementation(() => proxy);
  proxy.set = vi.fn().mockImplementation(() => proxy);
  proxy.returning = vi.fn().mockImplementation(() => {
    const result = updateResults.shift() ?? [];
    return Promise.resolve(result);
  });
  proxy.insert = vi.fn().mockImplementation(() => proxy);
  proxy.values = vi.fn().mockImplementation(() => proxy);

  return proxy;
}

const mockDb = createChainedProxy();

vi.mock('@/db/connection', () => ({ db: mockDb }));

vi.mock('@/db/schema', () => ({
  lots: { id: 'id', auctionId: 'auctionId', deletedAt: 'deletedAt', lotNumber: 'lotNumber', sortOrder: 'sortOrder' },
  media: { id: 'id', lotId: 'lotId', isPrimary: 'isPrimary', deletedAt: 'deletedAt', thumbnailUrl: 'thumbnailUrl' },
  auctions: { id: 'id', deletedAt: 'deletedAt' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ _eq: args })),
  and: vi.fn((...args: unknown[]) => ({ _and: args })),
  isNull: vi.fn((col: unknown) => ({ _isNull: col })),
  asc: vi.fn((col: unknown) => ({ _asc: col })),
  max: vi.fn((col: unknown) => ({ _max: col })),
}));

vi.mock('@/lib/audit', () => ({
  logCreate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/validation/lot', () => ({
  createLotSchema: {
    safeParse: vi.fn((data: unknown) => {
      const d = data as Record<string, unknown>;
      if (!d || !d.title) {
        return {
          success: false,
          error: { flatten: () => ({ fieldErrors: { title: ['Title is required'] } }) },
        };
      }
      return { success: true, data: d };
    }),
  },
}));

// ─── Import ─────────────────────────────────────────────────────────────────

const { AuthError } = await import('@/lib/auth-utils');

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeGetRequest() {
  return new Request('http://localhost:3000/api/admin/auctions/auc-1/lots', {
    method: 'GET',
  });
}

function makePostRequest(body: unknown) {
  return new Request('http://localhost:3000/api/admin/auctions/auc-1/lots', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeContext(id = 'auc-1') {
  return { params: Promise.resolve({ id }) };
}

// ─── Tests: GET ─────────────────────────────────────────────────────────────

describe('GET /api/admin/auctions/[id]/lots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = [];
    updateResults = [];
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { GET } = await import('@/app/api/admin/auctions/[id]/lots/route');
    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns lots for auction', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    const lotRows = [
      { lot: { id: 'lot-1', title: 'Lot 1' }, primaryThumbnailUrl: 'thumb1.jpg' },
      { lot: { id: 'lot-2', title: 'Lot 2' }, primaryThumbnailUrl: null },
    ];
    // The GET does: db.select().from().leftJoin().where().orderBy()
    // .orderBy() is terminal -> resolves via thenable
    queryResults = [lotRows];

    const { GET } = await import('@/app/api/admin/auctions/[id]/lots/route');
    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.lots).toHaveLength(2);
    expect(body.lots[0].primaryThumbnailUrl).toBe('thumb1.jpg');
    expect(body.lots[1].primaryThumbnailUrl).toBeNull();
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Crash'));

    const { GET } = await import('@/app/api/admin/auctions/[id]/lots/route');
    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});

// ─── Tests: POST ────────────────────────────────────────────────────────────

describe('POST /api/admin/auctions/[id]/lots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = [];
    updateResults = [];
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { POST } = await import('@/app/api/admin/auctions/[id]/lots/route');
    const res = await POST(makePostRequest({ title: 'Test' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 404 when auction not found', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    // select().from().where().limit(1) -> []
    queryResults = [[]];

    const { POST } = await import('@/app/api/admin/auctions/[id]/lots/route');
    const res = await POST(makePostRequest({ title: 'Test' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Auction not found');
  });

  it('returns 400 for invalid lot data', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    // 1. Auction found: select().from().where().limit(1)
    // 2. Max lot number: select().from().where() (thenable)
    queryResults = [
      [{ id: 'auc-1' }],      // auction found
      [{ maxNum: 5 }],         // max lot number
    ];

    const { POST } = await import('@/app/api/admin/auctions/[id]/lots/route');
    const res = await POST(makePostRequest({}), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Validation failed');
  });

  it('creates lot successfully', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    const created = { id: 'lot-new', title: 'Test Lot', auctionId: 'auc-1', lotNumber: 6 };

    // 1. Auction: select().from().where().limit(1)
    // 2. Max lot number: select().from().where() (thenable)
    // 3. Max sort order: select().from().where() (thenable)
    queryResults = [
      [{ id: 'auc-1' }],     // auction found
      [{ maxNum: 5 }],        // max lot number
      [{ maxSort: 4 }],       // max sort order
    ];
    updateResults = [
      [created],               // insert().values().returning()
    ];

    const { POST } = await import('@/app/api/admin/auctions/[id]/lots/route');
    const res = await POST(makePostRequest({ title: 'Test Lot', auctionId: 'auc-1', lotNumber: 6 }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.lot.title).toBe('Test Lot');
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Crash'));

    const { POST } = await import('@/app/api/admin/auctions/[id]/lots/route');
    const res = await POST(makePostRequest({ title: 'X' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
