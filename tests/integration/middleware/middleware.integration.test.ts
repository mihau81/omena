import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

// Mock next-auth/jwt getToken so we control the token in each test
vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn(),
}));

import { getToken } from 'next-auth/jwt';
const mockGetToken = getToken as ReturnType<typeof vi.fn>;

// Helper to build a minimal NextRequest-like object that the middleware accepts
async function buildRequest(pathname: string) {
  const { NextRequest } = await import('next/server');
  return new NextRequest(`http://localhost:3002${pathname}`);
}

describe('Middleware', () => {
  beforeEach(() => {
    mockGetToken.mockReset();
  });

  describe('Admin page protection (/admin/*)', () => {
    it('redirects unauthenticated request to /admin/login', async () => {
      mockGetToken.mockResolvedValue(null);
      const { middleware } = await import('@/middleware');

      const request = await buildRequest('/admin/auctions');
      const response = await middleware(request);

      expect(response).toBeInstanceOf(NextResponse);
      expect(response.status).toBe(307); // redirect
      expect(response.headers.get('location')).toContain('/admin/login');
    });

    it('redirects non-admin user to /admin/login', async () => {
      mockGetToken.mockResolvedValue({
        sub: 'user-123',
        userType: 'user',
        visibilityLevel: 0,
      });
      const { middleware } = await import('@/middleware');

      const request = await buildRequest('/admin/auctions');
      const response = await middleware(request);

      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/admin/login');
    });

    it('allows admin access to /admin routes', async () => {
      mockGetToken.mockResolvedValue({
        sub: 'admin-123',
        userType: 'admin',
        visibilityLevel: 2,
      });
      const { middleware } = await import('@/middleware');

      const request = await buildRequest('/admin/auctions');
      const response = await middleware(request);

      // Should not redirect — passes through
      expect(response.status).not.toBe(307);
    });

    it('allows unauthenticated access to /admin/login', async () => {
      mockGetToken.mockResolvedValue(null);
      const { middleware } = await import('@/middleware');

      const request = await buildRequest('/admin/login');
      const response = await middleware(request);

      // Should not redirect — unauthenticated user can access /admin/login
      expect(response.status).not.toBe(307);
    });

    it('redirects already-logged-in admin away from /admin/login', async () => {
      mockGetToken.mockResolvedValue({
        sub: 'admin-123',
        userType: 'admin',
        visibilityLevel: 2,
      });
      const { middleware } = await import('@/middleware');

      const request = await buildRequest('/admin/login');
      const response = await middleware(request);

      // Logged-in admin visiting /admin/login should be redirected to /admin
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toMatch(/\/admin$/);
    });
  });

  describe('Admin API protection (/api/admin/*)', () => {
    it('returns 401 for unauthenticated API request', async () => {
      mockGetToken.mockResolvedValue(null);
      const { middleware } = await import('@/middleware');

      const request = await buildRequest('/api/admin/auctions');
      const response = await middleware(request);

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body).toHaveProperty('error');
    });

    it('returns 401 for non-admin user on API route', async () => {
      mockGetToken.mockResolvedValue({
        sub: 'user-123',
        userType: 'user',
        visibilityLevel: 0,
      });
      const { middleware } = await import('@/middleware');

      const request = await buildRequest('/api/admin/lots');
      const response = await middleware(request);

      expect(response.status).toBe(401);
    });

    it('allows admin access to /api/admin routes', async () => {
      mockGetToken.mockResolvedValue({
        sub: 'admin-123',
        userType: 'admin',
        visibilityLevel: 2,
      });
      const { middleware } = await import('@/middleware');

      const request = await buildRequest('/api/admin/auctions');
      const response = await middleware(request);

      expect(response.status).not.toBe(401);
    });

    it('allows unauthenticated access to /api/admin/login', async () => {
      mockGetToken.mockResolvedValue(null);
      const { middleware } = await import('@/middleware');

      const request = await buildRequest('/api/admin/login');
      const response = await middleware(request);

      // Login endpoint is exempt from protection
      expect(response.status).not.toBe(401);
    });
  });

  describe('Visibility headers', () => {
    it('sets x-user-visibility=0 for anonymous user', async () => {
      mockGetToken.mockResolvedValue(null);
      const { middleware } = await import('@/middleware');

      const request = await buildRequest('/api/v1/auctions');
      const response = await middleware(request);

      expect(response.headers.get('x-user-visibility')).toBe('0');
      expect(response.headers.get('x-user-id')).toBe('');
      expect(response.headers.get('x-user-type')).toBe('anonymous');
    });

    it('sets visibility headers from token for authenticated user', async () => {
      mockGetToken.mockResolvedValue({
        sub: 'user-abc',
        userType: 'user',
        visibilityLevel: 1,
      });
      const { middleware } = await import('@/middleware');

      const request = await buildRequest('/api/v1/auctions');
      const response = await middleware(request);

      expect(response.headers.get('x-user-visibility')).toBe('1');
      expect(response.headers.get('x-user-id')).toBe('user-abc');
      expect(response.headers.get('x-user-type')).toBe('user');
    });

    it('sets visibility=2 for admin token', async () => {
      mockGetToken.mockResolvedValue({
        sub: 'admin-xyz',
        userType: 'admin',
        visibilityLevel: 2,
      });
      const { middleware } = await import('@/middleware');

      const request = await buildRequest('/api/v1/lots');
      const response = await middleware(request);

      expect(response.headers.get('x-user-visibility')).toBe('2');
      expect(response.headers.get('x-user-type')).toBe('admin');
    });
  });

  describe('Public routes', () => {
    it('passes through public API routes without redirect', async () => {
      mockGetToken.mockResolvedValue(null);
      const { middleware } = await import('@/middleware');

      const request = await buildRequest('/api/v1/auctions');
      const response = await middleware(request);

      expect(response.status).not.toBe(307);
      expect(response.status).not.toBe(401);
    });

    it('passes through auth endpoint', async () => {
      mockGetToken.mockResolvedValue(null);
      const { middleware } = await import('@/middleware');

      const request = await buildRequest('/api/auth/register');
      const response = await middleware(request);

      expect(response.status).not.toBe(307);
      expect(response.status).not.toBe(401);
    });
  });
});
