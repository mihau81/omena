/**
 * Unit tests for GET/PATCH /api/admin/registrations/[id]
 * Coverage target: single registration detail and approve/reject
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

// We use a call-count approach so where() returns chainable for some calls
// and resolves to data on others (when it's the terminal call).

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockInnerJoin = vi.fn();
const mockUpdate = vi.fn();
const mockSet = vi.fn();
const mockReturning = vi.fn();

const chainedDb = {
  select: mockSelect,
  from: mockFrom,
  where: mockWhere,
  limit: mockLimit,
  innerJoin: mockInnerJoin,
  update: mockUpdate,
  set: mockSet,
  returning: mockReturning,
};

function resetChain() {
  mockSelect.mockReturnValue(chainedDb);
  mockFrom.mockReturnValue(chainedDb);
  mockWhere.mockReturnValue(chainedDb);
  mockLimit.mockResolvedValue([]);
  mockInnerJoin.mockReturnValue(chainedDb);
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
  users: { id: 'id', name: 'name', email: 'email' },
  auctions: { id: 'id', title: 'title', slug: 'slug' },
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

function makeGetRequest() {
  return new NextRequest('http://localhost:3000/api/admin/registrations/reg-1', { method: 'GET' });
}

function makePatchRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/admin/registrations/reg-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeContext(id = 'reg-1') {
  return { params: Promise.resolve({ id }) };
}

const registrationRow = {
  id: 'reg-1',
  userId: 'user-1',
  auctionId: 'auc-1',
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

const existingReg = {
  id: 'reg-1',
  userId: 'user-1',
  auctionId: 'auc-1',
  paddleNumber: null,
  isApproved: false,
  approvedBy: null,
  approvedAt: null,
  depositPaid: false,
  notes: null,
  createdAt: new Date(),
};

const auctionRow = { title: 'Test Auction', slug: 'test-auction' };

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/admin/registrations/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetChain();
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { GET } = await import('@/app/api/admin/registrations/[id]/route');
    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 404 when registration not found', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([]);

    const { GET } = await import('@/app/api/admin/registrations/[id]/route');
    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Registration not found');
  });

  it('returns registration with pending status', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([registrationRow]);

    const { GET } = await import('@/app/api/admin/registrations/[id]/route');
    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.registration.status).toBe('pending');
  });

  it('returns registration with approved status', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([{ ...registrationRow, isApproved: true }]);

    const { GET } = await import('@/app/api/admin/registrations/[id]/route');
    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.registration.status).toBe('approved');
  });

  it('returns registration with rejected status', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([{ ...registrationRow, isApproved: false, approvedBy: 'admin-2' }]);

    const { GET } = await import('@/app/api/admin/registrations/[id]/route');
    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.registration.status).toBe('rejected');
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Unexpected'));

    const { GET } = await import('@/app/api/admin/registrations/[id]/route');
    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});

describe('PATCH /api/admin/registrations/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetChain();
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { PATCH } = await import('@/app/api/admin/registrations/[id]/route');
    const res = await PATCH(makePatchRequest({ action: 'approve' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 400 for invalid action', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });

    const { PATCH } = await import('@/app/api/admin/registrations/[id]/route');
    const res = await PATCH(makePatchRequest({ action: 'invalid' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('Invalid action');
  });

  it('returns 400 when action is missing', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });

    const { PATCH } = await import('@/app/api/admin/registrations/[id]/route');
    const res = await PATCH(makePatchRequest({}), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('Invalid action');
  });

  it('returns 404 when registration not found for approve', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    // db.select().from(bidRegistrations).where(...).limit(1) => []
    mockLimit.mockResolvedValueOnce([]);

    const { PATCH } = await import('@/app/api/admin/registrations/[id]/route');
    const res = await PATCH(makePatchRequest({ action: 'approve' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Registration not found');
  });

  it('returns 409 when approving already approved registration', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    // Fetch existing reg (limit(1))
    mockLimit.mockResolvedValueOnce([{ ...existingReg, isApproved: true }]);
    // Fetch auction (limit(1))
    mockLimit.mockResolvedValueOnce([auctionRow]);

    const { PATCH } = await import('@/app/api/admin/registrations/[id]/route');
    const res = await PATCH(makePatchRequest({ action: 'approve' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe('Registration is already approved');
  });

  it('approves registration and assigns paddle number', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    // 1st limit: fetch existing reg
    mockLimit.mockResolvedValueOnce([existingReg]);
    // 2nd limit: fetch auction
    mockLimit.mockResolvedValueOnce([auctionRow]);
    // 3rd call is max paddle: db.select().from().where() — no limit!
    // where() is terminal here, so we need it to resolve to array
    // But where normally returns chainedDb. We handle this by making
    // where resolve to the paddle result on the 3rd call.
    // The query chain is: select->from->where (terminal)
    // Calls to where in order:
    //   1st: existing reg (chain to .limit) — where returns chainedDb
    //   2nd: auction fetch (chain to .limit) — where returns chainedDb
    //   3rd: max paddle (terminal) — where resolves to array
    //   4th: update.set.where.returning — where returns chainedDb
    mockWhere
      .mockReturnValueOnce(chainedDb)   // 1st: existing reg, chained to limit
      .mockReturnValueOnce(chainedDb)   // 2nd: auction, chained to limit
      .mockResolvedValueOnce([{ maxPaddle: 3 }])  // 3rd: max paddle, terminal
      .mockReturnValueOnce(chainedDb);  // 4th: update where

    const updated = { ...existingReg, isApproved: true, paddleNumber: 4 };
    mockReturning.mockResolvedValueOnce([updated]);

    const { PATCH } = await import('@/app/api/admin/registrations/[id]/route');
    const res = await PATCH(makePatchRequest({ action: 'approve' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.registration).toBeDefined();
    expect(body.paddleNumber).toBe(4);
  });

  it('returns 409 when rejecting already approved registration', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    // existing: isApproved=true (so code will hit "Cannot reject an already approved")
    mockLimit.mockResolvedValueOnce([{ ...existingReg, isApproved: true }]);
    // auction
    mockLimit.mockResolvedValueOnce([auctionRow]);

    const { PATCH } = await import('@/app/api/admin/registrations/[id]/route');
    const res = await PATCH(makePatchRequest({ action: 'reject' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe('Cannot reject an already approved registration');
  });

  it('returns 409 when rejecting already rejected registration', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    // existing: isApproved=false, approvedBy='admin-2' (already rejected)
    mockLimit.mockResolvedValueOnce([{ ...existingReg, isApproved: false, approvedBy: 'admin-2' }]);
    // auction
    mockLimit.mockResolvedValueOnce([auctionRow]);

    const { PATCH } = await import('@/app/api/admin/registrations/[id]/route');
    const res = await PATCH(makePatchRequest({ action: 'reject' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe('Registration has already been rejected');
  });

  it('rejects registration successfully', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    // existing: isApproved=false, approvedBy=null (pending)
    mockLimit.mockResolvedValueOnce([existingReg]);
    // auction
    mockLimit.mockResolvedValueOnce([auctionRow]);
    // update returning
    const updated = { ...existingReg, isApproved: false, approvedBy: 'admin-1' };
    mockReturning.mockResolvedValueOnce([updated]);

    const { PATCH } = await import('@/app/api/admin/registrations/[id]/route');
    const res = await PATCH(makePatchRequest({ action: 'reject', notes: 'Incomplete docs' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.registration).toBeDefined();
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Unexpected'));

    const { PATCH } = await import('@/app/api/admin/registrations/[id]/route');
    const res = await PATCH(makePatchRequest({ action: 'approve' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
