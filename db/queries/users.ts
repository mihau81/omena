import { eq, and, or, ilike, desc, count, sql } from 'drizzle-orm';
import { db } from '../connection';
import { users, bids, bidRegistrations, watchedLots, lots, auctions } from '../schema';
import { notDeleted } from '../helpers';

// ─── Single User ────────────────────────────────────────────────────────────

export async function getUserById(id: string) {
  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), notDeleted(users)))
    .limit(1);

  return rows[0] ?? null;
}

export async function getUserByEmail(email: string) {
  const rows = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), notDeleted(users)))
    .limit(1);

  return rows[0] ?? null;
}

export async function isUserRegisteredForAuction(userId: string, auctionId: string) {
  const rows = await db
    .select({ id: bidRegistrations.id, isApproved: bidRegistrations.isApproved })
    .from(bidRegistrations)
    .where(
      and(
        eq(bidRegistrations.userId, userId),
        eq(bidRegistrations.auctionId, auctionId),
      ),
    )
    .limit(1);

  if (rows.length === 0) return { registered: false, approved: false } as const;
  return { registered: true, approved: rows[0].isApproved } as const;
}

// ─── Admin: List Users (paginated + filtered) ───────────────────────────────

interface ListUsersFilters {
  search?: string;
  visibilityLevel?: '0' | '1' | '2';
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export async function listUsers(filters: ListUsersFilters = {}) {
  const { page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;

  const conditions = [notDeleted(users)];

  if (filters.search) {
    const pattern = `%${filters.search}%`;
    conditions.push(
      or(
        ilike(users.name, pattern),
        ilike(users.email, pattern),
      )!,
    );
  }

  if (filters.visibilityLevel) {
    conditions.push(eq(users.visibilityLevel, filters.visibilityLevel));
  }

  if (filters.isActive !== undefined) {
    conditions.push(eq(users.isActive, filters.isActive));
  }

  const whereClause = and(...conditions);

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        phone: users.phone,
        visibilityLevel: users.visibilityLevel,
        referrerId: users.referrerId,
        isActive: users.isActive,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(whereClause)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(users)
      .where(whereClause),
  ]);

  return {
    data: rows,
    total: totalResult[0].total,
    page,
    limit,
    totalPages: Math.ceil(totalResult[0].total / limit),
  };
}

// ─── Admin: Full User Detail ────────────────────────────────────────────────

export async function getUserDetail(id: string) {
  const user = await getUserById(id);
  if (!user) return null;

  // Get referrer name if exists
  let referrerName: string | null = null;
  if (user.referrerId) {
    const ref = await getUserById(user.referrerId);
    referrerName = ref?.name ?? null;
  }

  // Get counts
  const [bidCountResult, registrationCountResult, watchedCountResult] = await Promise.all([
    db.select({ total: count() }).from(bids).where(eq(bids.userId, id)),
    db.select({ total: count() }).from(bidRegistrations).where(eq(bidRegistrations.userId, id)),
    db.select({ total: count() }).from(watchedLots).where(eq(watchedLots.userId, id)),
  ]);

  return {
    ...user,
    referrerName,
    bidCount: bidCountResult[0].total,
    registrationCount: registrationCountResult[0].total,
    watchedLotCount: watchedCountResult[0].total,
  };
}

// ─── Admin: User Bid History (paginated) ────────────────────────────────────

export async function getUserBidsPaginated(userId: string, page = 1, limit = 20) {
  const offset = (page - 1) * limit;

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        id: bids.id,
        amount: bids.amount,
        bidType: bids.bidType,
        isWinning: bids.isWinning,
        createdAt: bids.createdAt,
        lotId: bids.lotId,
        lotNumber: lots.lotNumber,
        lotTitle: lots.title,
        auctionId: lots.auctionId,
        auctionTitle: auctions.title,
        auctionSlug: auctions.slug,
      })
      .from(bids)
      .innerJoin(lots, eq(lots.id, bids.lotId))
      .innerJoin(auctions, eq(auctions.id, lots.auctionId))
      .where(eq(bids.userId, userId))
      .orderBy(desc(bids.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(bids)
      .where(eq(bids.userId, userId)),
  ]);

  return {
    data: rows,
    total: totalResult[0].total,
    page,
    limit,
    totalPages: Math.ceil(totalResult[0].total / limit),
  };
}

// ─── Admin: User Registrations (paginated) ──────────────────────────────────

export async function getUserRegistrationsPaginated(userId: string, page = 1, limit = 20) {
  const offset = (page - 1) * limit;

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        id: bidRegistrations.id,
        auctionId: bidRegistrations.auctionId,
        auctionTitle: auctions.title,
        auctionSlug: auctions.slug,
        paddleNumber: bidRegistrations.paddleNumber,
        isApproved: bidRegistrations.isApproved,
        depositPaid: bidRegistrations.depositPaid,
        createdAt: bidRegistrations.createdAt,
      })
      .from(bidRegistrations)
      .innerJoin(auctions, eq(auctions.id, bidRegistrations.auctionId))
      .where(eq(bidRegistrations.userId, userId))
      .orderBy(desc(bidRegistrations.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(bidRegistrations)
      .where(eq(bidRegistrations.userId, userId)),
  ]);

  return {
    data: rows,
    total: totalResult[0].total,
    page,
    limit,
    totalPages: Math.ceil(totalResult[0].total / limit),
  };
}

// ─── Admin: User Watched Lots (paginated) ───────────────────────────────────

export async function getUserWatchedLotsPaginated(userId: string, page = 1, limit = 20) {
  const offset = (page - 1) * limit;

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        lotId: watchedLots.lotId,
        lotNumber: lots.lotNumber,
        lotTitle: lots.title,
        artist: lots.artist,
        auctionId: lots.auctionId,
        auctionTitle: auctions.title,
        auctionSlug: auctions.slug,
        createdAt: watchedLots.createdAt,
      })
      .from(watchedLots)
      .innerJoin(lots, eq(lots.id, watchedLots.lotId))
      .innerJoin(auctions, eq(auctions.id, lots.auctionId))
      .where(eq(watchedLots.userId, userId))
      .orderBy(desc(watchedLots.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(watchedLots)
      .where(eq(watchedLots.userId, userId)),
  ]);

  return {
    data: rows,
    total: totalResult[0].total,
    page,
    limit,
    totalPages: Math.ceil(totalResult[0].total / limit),
  };
}
