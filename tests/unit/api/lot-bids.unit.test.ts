/**
 * Unit tests for POST/GET /api/lots/[id]/bids
 * Coverage target: bid placement and bid history retrieval
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock auth ──────────────────────────────────────────────────────────────

const mockRequireAuth = vi.fn();

vi.mock('@/lib/auth-utils', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
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

// ─── Mock bid-service ───────────────────────────────────────────────────────

const mockPlaceBid = vi.fn();
const mockGetBidHistory = vi.fn();

class MockBidError extends Error {
  code: string;
  statusCode: number;
  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.name = 'BidError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

vi.mock('@/lib/bid-service', () => ({
  placeBid: (...args: unknown[]) => mockPlaceBid(...args),
  getBidHistory: (...args: unknown[]) => mockGetBidHistory(...args),
  BidError: MockBidError,
}));

// ─── Mock rate limiter ──────────────────────────────────────────────────────

const mockBidLimiterCheck = vi.fn();
vi.mock('@/lib/rate-limiters', () => ({
  bidLimiter: {
    check: (...args: unknown[]) => mockBidLimiterCheck(...args),
  },
}));

// ─── Mock bidding lib ───────────────────────────────────────────────────────

vi.mock('@/app/lib/bidding', () => ({
  getNextMinBid: vi.fn((amount: number) => amount + 100),
}));

// ─── Mock Sentry ────────────────────────────────────────────────────────────

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

// ─── Import AuthError ───────────────────────────────────────────────────────

const { AuthError } = await import('@/lib/auth-utils');

// ─── Helpers ────────────────────────────────────────────────────────────────

function makePostRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://localhost:3000/api/lots/lot-1/bids', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': '1.2.3.4',
      'user-agent': 'TestAgent/1.0',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function makeGetRequest() {
  return new Request('http://localhost:3000/api/lots/lot-1/bids');
}

function makeContext(id = 'lot-1') {
  return { params: Promise.resolve({ id }) };
}

// ─── POST tests ─────────────────────────────────────────────────────────────

describe('POST /api/lots/[id]/bids', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBidLimiterCheck.mockReturnValue({ success: true });
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new AuthError('Authentication required', 401));

    const { POST } = await import('@/app/api/lots/[id]/bids/route');
    const res = await POST(makePostRequest({ amount: 1000 }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 403 for admin users', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'admin-1', userType: 'admin' });

    const { POST } = await import('@/app/api/lots/[id]/bids/route');
    const res = await POST(makePostRequest({ amount: 1000 }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('Only registered users can place bids');
  });

  it('returns 429 when rate limited', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'user-1', userType: 'user' });
    mockBidLimiterCheck.mockReturnValue({ success: false, resetMs: 2000 });

    const { POST } = await import('@/app/api/lots/[id]/bids/route');
    const res = await POST(makePostRequest({ amount: 1000 }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error).toContain('Too many bids');
    expect(res.headers.get('Retry-After')).toBe('2');
  });

  it('returns 400 for invalid body (missing amount)', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'user-1', userType: 'user' });

    const { POST } = await import('@/app/api/lots/[id]/bids/route');
    const res = await POST(makePostRequest({}), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Validation failed');
    expect(body.details).toBeDefined();
  });

  it('returns 400 for negative amount', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'user-1', userType: 'user' });

    const { POST } = await import('@/app/api/lots/[id]/bids/route');
    const res = await POST(makePostRequest({ amount: -500 }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Validation failed');
  });

  it('returns 400 for non-integer amount', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'user-1', userType: 'user' });

    const { POST } = await import('@/app/api/lots/[id]/bids/route');
    const res = await POST(makePostRequest({ amount: 100.5 }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Validation failed');
  });

  it('returns 201 on successful bid placement', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'user-1', userType: 'user' });
    mockPlaceBid.mockResolvedValue({
      bid: {
        id: 'bid-1',
        lotId: 'lot-1',
        userId: 'user-1',
        amount: 5000,
        bidType: 'online',
        isWinning: true,
        createdAt: new Date('2026-01-01'),
      },
      nextMinBid: 5500,
    });

    const { POST } = await import('@/app/api/lots/[id]/bids/route');
    const res = await POST(makePostRequest({ amount: 5000 }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.bid.id).toBe('bid-1');
    expect(body.bid.amount).toBe(5000);
    expect(body.bid.isWinning).toBe(true);
    expect(body.nextMinBid).toBe(5500);
    expect(mockPlaceBid).toHaveBeenCalledWith('lot-1', 'user-1', 5000, '1.2.3.4', 'TestAgent/1.0');
  });

  it('passes IP and user agent from request headers', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'user-1', userType: 'user' });
    mockPlaceBid.mockResolvedValue({
      bid: { id: 'bid-1', amount: 1000, isWinning: true, createdAt: new Date() },
      nextMinBid: 1100,
    });

    const { POST } = await import('@/app/api/lots/[id]/bids/route');
    await POST(
      makePostRequest({ amount: 1000 }, { 'x-forwarded-for': '10.0.0.1, 172.16.0.1', 'user-agent': 'CustomAgent' }),
      makeContext(),
    );

    expect(mockPlaceBid).toHaveBeenCalledWith('lot-1', 'user-1', 1000, '10.0.0.1', 'CustomAgent');
  });

  it('returns BidError status code when service throws', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'user-1', userType: 'user' });
    mockPlaceBid.mockRejectedValue(
      new MockBidError('Bid too low', 'BID_TOO_LOW', 422),
    );

    const { POST } = await import('@/app/api/lots/[id]/bids/route');
    const res = await POST(makePostRequest({ amount: 100 }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error).toBe('Bid too low');
    expect(body.code).toBe('BID_TOO_LOW');
  });

  it('returns BidError for lot not active', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'user-1', userType: 'user' });
    mockPlaceBid.mockRejectedValue(
      new MockBidError('Lot is not active', 'LOT_NOT_ACTIVE', 409),
    );

    const { POST } = await import('@/app/api/lots/[id]/bids/route');
    const res = await POST(makePostRequest({ amount: 5000 }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.code).toBe('LOT_NOT_ACTIVE');
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'user-1', userType: 'user' });
    mockPlaceBid.mockRejectedValue(new Error('DB crash'));

    const { POST } = await import('@/app/api/lots/[id]/bids/route');
    const res = await POST(makePostRequest({ amount: 5000 }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});

// ─── GET tests ──────────────────────────────────────────────────────────────

describe('GET /api/lots/[id]/bids', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns bid history with anonymized data', async () => {
    mockGetBidHistory.mockResolvedValue([
      { id: 'bid-1', amount: 5000, bidType: 'online', paddleNumber: 'P-001', isWinning: true, createdAt: new Date(), isRetracted: false },
      { id: 'bid-2', amount: 3000, bidType: 'online', paddleNumber: 'P-002', isWinning: false, createdAt: new Date(), isRetracted: false },
    ]);

    const { GET } = await import('@/app/api/lots/[id]/bids/route');
    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.bids).toHaveLength(2);
    expect(body.bids[0].paddleNumber).toBe('P-001');
    // Ensure no user identity is leaked
    expect(body.bids[0]).not.toHaveProperty('userId');
    expect(body.currentHighestBid).toBe(5000);
    expect(body.nextMinBid).toBe(5100); // 5000 + 100
    expect(body.totalBids).toBe(2);
  });

  it('returns empty bid history', async () => {
    mockGetBidHistory.mockResolvedValue([]);

    const { GET } = await import('@/app/api/lots/[id]/bids/route');
    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.bids).toEqual([]);
    expect(body.currentHighestBid).toBeNull();
    expect(body.nextMinBid).toBe(100); // getNextMinBid(0) = 0 + 100
    expect(body.totalBids).toBe(0);
  });

  it('excludes retracted bids from totalBids count', async () => {
    mockGetBidHistory.mockResolvedValue([
      { id: 'bid-1', amount: 5000, bidType: 'online', paddleNumber: 'P-001', isWinning: true, createdAt: new Date(), isRetracted: false },
      { id: 'bid-2', amount: 3000, bidType: 'online', paddleNumber: 'P-002', isWinning: false, createdAt: new Date(), isRetracted: true },
    ]);

    const { GET } = await import('@/app/api/lots/[id]/bids/route');
    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.totalBids).toBe(1);
    expect(body.bids).toHaveLength(2); // All bids returned, retracted ones included
  });

  it('currentHighestBid ignores retracted winning bids', async () => {
    mockGetBidHistory.mockResolvedValue([
      { id: 'bid-1', amount: 5000, bidType: 'online', paddleNumber: 'P-001', isWinning: true, createdAt: new Date(), isRetracted: true },
      { id: 'bid-2', amount: 3000, bidType: 'online', paddleNumber: 'P-002', isWinning: false, createdAt: new Date(), isRetracted: false },
    ]);

    const { GET } = await import('@/app/api/lots/[id]/bids/route');
    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    // Retracted winning bid should not be current highest
    expect(body.currentHighestBid).toBeNull();
  });

  it('returns 500 on unexpected error', async () => {
    mockGetBidHistory.mockRejectedValue(new Error('DB crash'));

    const { GET } = await import('@/app/api/lots/[id]/bids/route');
    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
