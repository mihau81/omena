/**
 * Unit tests for POST/GET/DELETE /api/lots/[id]/absentee
 * Coverage target: absentee bid management (create/check/cancel)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock auth ──────────────────────────────────────────────────────────────

const mockRequireAuth = vi.fn();

vi.mock('@/lib/auth-utils', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
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

// ─── Mock absentee-service ──────────────────────────────────────────────────

const mockPlaceAbsenteeBid = vi.fn();
const mockGetUserAbsenteeBid = vi.fn();
const mockCancelAbsenteeBid = vi.fn();

class MockAbsenteeError extends Error {
  code: string;
  statusCode: number;
  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.name = 'AbsenteeError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

vi.mock('@/lib/absentee-service', () => ({
  placeAbsenteeBid: (...args: unknown[]) => mockPlaceAbsenteeBid(...args),
  getUserAbsenteeBid: (...args: unknown[]) => mockGetUserAbsenteeBid(...args),
  cancelAbsenteeBid: (...args: unknown[]) => mockCancelAbsenteeBid(...args),
  AbsenteeError: MockAbsenteeError,
}));

// ─── Import AuthError ───────────────────────────────────────────────────────

const { AuthError } = await import('@/lib/auth-utils');

// ─── Helpers ────────────────────────────────────────────────────────────────

function makePostRequest(body: unknown) {
  return new Request('http://localhost:3000/api/lots/lot-1/absentee', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeGetRequest() {
  return new Request('http://localhost:3000/api/lots/lot-1/absentee');
}

function makeDeleteRequest() {
  return new Request('http://localhost:3000/api/lots/lot-1/absentee', {
    method: 'DELETE',
  });
}

function makeContext(id = 'lot-1') {
  return { params: Promise.resolve({ id }) };
}

// ─── POST tests ─────────────────────────────────────────────────────────────

describe('POST /api/lots/[id]/absentee', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new AuthError('Authentication required', 401));

    const { POST } = await import('@/app/api/lots/[id]/absentee/route');
    const res = await POST(makePostRequest({ maxAmount: 5000 }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 403 for admin users', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'admin-1', userType: 'admin' });

    const { POST } = await import('@/app/api/lots/[id]/absentee/route');
    const res = await POST(makePostRequest({ maxAmount: 5000 }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('Only registered users can place absentee bids');
  });

  it('returns 400 for invalid body (missing maxAmount)', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'user-1', userType: 'user' });

    const { POST } = await import('@/app/api/lots/[id]/absentee/route');
    const res = await POST(makePostRequest({}), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Validation failed');
    expect(body.details).toBeDefined();
  });

  it('returns 400 for negative maxAmount', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'user-1', userType: 'user' });

    const { POST } = await import('@/app/api/lots/[id]/absentee/route');
    const res = await POST(makePostRequest({ maxAmount: -100 }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Validation failed');
  });

  it('returns 400 for non-integer maxAmount', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'user-1', userType: 'user' });

    const { POST } = await import('@/app/api/lots/[id]/absentee/route');
    const res = await POST(makePostRequest({ maxAmount: 50.5 }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Validation failed');
  });

  it('returns 201 on successful absentee bid', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'user-1', userType: 'user' });
    mockPlaceAbsenteeBid.mockResolvedValue({ id: 'absentee-1' });

    const { POST } = await import('@/app/api/lots/[id]/absentee/route');
    const res = await POST(makePostRequest({ maxAmount: 5000 }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.message).toBe('Absentee bid set successfully');
    expect(body.id).toBe('absentee-1');
    expect(mockPlaceAbsenteeBid).toHaveBeenCalledWith('lot-1', 'user-1', 5000);
  });

  it('returns AbsenteeError status code when service throws', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'user-1', userType: 'user' });
    mockPlaceAbsenteeBid.mockRejectedValue(
      new MockAbsenteeError('Lot is not active', 'LOT_NOT_ACTIVE', 409),
    );

    const { POST } = await import('@/app/api/lots/[id]/absentee/route');
    const res = await POST(makePostRequest({ maxAmount: 5000 }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe('Lot is not active');
    expect(body.code).toBe('LOT_NOT_ACTIVE');
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'user-1', userType: 'user' });
    mockPlaceAbsenteeBid.mockRejectedValue(new Error('DB crash'));

    const { POST } = await import('@/app/api/lots/[id]/absentee/route');
    const res = await POST(makePostRequest({ maxAmount: 5000 }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});

// ─── GET tests ──────────────────────────────────────────────────────────────

describe('GET /api/lots/[id]/absentee', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new AuthError('Authentication required', 401));

    const { GET } = await import('@/app/api/lots/[id]/absentee/route');
    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns hasAbsenteeBid: false for admin users', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'admin-1', userType: 'admin' });

    const { GET } = await import('@/app/api/lots/[id]/absentee/route');
    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.hasAbsenteeBid).toBe(false);
  });

  it('returns absentee bid data for regular user', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'user-1', userType: 'user' });
    mockGetUserAbsenteeBid.mockResolvedValue({
      hasAbsenteeBid: true,
      maxAmount: 5000,
    });

    const { GET } = await import('@/app/api/lots/[id]/absentee/route');
    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.hasAbsenteeBid).toBe(true);
    expect(body.maxAmount).toBe(5000);
    expect(mockGetUserAbsenteeBid).toHaveBeenCalledWith('lot-1', 'user-1');
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'user-1', userType: 'user' });
    mockGetUserAbsenteeBid.mockRejectedValue(new Error('DB crash'));

    const { GET } = await import('@/app/api/lots/[id]/absentee/route');
    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});

// ─── DELETE tests ───────────────────────────────────────────────────────────

describe('DELETE /api/lots/[id]/absentee', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new AuthError('Authentication required', 401));

    const { DELETE } = await import('@/app/api/lots/[id]/absentee/route');
    const res = await DELETE(makeDeleteRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 403 for admin users', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'admin-1', userType: 'admin' });

    const { DELETE } = await import('@/app/api/lots/[id]/absentee/route');
    const res = await DELETE(makeDeleteRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('Only registered users can cancel absentee bids');
  });

  it('cancels absentee bid successfully', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'user-1', userType: 'user' });
    mockCancelAbsenteeBid.mockResolvedValue(undefined);

    const { DELETE } = await import('@/app/api/lots/[id]/absentee/route');
    const res = await DELETE(makeDeleteRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.message).toBe('Absentee bid cancelled');
    expect(mockCancelAbsenteeBid).toHaveBeenCalledWith('lot-1', 'user-1');
  });

  it('returns AbsenteeError status code when service throws', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'user-1', userType: 'user' });
    mockCancelAbsenteeBid.mockRejectedValue(
      new MockAbsenteeError('No active absentee bid', 'NOT_FOUND', 404),
    );

    const { DELETE } = await import('@/app/api/lots/[id]/absentee/route');
    const res = await DELETE(makeDeleteRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('No active absentee bid');
    expect(body.code).toBe('NOT_FOUND');
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'user-1', userType: 'user' });
    mockCancelAbsenteeBid.mockRejectedValue(new Error('DB crash'));

    const { DELETE } = await import('@/app/api/lots/[id]/absentee/route');
    const res = await DELETE(makeDeleteRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
