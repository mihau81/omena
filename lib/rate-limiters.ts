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

// 3 magic link requests per 10 minutes per email
export const magicLinkLimiter = rateLimit({
  maxRequests: 3,
  windowMs: 10 * 60 * 1000,
});

// 5 registration requests per hour per IP
export const registrationLimiter = rateLimit({
  maxRequests: 5,
  windowMs: 60 * 60 * 1000,
});

// 3 invitation sends per 24 hours per user
export const inviteLimiter = rateLimit({
  maxRequests: 3,
  windowMs: 24 * 60 * 60 * 1000,
});

// 3 password reset requests per 10 minutes per email
export const passwordResetLimiter = rateLimit({
  maxRequests: 3,
  windowMs: 10 * 60 * 1000,
});
