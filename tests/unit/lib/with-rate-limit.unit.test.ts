import { describe, it, expect, vi } from 'vitest';
import { withRateLimit, getClientIp, getUserId } from '@/lib/with-rate-limit';
import { NextRequest, NextResponse } from 'next/server';

// ─── Helper: create a mock NextRequest ──────────────────────────────────────

function createMockRequest(
  url = 'https://omena.pl/api/test',
  headers: Record<string, string> = {},
): NextRequest {
  const req = new NextRequest(url, {
    headers: new Headers(headers),
  });
  return req;
}

// ─── withRateLimit ──────────────────────────────────────────────────────────

describe('withRateLimit', () => {
  describe('successful request (not rate-limited)', () => {
    it('passes through to handler when rate limit allows', async () => {
      const limiter = {
        check: vi.fn().mockReturnValue({ success: true, remaining: 9, resetMs: 60000 }),
      };
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const keyFn = vi.fn().mockReturnValue('test-key');

      const wrapped = withRateLimit(limiter, keyFn, handler);
      const req = createMockRequest();
      const response = await wrapped(req);

      expect(handler).toHaveBeenCalledWith(req);
      expect(response.status).toBe(200);
    });

    it('calls keyFn with the request', async () => {
      const limiter = {
        check: vi.fn().mockReturnValue({ success: true, remaining: 5, resetMs: 60000 }),
      };
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const keyFn = vi.fn().mockReturnValue('user-ip');

      const wrapped = withRateLimit(limiter, keyFn, handler);
      const req = createMockRequest();
      await wrapped(req);

      expect(keyFn).toHaveBeenCalledWith(req);
    });

    it('calls limiter.check with the key from keyFn', async () => {
      const limiter = {
        check: vi.fn().mockReturnValue({ success: true, remaining: 5, resetMs: 60000 }),
      };
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const keyFn = vi.fn().mockReturnValue('192.168.1.1');

      const wrapped = withRateLimit(limiter, keyFn, handler);
      await wrapped(createMockRequest());

      expect(limiter.check).toHaveBeenCalledWith('192.168.1.1');
    });

    it('sets X-RateLimit-Remaining header on successful response', async () => {
      const limiter = {
        check: vi.fn().mockReturnValue({ success: true, remaining: 7, resetMs: 60000 }),
      };
      const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
      const keyFn = vi.fn().mockReturnValue('key');

      const wrapped = withRateLimit(limiter, keyFn, handler);
      const response = await wrapped(createMockRequest());

      expect(response.headers.get('X-RateLimit-Remaining')).toBe('7');
    });
  });

  describe('rate-limited request', () => {
    it('returns 429 status when rate limit exceeded', async () => {
      const limiter = {
        check: vi.fn().mockReturnValue({ success: false, remaining: 0, resetMs: 30000 }),
      };
      const handler = vi.fn();
      const keyFn = vi.fn().mockReturnValue('key');

      const wrapped = withRateLimit(limiter, keyFn, handler);
      const response = await wrapped(createMockRequest());

      expect(response.status).toBe(429);
    });

    it('does not call handler when rate-limited', async () => {
      const limiter = {
        check: vi.fn().mockReturnValue({ success: false, remaining: 0, resetMs: 30000 }),
      };
      const handler = vi.fn();
      const keyFn = vi.fn().mockReturnValue('key');

      const wrapped = withRateLimit(limiter, keyFn, handler);
      await wrapped(createMockRequest());

      expect(handler).not.toHaveBeenCalled();
    });

    it('returns error body with retryAfter', async () => {
      const limiter = {
        check: vi.fn().mockReturnValue({ success: false, remaining: 0, resetMs: 45000 }),
      };
      const handler = vi.fn();
      const keyFn = vi.fn().mockReturnValue('key');

      const wrapped = withRateLimit(limiter, keyFn, handler);
      const response = await wrapped(createMockRequest());
      const body = await response.json();

      expect(body.error).toBe('Too many requests');
      expect(body.retryAfter).toBe(45); // Math.ceil(45000 / 1000)
    });

    it('sets Retry-After header in seconds', async () => {
      const limiter = {
        check: vi.fn().mockReturnValue({ success: false, remaining: 0, resetMs: 60000 }),
      };
      const handler = vi.fn();
      const keyFn = vi.fn().mockReturnValue('key');

      const wrapped = withRateLimit(limiter, keyFn, handler);
      const response = await wrapped(createMockRequest());

      expect(response.headers.get('Retry-After')).toBe('60');
    });

    it('sets X-RateLimit-Limit header to 1', async () => {
      const limiter = {
        check: vi.fn().mockReturnValue({ success: false, remaining: 0, resetMs: 60000 }),
      };
      const handler = vi.fn();
      const keyFn = vi.fn().mockReturnValue('key');

      const wrapped = withRateLimit(limiter, keyFn, handler);
      const response = await wrapped(createMockRequest());

      expect(response.headers.get('X-RateLimit-Limit')).toBe('1');
    });

    it('sets X-RateLimit-Remaining header to 0', async () => {
      const limiter = {
        check: vi.fn().mockReturnValue({ success: false, remaining: 0, resetMs: 60000 }),
      };
      const handler = vi.fn();
      const keyFn = vi.fn().mockReturnValue('key');

      const wrapped = withRateLimit(limiter, keyFn, handler);
      const response = await wrapped(createMockRequest());

      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    });

    it('sets X-RateLimit-Reset header as ISO timestamp', async () => {
      const limiter = {
        check: vi.fn().mockReturnValue({ success: false, remaining: 0, resetMs: 60000 }),
      };
      const handler = vi.fn();
      const keyFn = vi.fn().mockReturnValue('key');

      const wrapped = withRateLimit(limiter, keyFn, handler);
      const response = await wrapped(createMockRequest());

      const resetHeader = response.headers.get('X-RateLimit-Reset');
      expect(resetHeader).toBeTruthy();
      // Should be a valid ISO date
      const resetDate = new Date(resetHeader!);
      expect(resetDate.getTime()).toBeGreaterThan(Date.now() - 1000);
    });

    it('correctly rounds resetMs to seconds (ceiling)', async () => {
      const limiter = {
        check: vi.fn().mockReturnValue({ success: false, remaining: 0, resetMs: 1500 }),
      };
      const handler = vi.fn();
      const keyFn = vi.fn().mockReturnValue('key');

      const wrapped = withRateLimit(limiter, keyFn, handler);
      const response = await wrapped(createMockRequest());

      // Math.ceil(1500 / 1000) = 2
      expect(response.headers.get('Retry-After')).toBe('2');
      const body = await response.json();
      expect(body.retryAfter).toBe(2);
    });
  });
});

// ─── getClientIp ────────────────────────────────────────────────────────────

describe('getClientIp', () => {
  it('extracts IP from x-forwarded-for header', () => {
    const req = createMockRequest('https://omena.pl/api/test', {
      'x-forwarded-for': '203.0.113.50',
    });
    expect(getClientIp(req)).toBe('203.0.113.50');
  });

  it('returns the first IP from a comma-separated x-forwarded-for list', () => {
    const req = createMockRequest('https://omena.pl/api/test', {
      'x-forwarded-for': '203.0.113.50, 70.41.3.18, 150.172.238.178',
    });
    expect(getClientIp(req)).toBe('203.0.113.50');
  });

  it('trims whitespace from forwarded IP', () => {
    const req = createMockRequest('https://omena.pl/api/test', {
      'x-forwarded-for': '  10.0.0.1  , 10.0.0.2',
    });
    expect(getClientIp(req)).toBe('10.0.0.1');
  });

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    const req = createMockRequest('https://omena.pl/api/test', {
      'x-real-ip': '198.51.100.42',
    });
    expect(getClientIp(req)).toBe('198.51.100.42');
  });

  it('returns "unknown" when neither x-forwarded-for nor x-real-ip is present', () => {
    const req = createMockRequest('https://omena.pl/api/test', {});
    expect(getClientIp(req)).toBe('unknown');
  });

  it('prefers x-forwarded-for over x-real-ip when both are present', () => {
    const req = createMockRequest('https://omena.pl/api/test', {
      'x-forwarded-for': '192.168.1.100',
      'x-real-ip': '10.0.0.1',
    });
    expect(getClientIp(req)).toBe('192.168.1.100');
  });
});

// ─── getUserId ──────────────────────────────────────────────────────────────

describe('getUserId', () => {
  it('extracts user ID from x-user-id header', () => {
    const req = createMockRequest('https://omena.pl/api/test', {
      'x-user-id': 'usr_abc123',
    });
    expect(getUserId(req)).toBe('usr_abc123');
  });

  it('returns "anonymous" when x-user-id header is absent', () => {
    const req = createMockRequest('https://omena.pl/api/test', {});
    expect(getUserId(req)).toBe('anonymous');
  });

  it('returns "anonymous" when x-user-id header is empty string', () => {
    const req = createMockRequest('https://omena.pl/api/test', {
      'x-user-id': '',
    });
    // Empty string is falsy, so falls back to 'anonymous'
    expect(getUserId(req)).toBe('anonymous');
  });
});
