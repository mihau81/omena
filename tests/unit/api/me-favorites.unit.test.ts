/**
 * Unit tests for GET/POST/DELETE /api/me/favorites
 * Coverage target: user favorites (watched lots) management
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock auth ──────────────────────────────────────────────────────────────

const mockRequireApprovedUser = vi.fn();

vi.mock('@/lib/auth-utils', () => ({
  requireApprovedUser: (...args: unknown[]) => mockRequireApprovedUser(...args),
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
const mockInnerJoin = vi.fn();
const mockLeftJoin = vi.fn();
const mockOrderBy = vi.fn();
const mockInsert = vi.fn();
const mockValues = vi.fn();
const mockOnConflictDoNothing = vi.fn();
const mockDelete = vi.fn();

const chainedDb = {
  select: mockSelect,
  from: mockFrom,
  where: mockWhere,
  innerJoin: mockInnerJoin,
  leftJoin: mockLeftJoin,
  orderBy: mockOrderBy,
  insert: mockInsert,
  values: mockValues,
  onConflictDoNothing: mockOnConflictDoNothing,
  delete: mockDelete,
};

mockSelect.mockReturnValue(chainedDb);
mockFrom.mockReturnValue(chainedDb);
mockWhere.mockReturnValue(chainedDb);
mockInnerJoin.mockReturnValue(chainedDb);
mockLeftJoin.mockReturnValue(chainedDb);
mockOrderBy.mockResolvedValue([]);
mockInsert.mockReturnValue(chainedDb);
mockValues.mockReturnValue(chainedDb);
mockOnConflictDoNothing.mockResolvedValue(undefined);
mockDelete.mockReturnValue(chainedDb);

vi.mock('@/db/connection', () => ({ db: chainedDb }));

vi.mock('@/db/schema', () => ({
  watchedLots: { userId: 'userId', lotId: 'lotId', createdAt: 'createdAt' },
  lots: { id: 'id', auctionId: 'auctionId', deletedAt: 'deletedAt', title: 'title', artist: 'artist', lotNumber: 'lotNumber', status: 'status', estimateMin: 'estimateMin', estimateMax: 'estimateMax', hammerPrice: 'hammerPrice' },
  auctions: { id: 'id', deletedAt: 'deletedAt', title: 'title', slug: 'slug' },
  media: { lotId: 'lotId', isPrimary: 'isPrimary', deletedAt: 'deletedAt', thumbnailUrl: 'thumbnailUrl' },
}));

// ─── Import AuthError ───────────────────────────────────────────────────────

const { AuthError } = await import('@/lib/auth-utils');

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeGetRequest() {
  return new Request('http://localhost:3000/api/me/favorites');
}

function makePostRequest(body: unknown) {
  return new Request('http://localhost:3000/api/me/favorites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeDeleteRequest(body: unknown) {
  return new Request('http://localhost:3000/api/me/favorites', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('GET /api/me/favorites', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue(chainedDb);
    mockFrom.mockReturnValue(chainedDb);
    mockWhere.mockReturnValue(chainedDb);
    mockInnerJoin.mockReturnValue(chainedDb);
    mockLeftJoin.mockReturnValue(chainedDb);
    mockOrderBy.mockResolvedValue([]);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireApprovedUser.mockRejectedValue(new AuthError('Authentication required', 401));

    const { GET } = await import('@/app/api/me/favorites/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 403 for non-user accounts', async () => {
    mockRequireApprovedUser.mockRejectedValue(new AuthError('User access required', 403));

    const { GET } = await import('@/app/api/me/favorites/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('User access required');
  });

  it('returns empty favorites for new user', async () => {
    mockRequireApprovedUser.mockResolvedValue({ id: 'user-1' });
    mockOrderBy.mockResolvedValueOnce([]);

    const { GET } = await import('@/app/api/me/favorites/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.favorites).toEqual([]);
  });

  it('returns favorites with lot and auction data', async () => {
    mockRequireApprovedUser.mockResolvedValue({ id: 'user-1' });
    const rows = [
      {
        lotId: 'lot-1',
        addedAt: new Date(),
        lotTitle: 'Sunset',
        lotArtist: 'Turner',
        lotNumber: 5,
        lotStatus: 'active',
        estimateMin: 1000,
        estimateMax: 3000,
        hammerPrice: null,
        auctionId: 'a1',
        auctionTitle: 'Spring',
        auctionSlug: 'spring',
        imageUrl: 'http://thumb.jpg',
      },
    ];
    mockOrderBy.mockResolvedValueOnce(rows);

    const { GET } = await import('@/app/api/me/favorites/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.favorites).toHaveLength(1);
    expect(body.favorites[0].lotTitle).toBe('Sunset');
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireApprovedUser.mockRejectedValue(new Error('DB crash'));

    const { GET } = await import('@/app/api/me/favorites/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});

describe('POST /api/me/favorites', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockReturnValue(chainedDb);
    mockValues.mockReturnValue(chainedDb);
    mockOnConflictDoNothing.mockResolvedValue(undefined);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireApprovedUser.mockRejectedValue(new AuthError('Authentication required', 401));

    const { POST } = await import('@/app/api/me/favorites/route');
    const res = await POST(makePostRequest({ lotId: 'lot-1' }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 400 when lotId is missing', async () => {
    mockRequireApprovedUser.mockResolvedValue({ id: 'user-1' });

    const { POST } = await import('@/app/api/me/favorites/route');
    const res = await POST(makePostRequest({}));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('lotId is required');
  });

  it('returns 400 when lotId is not a string', async () => {
    mockRequireApprovedUser.mockResolvedValue({ id: 'user-1' });

    const { POST } = await import('@/app/api/me/favorites/route');
    const res = await POST(makePostRequest({ lotId: 123 }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('lotId is required');
  });

  it('adds favorite successfully', async () => {
    mockRequireApprovedUser.mockResolvedValue({ id: 'user-1' });

    const { POST } = await import('@/app/api/me/favorites/route');
    const res = await POST(makePostRequest({ lotId: 'lot-1' }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.ok).toBe(true);
    expect(mockInsert).toHaveBeenCalled();
    expect(mockOnConflictDoNothing).toHaveBeenCalled();
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireApprovedUser.mockRejectedValue(new Error('DB crash'));

    const { POST } = await import('@/app/api/me/favorites/route');
    const res = await POST(makePostRequest({ lotId: 'lot-1' }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});

describe('DELETE /api/me/favorites', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDelete.mockReturnValue(chainedDb);
    mockWhere.mockResolvedValue(undefined);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireApprovedUser.mockRejectedValue(new AuthError('Authentication required', 401));

    const { DELETE } = await import('@/app/api/me/favorites/route');
    const res = await DELETE(makeDeleteRequest({ lotId: 'lot-1' }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 400 when lotId is missing', async () => {
    mockRequireApprovedUser.mockResolvedValue({ id: 'user-1' });

    const { DELETE } = await import('@/app/api/me/favorites/route');
    const res = await DELETE(makeDeleteRequest({}));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('lotId is required');
  });

  it('removes favorite successfully', async () => {
    mockRequireApprovedUser.mockResolvedValue({ id: 'user-1' });

    const { DELETE } = await import('@/app/api/me/favorites/route');
    const res = await DELETE(makeDeleteRequest({ lotId: 'lot-1' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockDelete).toHaveBeenCalled();
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireApprovedUser.mockRejectedValue(new Error('Unexpected'));

    const { DELETE } = await import('@/app/api/me/favorites/route');
    const res = await DELETE(makeDeleteRequest({ lotId: 'lot-1' }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
