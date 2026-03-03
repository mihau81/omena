/**
 * Unit tests for /api/me/notifications routes:
 * - POST /api/me/notifications/[id]/read
 * - POST /api/me/notifications/read-all
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock auth ──────────────────────────────────────────────────────────────

const mockRequireAuth = vi.fn();
const mockRequireApprovedUser = vi.fn();

vi.mock('@/lib/auth-utils', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
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

// ─── Mock notifications ─────────────────────────────────────────────────────

const mockMarkAsRead = vi.fn();

vi.mock('@/lib/notifications', () => ({
  markAsRead: (...args: unknown[]) => mockMarkAsRead(...args),
}));

// ─── Mock DB (for read-all) ─────────────────────────────────────────────────

const mockUpdate = vi.fn();
const mockSet = vi.fn();
const mockWhere = vi.fn();

const chainedDb = {
  update: mockUpdate,
  set: mockSet,
  where: mockWhere,
};

mockUpdate.mockReturnValue(chainedDb);
mockSet.mockReturnValue(chainedDb);
mockWhere.mockResolvedValue(undefined);

vi.mock('@/db/connection', () => ({ db: chainedDb }));

vi.mock('@/db/schema', () => ({
  notifications: { userId: 'userId', isRead: 'isRead' },
}));

// ─── Import ─────────────────────────────────────────────────────────────────

const { AuthError } = await import('@/lib/auth-utils');

// ─── Helpers ────────────────────────────────────────────────────────────────

function makePostRequest() {
  return new Request('http://localhost:3000/api/me/notifications/notif-1/read', {
    method: 'POST',
  });
}

function makeReadAllRequest() {
  return new Request('http://localhost:3000/api/me/notifications/read-all', {
    method: 'POST',
  });
}

function makeContext(id = 'notif-1') {
  return { params: Promise.resolve({ id }) };
}

describe('POST /api/me/notifications/[id]/read', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new AuthError('Authentication required', 401));

    const { POST } = await import('@/app/api/me/notifications/[id]/read/route');
    const res = await POST(makePostRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 403 for admin users', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'admin-1', userType: 'admin' });

    const { POST } = await import('@/app/api/me/notifications/[id]/read/route');
    const res = await POST(makePostRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('Forbidden');
  });

  it('returns 404 when notification not found', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'user-1', userType: 'user' });
    mockMarkAsRead.mockResolvedValue(null); // not found

    const { POST } = await import('@/app/api/me/notifications/[id]/read/route');
    const res = await POST(makePostRequest(), makeContext('nonexistent'));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Notification not found');
  });

  it('marks notification as read successfully', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'user-1', userType: 'user' });
    mockMarkAsRead.mockResolvedValue({ id: 'notif-1', readAt: new Date() });

    const { POST } = await import('@/app/api/me/notifications/[id]/read/route');
    const res = await POST(makePostRequest(), makeContext('notif-1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockMarkAsRead).toHaveBeenCalledWith('notif-1', 'user-1');
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unexpected'));

    const { POST } = await import('@/app/api/me/notifications/[id]/read/route');
    const res = await POST(makePostRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});

describe('POST /api/me/notifications/read-all', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockReturnValue(chainedDb);
    mockSet.mockReturnValue(chainedDb);
    mockWhere.mockResolvedValue(undefined);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireApprovedUser.mockRejectedValue(new AuthError('Authentication required', 401));

    const { POST } = await import('@/app/api/me/notifications/read-all/route');
    const res = await POST(makeReadAllRequest());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 403 for non-user accounts', async () => {
    mockRequireApprovedUser.mockRejectedValue(new AuthError('User access required', 403));

    const { POST } = await import('@/app/api/me/notifications/read-all/route');
    const res = await POST(makeReadAllRequest());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('User access required');
  });

  it('marks all notifications as read successfully', async () => {
    mockRequireApprovedUser.mockResolvedValue({ id: 'user-1' });

    const { POST } = await import('@/app/api/me/notifications/read-all/route');
    const res = await POST(makeReadAllRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireApprovedUser.mockRejectedValue(new Error('DB error'));

    const { POST } = await import('@/app/api/me/notifications/read-all/route');
    const res = await POST(makeReadAllRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
