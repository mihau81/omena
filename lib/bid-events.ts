import { EventEmitter } from 'events';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BidEvent {
  lotId: string;
  auctionId: string;
  amount: number;
  isWinning: boolean;
  timestamp: string;
  nextMinBid: number;
}

// ─── In-memory pub/sub ───────────────────────────────────────────────────────

const bidEmitter = new EventEmitter();

// Allow up to 500 SSE connections concurrently without Node.js warnings
bidEmitter.setMaxListeners(500);

function eventKey(auctionId: string): string {
  return `bid:${auctionId}`;
}

export function emitBid(auctionId: string, data: BidEvent): void {
  bidEmitter.emit(eventKey(auctionId), data);
}

export function subscribeBids(
  auctionId: string,
  callback: (data: BidEvent) => void,
): void {
  bidEmitter.on(eventKey(auctionId), callback);
}

export function unsubscribeBids(
  auctionId: string,
  callback: (data: BidEvent) => void,
): void {
  bidEmitter.off(eventKey(auctionId), callback);
}
