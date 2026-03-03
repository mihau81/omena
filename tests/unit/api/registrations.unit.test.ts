/**
 * Unit tests for GET/PATCH /api/admin/auctions/[id]/registrations
 * Coverage target: auction registration listing and bulk approval
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
const mockInnerJoin = vi.fn();
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
  orderBy: mockOrderBy,
  innerJoin: mockInnerJoin,
  leftJoin: mockLeftJoin,
  groupBy: mockGroupBy,
  update: mockUpdate,
  set: mockSet,
  returning: mockReturning,
};

function resetChain() {
  mockSelect.mockReturnValue(chainedDb);
  mockFrom.mockReturnValue(chainedDb);
  mockWhere.mockReturnValue(chainedDb);
  mockLimit.mockResolvedValue([]);
  mockOrderBy.mockResolvedValue([]);
  mockInnerJoin.mockReturnValue(chainedDb);
  mockLeftJoin.mockReturnValue(chainedDb);
  mockGroupBy.mockReturnValue(chainedDb);
  mockUpdate.mockReturnValue(chainedDb);
  mockSet.mockReturnValue(chainedDb);
  mockReturning.mockResolvedValue([]);
}

vi.mock('@/db/connection', () => ({ db: chainedDb }));

vi.mock('@/db/schema', () => ({
  bidRegistrations: {
    id: 'id',
    userId: 'userId',
    auctionId: 'auctionId',
    paddleNumber: 'paddleNumber',
    isApproved: 'isApproved',
    approvedBy: 'approvedBy',
    approvedAt: 'approvedAt',
    depositPaid: 'depositPaid',
    notes: 'notes',
    createdAt: 'createdAt',
  },
  users: {
    id: 'id',
    name: 'name',
    email: 'email',
  },
  auctions: {
    id: 'id',
    title: 'title',
    slug: 'slug',
    deletedAt: 'deletedAt',
  },
}));

// ─── Mock audit & notifications ─────────────────────────────────────────────

vi.mock('@/lib/audit', () => ({
  logCreate: vi.fn().mockResolvedValue(undefined),
  logUpdate: vi.fn().mockResolvedValue(undefined),
  logDelete: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/notifications', () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
}));

// ─── Import AuthError ───────────────────────────────────────────────────────

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

const auctionRow = { id: 'auc-1', title: 'Test Auction' };

const registrationRow = {
  id: 'reg-1',
  userId: 'user-1',
  userName: 'John',
  userEmail: 'john@test.com',
  paddleNumber: null,
  isApproved: false,
  approvedBy: null,
  approvedAt: null,
  depositPaid: false,
  notes: null,
  createdAt: new Date(),
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/admin/auctions/[id]/registrations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetChain();
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
    mockLimit.mockResolvedValueOnce([]); // auction not found

    const { GET } = await import('@/app/api/admin/auctions/[id]/registrations/route');
    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Auction not found');
  });

  it('returns registrations with derived status', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([auctionRow]); // auction found
    mockOrderBy.mockResolvedValueOnce([registrationRow]); // registrations

    const { GET } = await import('@/app/api/admin/auctions/[id]/registrations/route');
    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.auction).toEqual(auctionRow);
    expect(body.registrations).toHaveLength(1);
    expect(body.registrations[0].status).toBe('pending');
  });

  it('filters by status when query param provided', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([auctionRow]);
    const approved = { ...registrationRow, isApproved: true };
    const pending = { ...registrationRow, id: 'reg-2' };
    mockOrderBy.mockResolvedValueOnce([approved, pending]);

    const { GET } = await import('@/app/api/admin/auctions/[id]/registrations/route');
    const res = await GET(makeGetRequest('approved'), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.registrations).toHaveLength(1);
    expect(body.registrations[0].status).toBe('approved');
  });

  it('returns empty registrations list', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([auctionRow]);
    mockOrderBy.mockResolvedValueOnce([]);

    const { GET } = await import('@/app/api/admin/auctions/[id]/registrations/route');
    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.registrations).toEqual([]);
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Unexpected'));

    const { GET } = await import('@/app/api/admin/auctions/[id]/registrations/route');
    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});

describe('PATCH /api/admin/auctions/[id]/registrations (bulk_approve)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetChain();
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { PATCH } = await import('@/app/api/admin/auctions/[id]/registrations/route');
    const res = await PATCH(makePatchRequest({ action: 'bulk_approve', ids: ['reg-1'] }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 400 for invalid action', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });

    const { PATCH } = await import('@/app/api/admin/auctions/[id]/registrations/route');
    const res = await PATCH(makePatchRequest({ action: 'invalid', ids: ['reg-1'] }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('Invalid action');
  });

  it('returns 400 when ids is empty', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });

    const { PATCH } = await import('@/app/api/admin/auctions/[id]/registrations/route');
    const res = await PATCH(makePatchRequest({ action: 'bulk_approve', ids: [] }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('ids must be');
  });

  it('returns 400 when ids is not an array', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });

    const { PATCH } = await import('@/app/api/admin/auctions/[id]/registrations/route');
    const res = await PATCH(makePatchRequest({ action: 'bulk_approve', ids: 'not-array' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('ids must be');
  });

  it('returns 404 when auction not found', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([]); // auction not found

    const { PATCH } = await import('@/app/api/admin/auctions/[id]/registrations/route');
    const res = await PATCH(makePatchRequest({ action: 'bulk_approve', ids: ['reg-1'] }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Auction not found');
  });

  it('returns zero approved when no matching pending registrations', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    // 1st limit: auction found
    mockLimit.mockResolvedValueOnce([auctionRow]);
    // pending regs query: select().from().where() — terminal, no .limit()
    // where calls:
    //   1st: auction check (chains to .limit)
    //   2nd: pending regs (terminal — resolves to array)
    mockWhere
      .mockReturnValueOnce(chainedDb) // 1st: auction, chains to limit
      .mockResolvedValueOnce([]);     // 2nd: no pending registrations

    const { PATCH } = await import('@/app/api/admin/auctions/[id]/registrations/route');
    const res = await PATCH(makePatchRequest({ action: 'bulk_approve', ids: ['reg-999'] }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.approved).toBe(0);
    expect(body.skipped).toBe(1);
  });

  it('approves pending registrations and assigns paddle numbers', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    // auction found
    mockLimit.mockResolvedValueOnce([auctionRow]);

    const pendingReg = {
      id: 'reg-1',
      auctionId: 'auc-1',
      approvedBy: null,
      isApproved: false,
      userId: 'user-1',
    };

    // where calls:
    //   1st: auction check (chains to limit) — returns chainedDb
    //   2nd: pending regs (terminal) — resolves to [pendingReg]
    //   3rd: max paddle (terminal) — resolves to [{maxPaddle: 5}]
    //   4th: update where (chains to returning) — returns chainedDb
    mockWhere
      .mockReturnValueOnce(chainedDb)     // 1: auction, chains to limit
      .mockResolvedValueOnce([pendingReg]) // 2: pending regs, terminal
      .mockResolvedValueOnce([{ maxPaddle: 5 }]) // 3: max paddle, terminal
      .mockReturnValueOnce(chainedDb);    // 4: update where, chains to returning

    const updatedReg = { ...pendingReg, isApproved: true, paddleNumber: 6 };
    mockReturning.mockResolvedValueOnce([updatedReg]);

    const { PATCH } = await import('@/app/api/admin/auctions/[id]/registrations/route');
    const res = await PATCH(makePatchRequest({ action: 'bulk_approve', ids: ['reg-1'] }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.approved).toBe(1);
    expect(body.results).toHaveLength(1);
    expect(body.results[0].paddleNumber).toBe(6);
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Unexpected'));

    const { PATCH } = await import('@/app/api/admin/auctions/[id]/registrations/route');
    const res = await PATCH(makePatchRequest({ action: 'bulk_approve', ids: ['reg-1'] }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
