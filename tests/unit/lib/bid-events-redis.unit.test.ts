import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mocks for Redis ─────────────────────────────────────────────────

const mockPublish = vi.fn().mockResolvedValue(1);
const mockSubscribe = vi.fn().mockImplementation((_channel: string, cb?: (err: Error | null) => void) => {
  // ioredis subscribe takes a callback as 2nd arg
  if (cb) cb(null);
  return Promise.resolve(undefined);
});
const mockUnsubscribe = vi.fn().mockResolvedValue(undefined);
const mockOn = vi.fn();
const mockRemoveListener = vi.fn();

function createMockSubscriber() {
  return {
    status: 'ready',
    subscribe: mockSubscribe,
    unsubscribe: mockUnsubscribe,
    on: mockOn,
    removeListener: mockRemoveListener,
  };
}

function createMockPublisher() {
  return {
    status: 'ready',
    publish: mockPublish,
  };
}

vi.mock('@/lib/redis', () => ({
  getPublisher: vi.fn(() => createMockPublisher()),
  getSubscriber: vi.fn(() => createMockSubscriber()),
}));

import {
  emitBid,
  emitTimerEvent,
  subscribeBids,
  unsubscribeBids,
  subscribeTimer,
  unsubscribeTimer,
  type BidEvent,
  type TimerEvent,
} from '@/lib/bid-events';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeBidEvent(overrides?: Partial<BidEvent>): BidEvent {
  return {
    lotId: 'lot-1',
    auctionId: 'auction-1',
    amount: 5000,
    isWinning: true,
    timestamp: new Date().toISOString(),
    nextMinBid: 5500,
    ...overrides,
  };
}

function makeTimerEvent(overrides?: Partial<TimerEvent>): TimerEvent {
  return {
    type: 'lot:timer:start',
    lotId: 'lot-1',
    closingAt: new Date().toISOString(),
    durationSeconds: 120,
    ...overrides,
  } as TimerEvent;
}

// ─── Tests: Redis path ───────────────────────────────────────────────────────

describe('bid-events (Redis pub/sub path)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── emitBid via Redis ────────────────────────────────────────────────────

  describe('emitBid via Redis', () => {
    it('publishes bid event to the correct Redis channel', () => {
      const auctionId = 'auction-redis-1';
      const bidData = makeBidEvent({ auctionId });

      emitBid(auctionId, bidData);

      expect(mockPublish).toHaveBeenCalledTimes(1);
      expect(mockPublish).toHaveBeenCalledWith(
        `auction:${auctionId}:bids`,
        JSON.stringify(bidData),
      );
    });

    it('serializes bid event data as JSON when publishing', () => {
      const auctionId = 'auction-redis-json';
      const bidData = makeBidEvent({ auctionId, amount: 9999, isWinning: false });

      emitBid(auctionId, bidData);

      const publishedJson = mockPublish.mock.calls[0][1];
      const parsed = JSON.parse(publishedJson);
      expect(parsed.amount).toBe(9999);
      expect(parsed.isWinning).toBe(false);
      expect(parsed.auctionId).toBe(auctionId);
    });

    it('falls back to EventEmitter when Redis publish fails', async () => {
      const publishError = new Error('Redis connection lost');
      mockPublish.mockRejectedValueOnce(publishError);

      const auctionId = 'auction-redis-fail';
      const bidData = makeBidEvent({ auctionId });

      // emitBid should not throw even if publish fails
      expect(() => emitBid(auctionId, bidData)).not.toThrow();

      // Wait for the promise rejection to be handled
      await vi.waitFor(() => {
        expect(mockPublish).toHaveBeenCalledTimes(1);
      });
    });
  });

  // ── emitTimerEvent via Redis ─────────────────────────────────────────────

  describe('emitTimerEvent via Redis', () => {
    it('publishes timer event to the correct Redis channel', () => {
      const auctionId = 'auction-timer-redis-1';
      const timerData = makeTimerEvent();

      emitTimerEvent(auctionId, timerData);

      expect(mockPublish).toHaveBeenCalledTimes(1);
      expect(mockPublish).toHaveBeenCalledWith(
        `auction:${auctionId}:timer`,
        JSON.stringify(timerData),
      );
    });

    it('publishes different timer event types correctly', () => {
      const auctionId = 'auction-timer-types';

      const expiredEvent: TimerEvent = {
        type: 'lot:timer:expired',
        lotId: 'lot-1',
        result: 'sold',
      };

      emitTimerEvent(auctionId, expiredEvent);

      const publishedJson = mockPublish.mock.calls[0][1];
      const parsed = JSON.parse(publishedJson);
      expect(parsed.type).toBe('lot:timer:expired');
      expect(parsed.result).toBe('sold');
    });

    it('falls back to EventEmitter when Redis timer publish fails', async () => {
      mockPublish.mockRejectedValueOnce(new Error('Redis down'));

      const auctionId = 'auction-timer-redis-fail';
      const timerData = makeTimerEvent();

      expect(() => emitTimerEvent(auctionId, timerData)).not.toThrow();

      await vi.waitFor(() => {
        expect(mockPublish).toHaveBeenCalledTimes(1);
      });
    });
  });

  // ── subscribeBids via Redis ──────────────────────────────────────────────

  describe('subscribeBids via Redis', () => {
    it('subscribes to the correct Redis channel', () => {
      const auctionId = 'auction-sub-redis-1';
      const callback = vi.fn();

      subscribeBids(auctionId, callback);

      expect(mockSubscribe).toHaveBeenCalledTimes(1);
      expect(mockSubscribe).toHaveBeenCalledWith(
        `auction:${auctionId}:bids`,
        expect.any(Function),
      );

      // cleanup
      unsubscribeBids(auctionId, callback);
    });

    it('registers a message listener on the subscriber', () => {
      const auctionId = 'auction-sub-listener';
      const callback = vi.fn();

      subscribeBids(auctionId, callback);

      expect(mockOn).toHaveBeenCalledWith('message', expect.any(Function));

      // cleanup
      unsubscribeBids(auctionId, callback);
    });

    it('wrapper filters messages by channel and parses JSON', () => {
      const auctionId = 'auction-sub-wrapper';
      const callback = vi.fn();

      subscribeBids(auctionId, callback);

      // Get the wrapper function that was registered with sub.on('message', wrapper)
      const wrapper = mockOn.mock.calls.find(
        (call: unknown[]) => call[0] === 'message',
      )?.[1] as (channel: string, message: string) => void;

      expect(wrapper).toBeDefined();

      const bidData = makeBidEvent({ auctionId });
      // Simulate a message on the correct channel
      wrapper(`auction:${auctionId}:bids`, JSON.stringify(bidData));

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(bidData);

      // cleanup
      unsubscribeBids(auctionId, callback);
    });

    it('wrapper ignores messages from a different channel', () => {
      const auctionId = 'auction-sub-filter';
      const callback = vi.fn();

      subscribeBids(auctionId, callback);

      const wrapper = mockOn.mock.calls.find(
        (call: unknown[]) => call[0] === 'message',
      )?.[1] as (channel: string, message: string) => void;

      // Simulate a message on a DIFFERENT channel
      wrapper('auction:other-auction:bids', JSON.stringify(makeBidEvent()));

      expect(callback).not.toHaveBeenCalled();

      // cleanup
      unsubscribeBids(auctionId, callback);
    });

    it('wrapper ignores invalid JSON without throwing', () => {
      const auctionId = 'auction-sub-invalid';
      const callback = vi.fn();

      subscribeBids(auctionId, callback);

      const wrapper = mockOn.mock.calls.find(
        (call: unknown[]) => call[0] === 'message',
      )?.[1] as (channel: string, message: string) => void;

      // Simulate a message with invalid JSON
      expect(() => {
        wrapper(`auction:${auctionId}:bids`, 'not valid json {{{');
      }).not.toThrow();

      expect(callback).not.toHaveBeenCalled();

      // cleanup
      unsubscribeBids(auctionId, callback);
    });

    it('falls back to EventEmitter when subscribe fails', () => {
      mockSubscribe.mockImplementationOnce((_channel: string, cb?: (err: Error | null) => void) => {
        if (cb) cb(new Error('Subscribe failed'));
        return Promise.resolve(undefined);
      });

      const auctionId = 'auction-sub-fail';
      const callback = vi.fn();

      subscribeBids(auctionId, callback);

      // The subscribe error callback should trigger fallback to EventEmitter
      expect(mockSubscribe).toHaveBeenCalledTimes(1);
    });
  });

  // ── unsubscribeBids via Redis ────────────────────────────────────────────

  describe('unsubscribeBids ref-counting via Redis', () => {
    it('removes the message listener wrapper on unsubscribe', () => {
      const auctionId = 'auction-unsub-redis-1';
      const callback = vi.fn();

      subscribeBids(auctionId, callback);
      unsubscribeBids(auctionId, callback);

      expect(mockRemoveListener).toHaveBeenCalledWith('message', expect.any(Function));
    });

    it('unsubscribes from Redis channel when ref count reaches 0', () => {
      const auctionId = 'auction-unsub-refcount-zero';
      const callback = vi.fn();

      subscribeBids(auctionId, callback);
      unsubscribeBids(auctionId, callback);

      // With only 1 subscriber, unsubscribing should call Redis unsubscribe
      expect(mockUnsubscribe).toHaveBeenCalledWith(`auction:${auctionId}:bids`);
    });

    it('does NOT unsubscribe from Redis channel when other subscribers remain', () => {
      const auctionId = 'auction-unsub-refcount-keep';
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      subscribeBids(auctionId, cb1);
      subscribeBids(auctionId, cb2);

      // Only remove first subscriber
      unsubscribeBids(auctionId, cb1);

      // Redis channel should NOT be unsubscribed — cb2 still active
      expect(mockUnsubscribe).not.toHaveBeenCalled();

      // Now remove second subscriber
      unsubscribeBids(auctionId, cb2);

      // NOW the channel should be unsubscribed
      expect(mockUnsubscribe).toHaveBeenCalledWith(`auction:${auctionId}:bids`);
    });
  });

  // ── subscribeTimer via Redis ─────────────────────────────────────────────

  describe('subscribeTimer via Redis', () => {
    it('subscribes to the correct timer Redis channel', () => {
      const auctionId = 'auction-timer-sub-redis';
      const callback = vi.fn();

      subscribeTimer(auctionId, callback);

      expect(mockSubscribe).toHaveBeenCalledWith(
        `auction:${auctionId}:timer`,
        expect.any(Function),
      );

      // cleanup
      unsubscribeTimer(auctionId, callback);
    });

    it('timer wrapper parses messages on the correct channel', () => {
      const auctionId = 'auction-timer-wrapper';
      const callback = vi.fn();

      subscribeTimer(auctionId, callback);

      const wrapper = mockOn.mock.calls.find(
        (call: unknown[]) => call[0] === 'message',
      )?.[1] as (channel: string, message: string) => void;

      const timerData: TimerEvent = {
        type: 'lot:timer:extend',
        lotId: 'lot-1',
        newClosingAt: '2026-06-01T00:00:00Z',
        reason: 'anti-sniping',
      };

      wrapper(`auction:${auctionId}:timer`, JSON.stringify(timerData));

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(timerData);

      // cleanup
      unsubscribeTimer(auctionId, callback);
    });

    it('timer wrapper ignores messages from different channels', () => {
      const auctionId = 'auction-timer-filter';
      const callback = vi.fn();

      subscribeTimer(auctionId, callback);

      const wrapper = mockOn.mock.calls.find(
        (call: unknown[]) => call[0] === 'message',
      )?.[1] as (channel: string, message: string) => void;

      wrapper('auction:wrong:timer', JSON.stringify(makeTimerEvent()));

      expect(callback).not.toHaveBeenCalled();

      // cleanup
      unsubscribeTimer(auctionId, callback);
    });
  });

  // ── unsubscribeTimer via Redis ───────────────────────────────────────────

  describe('unsubscribeTimer ref-counting via Redis', () => {
    it('removes the timer listener wrapper on unsubscribe', () => {
      const auctionId = 'auction-timer-unsub-redis';
      const callback = vi.fn();

      subscribeTimer(auctionId, callback);
      unsubscribeTimer(auctionId, callback);

      expect(mockRemoveListener).toHaveBeenCalledWith('message', expect.any(Function));
    });

    it('unsubscribes timer channel when ref count reaches 0', () => {
      const auctionId = 'auction-timer-refcount-zero';
      const callback = vi.fn();

      subscribeTimer(auctionId, callback);
      unsubscribeTimer(auctionId, callback);

      expect(mockUnsubscribe).toHaveBeenCalledWith(`auction:${auctionId}:timer`);
    });

    it('does NOT unsubscribe timer channel when other subscribers remain', () => {
      const auctionId = 'auction-timer-refcount-keep';
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      subscribeTimer(auctionId, cb1);
      subscribeTimer(auctionId, cb2);

      unsubscribeTimer(auctionId, cb1);
      expect(mockUnsubscribe).not.toHaveBeenCalled();

      unsubscribeTimer(auctionId, cb2);
      expect(mockUnsubscribe).toHaveBeenCalledWith(`auction:${auctionId}:timer`);
    });
  });

  // ── Channel naming ──────────────────────────────────────────────────────

  describe('Redis channel naming', () => {
    it('uses auction:{id}:bids for bid channels', () => {
      const callback = vi.fn();
      subscribeBids('my-auction', callback);

      expect(mockSubscribe).toHaveBeenCalledWith('auction:my-auction:bids', expect.any(Function));

      unsubscribeBids('my-auction', callback);
    });

    it('uses auction:{id}:timer for timer channels', () => {
      const callback = vi.fn();
      subscribeTimer('my-auction', callback);

      expect(mockSubscribe).toHaveBeenCalledWith('auction:my-auction:timer', expect.any(Function));

      unsubscribeTimer('my-auction', callback);
    });

    it('bid and timer channels are distinct for the same auction', () => {
      const bidCb = vi.fn();
      const timerCb = vi.fn();

      subscribeBids('same-auction', bidCb);
      subscribeTimer('same-auction', timerCb);

      const subscribedChannels = mockSubscribe.mock.calls.map((call: unknown[]) => call[0]);
      expect(subscribedChannels).toContain('auction:same-auction:bids');
      expect(subscribedChannels).toContain('auction:same-auction:timer');
      expect(subscribedChannels[0]).not.toBe(subscribedChannels[1]);

      // cleanup
      unsubscribeBids('same-auction', bidCb);
      unsubscribeTimer('same-auction', timerCb);
    });
  });
});
