/**
 * Unit tests for /api/admin/artists/[id] (GET, PATCH, DELETE)
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

// ─── Mock DB queries ────────────────────────────────────────────────────────

const mockGetArtistById = vi.fn();
const mockGetUnlinkedLotsByArtistName = vi.fn();
const mockUpdateArtist = vi.fn();
const mockDeleteArtist = vi.fn();
const mockLinkLotsToArtist = vi.fn();

vi.mock('@/db/queries/artists', () => ({
  getArtistById: (...args: unknown[]) => mockGetArtistById(...args),
  getUnlinkedLotsByArtistName: (...args: unknown[]) => mockGetUnlinkedLotsByArtistName(...args),
  updateArtist: (...args: unknown[]) => mockUpdateArtist(...args),
  deleteArtist: (...args: unknown[]) => mockDeleteArtist(...args),
  linkLotsToArtist: (...args: unknown[]) => mockLinkLotsToArtist(...args),
}));

// ─── Mock DB ────────────────────────────────────────────────────────────────

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockUpdate = vi.fn();
const mockSet = vi.fn();

const chainedDb = {
  select: mockSelect,
  from: mockFrom,
  where: mockWhere,
  update: mockUpdate,
  set: mockSet,
};

mockSelect.mockReturnValue(chainedDb);
mockFrom.mockReturnValue(chainedDb);
mockWhere.mockResolvedValue([{ count: 5 }]);
mockUpdate.mockReturnValue(chainedDb);
mockSet.mockReturnValue(chainedDb);

vi.mock('@/db/connection', () => ({ db: chainedDb }));

vi.mock('@/db/schema', () => ({
  lots: { id: 'id', artistId: 'artistId', deletedAt: 'deletedAt' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ _eq: args })),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ _sql: strings, values })),
  isNull: vi.fn((col: unknown) => ({ _isNull: col })),
}));

vi.mock('@/lib/audit', () => ({
  logCreate: vi.fn().mockResolvedValue(undefined),
  logUpdate: vi.fn().mockResolvedValue(undefined),
  logDelete: vi.fn().mockResolvedValue(undefined),
}));

// ─── Import ─────────────────────────────────────────────────────────────────

const { AuthError } = await import('@/lib/auth-utils');

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(method: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  return new NextRequest('http://localhost:3000/api/admin/artists/artist-1', opts);
}

function makeContext(id = 'artist-1') {
  return { params: Promise.resolve({ id }) };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/admin/artists/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue(chainedDb);
    mockFrom.mockReturnValue(chainedDb);
    mockWhere.mockResolvedValue([{ count: 5 }]);
    mockUpdate.mockReturnValue(chainedDb);
    mockSet.mockReturnValue(chainedDb);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { GET } = await import('@/app/api/admin/artists/[id]/route');
    const res = await GET(makeRequest('GET'), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 404 when artist not found', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGetArtistById.mockResolvedValue(null);

    const { GET } = await import('@/app/api/admin/artists/[id]/route');
    const res = await GET(makeRequest('GET'), makeContext());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Artist not found');
  });

  it('returns artist detail with unlinked lots and lot count', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    const artist = { id: 'artist-1', name: 'Jan Kowalski', slug: 'jan-kowalski' };
    mockGetArtistById.mockResolvedValue(artist);
    mockGetUnlinkedLotsByArtistName.mockResolvedValue([{ id: 'lot-1' }]);

    const { GET } = await import('@/app/api/admin/artists/[id]/route');
    const res = await GET(makeRequest('GET'), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.artist).toEqual(artist);
    expect(body.unlinkedLots).toEqual([{ id: 'lot-1' }]);
    expect(body.lotCount).toBe(5);
  });

  it('returns empty unlinked lots when artist has no name', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    const artist = { id: 'artist-1', name: '', slug: 'unknown' };
    mockGetArtistById.mockResolvedValue(artist);

    const { GET } = await import('@/app/api/admin/artists/[id]/route');
    const res = await GET(makeRequest('GET'), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.unlinkedLots).toEqual([]);
    expect(mockGetUnlinkedLotsByArtistName).not.toHaveBeenCalled();
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Unexpected'));

    const { GET } = await import('@/app/api/admin/artists/[id]/route');
    const res = await GET(makeRequest('GET'), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});

describe('PATCH /api/admin/artists/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue(chainedDb);
    mockFrom.mockReturnValue(chainedDb);
    mockWhere.mockResolvedValue([{ count: 0 }]);
    mockUpdate.mockReturnValue(chainedDb);
    mockSet.mockReturnValue(chainedDb);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { PATCH } = await import('@/app/api/admin/artists/[id]/route');
    const res = await PATCH(makeRequest('PATCH', { name: 'New' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 404 when artist not found', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGetArtistById.mockResolvedValue(null);

    const { PATCH } = await import('@/app/api/admin/artists/[id]/route');
    const res = await PATCH(makeRequest('PATCH', { name: 'New' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Artist not found');
  });

  it('handles bulk link-lots action', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGetArtistById.mockResolvedValue({ id: 'artist-1', name: 'Artist' });
    mockLinkLotsToArtist.mockResolvedValue(undefined);

    const { PATCH } = await import('@/app/api/admin/artists/[id]/route');
    const res = await PATCH(
      makeRequest('PATCH', { action: 'link-lots', lotIds: ['lot-1', 'lot-2'] }),
      makeContext(),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.linked).toBe(2);
    expect(mockLinkLotsToArtist).toHaveBeenCalledWith('artist-1', ['lot-1', 'lot-2']);
  });

  it('returns 400 when no fields to update', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGetArtistById.mockResolvedValue({ id: 'artist-1', name: 'Artist' });

    const { PATCH } = await import('@/app/api/admin/artists/[id]/route');
    const res = await PATCH(makeRequest('PATCH', {}), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('No fields to update');
  });

  it('updates artist successfully', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    const existing = { id: 'artist-1', name: 'Old', slug: 'old' };
    mockGetArtistById.mockResolvedValue(existing);
    const updated = { id: 'artist-1', name: 'New Name', slug: 'new-name' };
    mockUpdateArtist.mockResolvedValue(updated);

    const { PATCH } = await import('@/app/api/admin/artists/[id]/route');
    const res = await PATCH(makeRequest('PATCH', { name: 'New Name' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.artist.name).toBe('New Name');
  });

  it('returns 409 for duplicate slug', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGetArtistById.mockResolvedValue({ id: 'artist-1', name: 'Artist', slug: 'artist' });
    mockUpdateArtist.mockRejectedValue({ code: '23505' });

    const { PATCH } = await import('@/app/api/admin/artists/[id]/route');
    const res = await PATCH(makeRequest('PATCH', { slug: 'existing-slug' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toContain('Slug already exists');
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Crash'));

    const { PATCH } = await import('@/app/api/admin/artists/[id]/route');
    const res = await PATCH(makeRequest('PATCH', { name: 'X' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});

describe('DELETE /api/admin/artists/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue(chainedDb);
    mockFrom.mockReturnValue(chainedDb);
    mockWhere.mockResolvedValue([]);
    mockUpdate.mockReturnValue(chainedDb);
    mockSet.mockReturnValue(chainedDb);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { DELETE } = await import('@/app/api/admin/artists/[id]/route');
    const res = await DELETE(makeRequest('DELETE'), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 404 when artist not found', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGetArtistById.mockResolvedValue(null);

    const { DELETE } = await import('@/app/api/admin/artists/[id]/route');
    const res = await DELETE(makeRequest('DELETE'), makeContext());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Artist not found');
  });

  it('deletes artist and unlinks lots', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGetArtistById.mockResolvedValue({ id: 'artist-1', name: 'Artist', slug: 'artist' });
    mockDeleteArtist.mockResolvedValue(undefined);

    const { DELETE } = await import('@/app/api/admin/artists/[id]/route');
    const res = await DELETE(makeRequest('DELETE'), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockDeleteArtist).toHaveBeenCalledWith('artist-1');
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Crash'));

    const { DELETE } = await import('@/app/api/admin/artists/[id]/route');
    const res = await DELETE(makeRequest('DELETE'), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
