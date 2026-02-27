import { eq, and, desc, sql, isNull } from 'drizzle-orm';
import { db, pool } from '@/db/connection';
import {
  bids, bidRegistrations, bidRetractions,
  lots, auctions, users,
} from '@/db/schema';
import { getNextMinBid } from '@/app/lib/bidding';
import { logCreate } from '@/lib/audit';
import { emitBid } from '@/lib/bid-events';
import { processAbsenteeBids } from '@/lib/absentee-service';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PlaceBidResult {
  bid: {
    id: string;
    lotId: string;
    userId: string;
    amount: number;
    bidType: string;
    isWinning: boolean;
    createdAt: Date;
  };
  nextMinBid: number;
}

export class BidError extends Error {
  constructor(
    message: string,
    public code:
      | 'NOT_AUTHENTICATED'
      | 'NOT_REGISTERED'
      | 'AUCTION_NOT_LIVE'
      | 'LOT_NOT_ACTIVE'
      | 'BID_TOO_LOW'
      | 'ALREADY_WINNING'
      | 'USER_INACTIVE'
      | 'RATE_LIMITED',
    public statusCode: number,
  ) {
    super(message);
    this.name = 'BidError';
  }
}

// ─── Core Bid Placement ─────────────────────────────────────────────────────

export async function placeBid(
  lotId: string,
  userId: string,
  amount: number,
  ipAddress?: string,
  userAgent?: string,
): Promise<PlaceBidResult> {
  // Use a client from the pool for the transaction + advisory lock
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Advisory lock on lot to prevent race conditions
    // Use a hash of the lotId UUID as the lock key
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtext($1))`,
      [lotId],
    );

    // 1. Verify user exists and is active
    const [user] = await db
      .select({ id: users.id, isActive: users.isActive })
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);

    if (!user) {
      throw new BidError('User not found', 'NOT_AUTHENTICATED', 401);
    }
    if (!user.isActive) {
      throw new BidError('User account is not active', 'USER_INACTIVE', 403);
    }

    // 2. Load lot + auction in one query
    const [lotRow] = await db
      .select({
        lotId: lots.id,
        lotStatus: lots.status,
        auctionId: lots.auctionId,
        auctionStatus: auctions.status,
        startingBid: lots.startingBid,
      })
      .from(lots)
      .innerJoin(auctions, eq(auctions.id, lots.auctionId))
      .where(and(eq(lots.id, lotId), isNull(lots.deletedAt)))
      .limit(1);

    if (!lotRow) {
      throw new BidError('Lot not found', 'LOT_NOT_ACTIVE', 400);
    }
    if (lotRow.auctionStatus !== 'live') {
      throw new BidError('Auction is not live', 'AUCTION_NOT_LIVE', 400);
    }
    if (lotRow.lotStatus !== 'active') {
      throw new BidError('Lot is not active for bidding', 'LOT_NOT_ACTIVE', 400);
    }

    // 3. Check user is registered for this auction (approved)
    const [registration] = await db
      .select({
        id: bidRegistrations.id,
        isApproved: bidRegistrations.isApproved,
        paddleNumber: bidRegistrations.paddleNumber,
      })
      .from(bidRegistrations)
      .where(
        and(
          eq(bidRegistrations.userId, userId),
          eq(bidRegistrations.auctionId, lotRow.auctionId),
        ),
      )
      .limit(1);

    if (!registration) {
      throw new BidError(
        'You must register for this auction before bidding',
        'NOT_REGISTERED',
        403,
      );
    }
    if (!registration.isApproved) {
      throw new BidError(
        'Your auction registration has not been approved yet',
        'NOT_REGISTERED',
        403,
      );
    }

    // 4. Get current highest non-retracted bid
    const [currentHighest] = await db
      .select({
        amount: bids.amount,
        userId: bids.userId,
        id: bids.id,
      })
      .from(bids)
      .leftJoin(bidRetractions, eq(bidRetractions.bidId, bids.id))
      .where(
        and(
          eq(bids.lotId, lotId),
          isNull(bidRetractions.id),
        ),
      )
      .orderBy(desc(bids.amount))
      .limit(1);

    const currentHighestAmount = currentHighest?.amount ?? 0;

    // 5. Check no self-outbid
    if (currentHighest && currentHighest.userId === userId) {
      throw new BidError(
        'You already have the highest bid on this lot',
        'ALREADY_WINNING',
        409,
      );
    }

    // 6. Check bid amount meets minimum
    let minBid: number;
    if (currentHighestAmount === 0) {
      // No bids yet — use starting bid or the minimum increment from 0
      minBid = lotRow.startingBid ?? getNextMinBid(0);
    } else {
      minBid = getNextMinBid(currentHighestAmount);
    }

    if (amount < minBid) {
      throw new BidError(
        `Bid must be at least ${minBid} PLN`,
        'BID_TOO_LOW',
        400,
      );
    }

    // 7. Mark previous winning bid as not winning (within raw SQL since we're in a tx)
    if (currentHighest) {
      await client.query(
        `UPDATE bids SET is_winning = false WHERE lot_id = $1 AND is_winning = true`,
        [lotId],
      );
    }

    // 8. Insert the new bid
    const insertResult = await client.query(
      `INSERT INTO bids (lot_id, user_id, registration_id, amount, bid_type, paddle_number, is_winning, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, 'online', $5, true, $6, $7)
       RETURNING id, lot_id, user_id, amount, bid_type, is_winning, created_at`,
      [lotId, userId, registration.id, amount, registration.paddleNumber, ipAddress ?? null, userAgent ?? null],
    );

    const newBid = insertResult.rows[0];

    await client.query('COMMIT');

    // 9. Audit log (outside transaction — non-critical)
    await logCreate(
      'bids',
      newBid.id,
      {
        lotId,
        userId,
        amount,
        bidType: 'online',
        paddleNumber: registration.paddleNumber,
        isWinning: true,
      },
      userId,
      'user',
      ipAddress,
    ).catch(() => {
      // Don't fail the bid if audit logging fails
    });

    // 10. Emit real-time bid event to SSE subscribers (non-critical)
    emitBid(lotRow.auctionId, {
      lotId,
      auctionId: lotRow.auctionId,
      amount,
      isWinning: true,
      timestamp: new Date(newBid.created_at).toISOString(),
      nextMinBid: getNextMinBid(amount),
    });

    // 11. Trigger proxy bid engine (non-blocking, non-critical)
    processAbsenteeBids(lotId, amount, userId, lotRow.auctionId).catch(() => {});

    return {
      bid: {
        id: newBid.id,
        lotId: newBid.lot_id,
        userId: newBid.user_id,
        amount: newBid.amount,
        bidType: newBid.bid_type,
        isWinning: newBid.is_winning,
        createdAt: newBid.created_at,
      },
      nextMinBid: getNextMinBid(amount),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ─── Queries ────────────────────────────────────────────────────────────────

export async function getWinningBid(lotId: string) {
  const [winning] = await db
    .select({
      id: bids.id,
      userId: bids.userId,
      amount: bids.amount,
      createdAt: bids.createdAt,
    })
    .from(bids)
    .leftJoin(bidRetractions, eq(bidRetractions.bidId, bids.id))
    .where(
      and(
        eq(bids.lotId, lotId),
        eq(bids.isWinning, true),
        isNull(bidRetractions.id),
      ),
    )
    .limit(1);

  return winning ?? null;
}

export async function isUserWinning(lotId: string, userId: string): Promise<boolean> {
  const winning = await getWinningBid(lotId);
  return winning?.userId === userId;
}

export async function getBidHistory(lotId: string) {
  return db
    .select({
      id: bids.id,
      amount: bids.amount,
      bidType: bids.bidType,
      paddleNumber: bids.paddleNumber,
      isWinning: bids.isWinning,
      createdAt: bids.createdAt,
      isRetracted: sql<boolean>`${bidRetractions.id} IS NOT NULL`,
    })
    .from(bids)
    .leftJoin(bidRetractions, eq(bidRetractions.bidId, bids.id))
    .where(eq(bids.lotId, lotId))
    .orderBy(desc(bids.amount));
}
