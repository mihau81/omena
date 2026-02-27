/**
 * Pre-configured rate limiter instances for different endpoints
 */

import { rateLimit } from '@/lib/rate-limit';

// 1 request per 3 seconds per key (user+lot combination)
export const bidLimiter = rateLimit({
  maxRequests: 1,
  windowMs: 3000,
});

// 5 requests per minute per IP
export const authLimiter = rateLimit({
  maxRequests: 5,
  windowMs: 60 * 1000,
});

// 30 requests per minute per admin
export const adminLimiter = rateLimit({
  maxRequests: 30,
  windowMs: 60 * 1000,
});

// 100 requests per minute per IP
export const publicApiLimiter = rateLimit({
  maxRequests: 100,
  windowMs: 60 * 1000,
});
