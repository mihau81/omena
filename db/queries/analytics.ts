import { eq, and, sql, count, sum, avg, isNotNull, desc } from 'drizzle-orm';
import { db } from '../connection';
import { auctions, lots, bids, users, bidRegistrations } from '../schema';
import { notDeleted } from '../helpers';

// ─── Sell-Through Rate ────────────────────────────────────────────────────────

export async function getSellThroughRate(auctionId?: string) {
  const conditions = [notDeleted(lots), notDeleted(auctions)];

  if (auctionId) {
    conditions.push(eq(lots.auctionId, auctionId));
  }

  const results = await db
    .select({
      auctionId: lots.auctionId,
      auctionTitle: auctions.title,
      totalLots: count(lots.id),
      soldLots: count(sql<number>`CASE WHEN ${lots.hammerPrice} IS NOT NULL THEN 1 END`),
    })
    .from(lots)
    .innerJoin(auctions, eq(lots.auctionId, auctions.id))
    .where(and(...conditions))
    .groupBy(lots.auctionId, auctions.title);

  const rows = results.map((row) => {
    const total = Number(row.totalLots) || 0;
    const sold = Number(row.soldLots) || 0;
    return {
      auctionId: row.auctionId,
      auctionTitle: row.auctionTitle,
      totalLots: total,
      soldLots: sold,
      sellThroughRate: total > 0 ? Math.round((sold / total) * 10000) / 100 : 0,
    };
  });

  // If filtering by auction return single or overall summary
  if (!auctionId) {
    const totalLots = rows.reduce((s, r) => s + r.totalLots, 0);
    const soldLots = rows.reduce((s, r) => s + r.soldLots, 0);
    return {
      overall: {
        totalLots,
        soldLots,
        sellThroughRate: totalLots > 0 ? Math.round((soldLots / totalLots) * 10000) / 100 : 0,
      },
      byAuction: rows,
    };
  }

  return {
    overall: rows[0] ?? { totalLots: 0, soldLots: 0, sellThroughRate: 0 },
    byAuction: rows,
  };
}

// ─── Hammer-to-Estimate Ratio ─────────────────────────────────────────────────

export async function getHammerToEstimateRatio(auctionId?: string) {
  const conditions = [
    notDeleted(lots),
    notDeleted(auctions),
    isNotNull(lots.hammerPrice),
    sql`${lots.estimateMin} > 0`,
  ];

  if (auctionId) {
    conditions.push(eq(lots.auctionId, auctionId));
  }

  const results = await db
    .select({
      auctionId: lots.auctionId,
      auctionTitle: auctions.title,
      avgRatio: avg(sql<number>`CAST(${lots.hammerPrice} AS FLOAT) / NULLIF(${lots.estimateMin}, 0)`),
      lotCount: count(lots.id),
    })
    .from(lots)
    .innerJoin(auctions, eq(lots.auctionId, auctions.id))
    .where(and(...conditions))
    .groupBy(lots.auctionId, auctions.title);

  return results.map((row) => ({
    auctionId: row.auctionId,
    auctionTitle: row.auctionTitle,
    avgHammerToEstimateRatio: row.avgRatio ? Math.round(Number(row.avgRatio) * 100) / 100 : null,
    lotCount: Number(row.lotCount),
  }));
}

// ─── Revenue Trends (monthly) ─────────────────────────────────────────────────

export async function getRevenueTrends(months: number) {
  const rows = await db.execute(sql`
    SELECT
      TO_CHAR(DATE_TRUNC('month', a.start_date), 'YYYY-MM') AS month,
      TO_CHAR(DATE_TRUNC('month', a.start_date), 'Mon YYYY') AS month_label,
      SUM(l.hammer_price) AS total_hammer,
      SUM(ROUND(l.hammer_price * a.buyers_premium_rate::FLOAT)) AS total_premium,
      SUM(l.hammer_price + ROUND(l.hammer_price * a.buyers_premium_rate::FLOAT)) AS total_revenue,
      COUNT(l.id) FILTER (WHERE l.hammer_price IS NOT NULL) AS lots_sold
    FROM lots l
    INNER JOIN auctions a ON l.auction_id = a.id
    WHERE
      l.deleted_at IS NULL
      AND a.deleted_at IS NULL
      AND l.hammer_price IS NOT NULL
      AND a.start_date >= NOW() - INTERVAL '1 month' * ${months}
    GROUP BY DATE_TRUNC('month', a.start_date)
    ORDER BY DATE_TRUNC('month', a.start_date) ASC
  `);

  return (rows.rows as Array<Record<string, unknown>>).map((row) => ({
    month: String(row.month ?? ''),
    monthLabel: String(row.month_label ?? ''),
    totalHammer: Number(row.total_hammer ?? 0),
    totalPremium: Number(row.total_premium ?? 0),
    totalRevenue: Number(row.total_revenue ?? 0),
    lotsSold: Number(row.lots_sold ?? 0),
  }));
}

// ─── Top Artists ──────────────────────────────────────────────────────────────

export async function getTopArtists(limit: number) {
  const results = await db
    .select({
      artist: lots.artist,
      totalHammer: sum(lots.hammerPrice),
      lotsSold: count(sql<number>`CASE WHEN ${lots.hammerPrice} IS NOT NULL THEN 1 END`),
      avgHammer: avg(lots.hammerPrice),
      totalLots: count(lots.id),
    })
    .from(lots)
    .where(
      and(
        notDeleted(lots),
        sql`${lots.artist} != ''`,
        isNotNull(lots.hammerPrice),
      ),
    )
    .groupBy(lots.artist)
    .orderBy(desc(sum(lots.hammerPrice)))
    .limit(limit);

  return results.map((row) => ({
    artist: row.artist,
    totalHammerValue: Number(row.totalHammer ?? 0),
    lotsSold: Number(row.lotsSold ?? 0),
    totalLots: Number(row.totalLots ?? 0),
    avgHammerPrice: row.avgHammer ? Math.round(Number(row.avgHammer)) : 0,
  }));
}

// ─── Bid Activity Heatmap ─────────────────────────────────────────────────────

export async function getBidActivity(auctionId?: string, days: number = 30) {
  const auctionFilter = auctionId
    ? sql`AND l.auction_id = ${auctionId}`
    : sql``;

  const hourlyRows = await db.execute(sql`
    SELECT
      EXTRACT(HOUR FROM b.created_at AT TIME ZONE 'Europe/Warsaw') AS hour,
      COUNT(b.id) AS bid_count
    FROM bids b
    INNER JOIN lots l ON b.lot_id = l.id
    WHERE
      l.deleted_at IS NULL
      AND b.created_at >= NOW() - INTERVAL '1 day' * ${days}
      ${auctionFilter}
    GROUP BY EXTRACT(HOUR FROM b.created_at AT TIME ZONE 'Europe/Warsaw')
    ORDER BY hour ASC
  `);

  const dailyRows = await db.execute(sql`
    SELECT
      EXTRACT(DOW FROM b.created_at AT TIME ZONE 'Europe/Warsaw') AS dow,
      COUNT(b.id) AS bid_count
    FROM bids b
    INNER JOIN lots l ON b.lot_id = l.id
    WHERE
      l.deleted_at IS NULL
      AND b.created_at >= NOW() - INTERVAL '1 day' * ${days}
      ${auctionFilter}
    GROUP BY EXTRACT(DOW FROM b.created_at AT TIME ZONE 'Europe/Warsaw')
    ORDER BY dow ASC
  `);

  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return {
    byHour: (hourlyRows.rows as Array<Record<string, unknown>>).map((row) => ({
      hour: Number(row.hour),
      bidCount: Number(row.bid_count),
    })),
    byDayOfWeek: (dailyRows.rows as Array<Record<string, unknown>>).map((row) => ({
      dayOfWeek: Number(row.dow),
      dayName: DAY_NAMES[Number(row.dow)] ?? '',
      bidCount: Number(row.bid_count),
    })),
  };
}

// ─── User Activity Stats ──────────────────────────────────────────────────────

export async function getUserActivityStats() {
  const totalUsersResult = await db
    .select({ count: count() })
    .from(users)
    .where(notDeleted(users));

  const newLast30Result = await db
    .select({ count: count() })
    .from(users)
    .where(
      and(
        notDeleted(users),
        sql`${users.createdAt} >= NOW() - INTERVAL '30 days'`,
      ),
    );

  const activeBiddersResult = await db
    .select({ count: count(sql<number>`DISTINCT ${bids.userId}`) })
    .from(bids)
    .where(
      and(
        isNotNull(bids.userId),
        sql`${bids.createdAt} >= NOW() - INTERVAL '30 days'`,
      ),
    );

  // Returning bidders: placed bids in last 30 days AND have a prior bid older than 30 days
  const returningResult = await db.execute(sql`
    SELECT COUNT(DISTINCT b_recent.user_id) AS returning_count
    FROM bids b_recent
    WHERE
      b_recent.user_id IS NOT NULL
      AND b_recent.created_at >= NOW() - INTERVAL '30 days'
      AND EXISTS (
        SELECT 1 FROM bids b_old
        WHERE b_old.user_id = b_recent.user_id
          AND b_old.created_at < NOW() - INTERVAL '30 days'
      )
  `);

  const pendingRegsResult = await db
    .select({ count: count() })
    .from(bidRegistrations)
    .where(eq(bidRegistrations.isApproved, false));

  const newLast7Result = await db
    .select({ count: count() })
    .from(users)
    .where(
      and(
        notDeleted(users),
        sql`${users.createdAt} >= NOW() - INTERVAL '7 days'`,
      ),
    );

  return {
    totalUsers: Number(totalUsersResult[0]?.count ?? 0),
    newUsersLast30Days: Number(newLast30Result[0]?.count ?? 0),
    newUsersLast7Days: Number(newLast7Result[0]?.count ?? 0),
    activeBiddersLast30Days: Number(activeBiddersResult[0]?.count ?? 0),
    returningBiddersLast30Days: Number((returningResult.rows[0] as Record<string, unknown>)?.returning_count ?? 0),
    pendingRegistrations: Number(pendingRegsResult[0]?.count ?? 0),
  };
}

// ─── Auction Comparison ───────────────────────────────────────────────────────

export async function getAuctionComparison() {
  const results = await db
    .select({
      auctionId: auctions.id,
      auctionTitle: auctions.title,
      auctionSlug: auctions.slug,
      startDate: auctions.startDate,
      status: auctions.status,
      buyersPremiumRate: auctions.buyersPremiumRate,
      totalLots: count(lots.id),
      soldLots: count(sql<number>`CASE WHEN ${lots.hammerPrice} IS NOT NULL THEN 1 END`),
      totalHammer: sum(lots.hammerPrice),
      avgHammer: avg(lots.hammerPrice),
    })
    .from(auctions)
    .leftJoin(lots, and(eq(lots.auctionId, auctions.id), notDeleted(lots)))
    .where(notDeleted(auctions))
    .groupBy(
      auctions.id,
      auctions.title,
      auctions.slug,
      auctions.startDate,
      auctions.status,
      auctions.buyersPremiumRate,
    )
    .orderBy(desc(auctions.startDate));

  return results.map((row) => {
    const totalLots = Number(row.totalLots) || 0;
    const soldLots = Number(row.soldLots) || 0;
    const hammerTotal = Number(row.totalHammer ?? 0);
    const premiumRate = Number(row.buyersPremiumRate ?? 0.2);
    const premium = Math.round(hammerTotal * premiumRate);

    return {
      auctionId: row.auctionId,
      auctionTitle: row.auctionTitle,
      auctionSlug: row.auctionSlug,
      startDate: row.startDate,
      status: row.status,
      totalLots,
      soldLots,
      sellThroughRate: totalLots > 0 ? Math.round((soldLots / totalLots) * 10000) / 100 : 0,
      totalHammerPrice: hammerTotal,
      buyersPremium: premium,
      totalRevenue: hammerTotal + premium,
      avgHammerPrice: row.avgHammer ? Math.round(Number(row.avgHammer)) : 0,
    };
  });
}

// ─── Lot Performance ──────────────────────────────────────────────────────────

export async function getLotPerformance(auctionId?: string) {
  const conditions = [notDeleted(lots), notDeleted(auctions)];

  if (auctionId) {
    conditions.push(eq(lots.auctionId, auctionId));
  }

  const results = await db
    .select({
      status: lots.status,
      count: count(lots.id),
      avgHammer: avg(lots.hammerPrice),
      totalHammer: sum(lots.hammerPrice),
      avgEstimateMin: avg(lots.estimateMin),
    })
    .from(lots)
    .innerJoin(auctions, eq(lots.auctionId, auctions.id))
    .where(and(...conditions))
    .groupBy(lots.status)
    .orderBy(lots.status);

  return results.map((row) => ({
    status: row.status,
    count: Number(row.count),
    avgHammerPrice: row.avgHammer ? Math.round(Number(row.avgHammer)) : null,
    totalHammerPrice: Number(row.totalHammer ?? 0),
    avgEstimateMin: row.avgEstimateMin ? Math.round(Number(row.avgEstimateMin)) : 0,
  }));
}
