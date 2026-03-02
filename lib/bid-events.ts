import { EventEmitter } from 'events';
import { getPublisher, getSubscriber } from './redis';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BidEvent {
  lotId: string;
  auctionId: string;
  amount: number;
  isWinning: boolean;
  timestamp: string;
  nextMinBid: number;
}

export type TimerEvent =
  | { type: 'lot:timer:start'; lotId: string; closingAt: string; durationSeconds: number }
  | { type: 'lot:timer:extend'; lotId: string; newClosingAt: string; reason: 'anti-sniping' }
  | { type: 'lot:timer:expired'; lotId: string; result: 'sold' | 'passed' }
  | { type: 'lot:timer:stopped'; lotId: string };

// ─── In-memory fallback pub/sub ───────────────────────────────────────────────

const bidEmitter = new EventEmitter();
bidEmitter.setMaxListeners(500);

function redisChannel(auctionId: string): string {
  return `auction:${auctionId}:bids`;
}

function localEventKey(auctionId: string): string {
  return `bid:${auctionId}`;
}

function redisTimerChannel(auctionId: string): string {
  return `auction:${auctionId}:timer`;
}

function localTimerKey(auctionId: string): string {
  return `timer:${auctionId}`;
}

// ─── Redis subscription ref-counting ─────────────────────────────────────────
// Tracks wrapper functions so we can properly remove listeners, and ref-counts
// channels so we don't unsubscribe while other listeners still exist.

const channelRefCount = new Map<string, number>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const listenerWrappers = new Map<Function, (channel: string, message: string) => void>();

function refCountInc(channel: string): void {
  channelRefCount.set(channel, (channelRefCount.get(channel) ?? 0) + 1);
}

function refCountDec(channel: string): number {
  const count = (channelRefCount.get(channel) ?? 1) - 1;
  if (count <= 0) {
    channelRefCount.delete(channel);
    return 0;
  }
  channelRefCount.set(channel, count);
  return count;
}

// ─── Publish ─────────────────────────────────────────────────────────────────

export function emitBid(auctionId: string, data: BidEvent): void {
  const pub = getPublisher();
  if (pub && pub.status === 'ready') {
    pub.publish(redisChannel(auctionId), JSON.stringify(data)).catch((err) => {
      console.warn('[BidEvents] Redis publish failed, falling back to EventEmitter:', err.message);
      bidEmitter.emit(localEventKey(auctionId), data);
    });
  } else {
    bidEmitter.emit(localEventKey(auctionId), data);
  }
}

export function emitTimerEvent(auctionId: string, data: TimerEvent): void {
  const pub = getPublisher();
  if (pub && pub.status === 'ready') {
    pub.publish(redisTimerChannel(auctionId), JSON.stringify(data)).catch(() => {
      bidEmitter.emit(localTimerKey(auctionId), data);
    });
  } else {
    bidEmitter.emit(localTimerKey(auctionId), data);
  }
}

// ─── Subscribe (Bids) ───────────────────────────────────────────────────────

export function subscribeBids(
  auctionId: string,
  callback: (data: BidEvent) => void,
): void {
  const sub = getSubscriber();
  if (sub && sub.status === 'ready') {
    const channel = redisChannel(auctionId);
    const wrapper = (ch: string, message: string) => {
      if (ch === channel) {
        try { callback(JSON.parse(message) as BidEvent); } catch { /* ignore */ }
      }
    };
    listenerWrappers.set(callback, wrapper);
    refCountInc(channel);
    sub.subscribe(channel, (err) => {
      if (err) {
        console.warn('[BidEvents] Redis subscribe failed, falling back:', err.message);
        listenerWrappers.delete(callback);
        refCountDec(channel);
        bidEmitter.on(localEventKey(auctionId), callback);
      }
    });
    sub.on('message', wrapper);
  } else {
    bidEmitter.on(localEventKey(auctionId), callback);
  }
}

export function unsubscribeBids(
  auctionId: string,
  callback: (data: BidEvent) => void,
): void {
  const sub = getSubscriber();
  if (sub && sub.status === 'ready') {
    const channel = redisChannel(auctionId);
    const wrapper = listenerWrappers.get(callback);
    if (wrapper) {
      sub.removeListener('message', wrapper);
      listenerWrappers.delete(callback);
    }
    if (refCountDec(channel) === 0) {
      sub.unsubscribe(channel).catch(() => {});
    }
  }
  bidEmitter.off(localEventKey(auctionId), callback);
}

// ─── Subscribe (Timer) ───────────────────────────────────────────────────────

export function subscribeTimer(
  auctionId: string,
  callback: (data: TimerEvent) => void,
): void {
  const sub = getSubscriber();
  if (sub && sub.status === 'ready') {
    const channel = redisTimerChannel(auctionId);
    const wrapper = (ch: string, message: string) => {
      if (ch === channel) {
        try { callback(JSON.parse(message) as TimerEvent); } catch { /* ignore */ }
      }
    };
    listenerWrappers.set(callback, wrapper);
    refCountInc(channel);
    sub.subscribe(channel, (err) => {
      if (err) {
        listenerWrappers.delete(callback);
        refCountDec(channel);
        bidEmitter.on(localTimerKey(auctionId), callback);
      }
    });
    sub.on('message', wrapper);
  } else {
    bidEmitter.on(localTimerKey(auctionId), callback);
  }
}

export function unsubscribeTimer(
  auctionId: string,
  callback: (data: TimerEvent) => void,
): void {
  const sub = getSubscriber();
  if (sub && sub.status === 'ready') {
    const channel = redisTimerChannel(auctionId);
    const wrapper = listenerWrappers.get(callback);
    if (wrapper) {
      sub.removeListener('message', wrapper);
      listenerWrappers.delete(callback);
    }
    if (refCountDec(channel) === 0) {
      sub.unsubscribe(channel).catch(() => {});
    }
  }
  bidEmitter.off(localTimerKey(auctionId), callback);
}
