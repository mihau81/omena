/**
 * Unit tests for PATCH /api/admin/lots/[id]/status
 * Coverage target: lot status transitions with notification logic
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
const mockUpdate = vi.fn();
const mockSet = vi.fn();
const mockReturning = vi.fn();

const chainedDb = {
  select: mockSelect,
  from: mockFrom,
  where: mockWhere,
  limit: mockLimit,
  update: mockUpdate,
  set: mockSet,
  returning: mockReturning,
};

mockSelect.mockReturnValue(chainedDb);
mockFrom.mockReturnValue(chainedDb);
mockWhere.mockReturnValue(chainedDb);
mockLimit.mockResolvedValue([]);
mockUpdate.mockReturnValue(chainedDb);
mockSet.mockReturnValue(chainedDb);
mockReturning.mockResolvedValue([]);

vi.mock('@/db/connection', () => ({ db: chainedDb }));

vi.mock('@/db/schema', () => ({
  lots: { id: 'id', deletedAt: 'deletedAt', status: 'status' },
  auctions: { id: 'id', buyersPremiumRate: 'buyersPremiumRate' },
}));

// ─── Mock audit ─────────────────────────────────────────────────────────────

vi.mock('@/lib/audit', () => ({
  logCreate: vi.fn().mockResolvedValue(undefined),
  logUpdate: vi.fn().mockResolvedValue(undefined),
  logDelete: vi.fn().mockResolvedValue(undefined),
}));

// ─── Mock notifications and bid service ─────────────────────────────────────

const mockCreateNotification = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/notifications', () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}));

const mockGetWinningBid = vi.fn();
vi.mock('@/lib/bid-service', () => ({
  getWinningBid: (...args: unknown[]) => mockGetWinningBid(...args),
}));

// ─── Import AuthError ───────────────────────────────────────────────────────

const { AuthError } = await import('@/lib/auth-utils');

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(body: unknown) {
  return new Request('http://localhost:3000/api/admin/lots/lot-1/status', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeContext(id = 'lot-1') {
  return { params: Promise.resolve({ id }) };
}

describe('PATCH /api/admin/lots/[id]/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue(chainedDb);
    mockFrom.mockReturnValue(chainedDb);
    mockWhere.mockReturnValue(chainedDb);
    mockLimit.mockResolvedValue([]);
    mockUpdate.mockReturnValue(chainedDb);
    mockSet.mockReturnValue(chainedDb);
    mockReturning.mockResolvedValue([]);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { PATCH } = await import('@/app/api/admin/lots/[id]/status/route');
    const res = await PATCH(makeRequest({ status: 'published' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 403 when admin lacks lots:write permission', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Missing permission: lots:write', 403));

    const { PATCH } = await import('@/app/api/admin/lots/[id]/status/route');
    const res = await PATCH(makeRequest({ status: 'published' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('Missing permission: lots:write');
  });

  it('returns 400 for invalid status value', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });

    const { PATCH } = await import('@/app/api/admin/lots/[id]/status/route');
    const res = await PATCH(makeRequest({ status: 'invalid_status' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Validation failed');
  });

  it('returns 404 when lot not found', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([]); // no lot found

    const { PATCH } = await import('@/app/api/admin/lots/[id]/status/route');
    const res = await PATCH(makeRequest({ status: 'published' }), makeContext('nonexistent'));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Lot not found');
  });

  it('returns 400 for invalid status transition', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    // Lot exists with status 'draft'
    mockLimit.mockResolvedValueOnce([{ id: 'lot-1', status: 'draft', auctionId: 'a1' }]);

    const { PATCH } = await import('@/app/api/admin/lots/[id]/status/route');
    // draft -> published is invalid (draft -> catalogued is the valid transition)
    const res = await PATCH(makeRequest({ status: 'published' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Cannot transition from 'draft' to 'published'");
  });

  it('successfully transitions draft -> catalogued', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([{ id: 'lot-1', status: 'draft', auctionId: 'a1' }]);
    const updatedLot = { id: 'lot-1', status: 'catalogued', auctionId: 'a1' };
    mockReturning.mockResolvedValueOnce([updatedLot]);

    const { PATCH } = await import('@/app/api/admin/lots/[id]/status/route');
    const res = await PATCH(makeRequest({ status: 'catalogued' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.lot.status).toBe('catalogued');
  });

  it('successfully transitions catalogued -> published', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([{ id: 'lot-1', status: 'catalogued', auctionId: 'a1' }]);
    mockReturning.mockResolvedValueOnce([{ id: 'lot-1', status: 'published' }]);

    const { PATCH } = await import('@/app/api/admin/lots/[id]/status/route');
    const res = await PATCH(makeRequest({ status: 'published' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.lot.status).toBe('published');
  });

  it('successfully transitions active -> sold and triggers notification', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([
      { id: 'lot-1', status: 'active', auctionId: 'auction-1', title: 'Test Lot', hammerPrice: 5000 },
    ]);
    mockReturning.mockResolvedValueOnce([{ id: 'lot-1', status: 'sold' }]);

    // Mock getWinningBid for the notification path
    mockGetWinningBid.mockResolvedValue({ userId: 'user-1', amount: 5000 });
    // Mock the auction query for buyer's premium
    mockLimit.mockResolvedValueOnce([{ buyersPremiumRate: '0.2000' }]);

    const { PATCH } = await import('@/app/api/admin/lots/[id]/status/route');
    const res = await PATCH(makeRequest({ status: 'sold' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.lot.status).toBe('sold');

    // Allow async notification to run
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockGetWinningBid).toHaveBeenCalledWith('lot-1');
  });

  it('does not crash when sold notification fails', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([
      { id: 'lot-1', status: 'active', auctionId: 'a1', title: 'Test', hammerPrice: 1000 },
    ]);
    mockReturning.mockResolvedValueOnce([{ id: 'lot-1', status: 'sold' }]);
    mockGetWinningBid.mockRejectedValue(new Error('Notification service down'));

    const { PATCH } = await import('@/app/api/admin/lots/[id]/status/route');
    const res = await PATCH(makeRequest({ status: 'sold' }), makeContext());

    // Should still return 200 because notification is fire-and-forget
    expect(res.status).toBe(200);
  });

  it('successfully transitions active -> passed', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([{ id: 'lot-1', status: 'active', auctionId: 'a1' }]);
    mockReturning.mockResolvedValueOnce([{ id: 'lot-1', status: 'passed' }]);

    const { PATCH } = await import('@/app/api/admin/lots/[id]/status/route');
    const res = await PATCH(makeRequest({ status: 'passed' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.lot.status).toBe('passed');
    // passed does not trigger notification
    expect(mockGetWinningBid).not.toHaveBeenCalled();
  });

  it('returns 400 for terminal state transitions (sold -> anything)', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([{ id: 'lot-1', status: 'sold', auctionId: 'a1' }]);

    const { PATCH } = await import('@/app/api/admin/lots/[id]/status/route');
    const res = await PATCH(makeRequest({ status: 'active' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Cannot transition from 'sold' to 'active'");
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('DB crash'));

    const { PATCH } = await import('@/app/api/admin/lots/[id]/status/route');
    const res = await PATCH(makeRequest({ status: 'catalogued' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
