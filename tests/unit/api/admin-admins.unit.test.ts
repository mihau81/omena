/**
 * Unit tests for /api/admin/admins (GET, POST)
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
const mockInsert = vi.fn();
const mockValues = vi.fn();
const mockReturning = vi.fn();
const mockOrderBy = vi.fn();

const chainedDb = {
  select: mockSelect,
  from: mockFrom,
  where: mockWhere,
  limit: mockLimit,
  insert: mockInsert,
  values: mockValues,
  returning: mockReturning,
  orderBy: mockOrderBy,
};

mockSelect.mockReturnValue(chainedDb);
mockFrom.mockReturnValue(chainedDb);
mockWhere.mockReturnValue(chainedDb);
mockLimit.mockResolvedValue([]);
mockOrderBy.mockResolvedValue([]);
mockInsert.mockReturnValue(chainedDb);
mockValues.mockReturnValue(chainedDb);
mockReturning.mockResolvedValue([]);

vi.mock('@/db/connection', () => ({ db: chainedDb }));

vi.mock('@/db/schema', () => ({
  admins: { id: 'id', email: 'email', name: 'name', role: 'role', isActive: 'isActive', deletedAt: 'deletedAt', createdAt: 'createdAt' },
}));

vi.mock('@/db/helpers', () => ({
  notDeleted: vi.fn(() => 'not-deleted-condition'),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ _eq: args })),
  and: vi.fn((...args: unknown[]) => ({ _and: args })),
  or: vi.fn((...args: unknown[]) => ({ _or: args })),
  ilike: vi.fn((...args: unknown[]) => ({ _ilike: args })),
  desc: vi.fn((col: unknown) => ({ _desc: col })),
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
  createAdminSchema: {
    safeParse: vi.fn((data: unknown) => {
      const d = data as Record<string, unknown>;
      if (!d || !d.email || !d.name || !d.password) {
        return {
          success: false,
          error: { flatten: () => ({ fieldErrors: { email: ['Required'] } }) },
        };
      }
      return { success: true, data: { ...d, role: d.role ?? 'viewer' } };
    }),
  },
}));

// ─── Import ─────────────────────────────────────────────────────────────────

const { AuthError } = await import('@/lib/auth-utils');

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeGetRequest(search = '') {
  const url = search
    ? `http://localhost:3000/api/admin/admins?search=${encodeURIComponent(search)}`
    : 'http://localhost:3000/api/admin/admins';
  return new NextRequest(url, { method: 'GET' });
}

function makePostRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/admin/admins', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/admin/admins', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue(chainedDb);
    mockFrom.mockReturnValue(chainedDb);
    mockWhere.mockReturnValue(chainedDb);
    mockLimit.mockResolvedValue([]);
    mockOrderBy.mockResolvedValue([]);
    mockInsert.mockReturnValue(chainedDb);
    mockValues.mockReturnValue(chainedDb);
    mockReturning.mockResolvedValue([]);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { GET } = await import('@/app/api/admin/admins/route');
    const res = await GET(makeGetRequest());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 403 when admin lacks admins:manage permission', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Missing permission: admins:manage', 403));

    const { GET } = await import('@/app/api/admin/admins/route');
    const res = await GET(makeGetRequest());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('Missing permission: admins:manage');
  });

  it('returns list of admins', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1', role: 'super_admin' });
    const adminRows = [
      { id: 'a1', email: 'a@test.com', name: 'Admin 1', role: 'admin', isActive: true },
      { id: 'a2', email: 'b@test.com', name: 'Admin 2', role: 'viewer', isActive: true },
    ];
    mockOrderBy.mockResolvedValue(adminRows);

    const { GET } = await import('@/app/api/admin/admins/route');
    const res = await GET(makeGetRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.admins).toEqual(adminRows);
    expect(body.total).toBe(2);
  });

  it('supports search parameter', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1', role: 'super_admin' });
    mockOrderBy.mockResolvedValue([]);

    const { GET } = await import('@/app/api/admin/admins/route');
    const res = await GET(makeGetRequest('test'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.admins).toEqual([]);
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('DB error'));

    const { GET } = await import('@/app/api/admin/admins/route');
    const res = await GET(makeGetRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});

describe('POST /api/admin/admins', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue(chainedDb);
    mockFrom.mockReturnValue(chainedDb);
    mockWhere.mockReturnValue(chainedDb);
    mockLimit.mockResolvedValue([]);
    mockOrderBy.mockResolvedValue([]);
    mockInsert.mockReturnValue(chainedDb);
    mockValues.mockReturnValue(chainedDb);
    mockReturning.mockResolvedValue([]);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { POST } = await import('@/app/api/admin/admins/route');
    const res = await POST(makePostRequest({ email: 'new@test.com', name: 'New', password: 'pass1234' }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 400 for invalid body', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1', role: 'super_admin' });

    const { POST } = await import('@/app/api/admin/admins/route');
    const res = await POST(makePostRequest({}));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Validation failed');
  });

  it('returns 403 when non-super_admin tries to create super_admin', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1', role: 'admin' });

    const { POST } = await import('@/app/api/admin/admins/route');
    const res = await POST(makePostRequest({
      email: 'new@test.com',
      name: 'New Admin',
      password: 'password123',
      role: 'super_admin',
    }));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toContain('super_admin');
  });

  it('returns 409 when email already exists', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1', role: 'super_admin' });
    mockLimit.mockResolvedValueOnce([{ id: 'existing-id' }]);

    const { POST } = await import('@/app/api/admin/admins/route');
    const res = await POST(makePostRequest({
      email: 'existing@test.com',
      name: 'Existing',
      password: 'password123',
    }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toContain('already exists');
  });

  it('creates admin successfully', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1', role: 'super_admin' });
    mockLimit.mockResolvedValueOnce([]);
    const newAdmin = {
      id: 'new-id',
      email: 'new@test.com',
      name: 'New Admin',
      role: 'viewer',
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    mockReturning.mockResolvedValueOnce([newAdmin]);

    const { POST } = await import('@/app/api/admin/admins/route');
    const res = await POST(makePostRequest({
      email: 'new@test.com',
      name: 'New Admin',
      password: 'password123',
    }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.admin.email).toBe('new@test.com');
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('DB crash'));

    const { POST } = await import('@/app/api/admin/admins/route');
    const res = await POST(makePostRequest({ email: 'a@b.com', name: 'X', password: '12345678' }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
