import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body: unknown, init?: { status?: number }) => ({
      body,
      status: init?.status ?? 200,
    })),
  },
}));

// Mock auth-utils to get AuthError
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: { GET: vi.fn(), POST: vi.fn() },
}));

vi.mock('@/lib/permissions', () => ({
  hasPermission: vi.fn(),
}));

import { handleApiError } from '@/lib/api-response';
import { AuthError } from '@/lib/auth-utils';
import { NextResponse } from 'next/server';

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('handleApiError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── AuthError handling ────────────────────────────────────────────────────

  describe('when error is an AuthError', () => {
    it('returns response with the AuthError message', () => {
      const error = new AuthError('Authentication required', 401);

      handleApiError(error, 'test-context');

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: 'Authentication required' },
        { status: 401 },
      );
    });

    it('uses the AuthError statusCode (401)', () => {
      const error = new AuthError('Unauthorized', 401);

      const result = handleApiError(error, 'auth');

      expect(result).toEqual(
        expect.objectContaining({ status: 401 }),
      );
    });

    it('uses the AuthError statusCode (403)', () => {
      const error = new AuthError('Forbidden', 403);

      handleApiError(error, 'auth');

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: 'Forbidden' },
        { status: 403 },
      );
    });

    it('uses default 401 statusCode when not specified', () => {
      const error = new AuthError('No token');

      handleApiError(error, 'auth');

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: 'No token' },
        { status: 401 },
      );
    });

    it('does not log to console.error for AuthErrors', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new AuthError('Auth required', 401);

      handleApiError(error, 'my-route');

      expect(errorSpy).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('handles AuthError with custom message', () => {
      const error = new AuthError('Missing permission: auctions:write', 403);

      handleApiError(error, 'create-auction');

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: 'Missing permission: auctions:write' },
        { status: 403 },
      );
    });

    it('returns a NextResponse object', () => {
      const error = new AuthError('Test');
      const result = handleApiError(error, 'test');

      expect(result).toBeDefined();
      expect(result).toHaveProperty('body');
      expect(result).toHaveProperty('status');
    });
  });

  // ── Generic Error handling ────────────────────────────────────────────────

  describe('when error is a generic Error', () => {
    it('returns 500 Internal server error', () => {
      const error = new Error('Something went wrong');

      handleApiError(error, 'some-context');

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: 'Internal server error' },
        { status: 500 },
      );
    });

    it('logs the error with context', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('DB connection failed');

      handleApiError(error, 'get-lots');

      expect(errorSpy).toHaveBeenCalledWith(
        '[get-lots] Error:',
        error,
      );
      errorSpy.mockRestore();
    });

    it('does not expose the original error message in the response', () => {
      const error = new Error('SQL injection detected');

      const result = handleApiError(error, 'query');

      expect(result.body).toEqual({ error: 'Internal server error' });
    });

    it('always returns status 500 for generic errors', () => {
      const error = new Error('any error');
      const result = handleApiError(error, 'ctx');
      expect(result.status).toBe(500);
    });

    it('includes context in the log message', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('test');

      handleApiError(error, 'api/lots/[id]/bids');

      expect(errorSpy).toHaveBeenCalledWith(
        '[api/lots/[id]/bids] Error:',
        error,
      );
      errorSpy.mockRestore();
    });
  });

  // ── Unknown error types ───────────────────────────────────────────────────

  describe('when error is an unknown type', () => {
    it('handles string error', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      handleApiError('something failed', 'route');

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: 'Internal server error' },
        { status: 500 },
      );
      expect(errorSpy).toHaveBeenCalledWith('[route] Error:', 'something failed');
      errorSpy.mockRestore();
    });

    it('handles null error', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      handleApiError(null, 'route');

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: 'Internal server error' },
        { status: 500 },
      );
      errorSpy.mockRestore();
    });

    it('handles undefined error', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      handleApiError(undefined, 'route');

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: 'Internal server error' },
        { status: 500 },
      );
      errorSpy.mockRestore();
    });

    it('handles numeric error', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      handleApiError(42, 'route');

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: 'Internal server error' },
        { status: 500 },
      );
      errorSpy.mockRestore();
    });

    it('handles object error that is not an Error instance', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const errorObj = { code: 'ECONNREFUSED', message: 'Connection refused' };

      handleApiError(errorObj, 'db-query');

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: 'Internal server error' },
        { status: 500 },
      );
      expect(errorSpy).toHaveBeenCalledWith('[db-query] Error:', errorObj);
      errorSpy.mockRestore();
    });

    it('logs unknown errors with context', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      handleApiError({ custom: true }, 'api-handler');

      expect(errorSpy).toHaveBeenCalledWith(
        '[api-handler] Error:',
        { custom: true },
      );
      errorSpy.mockRestore();
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles empty context string', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('test');

      handleApiError(error, '');

      expect(errorSpy).toHaveBeenCalledWith('[] Error:', error);
      errorSpy.mockRestore();
    });

    it('handles Error subclass that is not AuthError', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      class CustomError extends Error {
        code = 'CUSTOM';
      }

      const error = new CustomError('custom');
      handleApiError(error, 'test');

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: 'Internal server error' },
        { status: 500 },
      );
      errorSpy.mockRestore();
    });

    it('handles TypeError', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new TypeError('Cannot read property x of undefined');

      handleApiError(error, 'handler');

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: 'Internal server error' },
        { status: 500 },
      );
      errorSpy.mockRestore();
    });

    it('handles RangeError', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new RangeError('Invalid array length');

      handleApiError(error, 'handler');

      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: 'Internal server error' },
        { status: 500 },
      );
      errorSpy.mockRestore();
    });

    it('AuthError is correctly identified via instanceof', () => {
      const authErr = new AuthError('test', 403);
      expect(authErr instanceof AuthError).toBe(true);
      expect(authErr instanceof Error).toBe(true);

      const genericErr = new Error('test');
      expect(genericErr instanceof AuthError).toBe(false);
    });
  });
});
