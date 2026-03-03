/**
 * Unit tests for POST /api/admin/bids/[bidId]/retract
 * Coverage target: bid retraction logic
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

// ─── Mock pool (raw SQL) ────────────────────────────────────────────────────

const mockQuery = vi.fn();
const mockRelease = vi.fn();
const mockConnect = vi.fn();

vi.mock('@/db/connection', () => ({
  db: {},
  pool: {
    connect: (...args: unknown[]) => mockConnect(...args),
  },
}));

// ─── Mock audit ─────────────────────────────────────────────────────────────

vi.mock('@/lib/audit', () => ({
  logCreate: vi.fn().mockResolvedValue(undefined),
  logUpdate: vi.fn().mockResolvedValue(undefined),
  logDelete: vi.fn().mockResolvedValue(undefined),
}));

// ─── Mock bid events ────────────────────────────────────────────────────────

const mockEmitBid = vi.fn();
vi.mock('@/lib/bid-events', () => ({
  emitBid: (...args: unknown[]) => mockEmitBid(...args),
}));

// ─── Mock bidding lib ───────────────────────────────────────────────────────

vi.mock('@/app/lib/bidding', () => ({
  getNextMinBid: vi.fn().mockReturnValue(100),
}));

// ─── Import AuthError ───────────────────────────────────────────────────────

const { AuthError } = await import('@/lib/auth-utils');

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(body: unknown) {
  return new Request('http://localhost:3000/api/admin/bids/bid-1/retract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeContext(bidId = 'bid-1') {
  return { params: Promise.resolve({ bidId }) };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('POST /api/admin/bids/[bidId]/retract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const client = { query: mockQuery, release: mockRelease };
    mockConnect.mockResolvedValue(client);
    mockQuery.mockResolvedValue({ rows: [] });
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { POST } = await import('@/app/api/admin/bids/[bidId]/retract/route');
    const res = await POST(makeRequest({ reason: 'test' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 400 when reason is missing', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });

    const { POST } = await import('@/app/api/admin/bids/[bidId]/retract/route');
    const res = await POST(makeRequest({}), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Reason is required');
  });

  it('returns 400 when reason is empty string', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });

    const { POST } = await import('@/app/api/admin/bids/[bidId]/retract/route');
    const res = await POST(makeRequest({ reason: '  ' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Reason is required');
  });

  it('returns 404 when bid not found', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    // BEGIN
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // bid SELECT
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // ROLLBACK
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const { POST } = await import('@/app/api/admin/bids/[bidId]/retract/route');
    const res = await POST(makeRequest({ reason: 'Invalid bid' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Bid not found');
  });

  it('returns 409 when bid already retracted', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    // BEGIN
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // bid SELECT
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'bid-1', lot_id: 'lot-1', amount: 500, is_winning: true, auction_id: 'auc-1' }],
    });
    // existing retraction check
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'ret-1' }] });
    // ROLLBACK
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const { POST } = await import('@/app/api/admin/bids/[bidId]/retract/route');
    const res = await POST(makeRequest({ reason: 'Duplicate' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe('Bid is already retracted');
  });

  it('retracts non-winning bid successfully', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    // BEGIN
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // bid SELECT
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'bid-1', lot_id: 'lot-1', amount: 200, is_winning: false, auction_id: 'auc-1' }],
    });
    // existing retraction check
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // INSERT retraction
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // COMMIT
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const { POST } = await import('@/app/api/admin/bids/[bidId]/retract/route');
    const res = await POST(makeRequest({ reason: 'Test retraction' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.newWinningAmount).toBe(0);
    expect(mockEmitBid).not.toHaveBeenCalled();
  });

  it('retracts winning bid and promotes next highest', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    // BEGIN
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // bid SELECT
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'bid-1', lot_id: 'lot-1', amount: 500, is_winning: true, auction_id: 'auc-1' }],
    });
    // existing retraction check
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // INSERT retraction
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // UPDATE bids SET is_winning = false
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // next highest bid SELECT
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'bid-2', amount: 400 }],
    });
    // UPDATE bids SET is_winning = true
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // COMMIT
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const { POST } = await import('@/app/api/admin/bids/[bidId]/retract/route');
    const res = await POST(makeRequest({ reason: 'Fraudulent' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.newWinningAmount).toBe(400);
    expect(mockEmitBid).toHaveBeenCalled();
  });

  it('retracts winning bid with no next highest', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    // BEGIN
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // bid SELECT
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 'bid-1', lot_id: 'lot-1', amount: 500, is_winning: true, auction_id: 'auc-1' }],
    });
    // existing retraction check
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // INSERT retraction
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // UPDATE bids SET is_winning = false
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // next highest bid SELECT — none
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // COMMIT
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const { POST } = await import('@/app/api/admin/bids/[bidId]/retract/route');
    const res = await POST(makeRequest({ reason: 'Cancelled' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.newWinningAmount).toBe(0);
    expect(mockEmitBid).toHaveBeenCalled();
  });

  it('returns 500 on unexpected error and rolls back', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    // BEGIN
    mockQuery.mockResolvedValueOnce({ rows: [] });
    // bid SELECT throws
    mockQuery.mockRejectedValueOnce(new Error('DB crash'));
    // ROLLBACK
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const { POST } = await import('@/app/api/admin/bids/[bidId]/retract/route');
    const res = await POST(makeRequest({ reason: 'test' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
    expect(mockRelease).toHaveBeenCalled();
  });
});
