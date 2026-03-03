import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Redis to return null — forces EventEmitter fallback
vi.mock('@/lib/redis', () => ({
  getPublisher: vi.fn().mockReturnValue(null),
  getSubscriber: vi.fn().mockReturnValue(null),
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('bid-events (EventEmitter fallback)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Bid Events ──────────────────────────────────────────────────────────────

  describe('emitBid / subscribeBids', () => {
    it('delivers emitted bid to a subscribed callback', () => {
      const auctionId = 'auction-emit-1';
      const callback = vi.fn();
      const bidData = makeBidEvent({ auctionId });

      subscribeBids(auctionId, callback);
      emitBid(auctionId, bidData);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(bidData);

      // cleanup
      unsubscribeBids(auctionId, callback);
    });

    it('delivers the same event to multiple subscribers', () => {
      const auctionId = 'auction-multi-1';
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      const cb3 = vi.fn();
      const bidData = makeBidEvent({ auctionId });

      subscribeBids(auctionId, cb1);
      subscribeBids(auctionId, cb2);
      subscribeBids(auctionId, cb3);

      emitBid(auctionId, bidData);

      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
      expect(cb3).toHaveBeenCalledTimes(1);
      expect(cb1).toHaveBeenCalledWith(bidData);
      expect(cb2).toHaveBeenCalledWith(bidData);
      expect(cb3).toHaveBeenCalledWith(bidData);

      // cleanup
      unsubscribeBids(auctionId, cb1);
      unsubscribeBids(auctionId, cb2);
      unsubscribeBids(auctionId, cb3);
    });

    it('does not deliver events after unsubscribe', () => {
      const auctionId = 'auction-unsub-1';
      const callback = vi.fn();
      const bidData = makeBidEvent({ auctionId });

      subscribeBids(auctionId, callback);
      emitBid(auctionId, bidData);
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribeBids(auctionId, callback);
      emitBid(auctionId, bidData);
      expect(callback).toHaveBeenCalledTimes(1); // still 1
    });

    it('isolates events between different auctionIds', () => {
      const cbA = vi.fn();
      const cbB = vi.fn();
      const bidA = makeBidEvent({ auctionId: 'auction-A' });
      const bidB = makeBidEvent({ auctionId: 'auction-B' });

      subscribeBids('auction-A', cbA);
      subscribeBids('auction-B', cbB);

      emitBid('auction-A', bidA);
      expect(cbA).toHaveBeenCalledTimes(1);
      expect(cbB).toHaveBeenCalledTimes(0);

      emitBid('auction-B', bidB);
      expect(cbA).toHaveBeenCalledTimes(1);
      expect(cbB).toHaveBeenCalledTimes(1);

      // cleanup
      unsubscribeBids('auction-A', cbA);
      unsubscribeBids('auction-B', cbB);
    });

    it('does nothing when emitting with no subscribers', () => {
      // Should not throw
      expect(() => emitBid('no-subscribers', makeBidEvent())).not.toThrow();
    });
  });

  // ── Timer Events ────────────────────────────────────────────────────────────

  describe('emitTimerEvent / subscribeTimer', () => {
    it('delivers emitted timer event to a subscribed callback', () => {
      const auctionId = 'auction-timer-1';
      const callback = vi.fn();
      const timerData = makeTimerEvent();

      subscribeTimer(auctionId, callback);
      emitTimerEvent(auctionId, timerData);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(timerData);

      // cleanup
      unsubscribeTimer(auctionId, callback);
    });

    it('delivers timer events to multiple subscribers', () => {
      const auctionId = 'auction-timer-multi';
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      const timerData: TimerEvent = {
        type: 'lot:timer:extend',
        lotId: 'lot-1',
        newClosingAt: new Date().toISOString(),
        reason: 'anti-sniping',
      };

      subscribeTimer(auctionId, cb1);
      subscribeTimer(auctionId, cb2);

      emitTimerEvent(auctionId, timerData);

      expect(cb1).toHaveBeenCalledWith(timerData);
      expect(cb2).toHaveBeenCalledWith(timerData);

      // cleanup
      unsubscribeTimer(auctionId, cb1);
      unsubscribeTimer(auctionId, cb2);
    });

    it('stops receiving timer events after unsubscribe', () => {
      const auctionId = 'auction-timer-unsub';
      const callback = vi.fn();

      subscribeTimer(auctionId, callback);
      emitTimerEvent(auctionId, makeTimerEvent());
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribeTimer(auctionId, callback);
      emitTimerEvent(auctionId, makeTimerEvent());
      expect(callback).toHaveBeenCalledTimes(1); // still 1
    });

    it('isolates timer events between different auctionIds', () => {
      const cbX = vi.fn();
      const cbY = vi.fn();

      subscribeTimer('timer-X', cbX);
      subscribeTimer('timer-Y', cbY);

      emitTimerEvent('timer-X', makeTimerEvent());
      expect(cbX).toHaveBeenCalledTimes(1);
      expect(cbY).toHaveBeenCalledTimes(0);

      // cleanup
      unsubscribeTimer('timer-X', cbX);
      unsubscribeTimer('timer-Y', cbY);
    });

    it('handles all TimerEvent type variants', () => {
      const auctionId = 'auction-timer-types';
      const received: TimerEvent[] = [];
      const callback = (data: TimerEvent) => received.push(data);

      subscribeTimer(auctionId, callback);

      const events: TimerEvent[] = [
        { type: 'lot:timer:start', lotId: 'lot-1', closingAt: '2026-01-01T00:00:00Z', durationSeconds: 60 },
        { type: 'lot:timer:extend', lotId: 'lot-1', newClosingAt: '2026-01-01T00:01:00Z', reason: 'anti-sniping' },
        { type: 'lot:timer:expired', lotId: 'lot-1', result: 'sold' },
        { type: 'lot:timer:stopped', lotId: 'lot-1' },
      ];

      for (const ev of events) {
        emitTimerEvent(auctionId, ev);
      }

      expect(received).toHaveLength(4);
      expect(received[0].type).toBe('lot:timer:start');
      expect(received[1].type).toBe('lot:timer:extend');
      expect(received[2].type).toBe('lot:timer:expired');
      expect(received[3].type).toBe('lot:timer:stopped');

      // cleanup
      unsubscribeTimer(auctionId, callback);
    });
  });

  // ── Type structure ──────────────────────────────────────────────────────────

  describe('BidEvent type structure', () => {
    it('has the expected fields', () => {
      const bid = makeBidEvent();
      expect(bid).toHaveProperty('lotId');
      expect(bid).toHaveProperty('auctionId');
      expect(bid).toHaveProperty('amount');
      expect(bid).toHaveProperty('isWinning');
      expect(bid).toHaveProperty('timestamp');
      expect(bid).toHaveProperty('nextMinBid');
      expect(typeof bid.amount).toBe('number');
      expect(typeof bid.isWinning).toBe('boolean');
    });
  });

  describe('TimerEvent type structure', () => {
    it('start event has correct fields', () => {
      const ev: TimerEvent = {
        type: 'lot:timer:start',
        lotId: 'lot-1',
        closingAt: '2026-01-01T00:00:00Z',
        durationSeconds: 120,
      };
      expect(ev.type).toBe('lot:timer:start');
      expect(ev).toHaveProperty('closingAt');
      expect(ev).toHaveProperty('durationSeconds');
    });

    it('expired event has result field', () => {
      const ev: TimerEvent = {
        type: 'lot:timer:expired',
        lotId: 'lot-1',
        result: 'passed',
      };
      expect(ev.type).toBe('lot:timer:expired');
      expect(ev.result).toBe('passed');
    });
  });

  // ── Bid and timer isolation ─────────────────────────────────────────────────

  describe('bid vs timer isolation', () => {
    it('bid subscriptions do not receive timer events and vice versa', () => {
      const auctionId = 'auction-cross-1';
      const bidCb = vi.fn();
      const timerCb = vi.fn();

      subscribeBids(auctionId, bidCb);
      subscribeTimer(auctionId, timerCb);

      // Emit bid — only bidCb should fire
      emitBid(auctionId, makeBidEvent({ auctionId }));
      expect(bidCb).toHaveBeenCalledTimes(1);
      expect(timerCb).toHaveBeenCalledTimes(0);

      // Emit timer — only timerCb should fire
      emitTimerEvent(auctionId, makeTimerEvent());
      expect(bidCb).toHaveBeenCalledTimes(1);
      expect(timerCb).toHaveBeenCalledTimes(1);

      // cleanup
      unsubscribeBids(auctionId, bidCb);
      unsubscribeTimer(auctionId, timerCb);
    });
  });
});
