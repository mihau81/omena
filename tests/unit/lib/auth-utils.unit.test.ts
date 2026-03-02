import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAuth, mockHasPermission } = vi.hoisted(() => {
  const mockAuth = vi.fn();
  const mockHasPermission = vi.fn();
  return { mockAuth, mockHasPermission };
});

vi.mock('@/lib/auth', () => ({
  auth: mockAuth,
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: { GET: vi.fn(), POST: vi.fn() },
}));

vi.mock('@/lib/permissions', () => ({
  hasPermission: mockHasPermission,
}));

import {
  AuthError,
  getSession,
  getCurrentUser,
  requireAuth,
  requireAdmin,
} from '@/lib/auth-utils';

describe('AuthError', () => {
  it('has name AuthError', () => {
    const err = new AuthError('test');
    expect(err.name).toBe('AuthError');
  });

  it('defaults statusCode to 401', () => {
    const err = new AuthError('unauthorized');
    expect(err.statusCode).toBe(401);
  });

  it('accepts custom statusCode', () => {
    const err = new AuthError('forbidden', 403);
    expect(err.statusCode).toBe(403);
  });

  it('extends Error', () => {
    const err = new AuthError('test');
    expect(err).toBeInstanceOf(Error);
  });

  it('sets message correctly', () => {
    const err = new AuthError('access denied');
    expect(err.message).toBe('access denied');
  });
});

describe('getSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the session from auth()', async () => {
    const session = { user: { id: '1', email: 'a@b.com' } };
    mockAuth.mockResolvedValue(session);
    const result = await getSession();
    expect(result).toBe(session);
  });

  it('returns null when auth() returns null', async () => {
    mockAuth.mockResolvedValue(null);
    const result = await getSession();
    expect(result).toBeNull();
  });
});

describe('getCurrentUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the user when session exists', async () => {
    const user = { id: '1', email: 'user@test.com' };
    mockAuth.mockResolvedValue({ user });
    const result = await getCurrentUser();
    expect(result).toBe(user);
  });

  it('returns null when session is null', async () => {
    mockAuth.mockResolvedValue(null);
    const result = await getCurrentUser();
    expect(result).toBeNull();
  });

  it('returns null when session has no user', async () => {
    mockAuth.mockResolvedValue({});
    const result = await getCurrentUser();
    expect(result).toBeNull();
  });

  it('returns null when session.user is undefined', async () => {
    mockAuth.mockResolvedValue({ user: undefined });
    const result = await getCurrentUser();
    expect(result).toBeNull();
  });
});

describe('requireAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns user when authenticated', async () => {
    const user = { id: '1', email: 'user@test.com', userType: 'admin' };
    mockAuth.mockResolvedValue({ user });
    const result = await requireAuth();
    expect(result).toBe(user);
  });

  it('throws AuthError when session is null', async () => {
    mockAuth.mockResolvedValue(null);
    await expect(requireAuth()).rejects.toThrow(AuthError);
    await expect(requireAuth()).rejects.toMatchObject({
      statusCode: 401,
      message: 'Authentication required',
    });
  });

  it('throws AuthError when session has no user', async () => {
    mockAuth.mockResolvedValue({});
    await expect(requireAuth()).rejects.toThrow(AuthError);
  });

  it('throws AuthError with correct statusCode 401', async () => {
    mockAuth.mockResolvedValue(null);
    try {
      await requireAuth();
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(AuthError);
      expect((err as AuthError).statusCode).toBe(401);
    }
  });
});

describe('requireAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasPermission.mockReturnValue(true);
  });

  it('returns user when admin and no permission required', async () => {
    const user = { id: '1', email: 'admin@test.com', userType: 'admin', role: 'admin' };
    mockAuth.mockResolvedValue({ user });
    const result = await requireAdmin();
    expect(result).toBe(user);
  });

  it('throws AuthError with 403 when userType is not admin', async () => {
    const user = { id: '1', email: 'user@test.com', userType: 'user', role: null };
    mockAuth.mockResolvedValue({ user });
    await expect(requireAdmin()).rejects.toMatchObject({
      statusCode: 403,
      message: 'Admin access required',
    });
  });

  it('throws AuthError 403 when user lacks required permission', async () => {
    const user = { id: '1', email: 'admin@test.com', userType: 'admin', role: 'viewer' };
    mockAuth.mockResolvedValue({ user });
    mockHasPermission.mockReturnValue(false);
    await expect(requireAdmin('admins:manage')).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('returns user when admin has the required permission', async () => {
    const user = { id: '1', email: 'admin@test.com', userType: 'admin', role: 'super_admin' };
    mockAuth.mockResolvedValue({ user });
    mockHasPermission.mockReturnValue(true);
    const result = await requireAdmin('admins:manage');
    expect(result).toBe(user);
  });

  it('throws AuthError 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null);
    await expect(requireAdmin()).rejects.toMatchObject({ statusCode: 401 });
  });

  it('skips permission check when no permission argument given', async () => {
    const user = { id: '1', email: 'admin@test.com', userType: 'admin', role: 'viewer' };
    mockAuth.mockResolvedValue({ user });
    const result = await requireAdmin();
    expect(result).toBe(user);
    expect(mockHasPermission).not.toHaveBeenCalled();
  });

  it('skips permission check when user has no role', async () => {
    const user = { id: '1', email: 'admin@test.com', userType: 'admin', role: null };
    mockAuth.mockResolvedValue({ user });
    const result = await requireAdmin('auctions:read');
    expect(result).toBe(user);
    expect(mockHasPermission).not.toHaveBeenCalled();
  });

  it('error message includes missing permission name', async () => {
    const user = { id: '1', email: 'admin@test.com', userType: 'admin', role: 'viewer' };
    mockAuth.mockResolvedValue({ user });
    mockHasPermission.mockReturnValue(false);
    await expect(requireAdmin('admins:manage')).rejects.toMatchObject({
      message: 'Missing permission: admins:manage',
    });
  });

  it('throws AuthError 403 when userType is cataloguer (not admin)', async () => {
    const user = { id: '1', email: 'cat@test.com', userType: 'cataloguer', role: 'cataloguer' };
    mockAuth.mockResolvedValue({ user });
    await expect(requireAdmin()).rejects.toMatchObject({ statusCode: 403 });
  });
});
