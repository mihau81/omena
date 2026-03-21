import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Hoisted mock for next-auth/jwt ──────────────────────────────────────────

const { mockGetToken } = vi.hoisted(() => {
  return { mockGetToken: vi.fn() };
});

vi.mock('next-auth/jwt', () => ({
  getToken: mockGetToken,
}));

// ─── Import after mocks ──────────────────────────────────────────────────────

import { middleware, config } from '@/middleware';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createRequest(pathname: string): NextRequest {
  const url = new URL(pathname, 'http://localhost:3000');
  return new NextRequest(url, { method: 'GET' });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetToken.mockResolvedValue(null); // Default: unauthenticated
  });

  // ── Security headers ──────────────────────────────────────────────────

  describe('security headers', () => {
    it('adds X-Content-Type-Options header', async () => {
      const response = await middleware(createRequest('/'));
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });

    it('adds X-Frame-Options header', async () => {
      const response = await middleware(createRequest('/'));
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    });

    it('adds X-XSS-Protection header', async () => {
      const response = await middleware(createRequest('/'));
      expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block');
    });

    it('adds Referrer-Policy header', async () => {
      const response = await middleware(createRequest('/'));
      expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    });

    it('adds Permissions-Policy header', async () => {
      const response = await middleware(createRequest('/'));
      expect(response.headers.get('Permissions-Policy')).toBe('camera=(), microphone=(), geolocation=()');
    });

    it('adds Content-Security-Policy header', async () => {
      const response = await middleware(createRequest('/'));
      const csp = response.headers.get('Content-Security-Policy');
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self'");
      expect(csp).toContain("object-src 'none'");
    });
  });

  // ── Public routes ─────────────────────────────────────────────────────

  describe('public routes', () => {
    it('allows access to the root path without auth', async () => {
      const response = await middleware(createRequest('/'));
      expect(response.status).not.toBe(307);
      expect(response.status).not.toBe(401);
    });

    it('allows access to locale pages without auth', async () => {
      const response = await middleware(createRequest('/en/auctions'));
      expect(response.status).not.toBe(307);
      expect(response.status).not.toBe(401);
    });

    it('sets x-user-type header to anonymous for unauthenticated users', async () => {
      const response = await middleware(createRequest('/'));
      expect(response.headers.get('x-user-type')).toBe('anonymous');
    });

    it('sets x-user-id to empty string for unauthenticated users', async () => {
      const response = await middleware(createRequest('/'));
      expect(response.headers.get('x-user-id')).toBe('');
    });

    it('sets x-user-visibility to 0 for unauthenticated users', async () => {
      const response = await middleware(createRequest('/'));
      expect(response.headers.get('x-user-visibility')).toBe('0');
    });
  });

  // ── Authenticated user info propagation ───────────────────────────────

  describe('user info headers', () => {
    it('propagates user type in x-user-type header', async () => {
      mockGetToken.mockResolvedValue({ sub: 'user-123', userType: 'user', visibilityLevel: 1 });

      const response = await middleware(createRequest('/'));
      expect(response.headers.get('x-user-type')).toBe('user');
    });

    it('propagates user id in x-user-id header', async () => {
      mockGetToken.mockResolvedValue({ sub: 'user-456', userType: 'user', visibilityLevel: 0 });

      const response = await middleware(createRequest('/'));
      expect(response.headers.get('x-user-id')).toBe('user-456');
    });

    it('propagates visibility level in x-user-visibility header', async () => {
      mockGetToken.mockResolvedValue({ sub: 'user-789', userType: 'user', visibilityLevel: 2 });

      const response = await middleware(createRequest('/'));
      expect(response.headers.get('x-user-visibility')).toBe('2');
    });
  });

  // ── /api/me/* protection ──────────────────────────────────────────────

  describe('/api/me/* route protection', () => {
    it('returns 401 for unauthenticated requests to /api/me', async () => {
      const response = await middleware(createRequest('/api/me'));
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Authentication required');
    });

    it('returns 401 for non-user token on /api/me routes', async () => {
      mockGetToken.mockResolvedValue({ sub: 'admin-1', userType: 'admin' });

      const response = await middleware(createRequest('/api/me/settings'));
      expect(response.status).toBe(401);
    });

    it('allows authenticated user to access /api/me routes', async () => {
      mockGetToken.mockResolvedValue({ sub: 'user-1', userType: 'user', visibilityLevel: 0 });

      const response = await middleware(createRequest('/api/me/settings'));
      expect(response.status).not.toBe(401);
    });

    it('returns 401 for /api/me/subscriptions without user token', async () => {
      const response = await middleware(createRequest('/api/me/subscriptions'));
      expect(response.status).toBe(401);
    });
  });

  // ── /[locale]/account/* protection ────────────────────────────────────

  describe('/[locale]/account/* route protection', () => {
    it('redirects unauthenticated users to locale login page', async () => {
      const response = await middleware(createRequest('/en/account'));
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/en/login');
    });

    it('redirects to correct locale login page (pl)', async () => {
      const response = await middleware(createRequest('/pl/account/settings'));
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/pl/login');
    });

    it('redirects admin users away from account pages (not user type)', async () => {
      mockGetToken.mockResolvedValue({ sub: 'admin-1', userType: 'admin' });

      const response = await middleware(createRequest('/en/account'));
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/en/login');
    });

    it('allows authenticated user to access account pages', async () => {
      mockGetToken.mockResolvedValue({ sub: 'user-1', userType: 'user', visibilityLevel: 0 });

      const response = await middleware(createRequest('/en/account/bids'));
      expect(response.status).not.toBe(307);
    });

    it('adds security headers to redirect response', async () => {
      const response = await middleware(createRequest('/en/account'));
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    });
  });

  // ── /admin/* protection ───────────────────────────────────────────────

  describe('/admin/* route protection', () => {
    it('redirects unauthenticated users to unified login', async () => {
      const response = await middleware(createRequest('/admin/dashboard'));
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/en/login');
    });

    it('redirects non-admin users to unified login', async () => {
      mockGetToken.mockResolvedValue({ sub: 'user-1', userType: 'user' });

      const response = await middleware(createRequest('/admin/users'));
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/en/login');
    });

    it('allows admin users to access admin routes', async () => {
      mockGetToken.mockResolvedValue({ sub: 'admin-1', userType: 'admin', visibilityLevel: 2 });

      const response = await middleware(createRequest('/admin/dashboard'));
      expect(response.status).not.toBe(307);
      expect(response.status).not.toBe(401);
    });

    it('redirects /admin/login to unified login', async () => {
      const response = await middleware(createRequest('/admin/login'));
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/en/login');
    });

    it('redirects /admin/login to unified login even for admin users', async () => {
      mockGetToken.mockResolvedValue({ sub: 'admin-1', userType: 'admin' });

      const response = await middleware(createRequest('/admin/login'));
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/en/login');
    });

    it('adds security headers to /admin/login response', async () => {
      const response = await middleware(createRequest('/admin/login'));
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    });
  });

  // ── /api/admin/* protection ───────────────────────────────────────────

  describe('/api/admin/* route protection', () => {
    it('returns 401 for unauthenticated requests to /api/admin routes', async () => {
      const response = await middleware(createRequest('/api/admin/users'));
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Admin access required');
    });

    it('returns 401 for non-admin users on /api/admin routes', async () => {
      mockGetToken.mockResolvedValue({ sub: 'user-1', userType: 'user' });

      const response = await middleware(createRequest('/api/admin/auctions'));
      expect(response.status).toBe(401);
    });

    it('allows admin users to access /api/admin routes', async () => {
      mockGetToken.mockResolvedValue({ sub: 'admin-1', userType: 'admin', visibilityLevel: 2 });

      const response = await middleware(createRequest('/api/admin/lots'));
      expect(response.status).not.toBe(401);
    });

    it('returns 401 for unauthenticated access to /api/admin/login', async () => {
      const response = await middleware(createRequest('/api/admin/login'));
      expect(response.status).toBe(401);
    });
  });

  // ── Revoked token handling ────────────────────────────────────────────

  describe('revoked token handling', () => {
    it('returns 401 for revoked token on API routes', async () => {
      mockGetToken.mockResolvedValue({ sub: 'user-1', userType: 'revoked' });

      const response = await middleware(createRequest('/api/some-endpoint'));
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Session revoked');
    });

    it('redirects revoked token to /en/login for regular pages', async () => {
      mockGetToken.mockResolvedValue({ sub: 'user-1', userType: 'revoked' });

      const response = await middleware(createRequest('/en/auctions'));
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/en/login');
    });

    it('redirects revoked token to unified login for admin pages', async () => {
      mockGetToken.mockResolvedValue({ sub: 'admin-1', userType: 'revoked' });

      const response = await middleware(createRequest('/admin/dashboard'));
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/en/login');
    });

    it('adds security headers to revoked redirect response', async () => {
      mockGetToken.mockResolvedValue({ sub: 'user-1', userType: 'revoked' });

      const response = await middleware(createRequest('/en/something'));
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    });
  });

  // ── Matcher config ────────────────────────────────────────────────────

  describe('matcher config', () => {
    it('has a matcher pattern that excludes static files', () => {
      expect(config.matcher).toBeDefined();
      expect(config.matcher.length).toBeGreaterThan(0);

      const pattern = config.matcher[0];
      expect(pattern).toContain('_next/static');
      expect(pattern).toContain('_next/image');
      expect(pattern).toContain('favicon.ico');
      expect(pattern).toContain('images/');
    });
  });
});
