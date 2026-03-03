/**
 * Unit tests for GET/PUT /api/admin/auctions/[id]/premium-tiers
 * Coverage target: premium tier management for auctions
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

// ─── Mock DB queries ────────────────────────────────────────────────────────

const mockGetAuctionById = vi.fn();
const mockGetTiersForAuction = vi.fn();
const mockUpsertTiers = vi.fn();

vi.mock('@/db/queries', () => ({
  getAuctionById: (...args: unknown[]) => mockGetAuctionById(...args),
}));

vi.mock('@/db/queries/premium', () => ({
  getTiersForAuction: (...args: unknown[]) => mockGetTiersForAuction(...args),
  upsertTiers: (...args: unknown[]) => mockUpsertTiers(...args),
}));

// ─── Import AuthError after mock ────────────────────────────────────────────

const { AuthError } = await import('@/lib/auth-utils');

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeContext(id = 'auction-1') {
  return { params: Promise.resolve({ id }) };
}

function makePutRequest(body: unknown) {
  return new Request('http://localhost:3000/api/admin/auctions/abc/premium-tiers', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeGetRequest() {
  return new Request('http://localhost:3000/api/admin/auctions/abc/premium-tiers');
}

describe('GET /api/admin/auctions/[id]/premium-tiers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { GET } = await import('@/app/api/admin/auctions/[id]/premium-tiers/route');
    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 403 when admin lacks auctions:read permission', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Missing permission: auctions:read', 403));

    const { GET } = await import('@/app/api/admin/auctions/[id]/premium-tiers/route');
    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('Missing permission: auctions:read');
  });

  it('returns 404 when auction not found', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGetAuctionById.mockResolvedValue(null);

    const { GET } = await import('@/app/api/admin/auctions/[id]/premium-tiers/route');
    const res = await GET(makeGetRequest(), makeContext('nonexistent'));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Auction not found');
  });

  it('returns tiers for a valid auction', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGetAuctionById.mockResolvedValue({ id: 'auction-1', title: 'Test' });
    const tiers = [
      { id: 't1', minAmount: 0, maxAmount: 10000, rate: '0.2500', sortOrder: 0 },
      { id: 't2', minAmount: 10000, maxAmount: null, rate: '0.2000', sortOrder: 1 },
    ];
    mockGetTiersForAuction.mockResolvedValue(tiers);

    const { GET } = await import('@/app/api/admin/auctions/[id]/premium-tiers/route');
    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.tiers).toEqual(tiers);
    expect(mockGetTiersForAuction).toHaveBeenCalledWith('auction-1');
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('DB failure'));

    const { GET } = await import('@/app/api/admin/auctions/[id]/premium-tiers/route');
    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});

describe('PUT /api/admin/auctions/[id]/premium-tiers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { PUT } = await import('@/app/api/admin/auctions/[id]/premium-tiers/route');
    const res = await PUT(makePutRequest({ tiers: [] }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 404 when auction not found', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGetAuctionById.mockResolvedValue(null);

    const { PUT } = await import('@/app/api/admin/auctions/[id]/premium-tiers/route');
    const res = await PUT(makePutRequest({ tiers: [] }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Auction not found');
  });

  it('returns 400 for invalid body schema', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGetAuctionById.mockResolvedValue({ id: 'auction-1' });

    const { PUT } = await import('@/app/api/admin/auctions/[id]/premium-tiers/route');
    const res = await PUT(makePutRequest({ tiers: [{ minAmount: -5, maxAmount: null, rate: 'bad' }] }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Validation failed');
  });

  it('returns 400 when non-last tier has null maxAmount', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGetAuctionById.mockResolvedValue({ id: 'auction-1' });

    const tiers = [
      { minAmount: 0, maxAmount: null, rate: '0.2500' },
      { minAmount: 10000, maxAmount: 20000, rate: '0.2000' },
    ];

    const { PUT } = await import('@/app/api/admin/auctions/[id]/premium-tiers/route');
    const res = await PUT(makePutRequest({ tiers }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Validation failed');
    expect(body.details.fieldErrors.tiers[0]).toContain('Only the last tier');
  });

  it('returns 400 when tier ranges have gaps', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGetAuctionById.mockResolvedValue({ id: 'auction-1' });

    const tiers = [
      { minAmount: 0, maxAmount: 5000, rate: '0.2500' },
      { minAmount: 10000, maxAmount: null, rate: '0.2000' },  // gap from 5000 to 10000
    ];

    const { PUT } = await import('@/app/api/admin/auctions/[id]/premium-tiers/route');
    const res = await PUT(makePutRequest({ tiers }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Validation failed');
    expect(body.details.fieldErrors.tiers[0]).toContain('gap or overlap');
  });

  it('succeeds with valid contiguous tiers', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGetAuctionById.mockResolvedValue({ id: 'auction-1' });
    const updatedTiers = [
      { id: 't1', minAmount: 0, maxAmount: 10000, rate: '0.2500', sortOrder: 0 },
      { id: 't2', minAmount: 10000, maxAmount: null, rate: '0.2000', sortOrder: 1 },
    ];
    mockUpsertTiers.mockResolvedValue(updatedTiers);

    const tiers = [
      { minAmount: 0, maxAmount: 10000, rate: '0.2500' },
      { minAmount: 10000, maxAmount: null, rate: '0.2000' },
    ];

    const { PUT } = await import('@/app/api/admin/auctions/[id]/premium-tiers/route');
    const res = await PUT(makePutRequest({ tiers }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.tiers).toEqual(updatedTiers);
    expect(mockUpsertTiers).toHaveBeenCalledWith('auction-1', expect.any(Array));
  });

  it('succeeds with empty tiers array', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGetAuctionById.mockResolvedValue({ id: 'auction-1' });
    mockUpsertTiers.mockResolvedValue([]);

    const { PUT } = await import('@/app/api/admin/auctions/[id]/premium-tiers/route');
    const res = await PUT(makePutRequest({ tiers: [] }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.tiers).toEqual([]);
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Unexpected'));

    const { PUT } = await import('@/app/api/admin/auctions/[id]/premium-tiers/route');
    const res = await PUT(makePutRequest({ tiers: [] }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
