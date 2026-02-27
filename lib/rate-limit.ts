/**
 * In-memory rate limiter using token bucket algorithm
 * Tracks requests per key with automatic cleanup of expired entries
 */

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number; // time window in milliseconds
}

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetMs: number;
}

export function rateLimit(config: RateLimitConfig) {
  const buckets = new Map<string, TokenBucket>();
  const { maxRequests, windowMs } = config;

  // Cleanup expired buckets every 5 minutes
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets.entries()) {
      if (now - bucket.lastRefill > windowMs * 2) {
        buckets.delete(key);
      }
    }
  }, 5 * 60 * 1000);

  function check(key: string): RateLimitResult {
    const now = Date.now();
    const bucket = buckets.get(key) || { tokens: maxRequests, lastRefill: now };

    // Calculate tokens to add based on time elapsed
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = (timePassed / windowMs) * maxRequests;
    bucket.tokens = Math.min(maxRequests, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    const success = bucket.tokens >= 1;
    if (success) {
      bucket.tokens -= 1;
    }

    buckets.set(key, bucket);

    return {
      success,
      remaining: Math.floor(bucket.tokens),
      resetMs: windowMs,
    };
  }

  function cleanup() {
    clearInterval(cleanupInterval);
    buckets.clear();
  }

  return {
    check,
    cleanup,
  };
}
