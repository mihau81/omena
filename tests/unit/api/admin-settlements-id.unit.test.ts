/**
 * Unit tests for /api/admin/settlements/[id] (GET, PATCH)
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

const mockGetSettlementById = vi.fn();
const mockUpdateSettlementStatus = vi.fn();

vi.mock('@/db/queries/settlements', () => ({
  getSettlementById: (...args: unknown[]) => mockGetSettlementById(...args),
  updateSettlementStatus: (...args: unknown[]) => mockUpdateSettlementStatus(...args),
}));

// ─── Import ─────────────────────────────────────────────────────────────────

const { AuthError } = await import('@/lib/auth-utils');

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(method: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  return new NextRequest('http://localhost:3000/api/admin/settlements/s1', opts);
}

function makeContext(id = 'settlement-1') {
  return { params: Promise.resolve({ id }) };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/admin/settlements/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { GET } = await import('@/app/api/admin/settlements/[id]/route');
    const res = await GET(makeRequest('GET'), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 403 when admin lacks invoices:manage permission', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Missing permission', 403));

    const { GET } = await import('@/app/api/admin/settlements/[id]/route');
    const res = await GET(makeRequest('GET'), makeContext());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('Missing permission');
  });

  it('returns 404 when settlement not found', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGetSettlementById.mockResolvedValue(null);

    const { GET } = await import('@/app/api/admin/settlements/[id]/route');
    const res = await GET(makeRequest('GET'), makeContext());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Settlement not found');
  });

  it('returns settlement detail', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    const settlement = { id: 'settlement-1', status: 'pending', totalAmount: 10000 };
    mockGetSettlementById.mockResolvedValue(settlement);

    const { GET } = await import('@/app/api/admin/settlements/[id]/route');
    const res = await GET(makeRequest('GET'), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.settlement).toEqual(settlement);
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Crash'));

    const { GET } = await import('@/app/api/admin/settlements/[id]/route');
    const res = await GET(makeRequest('GET'), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});

describe('PATCH /api/admin/settlements/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { PATCH } = await import('@/app/api/admin/settlements/[id]/route');
    const res = await PATCH(makeRequest('PATCH', { status: 'approved' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 404 when settlement not found', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGetSettlementById.mockResolvedValue(null);

    const { PATCH } = await import('@/app/api/admin/settlements/[id]/route');
    const res = await PATCH(makeRequest('PATCH', { status: 'approved' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Settlement not found');
  });

  it('returns 400 for invalid status value', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGetSettlementById.mockResolvedValue({ id: 's1', status: 'pending' });

    const { PATCH } = await import('@/app/api/admin/settlements/[id]/route');
    const res = await PATCH(makeRequest('PATCH', { status: 'invalid' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('must be one of');
  });

  it('returns 422 for invalid transition (pending -> paid)', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGetSettlementById.mockResolvedValue({ id: 's1', status: 'pending' });

    const { PATCH } = await import('@/app/api/admin/settlements/[id]/route');
    const res = await PATCH(makeRequest('PATCH', { status: 'paid' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error).toContain('Cannot transition');
  });

  it('returns 422 for transition from terminal state (paid -> anything)', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGetSettlementById.mockResolvedValue({ id: 's1', status: 'paid' });

    const { PATCH } = await import('@/app/api/admin/settlements/[id]/route');
    const res = await PATCH(makeRequest('PATCH', { status: 'approved' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error).toContain('Cannot transition');
  });

  it('returns 400 when marking as paid without bankReference', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGetSettlementById.mockResolvedValue({ id: 's1', status: 'approved' });

    const { PATCH } = await import('@/app/api/admin/settlements/[id]/route');
    const res = await PATCH(makeRequest('PATCH', { status: 'paid' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('bankReference');
  });

  it('successfully transitions pending -> approved', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGetSettlementById.mockResolvedValue({ id: 's1', status: 'pending' });
    const updated = { id: 's1', status: 'approved' };
    mockUpdateSettlementStatus.mockResolvedValue(updated);

    const { PATCH } = await import('@/app/api/admin/settlements/[id]/route');
    const res = await PATCH(makeRequest('PATCH', { status: 'approved' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.settlement.status).toBe('approved');
  });

  it('successfully transitions approved -> paid with bankReference', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGetSettlementById.mockResolvedValue({ id: 's1', status: 'approved' });
    const updated = { id: 's1', status: 'paid', bankReference: 'REF-123' };
    mockUpdateSettlementStatus.mockResolvedValue(updated);

    const { PATCH } = await import('@/app/api/admin/settlements/[id]/route');
    const res = await PATCH(
      makeRequest('PATCH', { status: 'paid', bankReference: 'REF-123' }),
      makeContext(),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.settlement.status).toBe('paid');
    expect(mockUpdateSettlementStatus).toHaveBeenCalledWith('settlement-1', 'paid', 'REF-123', null);
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('DB crash'));

    const { PATCH } = await import('@/app/api/admin/settlements/[id]/route');
    const res = await PATCH(makeRequest('PATCH', { status: 'approved' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
