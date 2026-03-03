/**
 * Unit tests for GET /api/admin/lots/[id]/condition-report
 * Coverage target: single lot condition report HTML generation
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

const chainedDb = {
  select: mockSelect,
  from: mockFrom,
  where: mockWhere,
  limit: mockLimit,
};

mockSelect.mockReturnValue(chainedDb);
mockFrom.mockReturnValue(chainedDb);
mockWhere.mockReturnValue(chainedDb);
mockLimit.mockResolvedValue([]);

vi.mock('@/db/connection', () => ({ db: chainedDb }));

vi.mock('@/db/schema', () => ({
  lots: { id: 'id', auctionId: 'auctionId', deletedAt: 'deletedAt' },
  auctions: { id: 'id', deletedAt: 'deletedAt' },
  media: { lotId: 'lotId', isPrimary: 'isPrimary', mediaType: 'mediaType', deletedAt: 'deletedAt' },
}));

// ─── Mock condition report generator ────────────────────────────────────────

const mockGenerateHTML = vi.fn().mockReturnValue('<html>report</html>');

vi.mock('@/lib/condition-report', () => ({
  generateConditionReportHTML: (...args: unknown[]) => mockGenerateHTML(...args),
}));

// ─── Import ─────────────────────────────────────────────────────────────────

const { AuthError } = await import('@/lib/auth-utils');

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(url = 'http://localhost:3000/api/admin/lots/lot-1/condition-report') {
  return new Request(url);
}

function makeContext(id = 'lot-1') {
  return { params: Promise.resolve({ id }) };
}

const fakeLot = {
  id: 'lot-1',
  lotNumber: 42,
  title: 'Sunset Painting',
  artist: 'Claude Monet',
  medium: 'Oil on canvas',
  dimensions: '80x60 cm',
  year: '1872',
  estimateMin: 10000,
  estimateMax: 50000,
  conditionNotes: 'Minor cracking',
  provenance: 'Private collection',
  description: 'Beautiful sunset scene',
  auctionId: 'auction-1',
};

const fakeAuction = {
  id: 'auction-1',
  title: 'Impressionist Masters',
  startDate: new Date('2024-06-01'),
};

describe('GET /api/admin/lots/[id]/condition-report', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue(chainedDb);
    mockFrom.mockReturnValue(chainedDb);
    mockWhere.mockReturnValue(chainedDb);
    mockLimit.mockResolvedValue([]);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { GET } = await import('@/app/api/admin/lots/[id]/condition-report/route');
    const res = await GET(makeRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 403 when admin lacks lots:read permission', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Missing permission: lots:read', 403));

    const { GET } = await import('@/app/api/admin/lots/[id]/condition-report/route');
    const res = await GET(makeRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('Missing permission: lots:read');
  });

  it('returns 404 when lot not found', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([]); // lot not found

    const { GET } = await import('@/app/api/admin/lots/[id]/condition-report/route');
    const res = await GET(makeRequest(), makeContext('nonexistent'));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Lot not found');
  });

  it('returns 404 when parent auction not found', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit
      .mockResolvedValueOnce([fakeLot])      // lot found
      .mockResolvedValueOnce([]);             // auction not found

    const { GET } = await import('@/app/api/admin/lots/[id]/condition-report/route');
    const res = await GET(makeRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Auction not found');
  });

  it('returns HTML report inline with primary media', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    const primaryImage = {
      url: 'http://example.com/full.jpg',
      largeUrl: 'http://example.com/large.jpg',
      mediumUrl: 'http://example.com/medium.jpg',
      altText: 'Sunset painting',
    };
    mockLimit
      .mockResolvedValueOnce([fakeLot])       // lot found
      .mockResolvedValueOnce([fakeAuction])   // auction found
      .mockResolvedValueOnce([primaryImage]); // primary media found

    const { GET } = await import('@/app/api/admin/lots/[id]/condition-report/route');
    const res = await GET(makeRequest(), makeContext());

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(res.headers.get('content-disposition')).toContain('inline');
    expect(mockGenerateHTML).toHaveBeenCalledWith(
      expect.objectContaining({ lotNumber: 42, title: 'Sunset Painting' }),
      expect.objectContaining({ title: 'Impressionist Masters' }),
      expect.objectContaining({ url: 'http://example.com/full.jpg' }),
    );
  });

  it('passes null for media when no primary image exists', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit
      .mockResolvedValueOnce([fakeLot])
      .mockResolvedValueOnce([fakeAuction])
      .mockResolvedValueOnce([]); // no primary media

    const { GET } = await import('@/app/api/admin/lots/[id]/condition-report/route');
    const res = await GET(makeRequest(), makeContext());

    expect(res.status).toBe(200);
    expect(mockGenerateHTML).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      null,
    );
  });

  it('returns attachment disposition when download=true', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit
      .mockResolvedValueOnce([fakeLot])
      .mockResolvedValueOnce([fakeAuction])
      .mockResolvedValueOnce([]);

    const { GET } = await import('@/app/api/admin/lots/[id]/condition-report/route');
    const url = 'http://localhost:3000/api/admin/lots/lot-1/condition-report?download=true';
    const res = await GET(makeRequest(url), makeContext());

    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toContain('attachment');
    expect(res.headers.get('content-disposition')).toContain('lot-42-condition-report.html');
  });

  it('includes lot number in filename', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit
      .mockResolvedValueOnce([fakeLot])
      .mockResolvedValueOnce([fakeAuction])
      .mockResolvedValueOnce([]);

    const { GET } = await import('@/app/api/admin/lots/[id]/condition-report/route');
    const res = await GET(makeRequest(), makeContext());

    const disposition = res.headers.get('content-disposition') ?? '';
    expect(disposition).toContain('lot-42-condition-report.html');
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('DB crashed'));

    const { GET } = await import('@/app/api/admin/lots/[id]/condition-report/route');
    const res = await GET(makeRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
