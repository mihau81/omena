/**
 * Unit tests for PATCH /api/admin/auctions/[id]/status
 * Coverage target: auction status transitions
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
  auctions: { id: 'id', deletedAt: 'deletedAt', status: 'status' },
}));

// ─── Mock audit ─────────────────────────────────────────────────────────────

vi.mock('@/lib/audit', () => ({
  logCreate: vi.fn().mockResolvedValue(undefined),
  logUpdate: vi.fn().mockResolvedValue(undefined),
  logDelete: vi.fn().mockResolvedValue(undefined),
}));

// ─── Import ─────────────────────────────────────────────────────────────────

const { AuthError } = await import('@/lib/auth-utils');

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(body: unknown) {
  return new Request('http://localhost:3000/api/admin/auctions/a1/status', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeContext(id = 'auction-1') {
  return { params: Promise.resolve({ id }) };
}

describe('PATCH /api/admin/auctions/[id]/status', () => {
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

    const { PATCH } = await import('@/app/api/admin/auctions/[id]/status/route');
    const res = await PATCH(makeRequest({ status: 'preview' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 403 when admin lacks auctions:status permission', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Missing permission: auctions:status', 403));

    const { PATCH } = await import('@/app/api/admin/auctions/[id]/status/route');
    const res = await PATCH(makeRequest({ status: 'preview' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('Missing permission: auctions:status');
  });

  it('returns 400 for invalid status value', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });

    const { PATCH } = await import('@/app/api/admin/auctions/[id]/status/route');
    const res = await PATCH(makeRequest({ status: 'nonexistent' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Validation failed');
  });

  it('returns 404 when auction not found', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([]); // auction not found

    const { PATCH } = await import('@/app/api/admin/auctions/[id]/status/route');
    const res = await PATCH(makeRequest({ status: 'preview' }), makeContext('nonexistent'));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Auction not found');
  });

  it('returns 422 for invalid status transition (draft -> live)', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([{ id: 'auction-1', status: 'draft' }]);

    const { PATCH } = await import('@/app/api/admin/auctions/[id]/status/route');
    // draft -> preview is valid, draft -> live is not
    const res = await PATCH(makeRequest({ status: 'live' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error).toBe('Invalid status transition');
    expect(body.details.currentStatus).toBe('draft');
    expect(body.details.requestedStatus).toBe('live');
    expect(body.details.allowedTransition).toBe('preview');
  });

  it('returns 422 for terminal state (archive -> anything)', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([{ id: 'auction-1', status: 'archive' }]);

    const { PATCH } = await import('@/app/api/admin/auctions/[id]/status/route');
    const res = await PATCH(makeRequest({ status: 'live' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.details.allowedTransition).toContain('none');
  });

  it('successfully transitions draft -> preview', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([{ id: 'auction-1', status: 'draft' }]);
    mockReturning.mockResolvedValueOnce([{ id: 'auction-1', status: 'preview' }]);

    const { PATCH } = await import('@/app/api/admin/auctions/[id]/status/route');
    const res = await PATCH(makeRequest({ status: 'preview' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.auction.status).toBe('preview');
  });

  it('successfully transitions preview -> live', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([{ id: 'auction-1', status: 'preview' }]);
    mockReturning.mockResolvedValueOnce([{ id: 'auction-1', status: 'live' }]);

    const { PATCH } = await import('@/app/api/admin/auctions/[id]/status/route');
    const res = await PATCH(makeRequest({ status: 'live' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.auction.status).toBe('live');
  });

  it('successfully transitions live -> reconciliation', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([{ id: 'auction-1', status: 'live' }]);
    mockReturning.mockResolvedValueOnce([{ id: 'auction-1', status: 'reconciliation' }]);

    const { PATCH } = await import('@/app/api/admin/auctions/[id]/status/route');
    const res = await PATCH(makeRequest({ status: 'reconciliation' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.auction.status).toBe('reconciliation');
  });

  it('successfully transitions reconciliation -> archive', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([{ id: 'auction-1', status: 'reconciliation' }]);
    mockReturning.mockResolvedValueOnce([{ id: 'auction-1', status: 'archive' }]);

    const { PATCH } = await import('@/app/api/admin/auctions/[id]/status/route');
    const res = await PATCH(makeRequest({ status: 'archive' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.auction.status).toBe('archive');
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Unexpected'));

    const { PATCH } = await import('@/app/api/admin/auctions/[id]/status/route');
    const res = await PATCH(makeRequest({ status: 'preview' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
