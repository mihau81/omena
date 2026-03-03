/**
 * Unit tests for GET/PATCH /api/admin/settlements/[id]
 * Coverage target: settlement detail and status transitions
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

// ─── Mock settlements queries ───────────────────────────────────────────────

const mockGetSettlementById = vi.fn();
const mockUpdateSettlementStatus = vi.fn();

vi.mock('@/db/queries/settlements', () => ({
  getSettlementById: (...args: unknown[]) => mockGetSettlementById(...args),
  updateSettlementStatus: (...args: unknown[]) => mockUpdateSettlementStatus(...args),
}));

// ─── Import AuthError ───────────────────────────────────────────────────────

const { AuthError } = await import('@/lib/auth-utils');

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeGetRequest() {
  return new NextRequest('http://localhost:3000/api/admin/settlements/stl-1', { method: 'GET' });
}

function makePatchRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/admin/settlements/stl-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeContext(id = 'stl-1') {
  return { params: Promise.resolve({ id }) };
}

const settlementData = {
  id: 'stl-1',
  status: 'pending',
  consignorName: 'Jane Doe',
  totalAmount: 10000,
  items: [],
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/admin/settlements/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { GET } = await import('@/app/api/admin/settlements/[id]/route');
    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 404 when settlement not found', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGetSettlementById.mockResolvedValue(null);

    const { GET } = await import('@/app/api/admin/settlements/[id]/route');
    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Settlement not found');
  });

  it('returns settlement on success', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGetSettlementById.mockResolvedValue(settlementData);

    const { GET } = await import('@/app/api/admin/settlements/[id]/route');
    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.settlement).toEqual(settlementData);
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Unexpected'));

    const { GET } = await import('@/app/api/admin/settlements/[id]/route');
    const res = await GET(makeGetRequest(), makeContext());
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
    const res = await PATCH(makePatchRequest({ status: 'approved' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 404 when settlement not found', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGetSettlementById.mockResolvedValue(null);

    const { PATCH } = await import('@/app/api/admin/settlements/[id]/route');
    const res = await PATCH(makePatchRequest({ status: 'approved' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Settlement not found');
  });

  it('returns 400 when status is missing', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGetSettlementById.mockResolvedValue(settlementData);

    const { PATCH } = await import('@/app/api/admin/settlements/[id]/route');
    const res = await PATCH(makePatchRequest({}), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('status must be one of');
  });

  it('returns 400 when status is invalid', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGetSettlementById.mockResolvedValue(settlementData);

    const { PATCH } = await import('@/app/api/admin/settlements/[id]/route');
    const res = await PATCH(makePatchRequest({ status: 'invalid' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('status must be one of');
  });

  it('returns 422 for invalid status transition', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGetSettlementById.mockResolvedValue({ ...settlementData, status: 'pending' });

    const { PATCH } = await import('@/app/api/admin/settlements/[id]/route');
    const res = await PATCH(makePatchRequest({ status: 'paid' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error).toContain("Cannot transition from 'pending' to 'paid'");
  });

  it('returns 422 when transitioning from paid', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGetSettlementById.mockResolvedValue({ ...settlementData, status: 'paid' });

    const { PATCH } = await import('@/app/api/admin/settlements/[id]/route');
    const res = await PATCH(makePatchRequest({ status: 'approved' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error).toContain("Cannot transition from 'paid' to 'approved'");
  });

  it('returns 400 when marking as paid without bankReference', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGetSettlementById.mockResolvedValue({ ...settlementData, status: 'approved' });

    const { PATCH } = await import('@/app/api/admin/settlements/[id]/route');
    const res = await PATCH(makePatchRequest({ status: 'paid' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('bankReference is required');
  });

  it('transitions from pending to approved', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGetSettlementById.mockResolvedValue({ ...settlementData, status: 'pending' });
    const updated = { ...settlementData, status: 'approved' };
    mockUpdateSettlementStatus.mockResolvedValue(updated);

    const { PATCH } = await import('@/app/api/admin/settlements/[id]/route');
    const res = await PATCH(makePatchRequest({ status: 'approved' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.settlement.status).toBe('approved');
  });

  it('transitions from approved to paid with bankReference', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGetSettlementById.mockResolvedValue({ ...settlementData, status: 'approved' });
    const updated = { ...settlementData, status: 'paid' };
    mockUpdateSettlementStatus.mockResolvedValue(updated);

    const { PATCH } = await import('@/app/api/admin/settlements/[id]/route');
    const res = await PATCH(
      makePatchRequest({ status: 'paid', bankReference: 'TX-12345', notes: 'Paid on time' }),
      makeContext(),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.settlement.status).toBe('paid');
    expect(mockUpdateSettlementStatus).toHaveBeenCalledWith('stl-1', 'paid', 'TX-12345', 'Paid on time');
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Unexpected'));

    const { PATCH } = await import('@/app/api/admin/settlements/[id]/route');
    const res = await PATCH(makePatchRequest({ status: 'approved' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
