import { eq, asc } from 'drizzle-orm';
import { db } from '../connection';
import { premiumTiers } from '../schema';

// ─── Types ───────────────────────────────────────────────────────────────────

export type PremiumTierRow = typeof premiumTiers.$inferSelect;

export interface PremiumTierInput {
  minAmount: number;
  maxAmount: number | null;
  rate: string; // e.g. "0.2500"
  sortOrder?: number;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * Get all premium tiers for an auction, ordered by minAmount ascending.
 */
export async function getTiersForAuction(auctionId: string): Promise<PremiumTierRow[]> {
  return db
    .select()
    .from(premiumTiers)
    .where(eq(premiumTiers.auctionId, auctionId))
    .orderBy(asc(premiumTiers.minAmount));
}

/**
 * Replace all premium tiers for an auction.
 * Deletes existing tiers and inserts the new set atomically.
 * Pass an empty array to remove all tiers (revert to flat rate).
 */
export async function upsertTiers(
  auctionId: string,
  tiers: PremiumTierInput[],
): Promise<PremiumTierRow[]> {
  return db.transaction(async (tx) => {
    // Delete all existing tiers for this auction
    await tx
      .delete(premiumTiers)
      .where(eq(premiumTiers.auctionId, auctionId));

    if (tiers.length === 0) {
      return [];
    }

    // Insert new tiers with explicit sortOrder
    const rows = await tx
      .insert(premiumTiers)
      .values(
        tiers.map((t, idx) => ({
          auctionId,
          minAmount: t.minAmount,
          maxAmount: t.maxAmount,
          rate: t.rate,
          sortOrder: t.sortOrder ?? idx,
        })),
      )
      .returning();

    // Return ordered by minAmount
    return rows.sort((a, b) => a.minAmount - b.minAmount);
  });
}
