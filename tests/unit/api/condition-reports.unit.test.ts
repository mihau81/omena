/**
 * Unit tests for GET /api/admin/auctions/[id]/condition-reports
 * Coverage target: batch condition reports for an auction
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

// ─── Mock auth module (needed for transitive imports) ───────────────────────

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

const chainedDb = {
  select: mockSelect,
  from: mockFrom,
  where: mockWhere,
  limit: mockLimit,
  orderBy: mockOrderBy,
};

mockSelect.mockReturnValue(chainedDb);
mockFrom.mockReturnValue(chainedDb);
mockWhere.mockReturnValue(chainedDb);
mockOrderBy.mockReturnValue(chainedDb);
mockLimit.mockResolvedValue([]);

vi.mock('@/db/connection', () => ({ db: chainedDb }));

vi.mock('@/db/schema', () => ({
  lots: { id: 'id', auctionId: 'auctionId', sortOrder: 'sortOrder', lotNumber: 'lotNumber', deletedAt: 'deletedAt' },
  auctions: { id: 'id', deletedAt: 'deletedAt' },
  media: { lotId: 'lotId', isPrimary: 'isPrimary', mediaType: 'mediaType', deletedAt: 'deletedAt' },
}));

// ─── Mock condition-report ──────────────────────────────────────────────────

const mockGenerateBatchHTML = vi.fn().mockReturnValue('<html>batch report</html>');

vi.mock('@/lib/condition-report', () => ({
  generateBatchConditionReportHTML: (...args: unknown[]) => mockGenerateBatchHTML(...args),
}));

// ─── Import after mocks ────────────────────────────────────────────────────

const { AuthError } = await import('@/lib/auth-utils');

describe('GET /api/admin/auctions/[id]/condition-reports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue(chainedDb);
    mockFrom.mockReturnValue(chainedDb);
    mockWhere.mockReturnValue(chainedDb);
    mockOrderBy.mockReturnValue(chainedDb);
    mockLimit.mockResolvedValue([]);
  });

  function makeRequest(url = 'http://localhost:3000/api/admin/auctions/abc/condition-reports') {
    return new Request(url);
  }

  function makeContext(id = 'auction-1') {
    return { params: Promise.resolve({ id }) };
  }

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { GET } = await import('@/app/api/admin/auctions/[id]/condition-reports/route');
    const res = await GET(makeRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 403 when admin lacks lots:read permission', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Missing permission: lots:read', 403));

    const { GET } = await import('@/app/api/admin/auctions/[id]/condition-reports/route');
    const res = await GET(makeRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('Missing permission: lots:read');
  });

  it('returns 404 when auction not found', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1', role: 'admin' });
    mockLimit.mockResolvedValueOnce([]); // auction query returns empty

    const { GET } = await import('@/app/api/admin/auctions/[id]/condition-reports/route');
    const res = await GET(makeRequest(), makeContext('nonexistent'));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Auction not found');
  });

  it('returns HTML inline for auction with no lots', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1', role: 'admin' });
    // First query: auction found
    mockLimit.mockResolvedValueOnce([{ id: 'auction-1', title: 'Test Auction', startDate: new Date() }]);
    // Second query: no lots
    mockOrderBy.mockResolvedValueOnce([]);

    const { GET } = await import('@/app/api/admin/auctions/[id]/condition-reports/route');
    const res = await GET(makeRequest(), makeContext());

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(res.headers.get('content-disposition')).toContain('inline');
    expect(mockGenerateBatchHTML).toHaveBeenCalled();
  });

  it('returns HTML as attachment when download=true', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1', role: 'admin' });
    mockLimit.mockResolvedValueOnce([{ id: 'auction-1', title: 'Test Auction', startDate: new Date() }]);
    mockOrderBy.mockResolvedValueOnce([]);

    const { GET } = await import('@/app/api/admin/auctions/[id]/condition-reports/route');
    const url = 'http://localhost:3000/api/admin/auctions/abc/condition-reports?download=true';
    const res = await GET(makeRequest(url), makeContext());

    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toContain('attachment');
  });

  it('fetches primary images for lots and builds report items', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1', role: 'admin' });
    // Auction found
    mockLimit
      .mockResolvedValueOnce([{ id: 'auction-1', title: 'Art Auction', startDate: new Date() }])
      // Per-lot media query: returns an image for lot-1
      .mockResolvedValueOnce([{ url: 'http://img.jpg', largeUrl: 'http://large.jpg', mediumUrl: 'http://med.jpg', altText: 'Art' }])
      // Per-lot media query: no image for lot-2
      .mockResolvedValueOnce([]);

    // Lots query
    mockOrderBy.mockResolvedValueOnce([
      { id: 'lot-1', lotNumber: 1, title: 'Painting', artist: 'Artist 1', medium: 'Oil', dimensions: '50x70', year: '2020', estimateMin: 1000, estimateMax: 5000, conditionNotes: 'Good', provenance: 'Private', description: 'Desc' },
      { id: 'lot-2', lotNumber: 2, title: 'Sculpture', artist: 'Artist 2', medium: 'Bronze', dimensions: '30x40', year: '2021', estimateMin: 2000, estimateMax: 8000, conditionNotes: 'Fair', provenance: 'Gallery', description: 'Desc 2' },
    ]);

    const { GET } = await import('@/app/api/admin/auctions/[id]/condition-reports/route');
    const res = await GET(makeRequest(), makeContext());

    expect(res.status).toBe(200);
    expect(mockGenerateBatchHTML).toHaveBeenCalledTimes(1);

    const [reportAuction, items] = mockGenerateBatchHTML.mock.calls[0];
    expect(reportAuction.title).toBe('Art Auction');
    expect(items).toHaveLength(2);
    expect(items[0].lot.title).toBe('Painting');
    expect(items[0].primaryMedia).not.toBeNull();
    expect(items[1].primaryMedia).toBeNull();
  });

  it('generates correct filename from auction title', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1', role: 'admin' });
    mockLimit.mockResolvedValueOnce([{ id: 'auction-1', title: 'Art & Design 2024!', startDate: new Date() }]);
    mockOrderBy.mockResolvedValueOnce([]);

    const { GET } = await import('@/app/api/admin/auctions/[id]/condition-reports/route');
    const res = await GET(makeRequest(), makeContext());

    const disposition = res.headers.get('content-disposition') ?? '';
    expect(disposition).toContain('art---design-2024-');
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('DB connection failed'));

    const { GET } = await import('@/app/api/admin/auctions/[id]/condition-reports/route');
    const res = await GET(makeRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
