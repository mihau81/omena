/**
 * Rate limit middleware wrapper for Next.js Route Handlers
 */

import { NextRequest, NextResponse } from 'next/server';
import type { RateLimitResult } from '@/lib/rate-limit';

interface RateLimiter {
  check: (key: string) => RateLimitResult;
}

export function withRateLimit(
  limiter: RateLimiter,
  keyFn: (req: NextRequest) => string,
  handler: (req: NextRequest) => Promise<NextResponse>,
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const key = keyFn(req);
    const result = limiter.check(key);

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          retryAfter: Math.ceil(result.resetMs / 1000),
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil(result.resetMs / 1000).toString(),
            'X-RateLimit-Limit': '1',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(Date.now() + result.resetMs).toISOString(),
          },
        },
      );
    }

    const response = await handler(req);
    response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
    return response;
  };
}

/**
 * Helper to get client IP address from request
 */
export function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  return req.headers.get('x-real-ip') || 'unknown';
}

/**
 * Helper to get user ID from request headers (set by middleware)
 */
export function getUserId(req: NextRequest): string {
  return req.headers.get('x-user-id') || 'anonymous';
}
