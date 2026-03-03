/**
 * Unit tests for /api/admin/lots/[id]/bids (GET, POST)
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

// ─── Mock DB ────────────────────────────────────────────────────────────────

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockOrderBy = vi.fn();
const mockLeftJoin = vi.fn();

const chainedDb = {
  select: mockSelect,
  from: mockFrom,
  where: mockWhere,
  limit: mockLimit,
  orderBy: mockOrderBy,
  leftJoin: mockLeftJoin,
};

mockSelect.mockReturnValue(chainedDb);
mockFrom.mockReturnValue(chainedDb);
mockWhere.mockReturnValue(chainedDb);
mockLimit.mockResolvedValue([]);
mockOrderBy.mockResolvedValue([]);
mockLeftJoin.mockReturnValue(chainedDb);

// Mock pool for POST handler
const mockPoolQuery = vi.fn();
const mockRelease = vi.fn();
const mockPoolConnect = vi.fn().mockResolvedValue({
  query: mockPoolQuery,
  release: mockRelease,
});

vi.mock('@/db/connection', () => ({
  db: chainedDb,
  pool: { connect: () => mockPoolConnect() },
}));

vi.mock('@/db/schema', () => ({
  bids: { id: 'id', lotId: 'lotId', amount: 'amount', bidType: 'bidType', isWinning: 'isWinning', createdAt: 'createdAt', userId: 'userId', paddleNumber: 'paddleNumber' },
  bidRetractions: { id: 'id', bidId: 'bidId', reason: 'reason' },
  lots: { id: 'id', title: 'title', deletedAt: 'deletedAt' },
  users: { id: 'id', name: 'name', email: 'email' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ _eq: args })),
  and: vi.fn((...args: unknown[]) => ({ _and: args })),
  desc: vi.fn((col: unknown) => ({ _desc: col })),
  isNull: vi.fn((col: unknown) => ({ _isNull: col })),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ _sql: strings, values })),
}));

const mockGetNextMinBid = vi.fn();
vi.mock('@/app/lib/bidding', () => ({
  getNextMinBid: (...args: unknown[]) => mockGetNextMinBid(...args),
}));

vi.mock('@/lib/audit', () => ({
  logCreate: vi.fn().mockResolvedValue(undefined),
  logUpdate: vi.fn().mockResolvedValue(undefined),
}));

const mockEmitBid = vi.fn();
vi.mock('@/lib/bid-events', () => ({
  emitBid: (...args: unknown[]) => mockEmitBid(...args),
}));

// ─── Import ─────────────────────────────────────────────────────────────────

const { AuthError } = await import('@/lib/auth-utils');

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeGetRequest() {
  return new Request('http://localhost:3000/api/admin/lots/lot-1/bids', {
    method: 'GET',
  });
}

function makePostRequest(body: unknown) {
  return new Request('http://localhost:3000/api/admin/lots/lot-1/bids', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeContext(id = 'lot-1') {
  return { params: Promise.resolve({ id }) };
}

// ─── Tests: GET ─────────────────────────────────────────────────────────────

describe('GET /api/admin/lots/[id]/bids', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue(chainedDb);
    mockFrom.mockReturnValue(chainedDb);
    mockWhere.mockReturnValue(chainedDb);
    mockLimit.mockResolvedValue([]);
    mockOrderBy.mockResolvedValue([]);
    mockLeftJoin.mockReturnValue(chainedDb);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { GET } = await import('@/app/api/admin/lots/[id]/bids/route');
    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 404 when lot not found', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([]);

    const { GET } = await import('@/app/api/admin/lots/[id]/bids/route');
    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Lot not found');
  });

  it('returns bid history with nextMinBid', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([{ id: 'lot-1', title: 'Test Lot' }]);

    const bidHistory = [
      { id: 'bid-1', amount: 5000, isRetracted: false },
      { id: 'bid-2', amount: 3000, isRetracted: true },
    ];
    mockOrderBy.mockResolvedValueOnce(bidHistory);
    mockGetNextMinBid.mockReturnValue(5500);

    const { GET } = await import('@/app/api/admin/lots/[id]/bids/route');
    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.bids).toEqual(bidHistory);
    expect(body.nextMinBid).toBe(5500);
    expect(body.currentHighestBid).toBe(5000);
  });

  it('returns 0 for highest bid when no non-retracted bids exist', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([{ id: 'lot-1', title: 'Test Lot' }]);
    mockOrderBy.mockResolvedValueOnce([]);
    mockGetNextMinBid.mockReturnValue(100);

    const { GET } = await import('@/app/api/admin/lots/[id]/bids/route');
    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.currentHighestBid).toBe(0);
    expect(body.nextMinBid).toBe(100);
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Crash'));

    const { GET } = await import('@/app/api/admin/lots/[id]/bids/route');
    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});

// ─── Tests: POST ────────────────────────────────────────────────────────────

describe('POST /api/admin/lots/[id]/bids', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue(chainedDb);
    mockFrom.mockReturnValue(chainedDb);
    mockWhere.mockReturnValue(chainedDb);
    mockLimit.mockResolvedValue([]);
    mockPoolConnect.mockResolvedValue({
      query: mockPoolQuery,
      release: mockRelease,
    });
    mockPoolQuery.mockResolvedValue({ rows: [] });
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { POST } = await import('@/app/api/admin/lots/[id]/bids/route');
    const res = await POST(makePostRequest({ amount: 1000, bidType: 'floor' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 400 for invalid amount', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });

    const { POST } = await import('@/app/api/admin/lots/[id]/bids/route');
    const res = await POST(makePostRequest({ amount: -100, bidType: 'floor' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('Invalid bid amount');
  });

  it('returns 400 for invalid bidType', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });

    const { POST } = await import('@/app/api/admin/lots/[id]/bids/route');
    const res = await POST(makePostRequest({ amount: 1000, bidType: 'online' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('bidType');
  });

  it('returns 404 when lot not found in transaction', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // advisory lock
      .mockResolvedValueOnce({ rows: [] }) // lot query (empty)
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    const { POST } = await import('@/app/api/admin/lots/[id]/bids/route');
    const res = await POST(makePostRequest({ amount: 1000, bidType: 'floor' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Lot not found');
  });

  it('returns 400 when bid is below minimum', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGetNextMinBid.mockReturnValue(5000);

    mockPoolQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // advisory lock
      .mockResolvedValueOnce({ rows: [{ id: 'lot-1', starting_bid: 1000, auction_id: 'auc-1' }] }) // lot query
      .mockResolvedValueOnce({ rows: [{ amount: 4500, id: 'bid-old' }] }) // highest bid
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    const { POST } = await import('@/app/api/admin/lots/[id]/bids/route');
    const res = await POST(makePostRequest({ amount: 3000, bidType: 'floor' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('at least');
    expect(body.minBid).toBe(5000);
  });

  it('creates bid successfully', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGetNextMinBid.mockReturnValue(5500);

    mockPoolQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // advisory lock
      .mockResolvedValueOnce({ rows: [{ id: 'lot-1', starting_bid: 1000, auction_id: 'auc-1' }] }) // lot
      .mockResolvedValueOnce({ rows: [{ amount: 5000, id: 'old-bid' }] }) // highest bid
      .mockResolvedValueOnce({ rows: [] }) // update old winning bid
      .mockResolvedValueOnce({ rows: [{ id: 'new-bid', lot_id: 'lot-1', amount: 5500, bid_type: 'floor', is_winning: true, created_at: '2024-01-01T00:00:00Z' }] }) // insert
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const { POST } = await import('@/app/api/admin/lots/[id]/bids/route');
    const res = await POST(makePostRequest({ amount: 5500, bidType: 'floor', paddleNumber: 42 }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.bid.amount).toBe(5500);
    expect(body.bid.bidType).toBe('floor');
    expect(mockEmitBid).toHaveBeenCalled();
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Crash'));

    const { POST } = await import('@/app/api/admin/lots/[id]/bids/route');
    const res = await POST(makePostRequest({ amount: 1000, bidType: 'floor' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
