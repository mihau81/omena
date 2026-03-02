// Standard Polish auction house bid increment table
// Matches DESA Unicum / common market practice
const BID_INCREMENTS: [number, number][] = [
  [0,       50],
  [500,     100],
  [2_000,   200],
  [5_000,   500],
  [20_000,  1_000],
  [50_000,  2_000],
  [100_000, 5_000],
  [500_000, 10_000],
];

/**
 * Returns the increment step that applies at the given bid level.
 */
export function getBidIncrement(currentBid: number): number {
  let increment = BID_INCREMENTS[0][1];
  for (const [threshold, step] of BID_INCREMENTS) {
    if (currentBid >= threshold) increment = step;
    else break;
  }
  return increment;
}

/**
 * Returns the next minimum valid bid above `currentBid`.
 */
export function getNextValidBid(currentBid: number): number {
  return currentBid + getBidIncrement(currentBid);
}

/**
 * Returns `count` consecutive valid bid amounts starting from the next valid bid.
 * e.g. for currentBid=5000, count=4 → [5500, 6000, 6500, 7000]
 */
export function getValidBidOptions(currentBid: number, count = 4): number[] {
  const options: number[] = [];
  let bid = currentBid;
  for (let i = 0; i < count; i++) {
    bid = getNextValidBid(bid);
    options.push(bid);
  }
  return options;
}

/**
 * Validates that `proposedBid` meets the minimum increment above `currentBid`.
 * Returns true if the proposed bid is acceptable.
 */
export function isValidBidAmount(currentBid: number, proposedBid: number): boolean {
  return proposedBid >= getNextValidBid(currentBid);
}

/**
 * Formats a bid amount as "5 500 PLN" (Polish locale style).
 */
export function formatBidAmount(amount: number): string {
  return (
    new Intl.NumberFormat('pl-PL', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + ' PLN'
  );
}
