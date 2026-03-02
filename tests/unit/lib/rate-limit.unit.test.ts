import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rateLimit } from '@/lib/rate-limit';

describe('rateLimit token bucket', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('allows first request immediately', () => {
      const limiter = rateLimit({ maxRequests: 5, windowMs: 60000 });
      const result = limiter.check('user-1');
      expect(result.success).toBe(true);
      limiter.cleanup();
    });

    it('starts with full bucket (maxRequests - 1 remaining after first call)', () => {
      const limiter = rateLimit({ maxRequests: 5, windowMs: 60000 });
      const result = limiter.check('user-1');
      expect(result.remaining).toBe(4);
      limiter.cleanup();
    });

    it('returns resetMs equal to windowMs', () => {
      const limiter = rateLimit({ maxRequests: 5, windowMs: 60000 });
      const result = limiter.check('user-1');
      expect(result.resetMs).toBe(60000);
      limiter.cleanup();
    });
  });

  describe('token consumption', () => {
    it('allows requests up to maxRequests', () => {
      const limiter = rateLimit({ maxRequests: 3, windowMs: 60000 });
      expect(limiter.check('user-1').success).toBe(true);
      expect(limiter.check('user-1').success).toBe(true);
      expect(limiter.check('user-1').success).toBe(true);
      limiter.cleanup();
    });

    it('blocks request when bucket is empty', () => {
      const limiter = rateLimit({ maxRequests: 2, windowMs: 60000 });
      limiter.check('user-1');
      limiter.check('user-1');
      const result = limiter.check('user-1');
      expect(result.success).toBe(false);
      expect(result.remaining).toBe(0);
      limiter.cleanup();
    });

    it('tracks different keys independently', () => {
      const limiter = rateLimit({ maxRequests: 1, windowMs: 60000 });
      expect(limiter.check('user-1').success).toBe(true);
      expect(limiter.check('user-1').success).toBe(false);
      expect(limiter.check('user-2').success).toBe(true); // different key
      limiter.cleanup();
    });
  });

  describe('token refill over time', () => {
    it('refills tokens after full window passes', () => {
      const limiter = rateLimit({ maxRequests: 2, windowMs: 10000 });
      limiter.check('user-1');
      limiter.check('user-1');
      expect(limiter.check('user-1').success).toBe(false);

      // Advance time by full window
      vi.advanceTimersByTime(10000);
      expect(limiter.check('user-1').success).toBe(true);
      limiter.cleanup();
    });

    it('partially refills tokens after partial window', () => {
      const limiter = rateLimit({ maxRequests: 10, windowMs: 10000 });
      // Consume all 10 tokens
      for (let i = 0; i < 10; i++) limiter.check('user-1');
      expect(limiter.check('user-1').success).toBe(false);

      // Advance by half the window → ~5 tokens refilled
      vi.advanceTimersByTime(5000);
      const result = limiter.check('user-1');
      expect(result.success).toBe(true);
      limiter.cleanup();
    });
  });

  describe('cleanup', () => {
    it('cleanup clears all buckets', () => {
      const limiter = rateLimit({ maxRequests: 1, windowMs: 60000 });
      limiter.check('user-1');
      limiter.cleanup();
      // After cleanup, a new check should succeed (fresh bucket)
      // Note: after cleanup the interval is stopped, but buckets are cleared
      // so a new check creates a fresh bucket
      const result = limiter.check('user-1');
      expect(result.success).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('maxRequests of 1 allows exactly one request then blocks', () => {
      const limiter = rateLimit({ maxRequests: 1, windowMs: 3000 });
      expect(limiter.check('key').success).toBe(true);
      expect(limiter.check('key').success).toBe(false);
      limiter.cleanup();
    });

    it('remaining never goes negative', () => {
      const limiter = rateLimit({ maxRequests: 1, windowMs: 60000 });
      limiter.check('key');
      limiter.check('key');
      limiter.check('key');
      const result = limiter.check('key');
      expect(result.remaining).toBeGreaterThanOrEqual(0);
      limiter.cleanup();
    });
  });
});
