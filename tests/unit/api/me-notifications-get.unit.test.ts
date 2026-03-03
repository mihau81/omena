/**
 * Unit tests for GET /api/me/notifications
 * Coverage target: notification listing with unread count and limit
 * Note: The existing me-notifications.unit.test.ts covers the read/read-all POST routes.
 *       This file covers the GET route in app/api/me/notifications/route.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock auth ──────────────────────────────────────────────────────────────

const mockRequireAuth = vi.fn();

vi.mock('@/lib/auth-utils', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
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

const mockGetUserNotifications = vi.fn();

vi.mock('@/lib/notifications', () => ({
  getUserNotifications: (...args: unknown[]) => mockGetUserNotifications(...args),
}));

// ─── Import AuthError ───────────────────────────────────────────────────────

const { AuthError } = await import('@/lib/auth-utils');

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(query = '') {
  return new Request(`http://localhost:3000/api/me/notifications${query ? '?' + query : ''}`);
}

describe('GET /api/me/notifications', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new AuthError('Authentication required', 401));

    const { GET } = await import('@/app/api/me/notifications/route');
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 403 for admin users', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'admin-1', userType: 'admin' });

    const { GET } = await import('@/app/api/me/notifications/route');
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('Forbidden');
  });

  it('returns notifications with unread count', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'user-1', userType: 'user' });
    mockGetUserNotifications.mockResolvedValue([
      { id: 'n1', type: 'outbid', message: 'You were outbid', isRead: false, createdAt: new Date() },
      { id: 'n2', type: 'lot_won', message: 'You won!', isRead: true, createdAt: new Date() },
      { id: 'n3', type: 'auction_starting', message: 'Auction starts soon', isRead: false, createdAt: new Date() },
    ]);

    const { GET } = await import('@/app/api/me/notifications/route');
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.notifications).toHaveLength(3);
    expect(body.unreadCount).toBe(2);
    expect(mockGetUserNotifications).toHaveBeenCalledWith('user-1', 50);
  });

  it('returns empty notifications', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'user-1', userType: 'user' });
    mockGetUserNotifications.mockResolvedValue([]);

    const { GET } = await import('@/app/api/me/notifications/route');
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.notifications).toEqual([]);
    expect(body.unreadCount).toBe(0);
  });

  it('respects custom limit parameter', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'user-1', userType: 'user' });
    mockGetUserNotifications.mockResolvedValue([]);

    const { GET } = await import('@/app/api/me/notifications/route');
    const res = await GET(makeRequest('limit=10'));
    await res.json();

    expect(mockGetUserNotifications).toHaveBeenCalledWith('user-1', 10);
  });

  it('clamps limit to max 100', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'user-1', userType: 'user' });
    mockGetUserNotifications.mockResolvedValue([]);

    const { GET } = await import('@/app/api/me/notifications/route');
    const res = await GET(makeRequest('limit=999'));
    await res.json();

    expect(mockGetUserNotifications).toHaveBeenCalledWith('user-1', 100);
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'user-1', userType: 'user' });
    mockGetUserNotifications.mockRejectedValue(new Error('DB crash'));

    const { GET } = await import('@/app/api/me/notifications/route');
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
