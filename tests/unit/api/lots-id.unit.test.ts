/**
 * Unit tests for GET/PATCH/DELETE /api/admin/lots/[id]
 * Coverage target: single lot management
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

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
const mockUpdate = vi.fn();
const mockSet = vi.fn();
const mockReturning = vi.fn();

const chainedDb = {
  select: mockSelect,
  from: mockFrom,
  where: mockWhere,
  limit: mockLimit,
  orderBy: mockOrderBy,
  update: mockUpdate,
  set: mockSet,
  returning: mockReturning,
};

mockSelect.mockReturnValue(chainedDb);
mockFrom.mockReturnValue(chainedDb);
mockWhere.mockReturnValue(chainedDb);
mockLimit.mockResolvedValue([]);
mockOrderBy.mockResolvedValue([]);
mockUpdate.mockReturnValue(chainedDb);
mockSet.mockReturnValue(chainedDb);
mockReturning.mockResolvedValue([]);

vi.mock('@/db/connection', () => ({ db: chainedDb }));

vi.mock('@/db/schema', () => ({
  lots: {
    id: 'id',
    auctionId: 'auctionId',
    lotNumber: 'lotNumber',
    title: 'title',
    deletedAt: 'deletedAt',
  },
  media: {
    id: 'id',
    lotId: 'lotId',
    deletedAt: 'deletedAt',
    sortOrder: 'sortOrder',
  },
}));

// ─── Mock validation ────────────────────────────────────────────────────────

const mockSafeParse = vi.fn();
vi.mock('@/lib/validation/lot', () => ({
  updateLotSchema: { safeParse: (...args: unknown[]) => mockSafeParse(...args) },
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
  return new Request('http://localhost:3000/api/admin/lots/lot-1', init);
}

function makeContext(id = 'lot-1') {
  return { params: Promise.resolve({ id }) };
}

const existingLot = {
  id: 'lot-1',
  auctionId: 'auction-1',
  lotNumber: 1,
  title: 'Test Painting',
  artist: 'Test Artist',
  deletedAt: null,
  updatedBy: null,
};

const mediaItem = {
  id: 'media-1',
  lotId: 'lot-1',
  url: 'https://example.com/img.jpg',
  sortOrder: 0,
  deletedAt: null,
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/admin/lots/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue(chainedDb);
    mockFrom.mockReturnValue(chainedDb);
    mockWhere.mockReturnValue(chainedDb);
    mockLimit.mockResolvedValue([]);
    mockOrderBy.mockResolvedValue([]);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { GET } = await import('@/app/api/admin/lots/[id]/route');
    const res = await GET(makeRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 404 when lot not found', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([]); // lot not found

    const { GET } = await import('@/app/api/admin/lots/[id]/route');
    const res = await GET(makeRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Lot not found');
  });

  it('returns lot with media on success', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([existingLot]); // lot found
    mockOrderBy.mockResolvedValueOnce([mediaItem]); // media

    const { GET } = await import('@/app/api/admin/lots/[id]/route');
    const res = await GET(makeRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.lot).toEqual(existingLot);
    expect(body.media).toEqual([mediaItem]);
  });

  it('returns lot with empty media array', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([existingLot]);
    mockOrderBy.mockResolvedValueOnce([]);

    const { GET } = await import('@/app/api/admin/lots/[id]/route');
    const res = await GET(makeRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.lot).toEqual(existingLot);
    expect(body.media).toEqual([]);
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Unexpected'));

    const { GET } = await import('@/app/api/admin/lots/[id]/route');
    const res = await GET(makeRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});

describe('PATCH /api/admin/lots/[id]', () => {
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

    const { PATCH } = await import('@/app/api/admin/lots/[id]/route');
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

    const { PATCH } = await import('@/app/api/admin/lots/[id]/route');
    const res = await PATCH(makeRequest('PATCH', { title: '' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Validation failed');
  });

  it('returns 404 when lot not found', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockSafeParse.mockReturnValue({ success: true, data: { title: 'New' } });
    mockLimit.mockResolvedValueOnce([]); // not found

    const { PATCH } = await import('@/app/api/admin/lots/[id]/route');
    const res = await PATCH(makeRequest('PATCH', { title: 'New' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Lot not found');
  });

  it('updates lot successfully', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockSafeParse.mockReturnValue({ success: true, data: { title: 'Updated' } });
    mockLimit.mockResolvedValueOnce([existingLot]); // existing found
    const updated = { ...existingLot, title: 'Updated' };
    mockReturning.mockResolvedValueOnce([updated]);

    const { PATCH } = await import('@/app/api/admin/lots/[id]/route');
    const res = await PATCH(makeRequest('PATCH', { title: 'Updated' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.lot.title).toBe('Updated');
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Unexpected'));

    const { PATCH } = await import('@/app/api/admin/lots/[id]/route');
    const res = await PATCH(makeRequest('PATCH', { title: 'New' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});

describe('DELETE /api/admin/lots/[id]', () => {
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

    const { DELETE } = await import('@/app/api/admin/lots/[id]/route');
    const res = await DELETE(makeRequest('DELETE'), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 404 when lot not found', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([]);

    const { DELETE } = await import('@/app/api/admin/lots/[id]/route');
    const res = await DELETE(makeRequest('DELETE'), makeContext());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Lot not found');
  });

  it('soft-deletes lot successfully', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([existingLot]);
    const deleted = { ...existingLot, deletedAt: new Date() };
    mockReturning.mockResolvedValueOnce([deleted]);

    const { DELETE } = await import('@/app/api/admin/lots/[id]/route');
    const res = await DELETE(makeRequest('DELETE'), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.lot).toBeDefined();
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Unexpected'));

    const { DELETE } = await import('@/app/api/admin/lots/[id]/route');
    const res = await DELETE(makeRequest('DELETE'), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
