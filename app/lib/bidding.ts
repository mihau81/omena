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

/**
 * Returns `count` consecutive valid bid amounts starting from the next valid bid.
 * e.g. for currentBid=5000, count=4 → [6000, 7000, 8000, 9000]
 */
export function getValidBidOptions(currentBid: number, count = 4): number[] {
  const options: number[] = [];
  let bid = currentBid;
  for (let i = 0; i < count; i++) {
    bid = getNextMinBid(bid);
    options.push(bid);
  }
  return options;
}

/**
 * Validates that `proposedBid` meets the minimum increment above `currentBid`.
 */
export function isValidBidAmount(currentBid: number, proposedBid: number): boolean {
  return proposedBid >= getNextMinBid(currentBid);
}
