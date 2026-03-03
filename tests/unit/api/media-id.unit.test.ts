/**
 * Unit tests for PATCH/DELETE /api/admin/media/[id]
 * Coverage target: media primary flag and soft-delete
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
const mockOrderBy = vi.fn();
const mockUpdate = vi.fn();
const mockSet = vi.fn();

const chainedDb = {
  select: mockSelect,
  from: mockFrom,
  where: mockWhere,
  limit: mockLimit,
  orderBy: mockOrderBy,
  update: mockUpdate,
  set: mockSet,
};

function resetChain() {
  mockSelect.mockReturnValue(chainedDb);
  mockFrom.mockReturnValue(chainedDb);
  mockWhere.mockReturnValue(chainedDb); // default: chainable
  mockLimit.mockResolvedValue([]);
  mockOrderBy.mockReturnValue(chainedDb);
  mockUpdate.mockReturnValue(chainedDb);
  mockSet.mockReturnValue(chainedDb);
}

vi.mock('@/db/connection', () => ({ db: chainedDb }));

vi.mock('@/db/schema', () => ({
  media: {
    id: 'id',
    lotId: 'lotId',
    isPrimary: 'isPrimary',
    deletedAt: 'deletedAt',
    sortOrder: 'sortOrder',
  },
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

function makeRequest(method: string, body?: unknown) {
  const init: RequestInit = { method };
  if (body) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  return new Request('http://localhost:3000/api/admin/media/media-1', init);
}

function makeContext(id = 'media-1') {
  return { params: Promise.resolve({ id }) };
}

const existingMedia = {
  id: 'media-1',
  lotId: 'lot-1',
  url: 'https://example.com/img.jpg',
  isPrimary: false,
  sortOrder: 0,
  deletedAt: null,
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('PATCH /api/admin/media/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetChain();
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { PATCH } = await import('@/app/api/admin/media/[id]/route');
    const res = await PATCH(makeRequest('PATCH', { isPrimary: true }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 404 when media not found', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    // select().from(media).where().limit(1) => []
    mockLimit.mockResolvedValueOnce([]);

    const { PATCH } = await import('@/app/api/admin/media/[id]/route');
    const res = await PATCH(makeRequest('PATCH', { isPrimary: true }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Media not found');
  });

  it('sets media as primary successfully', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    // 1st limit: existing media found
    mockLimit.mockResolvedValueOnce([existingMedia]);

    // isPrimary=true + lotId exists: unset others, set this one
    // where calls:
    //   1st: select existing (chains to limit)
    //   2nd: update unset others (resolves, terminal for this update chain)
    //   3rd: update set this one (resolves, terminal for this update chain)
    //   4th: re-fetch select (chains to limit)
    mockWhere
      .mockReturnValueOnce(chainedDb)        // 1: existing, chains to .limit
      .mockResolvedValueOnce(undefined)       // 2: unset all others isPrimary=false
      .mockResolvedValueOnce(undefined)       // 3: set this one isPrimary=true
      .mockReturnValueOnce(chainedDb);        // 4: re-fetch, chains to .limit

    const updated = { ...existingMedia, isPrimary: true };
    // 2nd limit: re-fetched media
    mockLimit.mockResolvedValueOnce([updated]);

    const { PATCH } = await import('@/app/api/admin/media/[id]/route');
    const res = await PATCH(makeRequest('PATCH', { isPrimary: true }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.media).toBeDefined();
    expect(body.media.isPrimary).toBe(true);
  });

  it('handles patch without isPrimary=true (no primary logic)', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    // 1st limit: existing found
    mockLimit.mockResolvedValueOnce([existingMedia]);
    // where calls:
    //   1st: existing select (chains to limit)
    //   2nd: re-fetch select (chains to limit)
    mockWhere
      .mockReturnValueOnce(chainedDb)  // 1: existing
      .mockReturnValueOnce(chainedDb); // 2: re-fetch
    // 2nd limit: re-fetched
    mockLimit.mockResolvedValueOnce([existingMedia]);

    const { PATCH } = await import('@/app/api/admin/media/[id]/route');
    const res = await PATCH(makeRequest('PATCH', { altText: 'New alt' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.media).toBeDefined();
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Unexpected'));

    const { PATCH } = await import('@/app/api/admin/media/[id]/route');
    const res = await PATCH(makeRequest('PATCH', { isPrimary: true }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});

describe('DELETE /api/admin/media/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetChain();
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { DELETE } = await import('@/app/api/admin/media/[id]/route');
    const res = await DELETE(makeRequest('DELETE'), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 404 when media not found', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    // select().from().where().limit(1) => []
    mockLimit.mockResolvedValueOnce([]);

    const { DELETE } = await import('@/app/api/admin/media/[id]/route');
    const res = await DELETE(makeRequest('DELETE'), makeContext());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Media not found');
  });

  it('soft-deletes non-primary media', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    // 1st limit: existing found (isPrimary: false)
    mockLimit.mockResolvedValueOnce([existingMedia]);
    // where calls:
    //   1st: select existing (chains to limit)
    //   2nd: update soft-delete (terminal)
    mockWhere
      .mockReturnValueOnce(chainedDb)        // 1: existing, chains to .limit
      .mockResolvedValueOnce(undefined);      // 2: soft-delete update

    const { DELETE } = await import('@/app/api/admin/media/[id]/route');
    const res = await DELETE(makeRequest('DELETE'), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('soft-deletes primary media and promotes next', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    const primaryMedia = { ...existingMedia, isPrimary: true };
    // 1st limit: existing found (isPrimary: true)
    mockLimit.mockResolvedValueOnce([primaryMedia]);

    // where calls:
    //   1st: select existing (chains to limit)
    //   2nd: update soft-delete (terminal)
    //   3rd: select next (chains to orderBy -> limit)
    //   4th: update promote next (terminal)
    mockWhere
      .mockReturnValueOnce(chainedDb)        // 1: existing, chains to .limit
      .mockResolvedValueOnce(undefined)       // 2: soft-delete
      .mockReturnValueOnce(chainedDb)         // 3: select next, chains to orderBy
      .mockResolvedValueOnce(undefined);      // 4: promote next

    const nextMedia = { id: 'media-2', lotId: 'lot-1', isPrimary: false, sortOrder: 1 };
    // 2nd limit: next media found
    mockLimit.mockResolvedValueOnce([nextMedia]);

    const { DELETE } = await import('@/app/api/admin/media/[id]/route');
    const res = await DELETE(makeRequest('DELETE'), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('soft-deletes primary media with no next to promote', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    const primaryMedia = { ...existingMedia, isPrimary: true };
    mockLimit.mockResolvedValueOnce([primaryMedia]);

    // where calls:
    //   1st: select existing (chains to limit)
    //   2nd: update soft-delete (terminal)
    //   3rd: select next (chains to orderBy -> limit)
    mockWhere
      .mockReturnValueOnce(chainedDb)    // 1: existing
      .mockResolvedValueOnce(undefined)   // 2: soft-delete
      .mockReturnValueOnce(chainedDb);    // 3: select next

    // 2nd limit: no next media
    mockLimit.mockResolvedValueOnce([]);

    const { DELETE } = await import('@/app/api/admin/media/[id]/route');
    const res = await DELETE(makeRequest('DELETE'), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Unexpected'));

    const { DELETE } = await import('@/app/api/admin/media/[id]/route');
    const res = await DELETE(makeRequest('DELETE'), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
