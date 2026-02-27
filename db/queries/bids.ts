import { eq, and, desc, sql, max } from 'drizzle-orm';
import { db } from '../connection';
import { bids, bidRetractions, lots, auctions, users } from '../schema';
import { notDeleted } from '../helpers';

export async function getBidsForLot(lotId: string) {
  return db
    .select({
      bid: bids,
      retraction: bidRetractions,
      bidderName: users.name,
    })
    .from(bids)
    .leftJoin(bidRetractions, eq(bidRetractions.bidId, bids.id))
    .leftJoin(users, eq(users.id, bids.userId))
    .where(eq(bids.lotId, lotId))
    .orderBy(desc(bids.amount));
}

export async function getHighestBid(lotId: string) {
  const rows = await db
    .select({ amount: max(bids.amount) })
    .from(bids)
    .leftJoin(bidRetractions, eq(bidRetractions.bidId, bids.id))
    .where(
      and(
        eq(bids.lotId, lotId),
        sql`${bidRetractions.id} IS NULL`,
      ),
    );

  return rows[0]?.amount ?? null;
}

export async function getUserBids(userId: string) {
  return db
    .select({
      bid: bids,
      lotTitle: lots.title,
      lotNumber: lots.lotNumber,
      auctionSlug: auctions.slug,
      auctionTitle: auctions.title,
      isRetracted: sql<boolean>`${bidRetractions.id} IS NOT NULL`,
    })
    .from(bids)
    .innerJoin(lots, and(eq(lots.id, bids.lotId), notDeleted(lots)))
    .innerJoin(auctions, and(eq(auctions.id, lots.auctionId), notDeleted(auctions)))
    .leftJoin(bidRetractions, eq(bidRetractions.bidId, bids.id))
    .where(eq(bids.userId, userId))
    .orderBy(desc(bids.createdAt));
}
