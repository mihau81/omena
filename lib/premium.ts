// ─── Buyer's Premium Sliding-Scale Calculation ──────────────────────────────

export interface PremiumTier {
  minAmount: number;      // PLN, inclusive
  maxAmount: number | null; // PLN, exclusive — null means unlimited
  rate: string | number;  // e.g. "0.2500" or 0.25 (25%)
}

export interface PremiumBreakdownItem {
  range: string;   // human-readable, e.g. "0 – 100 000 PLN"
  rate: number;    // decimal, e.g. 0.25
  amount: number;  // PLN amount of premium for this tier slice
}

export interface PremiumResult {
  premium: number;
  breakdown: PremiumBreakdownItem[];
}

/**
 * Calculate buyer's premium using a sliding-scale tier table.
 *
 * Each tier covers [minAmount, maxAmount) and its rate applies only to the
 * portion of the hammer price that falls within that band — similar to how
 * income tax brackets work.
 *
 * Example (600 000 PLN hammer, 3-tier table):
 *   Tier 1: 0 – 100 000 @ 25%  → 25 000
 *   Tier 2: 100 000 – 500 000 @ 20%  → 80 000
 *   Tier 3: 500 000+ @ 12%  → 12 000
 *   Total premium: 117 000 PLN
 *
 * If tiers is empty the caller should fall back to the flat auction rate.
 */
export function calculatePremium(
  hammerPrice: number,
  tiers: PremiumTier[],
): PremiumResult {
  if (tiers.length === 0) {
    return { premium: 0, breakdown: [] };
  }

  // Sort tiers by minAmount ascending (defensive — DB should already order them)
  const sorted = [...tiers].sort((a, b) => a.minAmount - b.minAmount);

  let remaining = hammerPrice;
  let totalPremium = 0;
  const breakdown: PremiumBreakdownItem[] = [];

  for (const tier of sorted) {
    if (remaining <= 0) break;

    const tierMin = tier.minAmount;
    const tierMax = tier.maxAmount ?? Infinity;
    const rate = typeof tier.rate === 'string' ? parseFloat(tier.rate) : tier.rate;

    // The portion of the hammer price this tier covers
    const bandStart = tierMin;
    const bandEnd = tierMax;
    const bandWidth = bandEnd - bandStart;

    // How much of the hammer price has been accounted for by previous tiers?
    const alreadyCovered = hammerPrice - remaining;

    if (alreadyCovered >= bandEnd) {
      // Entire band already accounted for — skip
      continue;
    }

    // Amount within this band's range
    const applicableInBand = Math.min(remaining, bandWidth === Infinity ? remaining : bandEnd - alreadyCovered);
    if (applicableInBand <= 0) continue;

    const premiumSlice = Math.round(applicableInBand * rate);
    totalPremium += premiumSlice;
    remaining -= applicableInBand;

    const rangeLabel =
      tier.maxAmount != null
        ? `${formatAmount(tierMin)} – ${formatAmount(tier.maxAmount)} PLN`
        : `${formatAmount(tierMin)}+ PLN`;

    breakdown.push({
      range: rangeLabel,
      rate,
      amount: premiumSlice,
    });
  }

  return { premium: totalPremium, breakdown };
}

/**
 * Calculate premium using flat rate (fallback when no tiers are configured).
 */
export function calculateFlatPremium(
  hammerPrice: number,
  flatRate: number,
): PremiumResult {
  const premium = Math.round(hammerPrice * flatRate);
  return {
    premium,
    breakdown: [
      {
        range: `Flat rate`,
        rate: flatRate,
        amount: premium,
      },
    ],
  };
}

/** Format a PLN integer amount with space thousands separator */
function formatAmount(amount: number): string {
  return amount.toLocaleString('pl-PL', { maximumFractionDigits: 0 });
}

/** Standard tier presets used by the "Add standard tiers" button */
export const STANDARD_TIERS: (Omit<PremiumTier, 'rate'> & { rate: number })[] = [
  { minAmount: 0,       maxAmount: 100000,  rate: 0.25 },
  { minAmount: 100000,  maxAmount: 500000,  rate: 0.20 },
  { minAmount: 500000,  maxAmount: null,    rate: 0.12 },
];

/** Format a rate number as a percentage string, e.g. 0.25 → "25%" */
export function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(0)}%`;
}
