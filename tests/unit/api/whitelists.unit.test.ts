/**
 * Unit tests for GET/POST /api/admin/whitelists
 * Coverage target: whitelist listing and creation
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
const mockInsert = vi.fn();
const mockValues = vi.fn();
const mockReturning = vi.fn();
const mockOnConflictDoNothing = vi.fn();

const chainedDb = {
  select: mockSelect,
  from: mockFrom,
  where: mockWhere,
  limit: mockLimit,
  orderBy: mockOrderBy,
  insert: mockInsert,
  values: mockValues,
  returning: mockReturning,
  onConflictDoNothing: mockOnConflictDoNothing,
};

mockSelect.mockReturnValue(chainedDb);
mockFrom.mockReturnValue(chainedDb);
mockWhere.mockReturnValue(chainedDb);
mockOrderBy.mockReturnValue(chainedDb);
mockLimit.mockResolvedValue([]);
mockInsert.mockReturnValue(chainedDb);
mockValues.mockReturnValue(chainedDb);
mockOnConflictDoNothing.mockReturnValue(chainedDb);
mockReturning.mockResolvedValue([]);

vi.mock('@/db/connection', () => ({ db: chainedDb }));

vi.mock('@/db/schema', () => ({
  userWhitelists: {
    id: 'id',
    email: 'email',
    name: 'name',
    notes: 'notes',
    importedBy: 'importedBy',
    createdAt: 'createdAt',
  },
}));

// ─── Import AuthError ───────────────────────────────────────────────────────

const { AuthError } = await import('@/lib/auth-utils');

// ─── Helpers ────────────────────────────────────────────────────────────────

function makePostRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/admin/whitelists', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const whitelistEntry = {
  id: 'wl-1',
  email: 'test@example.com',
  name: 'Test User',
  notes: null,
  importedBy: 'admin-1',
  createdAt: new Date(),
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/admin/whitelists', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue(chainedDb);
    mockFrom.mockReturnValue(chainedDb);
    mockOrderBy.mockReturnValue(chainedDb);
    mockLimit.mockResolvedValue([]);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { GET } = await import('@/app/api/admin/whitelists/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns empty list when no entries', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValue([]);

    const { GET } = await import('@/app/api/admin/whitelists/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual([]);
  });

  it('returns list of whitelist entries', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValue([whitelistEntry]);

    const { GET } = await import('@/app/api/admin/whitelists/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Unexpected'));

    const { GET } = await import('@/app/api/admin/whitelists/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});

describe('POST /api/admin/whitelists', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockReturnValue(chainedDb);
    mockValues.mockReturnValue(chainedDb);
    mockOnConflictDoNothing.mockReturnValue(chainedDb);
    mockReturning.mockResolvedValue([whitelistEntry]);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { POST } = await import('@/app/api/admin/whitelists/route');
    const res = await POST(makePostRequest({ email: 'test@example.com' }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 400 when validation fails (invalid email)', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });

    const { POST } = await import('@/app/api/admin/whitelists/route');
    const res = await POST(makePostRequest({ email: 'not-an-email' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Validation failed');
  });

  it('returns 400 when email is missing', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });

    const { POST } = await import('@/app/api/admin/whitelists/route');
    const res = await POST(makePostRequest({}));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Validation failed');
  });

  it('returns 409 when email already on whitelist', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockReturning.mockResolvedValue([]); // onConflictDoNothing returns empty

    const { POST } = await import('@/app/api/admin/whitelists/route');
    const res = await POST(makePostRequest({ email: 'existing@example.com' }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe('Email already on whitelist');
  });

  it('creates whitelist entry successfully', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockReturning.mockResolvedValue([whitelistEntry]);

    const { POST } = await import('@/app/api/admin/whitelists/route');
    const res = await POST(makePostRequest({ email: 'test@example.com', name: 'Test User' }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.email).toBe('test@example.com');
  });

  it('creates entry with optional fields', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockReturning.mockResolvedValue([{ ...whitelistEntry, notes: 'VIP' }]);

    const { POST } = await import('@/app/api/admin/whitelists/route');
    const res = await POST(makePostRequest({ email: 'test@example.com', name: 'Test', notes: 'VIP' }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data).toBeDefined();
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Unexpected'));

    const { POST } = await import('@/app/api/admin/whitelists/route');
    const res = await POST(makePostRequest({ email: 'test@example.com' }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
