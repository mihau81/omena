/**
 * Unit tests for /api/admin/registrations/[id]/approve (PATCH)
 * and /api/admin/registrations/[id]/reject (PATCH)
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

// ─── Mock DB with flexible chaining ─────────────────────────────────────────
// We use a queryResults array: each DB query pops the next result.

let queryResults: unknown[][] = [];
let updateResults: unknown[][] = [];

function createChainedProxy(): Record<string, unknown> {
  const proxy: Record<string, unknown> = {};
  const chainMethods = ['select', 'from', 'where', 'innerJoin', 'leftJoin', 'orderBy'];
  const terminalSelect = ['limit'];
  const updateMethods = ['update', 'set'];

  for (const m of chainMethods) {
    proxy[m] = vi.fn().mockImplementation(() => proxy);
  }

  // limit() is terminal for select chains
  proxy.limit = vi.fn().mockImplementation(() => {
    const result = queryResults.shift() ?? [];
    return Promise.resolve(result);
  });

  // where() can also be terminal (when no .limit() follows)
  // Override where to return a "then-able" proxy: it acts as both
  // a chainable object AND a promise
  const origWhere = proxy.where;
  proxy.where = vi.fn().mockImplementation((...args: unknown[]) => {
    // Return an object that has all chain methods AND is thenable
    const thenableProxy = { ...proxy };
    // Make it thenable - resolves to next queryResults when awaited directly
    thenableProxy.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
      const result = queryResults.shift() ?? [];
      return Promise.resolve(result).then(resolve, reject);
    };
    return thenableProxy;
  });

  // update chain
  proxy.update = vi.fn().mockImplementation(() => proxy);
  proxy.set = vi.fn().mockImplementation(() => proxy);
  proxy.returning = vi.fn().mockImplementation(() => {
    const result = updateResults.shift() ?? [];
    return Promise.resolve(result);
  });

  // insert chain
  proxy.insert = vi.fn().mockImplementation(() => proxy);
  proxy.values = vi.fn().mockImplementation(() => proxy);

  return proxy;
}

const mockDb = createChainedProxy();

vi.mock('@/db/connection', () => ({ db: mockDb }));

vi.mock('@/db/schema', () => ({
  bidRegistrations: { id: 'id', auctionId: 'auctionId', userId: 'userId', isApproved: 'isApproved', approvedBy: 'approvedBy', paddleNumber: 'paddleNumber' },
  auctions: { id: 'id', title: 'title', slug: 'slug' },
  users: { id: 'id', name: 'name', email: 'email' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ _eq: args })),
  max: vi.fn((col: unknown) => ({ _max: col })),
}));

vi.mock('@/lib/audit', () => ({
  logCreate: vi.fn().mockResolvedValue(undefined),
  logUpdate: vi.fn().mockResolvedValue(undefined),
  logDelete: vi.fn().mockResolvedValue(undefined),
}));

const mockCreateNotification = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/notifications', () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}));

// ─── Import ─────────────────────────────────────────────────────────────────

const { AuthError } = await import('@/lib/auth-utils');

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeApproveRequest() {
  return new Request('http://localhost:3000/api/admin/registrations/reg-1/approve', {
    method: 'PATCH',
  });
}

function makeRejectRequest(body?: unknown) {
  return new Request('http://localhost:3000/api/admin/registrations/reg-1/reject', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function makeContext(id = 'reg-1') {
  return { params: Promise.resolve({ id }) };
}

// ─── Tests: Approve ─────────────────────────────────────────────────────────

describe('PATCH /api/admin/registrations/[id]/approve', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = [];
    updateResults = [];
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { PATCH } = await import('@/app/api/admin/registrations/[id]/approve/route');
    const res = await PATCH(makeApproveRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 404 when registration not found', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    // select().from().where().limit(1) -> []
    queryResults = [[]];

    const { PATCH } = await import('@/app/api/admin/registrations/[id]/approve/route');
    const res = await PATCH(makeApproveRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Registration not found');
  });

  it('returns 409 when registration is already approved', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    queryResults = [[{ id: 'reg-1', isApproved: true, auctionId: 'auc-1', userId: 'user-1' }]];

    const { PATCH } = await import('@/app/api/admin/registrations/[id]/approve/route');
    const res = await PATCH(makeApproveRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toContain('already approved');
  });

  it('approves registration and assigns paddle number', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    const registration = { id: 'reg-1', isApproved: false, auctionId: 'auc-1', userId: 'user-1' };
    const updated = { ...registration, isApproved: true, paddleNumber: 4, approvedBy: 'admin-1' };

    // 1. Fetch registration: select().from().where().limit(1)
    // 2. Max paddle: select({maxPaddle}).from().where() (awaited directly, goes through "then")
    // 3. Auction title: select().from().where().limit(1)
    queryResults = [
      [registration],         // fetch registration
      [{ maxPaddle: 3 }],    // max paddle
      [{ title: 'Test Auction', slug: 'test-auction' }], // auction title
    ];
    updateResults = [
      [updated],             // update registration
    ];

    const { PATCH } = await import('@/app/api/admin/registrations/[id]/approve/route');
    const res = await PATCH(makeApproveRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.paddleNumber).toBe(4);
    expect(body.registration).toBeDefined();
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('DB crash'));

    const { PATCH } = await import('@/app/api/admin/registrations/[id]/approve/route');
    const res = await PATCH(makeApproveRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});

// ─── Tests: Reject ──────────────────────────────────────────────────────────

describe('PATCH /api/admin/registrations/[id]/reject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryResults = [];
    updateResults = [];
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { PATCH } = await import('@/app/api/admin/registrations/[id]/reject/route');
    const res = await PATCH(makeRejectRequest({}), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 404 when registration not found', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    // select().from().where().limit(1) -> []
    queryResults = [[]];

    const { PATCH } = await import('@/app/api/admin/registrations/[id]/reject/route');
    const res = await PATCH(makeRejectRequest({}), makeContext());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Registration not found');
  });

  it('returns 409 when registration is already approved', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    queryResults = [[{
      id: 'reg-1', isApproved: true, auctionId: 'auc-1', userId: 'user-1',
      approvedBy: 'admin-old', notes: '',
    }]];

    const { PATCH } = await import('@/app/api/admin/registrations/[id]/reject/route');
    const res = await PATCH(makeRejectRequest({}), makeContext());
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toContain('already approved');
  });

  it('returns 409 when registration has already been rejected', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    queryResults = [[{
      id: 'reg-1', isApproved: false, approvedBy: 'some-admin',
      auctionId: 'auc-1', userId: 'user-1',
    }]];

    const { PATCH } = await import('@/app/api/admin/registrations/[id]/reject/route');
    const res = await PATCH(makeRejectRequest({}), makeContext());
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toContain('already been rejected');
  });

  it('rejects registration successfully with reason', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    const registration = {
      id: 'reg-1', isApproved: false, approvedBy: null,
      auctionId: 'auc-1', userId: 'user-1', notes: '',
    };
    const updated = { ...registration, approvedBy: 'admin-1', notes: 'Not eligible' };

    // 1. Fetch registration: select().from().where().limit(1)
    // 2. Auction title: select().from().where().limit(1)
    queryResults = [
      [registration],
      [{ title: 'Test Auction' }],
    ];
    updateResults = [
      [updated],
    ];

    const { PATCH } = await import('@/app/api/admin/registrations/[id]/reject/route');
    const res = await PATCH(makeRejectRequest({ reason: 'Not eligible' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.registration).toBeDefined();
  });

  it('rejects registration without reason', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    const registration = {
      id: 'reg-1', isApproved: false, approvedBy: null,
      auctionId: 'auc-1', userId: 'user-1', notes: '',
    };
    const updated = { ...registration, approvedBy: 'admin-1' };

    queryResults = [
      [registration],
      [{ title: 'Test Auction' }],
    ];
    updateResults = [
      [updated],
    ];

    const { PATCH } = await import('@/app/api/admin/registrations/[id]/reject/route');
    const res = await PATCH(makeRejectRequest({}), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.registration).toBeDefined();
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('DB crash'));

    const { PATCH } = await import('@/app/api/admin/registrations/[id]/reject/route');
    const res = await PATCH(makeRejectRequest({}), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
