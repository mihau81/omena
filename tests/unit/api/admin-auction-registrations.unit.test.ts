/**
 * Unit tests for /api/admin/auctions/[id]/registrations (GET, PATCH)
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

// ─── Mock DB with flexible chaining ─────────────────────────────────────────

let queryResults: unknown[][] = [];
let updateResults: unknown[][] = [];

function createChainedProxy(): Record<string, unknown> {
  const proxy: Record<string, unknown> = {};
  const chainMethods = ['select', 'from', 'innerJoin', 'leftJoin', 'orderBy'];

  for (const m of chainMethods) {
    proxy[m] = vi.fn().mockImplementation(() => proxy);
  }

  proxy.limit = vi.fn().mockImplementation(() => {
    const result = queryResults.shift() ?? [];
    return Promise.resolve(result);
  });

  proxy.where = vi.fn().mockImplementation(() => {
    const thenableProxy = { ...proxy };
    thenableProxy.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
      const result = queryResults.shift() ?? [];
      return Promise.resolve(result).then(resolve, reject);
    };
    // Re-attach limit so chaining .where().limit() works
    thenableProxy.limit = proxy.limit;
    return thenableProxy;
  });

  proxy.update = vi.fn().mockImplementation(() => proxy);
  proxy.set = vi.fn().mockImplementation(() => proxy);
  proxy.returning = vi.fn().mockImplementation(() => {
    const result = updateResults.shift() ?? [];
    return Promise.resolve(result);
  });
  proxy.insert = vi.fn().mockImplementation(() => proxy);
  proxy.values = vi.fn().mockImplementation(() => proxy);

  return proxy;
}

const mockDb = createChainedProxy();

vi.mock('@/db/connection', () => ({ db: mockDb }));

vi.mock('@/db/schema', () => ({
  bidRegistrations: { id: 'id', auctionId: 'auctionId', userId: 'userId', isApproved: 'isApproved', approvedBy: 'approvedBy', approvedAt: 'approvedAt', depositPaid: 'depositPaid', notes: 'notes', createdAt: 'createdAt', paddleNumber: 'paddleNumber' },
  users: { id: 'id', name: 'name', email: 'email' },
  auctions: { id: 'id', title: 'title', deletedAt: 'deletedAt' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ _eq: args })),
  and: vi.fn((...args: unknown[]) => ({ _and: args })),
  desc: vi.fn((col: unknown) => ({ _desc: col })),
  isNull: vi.fn((col: unknown) => ({ _isNull: col })),
  max: vi.fn((col: unknown) => ({ _max: col })),
}));

vi.mock('@/lib/audit', () => ({
  logUpdate: vi.fn().mockResolvedValue(undefined),
}));

const mockCreateNotification = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/notifications', () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}));

// ─── Import ─────────────────────────────────────────────────────────────────

const { AuthError } = await import('@/lib/auth-utils');

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeGetRequest(status?: string) {
  const url = status
    ? `http://localhost:3000/api/admin/auctions/auc-1/registrations?status=${status}`
    : 'http://localhost:3000/api/admin/auctions/auc-1/registrations';
  return new NextRequest(url, { method: 'GET' });
}

function makePatchRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/admin/auctions/auc-1/registrations', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeContext(id = 'auc-1') {
  return { params: Promise.resolve({ id }) };
}

// ─── Tests: GET ─────────────────────────────────────────────────────────────

describe('GET /api/admin/auctions/[id]/registrations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = [];
    updateResults = [];
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { GET } = await import('@/app/api/admin/auctions/[id]/registrations/route');
    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 404 when auction not found', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    queryResults = [[]]; // auction query returns empty

    const { GET } = await import('@/app/api/admin/auctions/[id]/registrations/route');
    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Auction not found');
  });

  it('returns registrations with derived status', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    const rows = [
      { id: 'reg-1', isApproved: true, approvedBy: 'admin-1', userId: 'u1', userName: 'User 1' },
      { id: 'reg-2', isApproved: false, approvedBy: null, userId: 'u2', userName: 'User 2' },
      { id: 'reg-3', isApproved: false, approvedBy: 'admin-1', userId: 'u3', userName: 'User 3' },
    ];
    // 1. Auction query: select().from().where().limit(1)
    // 2. Registrations query: select().from().innerJoin().where().orderBy() (orderBy is terminal here)
    queryResults = [
      [{ id: 'auc-1', title: 'Test Auction' }],
    ];
    // The registrations query ends with .orderBy() which returns proxy (we just mock it)
    // Actually orderBy returns the proxy, so it goes through .then()...
    // but no, the registrations query is: db.select().from().innerJoin().where().orderBy()
    // .orderBy() returns proxy. The result is awaited. Since proxy doesn't have .then,
    // it resolves to itself. Hmm, that won't work either.
    // Let me re-check: .where() returns thenableProxy, which has .orderBy ? No, it has limit.
    // Actually in createChainedProxy, chainMethods includes 'orderBy', so proxy.orderBy returns proxy.
    // But .where() returns thenableProxy which is {...proxy} with .then and .limit. It doesn't
    // have orderBy from the spread... wait, it does! {...proxy} spreads all properties including orderBy.
    // So: .where() -> thenableProxy (has .orderBy), .orderBy() -> proxy (returns proxy).
    // proxy is awaited. proxy doesn't have .then, so await resolves to proxy itself.
    // That's a problem. We need orderBy to also return something thenable.

    // Actually, let me fix this by making proxy itself thenable
    // Instead of fixing the complex proxy, let me just adjust the mock approach.
    // The GET uses:
    //   const rows = await db.select(...).from(...).innerJoin(...).where(...).orderBy(...)
    // So orderBy is the terminal call. I need orderBy to also be thenable.

    // Let me use a simpler approach: override the mock for specific tests.
    const origOrderBy = mockDb.orderBy;
    (mockDb.orderBy as ReturnType<typeof vi.fn>).mockImplementationOnce(() => Promise.resolve(rows));

    const { GET } = await import('@/app/api/admin/auctions/[id]/registrations/route');
    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.registrations).toHaveLength(3);
    expect(body.registrations[0].status).toBe('approved');
    expect(body.registrations[1].status).toBe('pending');
    expect(body.registrations[2].status).toBe('rejected');
  });

  it('filters registrations by status param', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    const rows = [
      { id: 'reg-1', isApproved: true, approvedBy: 'admin-1', userId: 'u1' },
      { id: 'reg-2', isApproved: false, approvedBy: null, userId: 'u2' },
    ];
    queryResults = [
      [{ id: 'auc-1', title: 'Test Auction' }],
    ];
    (mockDb.orderBy as ReturnType<typeof vi.fn>).mockImplementationOnce(() => Promise.resolve(rows));

    const { GET } = await import('@/app/api/admin/auctions/[id]/registrations/route');
    const res = await GET(makeGetRequest('pending'), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.registrations).toHaveLength(1);
    expect(body.registrations[0].status).toBe('pending');
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Crash'));

    const { GET } = await import('@/app/api/admin/auctions/[id]/registrations/route');
    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});

// ─── Tests: PATCH (bulk_approve) ────────────────────────────────────────────

describe('PATCH /api/admin/auctions/[id]/registrations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = [];
    updateResults = [];
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { PATCH } = await import('@/app/api/admin/auctions/[id]/registrations/route');
    const res = await PATCH(makePatchRequest({ action: 'bulk_approve', ids: ['r1'] }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 400 for invalid action', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });

    const { PATCH } = await import('@/app/api/admin/auctions/[id]/registrations/route');
    const res = await PATCH(makePatchRequest({ action: 'invalid', ids: ['r1'] }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('Invalid action');
  });

  it('returns 400 for empty ids', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });

    const { PATCH } = await import('@/app/api/admin/auctions/[id]/registrations/route');
    const res = await PATCH(makePatchRequest({ action: 'bulk_approve', ids: [] }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('non-empty');
  });

  it('returns 404 when auction not found', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    queryResults = [[]]; // auction not found

    const { PATCH } = await import('@/app/api/admin/auctions/[id]/registrations/route');
    const res = await PATCH(makePatchRequest({ action: 'bulk_approve', ids: ['r1'] }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Auction not found');
  });

  it('returns skipped count when no matching pending registrations', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    // 1. Auction query: select().from().where().limit(1)
    // 2. Pending registrations: select().from().where() (thenable, resolves via .then)
    queryResults = [
      [{ id: 'auc-1', title: 'Test Auction' }],
      [],  // no pending registrations
    ];

    const { PATCH } = await import('@/app/api/admin/auctions/[id]/registrations/route');
    const res = await PATCH(makePatchRequest({ action: 'bulk_approve', ids: ['r1', 'r2'] }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.approved).toBe(0);
    expect(body.skipped).toBe(2);
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Crash'));

    const { PATCH } = await import('@/app/api/admin/auctions/[id]/registrations/route');
    const res = await PATCH(makePatchRequest({ action: 'bulk_approve', ids: ['r1'] }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
