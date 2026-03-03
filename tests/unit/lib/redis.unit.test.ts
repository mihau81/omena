import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const { MockRedis, mockOn, mockConnect, constructorCalls } = vi.hoisted(() => {
  const mockOn = vi.fn().mockReturnThis();
  const mockConnect = vi.fn().mockResolvedValue(undefined);
  const constructorCalls: unknown[][] = [];

  // Use a real class so `new Redis(...)` works
  class MockRedis {
    on = mockOn;
    connect = mockConnect;
    constructor(...args: unknown[]) {
      constructorCalls.push(args);
    }
  }

  return { MockRedis, mockOn, mockConnect, constructorCalls };
});

vi.mock('ioredis', () => ({
  default: MockRedis,
}));

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('redis', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    constructorCalls.length = 0;
    delete process.env.REDIS_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // ── getPublisher ──────────────────────────────────────────────────────────

  describe('getPublisher', () => {
    it('returns null when REDIS_URL is not set', async () => {
      delete process.env.REDIS_URL;
      const { getPublisher } = await import('@/lib/redis');

      const result = getPublisher();

      expect(result).toBeNull();
    });

    it('creates a Redis client when REDIS_URL is set', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const { getPublisher } = await import('@/lib/redis');

      const result = getPublisher();

      expect(result).not.toBeNull();
      expect(constructorCalls).toHaveLength(1);
      expect(constructorCalls[0][0]).toBe('redis://localhost:6379');
      expect(constructorCalls[0][1]).toEqual({
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        enableOfflineQueue: false,
      });
    });

    it('calls connect on the created client', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const { getPublisher } = await import('@/lib/redis');

      getPublisher();

      expect(mockConnect).toHaveBeenCalledTimes(1);
    });

    it('registers an error event handler on the client', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const { getPublisher } = await import('@/lib/redis');

      getPublisher();

      expect(mockOn).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('caches the publisher client on subsequent calls', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const { getPublisher } = await import('@/lib/redis');

      const first = getPublisher();
      const second = getPublisher();

      expect(first).toBe(second);
      expect(constructorCalls).toHaveLength(1);
    });

    it('does not call connect on cached client (second call)', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const { getPublisher } = await import('@/lib/redis');

      getPublisher();
      getPublisher();

      // connect should only be called once during creation
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });

    it('handles connect rejection silently (catch swallows)', async () => {
      mockConnect.mockRejectedValue(new Error('Connection refused'));
      process.env.REDIS_URL = 'redis://localhost:6379';
      const { getPublisher } = await import('@/lib/redis');

      // Should not throw
      expect(() => getPublisher()).not.toThrow();
    });

    it('error handler logs warning without crashing', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { getPublisher } = await import('@/lib/redis');

      getPublisher();

      // Get the error handler that was registered
      const errorHandler = mockOn.mock.calls.find(
        (call: unknown[]) => call[0] === 'error',
      )?.[1] as (err: Error) => void;

      expect(errorHandler).toBeDefined();

      // Invoke the error handler
      errorHandler(new Error('Redis connection lost'));

      expect(warnSpy).toHaveBeenCalledWith(
        '[Redis] connection error:',
        'Redis connection lost',
      );

      warnSpy.mockRestore();
    });
  });

  // ── getSubscriber ─────────────────────────────────────────────────────────

  describe('getSubscriber', () => {
    it('returns null when REDIS_URL is not set', async () => {
      delete process.env.REDIS_URL;
      const { getSubscriber } = await import('@/lib/redis');

      const result = getSubscriber();

      expect(result).toBeNull();
    });

    it('creates a Redis client when REDIS_URL is set', async () => {
      process.env.REDIS_URL = 'redis://myredis:6380';
      const { getSubscriber } = await import('@/lib/redis');

      const result = getSubscriber();

      expect(result).not.toBeNull();
      expect(constructorCalls).toHaveLength(1);
      expect(constructorCalls[0][0]).toBe('redis://myredis:6380');
    });

    it('calls connect on the created subscriber client', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const { getSubscriber } = await import('@/lib/redis');

      getSubscriber();

      expect(mockConnect).toHaveBeenCalledTimes(1);
    });

    it('caches the subscriber client on subsequent calls', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const { getSubscriber } = await import('@/lib/redis');

      const first = getSubscriber();
      const second = getSubscriber();

      expect(first).toBe(second);
      expect(constructorCalls).toHaveLength(1);
    });

    it('does not call connect on cached subscriber (second call)', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const { getSubscriber } = await import('@/lib/redis');

      getSubscriber();
      getSubscriber();

      expect(mockConnect).toHaveBeenCalledTimes(1);
    });

    it('handles connect rejection silently', async () => {
      mockConnect.mockRejectedValue(new Error('Connection refused'));
      process.env.REDIS_URL = 'redis://localhost:6379';
      const { getSubscriber } = await import('@/lib/redis');

      expect(() => getSubscriber()).not.toThrow();
    });
  });

  // ── Publisher + Subscriber independence ────────────────────────────────────

  describe('publisher and subscriber are separate instances', () => {
    it('creates separate Redis instances for publisher and subscriber', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const { getPublisher, getSubscriber } = await import('@/lib/redis');

      const pub = getPublisher();
      const sub = getSubscriber();

      expect(pub).not.toBeNull();
      expect(sub).not.toBeNull();
      // Two separate calls to Redis constructor
      expect(constructorCalls).toHaveLength(2);
    });

    it('caching works independently for publisher and subscriber', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const { getPublisher, getSubscriber } = await import('@/lib/redis');

      getPublisher();
      getPublisher();
      getSubscriber();
      getSubscriber();

      // Still only 2 Redis instances created (1 pub + 1 sub)
      expect(constructorCalls).toHaveLength(2);
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('returns null for both when REDIS_URL is empty string', async () => {
      process.env.REDIS_URL = '';
      const { getPublisher, getSubscriber } = await import('@/lib/redis');

      // Empty string is falsy, so should return null
      expect(getPublisher()).toBeNull();
      expect(getSubscriber()).toBeNull();
    });

    it('uses the configured REDIS_URL value', async () => {
      process.env.REDIS_URL = 'redis://custom-host:9999/5';
      const { getPublisher } = await import('@/lib/redis');

      getPublisher();

      expect(constructorCalls[0][0]).toBe('redis://custom-host:9999/5');
    });
  });
});
