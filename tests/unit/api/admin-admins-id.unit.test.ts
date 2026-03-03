/**
 * Unit tests for /api/admin/admins/[id] (GET, PATCH, DELETE)
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
const mockUpdate = vi.fn();
const mockSet = vi.fn();
const mockReturning = vi.fn();

const chainedDb = {
  select: mockSelect,
  from: mockFrom,
  where: mockWhere,
  limit: mockLimit,
  update: mockUpdate,
  set: mockSet,
  returning: mockReturning,
};

mockSelect.mockReturnValue(chainedDb);
mockFrom.mockReturnValue(chainedDb);
mockWhere.mockReturnValue(chainedDb);
mockLimit.mockResolvedValue([]);
mockUpdate.mockReturnValue(chainedDb);
mockSet.mockReturnValue(chainedDb);
mockReturning.mockResolvedValue([]);

vi.mock('@/db/connection', () => ({ db: chainedDb }));

vi.mock('@/db/schema', () => ({
  admins: { id: 'id', email: 'email', name: 'name', role: 'role', isActive: 'isActive', deletedAt: 'deletedAt' },
}));

vi.mock('@/db/helpers', () => ({
  notDeleted: vi.fn(() => 'not-deleted-condition'),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ _eq: args })),
  and: vi.fn((...args: unknown[]) => ({ _and: args })),
}));

vi.mock('@/lib/audit', () => ({
  logCreate: vi.fn().mockResolvedValue(undefined),
  logUpdate: vi.fn().mockResolvedValue(undefined),
  logDelete: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn().mockResolvedValue('hashed-password') },
}));

vi.mock('@/lib/validation/admin', () => ({
  updateAdminSchema: {
    safeParse: vi.fn((data: unknown) => {
      const d = data as Record<string, unknown>;
      if (d && d.invalid) {
        return {
          success: false,
          error: { flatten: () => ({ fieldErrors: { name: ['Invalid'] } }) },
        };
      }
      return { success: true, data: d ?? {} };
    }),
  },
}));

// ─── Import ─────────────────────────────────────────────────────────────────

const { AuthError } = await import('@/lib/auth-utils');

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(method: string, body?: unknown) {
  const opts: RequestInit = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  return new NextRequest('http://localhost:3000/api/admin/admins/admin-1', opts);
}

function makeContext(id = 'admin-1') {
  return { params: Promise.resolve({ id }) };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/admin/admins/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue(chainedDb);
    mockFrom.mockReturnValue(chainedDb);
    mockWhere.mockReturnValue(chainedDb);
    mockLimit.mockResolvedValue([]);
    mockUpdate.mockReturnValue(chainedDb);
    mockSet.mockReturnValue(chainedDb);
    mockReturning.mockResolvedValue([]);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { GET } = await import('@/app/api/admin/admins/[id]/route');
    const res = await GET(makeRequest('GET'), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 404 when admin not found', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1', role: 'super_admin' });
    mockLimit.mockResolvedValueOnce([]);

    const { GET } = await import('@/app/api/admin/admins/[id]/route');
    const res = await GET(makeRequest('GET'), makeContext('nonexistent'));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Admin not found');
  });

  it('returns admin details', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1', role: 'super_admin' });
    const adminData = { id: 'a1', email: 'a@test.com', name: 'Admin', role: 'admin', isActive: true };
    mockLimit.mockResolvedValueOnce([adminData]);

    const { GET } = await import('@/app/api/admin/admins/[id]/route');
    const res = await GET(makeRequest('GET'), makeContext('a1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.admin).toEqual(adminData);
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Unexpected'));

    const { GET } = await import('@/app/api/admin/admins/[id]/route');
    const res = await GET(makeRequest('GET'), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});

describe('PATCH /api/admin/admins/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue(chainedDb);
    mockFrom.mockReturnValue(chainedDb);
    mockWhere.mockReturnValue(chainedDb);
    mockLimit.mockResolvedValue([]);
    mockUpdate.mockReturnValue(chainedDb);
    mockSet.mockReturnValue(chainedDb);
    mockReturning.mockResolvedValue([]);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { PATCH } = await import('@/app/api/admin/admins/[id]/route');
    const res = await PATCH(makeRequest('PATCH', { name: 'New Name' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 400 for invalid body', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1', role: 'super_admin' });

    const { PATCH } = await import('@/app/api/admin/admins/[id]/route');
    const res = await PATCH(makeRequest('PATCH', { invalid: true }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Validation failed');
  });

  it('returns 400 when no fields to update', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1', role: 'super_admin' });

    const { PATCH } = await import('@/app/api/admin/admins/[id]/route');
    const res = await PATCH(makeRequest('PATCH', {}), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('No fields to update');
  });

  it('returns 404 when admin not found', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1', role: 'super_admin' });
    mockLimit.mockResolvedValueOnce([]);

    const { PATCH } = await import('@/app/api/admin/admins/[id]/route');
    const res = await PATCH(makeRequest('PATCH', { name: 'New Name' }), makeContext('nonexistent'));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Admin not found');
  });

  it('returns 400 when trying to deactivate own account', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1', role: 'super_admin' });
    mockLimit.mockResolvedValueOnce([{ id: 'admin-1', role: 'admin', name: 'Admin' }]);

    const { PATCH } = await import('@/app/api/admin/admins/[id]/route');
    const res = await PATCH(makeRequest('PATCH', { isActive: false }), makeContext('admin-1'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('deactivate');
  });

  it('returns 403 when non-super_admin tries to modify super_admin', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1', role: 'admin' });
    mockLimit.mockResolvedValueOnce([{ id: 'admin-2', role: 'super_admin', name: 'SA' }]);

    const { PATCH } = await import('@/app/api/admin/admins/[id]/route');
    const res = await PATCH(makeRequest('PATCH', { name: 'New Name' }), makeContext('admin-2'));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toContain('super_admin');
  });

  it('updates admin successfully', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1', role: 'super_admin' });
    mockLimit.mockResolvedValueOnce([{ id: 'admin-2', role: 'admin', name: 'Old Name' }]);
    const updated = { id: 'admin-2', email: 'a@test.com', name: 'New Name', role: 'admin', isActive: true, lastLoginAt: null, createdAt: '2024-01-01' };
    mockReturning.mockResolvedValueOnce([updated]);

    const { PATCH } = await import('@/app/api/admin/admins/[id]/route');
    const res = await PATCH(makeRequest('PATCH', { name: 'New Name' }), makeContext('admin-2'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.admin.name).toBe('New Name');
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('DB crash'));

    const { PATCH } = await import('@/app/api/admin/admins/[id]/route');
    const res = await PATCH(makeRequest('PATCH', { name: 'X' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});

describe('DELETE /api/admin/admins/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue(chainedDb);
    mockFrom.mockReturnValue(chainedDb);
    mockWhere.mockReturnValue(chainedDb);
    mockLimit.mockResolvedValue([]);
    mockUpdate.mockReturnValue(chainedDb);
    mockSet.mockReturnValue(chainedDb);
    mockReturning.mockResolvedValue([]);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { DELETE } = await import('@/app/api/admin/admins/[id]/route');
    const res = await DELETE(makeRequest('DELETE'), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 400 when trying to delete own account', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1', role: 'super_admin' });

    const { DELETE } = await import('@/app/api/admin/admins/[id]/route');
    const res = await DELETE(makeRequest('DELETE'), makeContext('admin-1'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('cannot delete your own');
  });

  it('returns 404 when admin not found', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1', role: 'super_admin' });
    mockLimit.mockResolvedValueOnce([]);

    const { DELETE } = await import('@/app/api/admin/admins/[id]/route');
    const res = await DELETE(makeRequest('DELETE'), makeContext('nonexistent'));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Admin not found');
  });

  it('returns 403 when non-super_admin tries to delete super_admin', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1', role: 'admin' });
    mockLimit.mockResolvedValueOnce([{ id: 'admin-2', role: 'super_admin', email: 'sa@test.com', name: 'SA' }]);

    const { DELETE } = await import('@/app/api/admin/admins/[id]/route');
    const res = await DELETE(makeRequest('DELETE'), makeContext('admin-2'));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toContain('super_admin');
  });

  it('deletes admin successfully (soft delete)', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1', role: 'super_admin' });
    mockLimit.mockResolvedValueOnce([{ id: 'admin-2', role: 'admin', email: 'a@test.com', name: 'Admin 2' }]);

    const { DELETE } = await import('@/app/api/admin/admins/[id]/route');
    const res = await DELETE(makeRequest('DELETE'), makeContext('admin-2'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('DB crash'));

    const { DELETE } = await import('@/app/api/admin/admins/[id]/route');
    const res = await DELETE(makeRequest('DELETE'), makeContext('admin-2'));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
