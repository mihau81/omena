/**
 * Unit tests for GET/POST /api/admin/api-keys
 * Coverage target: API key listing and creation
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
mockOrderBy.mockResolvedValue([]);
mockLimit.mockResolvedValue([]);
mockInsert.mockReturnValue(chainedDb);
mockValues.mockReturnValue(chainedDb);
mockOnConflictDoNothing.mockReturnValue(chainedDb);
mockReturning.mockResolvedValue([]);

vi.mock('@/db/connection', () => ({ db: chainedDb }));

vi.mock('@/db/schema', () => ({
  apiKeys: {
    id: 'id',
    name: 'name',
    keyPrefix: 'keyPrefix',
    permissions: 'permissions',
    rateLimit: 'rateLimit',
    isActive: 'isActive',
    lastUsedAt: 'lastUsedAt',
    createdAt: 'createdAt',
    expiresAt: 'expiresAt',
  },
}));

// ─── Mock generateApiKey ────────────────────────────────────────────────────

const mockGenerateApiKey = vi.fn();
vi.mock('@/lib/api-key-auth', () => ({
  generateApiKey: (...args: unknown[]) => mockGenerateApiKey(...args),
}));

// ─── Mock audit ─────────────────────────────────────────────────────────────

vi.mock('@/lib/audit', () => ({
  logCreate: vi.fn().mockResolvedValue(undefined),
  logUpdate: vi.fn().mockResolvedValue(undefined),
  logDelete: vi.fn().mockResolvedValue(undefined),
}));

// ─── Import AuthError ───────────────────────────────────────────────────────

const { AuthError } = await import('@/lib/auth-utils');

// ─── Helpers ────────────────────────────────────────────────────────────────

function makePostRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/admin/api-keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const createdKey = {
  id: 'key-1',
  name: 'Test Key',
  keyPrefix: 'om_test',
  permissions: ['lots:read', 'auctions:read'],
  rateLimit: 1000,
  isActive: true,
  lastUsedAt: null,
  createdAt: new Date(),
  expiresAt: null,
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/admin/api-keys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue(chainedDb);
    mockFrom.mockReturnValue(chainedDb);
    mockOrderBy.mockResolvedValue([]);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { GET } = await import('@/app/api/admin/api-keys/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns empty list when no keys exist', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockOrderBy.mockResolvedValue([]);

    const { GET } = await import('@/app/api/admin/api-keys/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.apiKeys).toEqual([]);
    expect(body.total).toBe(0);
  });

  it('returns list of API keys', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    const rows = [createdKey, { ...createdKey, id: 'key-2', name: 'Key 2' }];
    mockOrderBy.mockResolvedValue(rows);

    const { GET } = await import('@/app/api/admin/api-keys/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.apiKeys).toHaveLength(2);
    expect(body.total).toBe(2);
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('DB failure'));

    const { GET } = await import('@/app/api/admin/api-keys/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});

describe('POST /api/admin/api-keys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue(chainedDb);
    mockFrom.mockReturnValue(chainedDb);
    mockInsert.mockReturnValue(chainedDb);
    mockValues.mockReturnValue(chainedDb);
    mockReturning.mockResolvedValue([createdKey]);
    mockGenerateApiKey.mockResolvedValue({
      plainKey: 'om_test_plainkey123',
      keyHash: 'hash123',
      keyPrefix: 'om_test',
    });
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { POST } = await import('@/app/api/admin/api-keys/route');
    const res = await POST(makePostRequest({ name: 'Test' }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 400 when name is missing', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });

    const { POST } = await import('@/app/api/admin/api-keys/route');
    const res = await POST(makePostRequest({}));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Name is required');
  });

  it('returns 400 when name is empty string', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });

    const { POST } = await import('@/app/api/admin/api-keys/route');
    const res = await POST(makePostRequest({ name: '' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Name is required');
  });

  it('returns 400 when name exceeds 100 characters', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });

    const { POST } = await import('@/app/api/admin/api-keys/route');
    const res = await POST(makePostRequest({ name: 'x'.repeat(101) }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Name must be 100 characters or less');
  });

  it('returns 400 when rateLimit is out of range', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });

    const { POST } = await import('@/app/api/admin/api-keys/route');
    const res = await POST(makePostRequest({ name: 'Test', rateLimit: 0 }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('rateLimit must be a number');
  });

  it('returns 400 when rateLimit exceeds max', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });

    const { POST } = await import('@/app/api/admin/api-keys/route');
    const res = await POST(makePostRequest({ name: 'Test', rateLimit: 100001 }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('rateLimit must be a number');
  });

  it('returns 400 when permissions is not an array', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });

    const { POST } = await import('@/app/api/admin/api-keys/route');
    const res = await POST(makePostRequest({ name: 'Test', permissions: 'invalid' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('permissions must be an array');
  });

  it('returns 400 when expiresAt is invalid date', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });

    const { POST } = await import('@/app/api/admin/api-keys/route');
    const res = await POST(makePostRequest({ name: 'Test', expiresAt: 'not-a-date' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid expiresAt date');
  });

  it('returns 400 when expiresAt is in the past', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });

    const { POST } = await import('@/app/api/admin/api-keys/route');
    const res = await POST(makePostRequest({ name: 'Test', expiresAt: '2020-01-01T00:00:00Z' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('expiresAt must be in the future');
  });

  it('creates API key successfully with defaults', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });

    const { POST } = await import('@/app/api/admin/api-keys/route');
    const res = await POST(makePostRequest({ name: 'My New Key' }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.apiKey).toBeDefined();
    expect(body.plainKey).toBe('om_test_plainkey123');
    expect(body.apiKey.id).toBe('key-1');
  });

  it('creates API key with custom fields', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    const futureDate = new Date(Date.now() + 86400000).toISOString();

    const { POST } = await import('@/app/api/admin/api-keys/route');
    const res = await POST(makePostRequest({
      name: 'Custom Key',
      rateLimit: 500,
      permissions: ['lots:read'],
      expiresAt: futureDate,
    }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.apiKey).toBeDefined();
    expect(body.plainKey).toBeDefined();
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Unexpected'));

    const { POST } = await import('@/app/api/admin/api-keys/route');
    const res = await POST(makePostRequest({ name: 'Test' }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
