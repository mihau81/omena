/**
 * Unit tests for DELETE /api/admin/whitelists/[id]
 * Coverage target: whitelist entry deletion
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

const mockDeleteFn = vi.fn();
const mockWhere = vi.fn();
const mockReturning = vi.fn();

const chainedDb = {
  delete: mockDeleteFn,
  where: mockWhere,
  returning: mockReturning,
};

mockDeleteFn.mockReturnValue(chainedDb);
mockWhere.mockReturnValue(chainedDb);
mockReturning.mockResolvedValue([]);

vi.mock('@/db/connection', () => ({ db: chainedDb }));

vi.mock('@/db/schema', () => ({
  userWhitelists: {
    id: 'id',
    email: 'email',
  },
}));

// ─── Import AuthError ───────────────────────────────────────────────────────

const { AuthError } = await import('@/lib/auth-utils');

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeRequest() {
  return new Request('http://localhost:3000/api/admin/whitelists/wl-1', { method: 'DELETE' });
}

function makeContext(id = 'wl-1') {
  return { params: Promise.resolve({ id }) };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('DELETE /api/admin/whitelists/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteFn.mockReturnValue(chainedDb);
    mockWhere.mockReturnValue(chainedDb);
    mockReturning.mockResolvedValue([]);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { DELETE } = await import('@/app/api/admin/whitelists/[id]/route');
    const res = await DELETE(makeRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 404 when entry not found', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockReturning.mockResolvedValue([]);

    const { DELETE } = await import('@/app/api/admin/whitelists/[id]/route');
    const res = await DELETE(makeRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Entry not found');
  });

  it('deletes entry successfully', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockReturning.mockResolvedValue([{ id: 'wl-1' }]);

    const { DELETE } = await import('@/app/api/admin/whitelists/[id]/route');
    const res = await DELETE(makeRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.message).toBe('Whitelist entry deleted');
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Unexpected'));

    const { DELETE } = await import('@/app/api/admin/whitelists/[id]/route');
    const res = await DELETE(makeRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
