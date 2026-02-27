import { eq, sum, count, avg, and, isNull, sql, isNotNull } from 'drizzle-orm';
import { db } from '../connection';
import { auctions, lots, bids, bidRegistrations, users } from '../schema';
import { notDeleted } from '../helpers';

// ─── Sales Summary by Auction ────────────────────────────────────────────────

export async function getSalesSummary(auctionId?: string) {
  const conditions = [notDeleted(lots), notDeleted(auctions)];

  if (auctionId) {
    conditions.push(eq(lots.auctionId, auctionId));
  }

  const results = await db
    .select({
      auctionId: lots.auctionId,
      auctionTitle: auctions.title,
      auctionSlug: auctions.slug,
      totalHammerPrice: sum(lots.hammerPrice),
      avgHammerPrice: avg(lots.hammerPrice),
      lotCount: count(lots.id),
      // Count lots that were actually sold (have a hammerPrice)
      soldCount: count(sql<number>`CASE WHEN ${lots.hammerPrice} IS NOT NULL THEN 1 END`),
      buyersPremiumRate: auctions.buyersPremiumRate,
    })
    .from(lots)
    .innerJoin(auctions, eq(lots.auctionId, auctions.id))
    .where(and(...conditions))
    .groupBy(lots.auctionId, auctions.id, auctions.title, auctions.slug, auctions.buyersPremiumRate);

  return results.map((row) => {
    const lotCount = Number(row.lotCount) || 0;
    const totalHammer = row.totalHammerPrice ? Number(row.totalHammerPrice) : 0;
    const avgPrice = row.avgHammerPrice ? Number(row.avgHammerPrice) : 0;
    const soldCount = Number(row.soldCount) || 0;

    return {
      auctionId: row.auctionId,
      auctionTitle: row.auctionTitle,
      auctionSlug: row.auctionSlug,
      totalHammerPrice: totalHammer,
      avgHammerPrice: Math.round(avgPrice),
      lotCount,
      soldCount,
      sellThroughRate: lotCount > 0 ? Math.round((soldCount / lotCount) * 10000) / 100 : 0,
      buyersPremiumRate: row.buyersPremiumRate ? Number(row.buyersPremiumRate) : 0,
    };
  });
}

// ─── User Activity Summary ────────────────────────────────────────────────────

export async function getUserActivitySummary() {
  // Total active users
  const totalUsersResult = await db
    .select({ count: count() })
    .from(users)
    .where(notDeleted(users));

  // Active bidders (users who placed bids) — count distinct
  const activeBiddersResult = await db
    .select({ count: count(sql<number>`DISTINCT ${bids.userId}`) })
    .from(bids)
    .where(isNotNull(bids.userId)); // Only count non-null user bids

  // Pending registrations (not approved)
  const pendingRegsResult = await db
    .select({ count: count() })
    .from(bidRegistrations)
    .where(eq(bidRegistrations.isApproved, false));

  return {
    totalUsers: Number(totalUsersResult[0]?.count ?? 0),
    activeBidders: Number(activeBiddersResult[0]?.count ?? 0),
    pendingRegistrations: Number(pendingRegsResult[0]?.count ?? 0),
  };
}

// ─── Revenue by Auction (Hammer Price + Buyers Premium) ──────────────────────

export async function getRevenueByAuction(auctionId?: string) {
  const conditions = [notDeleted(lots), notDeleted(auctions)];

  if (auctionId) {
    conditions.push(eq(lots.auctionId, auctionId));
  }

  const results = await db
    .select({
      auctionId: lots.auctionId,
      auctionTitle: auctions.title,
      auctionSlug: auctions.slug,
      totalHammerPrice: sum(lots.hammerPrice),
      buyersPremiumRate: auctions.buyersPremiumRate,
      lotCount: count(lots.id),
    })
    .from(lots)
    .innerJoin(auctions, eq(lots.auctionId, auctions.id))
    .where(and(...conditions))
    .groupBy(lots.auctionId, auctions.id, auctions.title, auctions.slug, auctions.buyersPremiumRate);

  return results.map((row) => {
    const hammerPrice = row.totalHammerPrice ? Number(row.totalHammerPrice) : 0;
    const premiumRate = row.buyersPremiumRate ? Number(row.buyersPremiumRate) : 0.2;
    const premium = Math.round(hammerPrice * premiumRate);
    const totalRevenue = hammerPrice + premium;

    return {
      auctionId: row.auctionId,
      auctionTitle: row.auctionTitle,
      auctionSlug: row.auctionSlug,
      hammerPrice,
      buyersPremium: premium,
      totalRevenue,
      lotCount: Number(row.lotCount),
    };
  });
}

// ─── Overall Statistics ──────────────────────────────────────────────────────

export async function getOverallStats() {
  // Total lots and sold lots
  const lotsResult = await db
    .select({
      totalCount: count(lots.id),
      soldCount: count(sql<number>`CASE WHEN ${lots.hammerPrice} IS NOT NULL THEN 1 END`),
    })
    .from(lots)
    .where(notDeleted(lots));

  const totalLots = Number(lotsResult[0]?.totalCount ?? 0);
  const soldLots = Number(lotsResult[0]?.soldCount ?? 0);

  // Total revenue
  const revenueData = await getRevenueByAuction();
  const totalRevenue = revenueData.reduce((sum, row) => sum + row.totalRevenue, 0);

  // User activity
  const userActivity = await getUserActivitySummary();

  return {
    totalRevenue,
    totalLots,
    soldLots,
    overallSellThroughRate: totalLots > 0 ? Math.round((soldLots / totalLots) * 10000) / 100 : 0,
    activeUsers: userActivity.activeBidders,
    pendingRegistrations: userActivity.pendingRegistrations,
  };
}
