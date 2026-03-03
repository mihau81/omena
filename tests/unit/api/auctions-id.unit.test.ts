/**
 * Unit tests for GET/PATCH/DELETE /api/admin/auctions/[id]
 * Coverage target: single auction management
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
const mockLeftJoin = vi.fn();
const mockGroupBy = vi.fn();
const mockUpdate = vi.fn();
const mockSet = vi.fn();
const mockReturning = vi.fn();

const chainedDb = {
  select: mockSelect,
  from: mockFrom,
  where: mockWhere,
  limit: mockLimit,
  leftJoin: mockLeftJoin,
  groupBy: mockGroupBy,
  update: mockUpdate,
  set: mockSet,
  returning: mockReturning,
};

mockSelect.mockReturnValue(chainedDb);
mockFrom.mockReturnValue(chainedDb);
mockWhere.mockReturnValue(chainedDb);
mockLimit.mockResolvedValue([]);
mockLeftJoin.mockReturnValue(chainedDb);
mockGroupBy.mockReturnValue(chainedDb);
mockUpdate.mockReturnValue(chainedDb);
mockSet.mockReturnValue(chainedDb);
mockReturning.mockResolvedValue([]);

vi.mock('@/db/connection', () => ({ db: chainedDb }));

vi.mock('@/db/schema', () => ({
  auctions: {
    id: 'id',
    title: 'title',
    slug: 'slug',
    description: 'description',
    deletedAt: 'deletedAt',
  },
  lots: {
    id: 'id',
    auctionId: 'auctionId',
    deletedAt: 'deletedAt',
  },
}));

// ─── Mock validation ────────────────────────────────────────────────────────

const mockSafeParse = vi.fn();
vi.mock('@/lib/validation/auction', () => ({
  updateAuctionSchema: { safeParse: (...args: unknown[]) => mockSafeParse(...args) },
}));

// ─── Mock audit ─────────────────────────────────────────────────────────────

vi.mock('@/lib/audit', () => ({
  logCreate: vi.fn().mockResolvedValue(undefined),
  logUpdate: vi.fn().mockResolvedValue(undefined),
  logDelete: vi.fn().mockResolvedValue(undefined),
}));

// ─── Import AuthError ───────────────────────────────────────────────────────

const { AuthError } = await import('@/lib/auth-utils');

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(method = 'GET', body?: unknown) {
  const init: RequestInit = { method };
  if (body) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  return new Request('http://localhost:3000/api/admin/auctions/auc-1', init);
}

function makeContext(id = 'auc-1') {
  return { params: Promise.resolve({ id }) };
}

const existingAuction = {
  id: 'auc-1',
  title: 'Test Auction',
  slug: 'test-auction',
  description: 'A test auction',
  deletedAt: null,
  updatedBy: null,
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/admin/auctions/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue(chainedDb);
    mockFrom.mockReturnValue(chainedDb);
    mockWhere.mockReturnValue(chainedDb);
    mockLeftJoin.mockReturnValue(chainedDb);
    mockGroupBy.mockReturnValue(chainedDb);
    mockLimit.mockResolvedValue([]);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { GET } = await import('@/app/api/admin/auctions/[id]/route');
    const res = await GET(makeRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 404 when auction not found', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValue([]);

    const { GET } = await import('@/app/api/admin/auctions/[id]/route');
    const res = await GET(makeRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Auction not found');
  });

  it('returns auction with lotCount', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValue([
      { auction: existingAuction, lotCount: 5 },
    ]);

    const { GET } = await import('@/app/api/admin/auctions/[id]/route');
    const res = await GET(makeRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.auction.lotCount).toBe(5);
    expect(body.auction.title).toBe('Test Auction');
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Unexpected'));

    const { GET } = await import('@/app/api/admin/auctions/[id]/route');
    const res = await GET(makeRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});

describe('PATCH /api/admin/auctions/[id]', () => {
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

    const { PATCH } = await import('@/app/api/admin/auctions/[id]/route');
    const res = await PATCH(makeRequest('PATCH', { title: 'New' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 400 when validation fails', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockSafeParse.mockReturnValue({
      success: false,
      error: { flatten: () => ({ fieldErrors: { title: ['Required'] } }) },
    });

    const { PATCH } = await import('@/app/api/admin/auctions/[id]/route');
    const res = await PATCH(makeRequest('PATCH', {}), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Validation failed');
  });

  it('returns 404 when auction not found', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockSafeParse.mockReturnValue({ success: true, data: { title: 'New' } });
    mockLimit.mockResolvedValueOnce([]);

    const { PATCH } = await import('@/app/api/admin/auctions/[id]/route');
    const res = await PATCH(makeRequest('PATCH', { title: 'New' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Auction not found');
  });

  it('returns 409 when slug already exists', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockSafeParse.mockReturnValue({ success: true, data: { slug: 'taken-slug' } });
    mockLimit.mockResolvedValueOnce([existingAuction]); // existing
    mockLimit.mockResolvedValueOnce([{ id: 'auc-other' }]); // slug conflict

    const { PATCH } = await import('@/app/api/admin/auctions/[id]/route');
    const res = await PATCH(makeRequest('PATCH', { slug: 'taken-slug' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe('Slug already exists');
  });

  it('updates auction successfully', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockSafeParse.mockReturnValue({ success: true, data: { title: 'Updated' } });
    mockLimit.mockResolvedValueOnce([existingAuction]);
    const updated = { ...existingAuction, title: 'Updated' };
    mockReturning.mockResolvedValueOnce([updated]);

    const { PATCH } = await import('@/app/api/admin/auctions/[id]/route');
    const res = await PATCH(makeRequest('PATCH', { title: 'Updated' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.auction.title).toBe('Updated');
  });

  it('updates auction with new slug (no conflict)', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockSafeParse.mockReturnValue({ success: true, data: { slug: 'new-slug' } });
    mockLimit.mockResolvedValueOnce([existingAuction]); // existing
    mockLimit.mockResolvedValueOnce([]); // no slug conflict
    const updated = { ...existingAuction, slug: 'new-slug' };
    mockReturning.mockResolvedValueOnce([updated]);

    const { PATCH } = await import('@/app/api/admin/auctions/[id]/route');
    const res = await PATCH(makeRequest('PATCH', { slug: 'new-slug' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.auction.slug).toBe('new-slug');
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Unexpected'));

    const { PATCH } = await import('@/app/api/admin/auctions/[id]/route');
    const res = await PATCH(makeRequest('PATCH', { title: 'New' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});

describe('DELETE /api/admin/auctions/[id]', () => {
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

    const { DELETE } = await import('@/app/api/admin/auctions/[id]/route');
    const res = await DELETE(makeRequest('DELETE'), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 404 when auction not found', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([]);

    const { DELETE } = await import('@/app/api/admin/auctions/[id]/route');
    const res = await DELETE(makeRequest('DELETE'), makeContext());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Auction not found');
  });

  it('soft-deletes auction successfully', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([existingAuction]);
    const deleted = { ...existingAuction, deletedAt: new Date() };
    mockReturning.mockResolvedValueOnce([deleted]);

    const { DELETE } = await import('@/app/api/admin/auctions/[id]/route');
    const res = await DELETE(makeRequest('DELETE'), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.auction).toBeDefined();
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Unexpected'));

    const { DELETE } = await import('@/app/api/admin/auctions/[id]/route');
    const res = await DELETE(makeRequest('DELETE'), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
