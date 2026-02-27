// Bid increment table (DESA Unicum / Polish auction house standard)
const BID_INCREMENTS: [number, number][] = [
  [0, 100],
  [1000, 100],
  [2000, 200],
  [5000, 500],
  [10000, 1000],
  [20000, 2000],
  [50000, 5000],
  [100000, 10000],
  [200000, 20000],
  [500000, 50000],
  [1000000, 100000],
];

export function getBidIncrement(currentBid: number): number {
  let increment = 100;
  for (const [threshold, step] of BID_INCREMENTS) {
    if (currentBid >= threshold) increment = step;
    else break;
  }
  return increment;
}

export function getNextMinBid(currentBid: number): number {
  return currentBid + getBidIncrement(currentBid);
}

export function generateBidderId(): string {
  return 'bidder-' + Math.random().toString(36).substring(2, 10);
}

export function generatePaddleNumber(): number {
  return Math.floor(100 + Math.random() * 900);
}

export function generateBotBidderLabel(): string {
  const num = Math.floor(10 + Math.random() * 90);
  return `Licytant #${num}`;
}

export function shouldBotCounterBid(): boolean {
  return Math.random() < 0.4;
}

export function getBotResponseDelay(): number {
  return 2000 + Math.random() * 4000;
}

// Soft close: if bid placed within last 2 minutes, extend by 2 minutes
export const SOFT_CLOSE_WINDOW_MS = 2 * 60 * 1000;
export const SOFT_CLOSE_EXTENSION_MS = 2 * 60 * 1000;

// Buyer's premium
export const BUYERS_PREMIUM_RATE = 0.20;

export function calculatePremium(amount: number): number {
  return Math.round(amount * BUYERS_PREMIUM_RATE);
}

export function calculateTotal(amount: number): number {
  return amount + calculatePremium(amount);
}
