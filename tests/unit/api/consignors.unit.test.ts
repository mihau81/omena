/**
 * Unit tests for /api/admin/consignors (GET, POST)
 * and /api/admin/consignors/[id] (GET, PATCH, DELETE)
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

const mockGetConsignors = vi.fn();
const mockCreateConsignor = vi.fn();
const mockGetConsignorById = vi.fn();
const mockGetConsignorLots = vi.fn();
const mockUpdateConsignor = vi.fn();
const mockDeleteConsignor = vi.fn();

vi.mock('@/db/queries/consignors', () => ({
  getConsignors: (...args: unknown[]) => mockGetConsignors(...args),
  createConsignor: (...args: unknown[]) => mockCreateConsignor(...args),
  getConsignorById: (...args: unknown[]) => mockGetConsignorById(...args),
  getConsignorLots: (...args: unknown[]) => mockGetConsignorLots(...args),
  updateConsignor: (...args: unknown[]) => mockUpdateConsignor(...args),
  deleteConsignor: (...args: unknown[]) => mockDeleteConsignor(...args),
}));

// ─── Mock audit ─────────────────────────────────────────────────────────────

vi.mock('@/lib/audit', () => ({
  logCreate: vi.fn().mockResolvedValue(undefined),
  logUpdate: vi.fn().mockResolvedValue(undefined),
  logDelete: vi.fn().mockResolvedValue(undefined),
}));

// ─── Mock validation ────────────────────────────────────────────────────────

vi.mock('@/lib/validation/consignor', () => ({
  createConsignorSchema: {
    safeParse: vi.fn((data: unknown) => {
      const d = data as Record<string, unknown>;
      if (!d || !d.name) {
        return {
          success: false,
          error: { flatten: () => ({ fieldErrors: { name: ['Name is required'] } }) },
        };
      }
      return { success: true, data: d };
    }),
  },
  updateConsignorSchema: {
    safeParse: vi.fn((data: unknown) => {
      const d = data as Record<string, unknown>;
      if (d && d.invalid) {
        return {
          success: false,
          error: { flatten: () => ({ fieldErrors: { name: ['Invalid'] } }) },
        };
      }
      return { success: true, data: d || {} };
    }),
  },
}));

// ─── Import AuthError ───────────────────────────────────────────────────────

const { AuthError } = await import('@/lib/auth-utils');

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeGetRequest(url = 'http://localhost:3000/api/admin/consignors') {
  return new NextRequest(url);
}

function makePostRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/admin/consignors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makePatchRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/admin/consignors/c1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeDeleteRequest() {
  return new NextRequest('http://localhost:3000/api/admin/consignors/c1', {
    method: 'DELETE',
  });
}

function makeContext(id = 'consignor-1') {
  return { params: Promise.resolve({ id }) };
}

// ─── Tests for /api/admin/consignors ────────────────────────────────────────

describe('GET /api/admin/consignors', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { GET } = await import('@/app/api/admin/consignors/route');
    const res = await GET(makeGetRequest());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns consignors list with default pagination', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    const result = { consignors: [{ id: 'c1', name: 'Gallery A' }], total: 1 };
    mockGetConsignors.mockResolvedValue(result);

    const { GET } = await import('@/app/api/admin/consignors/route');
    const res = await GET(makeGetRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.consignors).toHaveLength(1);
    expect(mockGetConsignors).toHaveBeenCalledWith({
      search: undefined,
      isActive: undefined,
      page: 1,
      limit: 20,
    });
  });

  it('passes search and pagination params', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGetConsignors.mockResolvedValue({ consignors: [], total: 0 });

    const { GET } = await import('@/app/api/admin/consignors/route');
    const url = 'http://localhost:3000/api/admin/consignors?page=2&limit=10&search=gallery&isActive=true';
    const res = await GET(makeGetRequest(url));

    expect(res.status).toBe(200);
    expect(mockGetConsignors).toHaveBeenCalledWith({
      search: 'gallery',
      isActive: true,
      page: 2,
      limit: 10,
    });
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('DB error'));

    const { GET } = await import('@/app/api/admin/consignors/route');
    const res = await GET(makeGetRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});

describe('POST /api/admin/consignors', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { POST } = await import('@/app/api/admin/consignors/route');
    const res = await POST(makePostRequest({ name: 'Test' }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 400 for invalid body', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });

    const { POST } = await import('@/app/api/admin/consignors/route');
    const res = await POST(makePostRequest({}));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Validation failed');
  });

  it('creates consignor successfully', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    const consignor = { id: 'c1', name: 'New Gallery', email: 'gallery@example.com' };
    mockCreateConsignor.mockResolvedValue(consignor);

    const { POST } = await import('@/app/api/admin/consignors/route');
    const res = await POST(makePostRequest({ name: 'New Gallery', email: 'gallery@example.com' }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.consignor.name).toBe('New Gallery');
  });
});

// ─── Tests for /api/admin/consignors/[id] ──────────────────────────────────

describe('GET /api/admin/consignors/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { GET } = await import('@/app/api/admin/consignors/[id]/route');
    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 404 when consignor not found', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGetConsignorById.mockResolvedValue(null);

    const { GET } = await import('@/app/api/admin/consignors/[id]/route');
    const res = await GET(makeGetRequest(), makeContext('nonexistent'));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Consignor not found');
  });

  it('returns consignor with lots', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    const consignor = { id: 'c1', name: 'Gallery A', email: 'a@gallery.com' };
    const lots = [{ id: 'lot-1', title: 'Painting' }];
    mockGetConsignorById.mockResolvedValue(consignor);
    mockGetConsignorLots.mockResolvedValue(lots);

    const { GET } = await import('@/app/api/admin/consignors/[id]/route');
    const res = await GET(makeGetRequest(), makeContext('c1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.consignor.name).toBe('Gallery A');
    expect(body.lots).toHaveLength(1);
  });
});

describe('PATCH /api/admin/consignors/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 404 when consignor not found', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGetConsignorById.mockResolvedValue(null);

    const { PATCH } = await import('@/app/api/admin/consignors/[id]/route');
    const res = await PATCH(makePatchRequest({ name: 'Updated' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Consignor not found');
  });

  it('returns 400 for validation errors', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGetConsignorById.mockResolvedValue({ id: 'c1', name: 'Old' });

    const { PATCH } = await import('@/app/api/admin/consignors/[id]/route');
    const res = await PATCH(makePatchRequest({ invalid: true }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Validation failed');
  });

  it('returns 400 when no fields to update', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGetConsignorById.mockResolvedValue({ id: 'c1', name: 'Old' });

    // Override the safeParse mock for this specific test
    const { updateConsignorSchema } = await import('@/lib/validation/consignor');
    (updateConsignorSchema.safeParse as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      success: true,
      data: {},
    });

    const { PATCH } = await import('@/app/api/admin/consignors/[id]/route');
    const res = await PATCH(makePatchRequest({}), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('No fields to update');
  });

  it('updates consignor successfully', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGetConsignorById.mockResolvedValue({ id: 'c1', name: 'Old Name', email: 'old@example.com' });
    mockUpdateConsignor.mockResolvedValue({ id: 'c1', name: 'New Name', email: 'old@example.com' });

    const { PATCH } = await import('@/app/api/admin/consignors/[id]/route');
    const res = await PATCH(makePatchRequest({ name: 'New Name' }), makeContext('c1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.consignor.name).toBe('New Name');
  });
});

describe('DELETE /api/admin/consignors/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { DELETE } = await import('@/app/api/admin/consignors/[id]/route');
    const res = await DELETE(makeDeleteRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 404 when consignor not found', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGetConsignorById.mockResolvedValue(null);

    const { DELETE } = await import('@/app/api/admin/consignors/[id]/route');
    const res = await DELETE(makeDeleteRequest(), makeContext('nonexistent'));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Consignor not found');
  });

  it('deletes consignor successfully', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGetConsignorById.mockResolvedValue({ id: 'c1', name: 'Gallery', email: 'g@example.com' });
    mockDeleteConsignor.mockResolvedValue(undefined);

    const { DELETE } = await import('@/app/api/admin/consignors/[id]/route');
    const res = await DELETE(makeDeleteRequest(), makeContext('c1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('DB failure'));

    const { DELETE } = await import('@/app/api/admin/consignors/[id]/route');
    const res = await DELETE(makeDeleteRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
