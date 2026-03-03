/**
 * Unit tests for GET/PATCH /api/me/profile
 * Coverage target: user profile read and update
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock auth ──────────────────────────────────────────────────────────────

const mockRequireApprovedUser = vi.fn();

vi.mock('@/lib/auth-utils', () => ({
  requireApprovedUser: (...args: unknown[]) => mockRequireApprovedUser(...args),
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

const chainedDb = {
  select: mockSelect,
  from: mockFrom,
  where: mockWhere,
  limit: mockLimit,
  update: mockUpdate,
  set: mockSet,
};

mockSelect.mockReturnValue(chainedDb);
mockFrom.mockReturnValue(chainedDb);
mockWhere.mockReturnValue(chainedDb);
mockLimit.mockResolvedValue([]);
mockUpdate.mockReturnValue(chainedDb);
mockSet.mockReturnValue(chainedDb);

vi.mock('@/db/connection', () => ({ db: chainedDb }));

vi.mock('@/db/schema', () => ({
  users: { id: 'id', email: 'email', name: 'name', phone: 'phone', address: 'address', city: 'city', postalCode: 'postalCode', country: 'country', passwordHash: 'passwordHash', createdAt: 'createdAt', updatedAt: 'updatedAt' },
}));

// ─── Import AuthError ───────────────────────────────────────────────────────

const { AuthError } = await import('@/lib/auth-utils');

// ─── Helpers ────────────────────────────────────────────────────────────────

function makePatchRequest(body: unknown) {
  return new Request('http://localhost:3000/api/me/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const sampleUser = {
  id: 'user-1',
  email: 'john@example.com',
  name: 'John Doe',
  phone: '+48123456789',
  address: '123 Main St',
  city: 'Warsaw',
  postalCode: '00-001',
  country: 'Poland',
  hasPassword: 'hashed-password',
  createdAt: new Date('2026-01-01'),
};

// ─── GET tests ──────────────────────────────────────────────────────────────

describe('GET /api/me/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue(chainedDb);
    mockFrom.mockReturnValue(chainedDb);
    mockWhere.mockReturnValue(chainedDb);
    mockLimit.mockResolvedValue([]);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireApprovedUser.mockRejectedValue(new AuthError('Authentication required', 401));

    const { GET } = await import('@/app/api/me/profile/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 403 for non-user accounts', async () => {
    mockRequireApprovedUser.mockRejectedValue(new AuthError('User access required', 403));

    const { GET } = await import('@/app/api/me/profile/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('User access required');
  });

  it('returns 404 when user not found in DB', async () => {
    mockRequireApprovedUser.mockResolvedValue({ id: 'user-1' });
    mockLimit.mockResolvedValueOnce([]);

    const { GET } = await import('@/app/api/me/profile/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('User not found');
  });

  it('returns profile with hasPassword as boolean', async () => {
    mockRequireApprovedUser.mockResolvedValue({ id: 'user-1' });
    mockLimit.mockResolvedValueOnce([sampleUser]);

    const { GET } = await import('@/app/api/me/profile/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.profile.id).toBe('user-1');
    expect(body.profile.email).toBe('john@example.com');
    expect(body.profile.name).toBe('John Doe');
    expect(body.profile.hasPassword).toBe(true);
    // Null fields should default to empty strings
    expect(typeof body.profile.phone).toBe('string');
  });

  it('returns hasPassword false when no password hash', async () => {
    mockRequireApprovedUser.mockResolvedValue({ id: 'user-1' });
    mockLimit.mockResolvedValueOnce([{ ...sampleUser, hasPassword: null }]);

    const { GET } = await import('@/app/api/me/profile/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.profile.hasPassword).toBe(false);
  });

  it('defaults null fields to empty strings', async () => {
    mockRequireApprovedUser.mockResolvedValue({ id: 'user-1' });
    mockLimit.mockResolvedValueOnce([{
      ...sampleUser,
      phone: null,
      address: null,
      city: null,
      postalCode: null,
      country: null,
    }]);

    const { GET } = await import('@/app/api/me/profile/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.profile.phone).toBe('');
    expect(body.profile.address).toBe('');
    expect(body.profile.city).toBe('');
    expect(body.profile.postalCode).toBe('');
    expect(body.profile.country).toBe('');
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireApprovedUser.mockRejectedValue(new Error('DB crash'));

    const { GET } = await import('@/app/api/me/profile/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});

// ─── PATCH tests ────────────────────────────────────────────────────────────

describe('PATCH /api/me/profile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockReturnValue(chainedDb);
    mockSet.mockReturnValue(chainedDb);
    mockWhere.mockResolvedValue(undefined);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireApprovedUser.mockRejectedValue(new AuthError('Authentication required', 401));

    const { PATCH } = await import('@/app/api/me/profile/route');
    const res = await PATCH(makePatchRequest({ name: 'New Name' }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 403 for non-user accounts', async () => {
    mockRequireApprovedUser.mockRejectedValue(new AuthError('User access required', 403));

    const { PATCH } = await import('@/app/api/me/profile/route');
    const res = await PATCH(makePatchRequest({ name: 'New Name' }));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('User access required');
  });

  it('returns 400 when no valid fields provided', async () => {
    mockRequireApprovedUser.mockResolvedValue({ id: 'user-1' });

    const { PATCH } = await import('@/app/api/me/profile/route');
    const res = await PATCH(makePatchRequest({ email: 'hack@example.com', invalidField: 'test' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('No valid fields to update');
  });

  it('returns 400 when name is too short', async () => {
    mockRequireApprovedUser.mockResolvedValue({ id: 'user-1' });

    const { PATCH } = await import('@/app/api/me/profile/route');
    const res = await PATCH(makePatchRequest({ name: 'A' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Name must be at least 2 characters');
  });

  it('updates profile successfully with name', async () => {
    mockRequireApprovedUser.mockResolvedValue({ id: 'user-1' });

    const { PATCH } = await import('@/app/api/me/profile/route');
    const res = await PATCH(makePatchRequest({ name: 'New Name' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('updates profile with multiple allowed fields', async () => {
    mockRequireApprovedUser.mockResolvedValue({ id: 'user-1' });

    const { PATCH } = await import('@/app/api/me/profile/route');
    const res = await PATCH(makePatchRequest({
      name: 'New Name',
      phone: '+48987654321',
      city: 'Krakow',
      country: 'Poland',
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it('ignores non-string field values', async () => {
    mockRequireApprovedUser.mockResolvedValue({ id: 'user-1' });

    const { PATCH } = await import('@/app/api/me/profile/route');
    const res = await PATCH(makePatchRequest({ name: 123, phone: true }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('No valid fields to update');
  });

  it('trims whitespace from field values', async () => {
    mockRequireApprovedUser.mockResolvedValue({ id: 'user-1' });

    const { PATCH } = await import('@/app/api/me/profile/route');
    const res = await PATCH(makePatchRequest({ name: '  New Name  ' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireApprovedUser.mockRejectedValue(new Error('DB crash'));

    const { PATCH } = await import('@/app/api/me/profile/route');
    const res = await PATCH(makePatchRequest({ name: 'New Name' }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
