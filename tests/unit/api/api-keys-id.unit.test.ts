/**
 * Unit tests for PATCH/DELETE /api/admin/api-keys/[id]
 * Coverage target: single API key management (update, delete)
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
const mockDeleteFn = vi.fn();

const chainedDb = {
  select: mockSelect,
  from: mockFrom,
  where: mockWhere,
  limit: mockLimit,
  update: mockUpdate,
  set: mockSet,
  returning: mockReturning,
  delete: mockDeleteFn,
};

mockSelect.mockReturnValue(chainedDb);
mockFrom.mockReturnValue(chainedDb);
mockWhere.mockReturnValue(chainedDb);
mockLimit.mockResolvedValue([]);
mockUpdate.mockReturnValue(chainedDb);
mockSet.mockReturnValue(chainedDb);
mockReturning.mockResolvedValue([]);
mockDeleteFn.mockReturnValue(chainedDb);

vi.mock('@/db/connection', () => ({ db: chainedDb }));

vi.mock('@/db/schema', () => ({
  apiKeys: { id: 'id', name: 'name', keyPrefix: 'keyPrefix', isActive: 'isActive', rateLimit: 'rateLimit', expiresAt: 'expiresAt' },
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

function makePatchRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/admin/api-keys/key-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeDeleteRequest() {
  return new NextRequest('http://localhost:3000/api/admin/api-keys/key-1', {
    method: 'DELETE',
  });
}

function makeContext(id = 'key-1') {
  return { params: Promise.resolve({ id }) };
}

const existingKey = {
  id: 'key-1',
  name: 'Test Key',
  keyPrefix: 'om_test',
  permissions: ['read'],
  rateLimit: 1000,
  isActive: true,
  lastUsedAt: null,
  createdAt: new Date(),
  expiresAt: null,
};

describe('PATCH /api/admin/api-keys/[id]', () => {
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

    const { PATCH } = await import('@/app/api/admin/api-keys/[id]/route');
    const res = await PATCH(makePatchRequest({ isActive: false }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 404 when key not found', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([]); // key not found

    const { PATCH } = await import('@/app/api/admin/api-keys/[id]/route');
    const res = await PATCH(makePatchRequest({ isActive: false }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('API key not found');
  });

  it('returns 400 when isActive is not boolean', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([existingKey]);

    const { PATCH } = await import('@/app/api/admin/api-keys/[id]/route');
    const res = await PATCH(makePatchRequest({ isActive: 'not-a-bool' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('isActive must be a boolean');
  });

  it('returns 400 when name is empty', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([existingKey]);

    const { PATCH } = await import('@/app/api/admin/api-keys/[id]/route');
    const res = await PATCH(makePatchRequest({ name: '' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Name must be a non-empty string');
  });

  it('returns 400 when name exceeds 100 characters', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([existingKey]);

    const { PATCH } = await import('@/app/api/admin/api-keys/[id]/route');
    const res = await PATCH(makePatchRequest({ name: 'a'.repeat(101) }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Name must be 100 characters or less');
  });

  it('returns 400 when rateLimit is out of range', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([existingKey]);

    const { PATCH } = await import('@/app/api/admin/api-keys/[id]/route');
    const res = await PATCH(makePatchRequest({ rateLimit: 0 }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('rateLimit must be a number between 1 and 100000');
  });

  it('returns 400 when expiresAt is invalid date', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([existingKey]);

    const { PATCH } = await import('@/app/api/admin/api-keys/[id]/route');
    const res = await PATCH(makePatchRequest({ expiresAt: 'not-a-date' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid expiresAt date');
  });

  it('returns 400 when no fields to update', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([existingKey]);

    const { PATCH } = await import('@/app/api/admin/api-keys/[id]/route');
    const res = await PATCH(makePatchRequest({}), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('No fields to update');
  });

  it('updates isActive successfully', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([existingKey]);
    mockReturning.mockResolvedValueOnce([{ ...existingKey, isActive: false }]);

    const { PATCH } = await import('@/app/api/admin/api-keys/[id]/route');
    const res = await PATCH(makePatchRequest({ isActive: false }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.apiKey.isActive).toBe(false);
  });

  it('updates name successfully', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([existingKey]);
    mockReturning.mockResolvedValueOnce([{ ...existingKey, name: 'Renamed Key' }]);

    const { PATCH } = await import('@/app/api/admin/api-keys/[id]/route');
    const res = await PATCH(makePatchRequest({ name: 'Renamed Key' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.apiKey.name).toBe('Renamed Key');
  });

  it('allows setting expiresAt to null', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([{ ...existingKey, expiresAt: new Date() }]);
    mockReturning.mockResolvedValueOnce([{ ...existingKey, expiresAt: null }]);

    const { PATCH } = await import('@/app/api/admin/api-keys/[id]/route');
    const res = await PATCH(makePatchRequest({ expiresAt: null }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.apiKey.expiresAt).toBeNull();
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Unexpected'));

    const { PATCH } = await import('@/app/api/admin/api-keys/[id]/route');
    const res = await PATCH(makePatchRequest({ isActive: false }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});

describe('DELETE /api/admin/api-keys/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue(chainedDb);
    mockFrom.mockReturnValue(chainedDb);
    mockWhere.mockReturnValue(chainedDb);
    mockLimit.mockResolvedValue([]);
    mockDeleteFn.mockReturnValue(chainedDb);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { DELETE } = await import('@/app/api/admin/api-keys/[id]/route');
    const res = await DELETE(makeDeleteRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 404 when key not found', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([]);

    const { DELETE } = await import('@/app/api/admin/api-keys/[id]/route');
    const res = await DELETE(makeDeleteRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('API key not found');
  });

  it('deletes key successfully', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([existingKey]);
    // The delete chain: db.delete(apiKeys).where(...) needs where to resolve
    // After the select chain finishes (with limit), delete chain starts
    // delete -> returns chainedDb -> where needs to resolve
    mockDeleteFn.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });

    const { DELETE } = await import('@/app/api/admin/api-keys/[id]/route');
    const res = await DELETE(makeDeleteRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('DB error'));

    const { DELETE } = await import('@/app/api/admin/api-keys/[id]/route');
    const res = await DELETE(makeDeleteRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
