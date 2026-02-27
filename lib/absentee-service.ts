import { eq, and, desc } from 'drizzle-orm';
import { db, pool } from '@/db/connection';
import {
  absenteeBids, bids, bidRegistrations, bidRetractions,
  lots, auctions, users,
} from '@/db/schema';
import { getNextMinBid } from '@/app/lib/bidding';
import { logCreate, logUpdate } from '@/lib/audit';
import { emitBid } from '@/lib/bid-events';
import { isNull } from 'drizzle-orm';

// ─── Types ──────────────────────────────────────────────────────────────────

export class AbsenteeError extends Error {
  constructor(
    message: string,
    public code:
      | 'NOT_AUTHENTICATED'
      | 'NOT_REGISTERED'
      | 'AUCTION_NOT_LIVE'
      | 'LOT_NOT_ACTIVE'
      | 'AMOUNT_TOO_LOW'
      | 'NOT_FOUND',
    public statusCode: number,
  ) {
    super(message);
    this.name = 'AbsenteeError';
  }
}

// ─── Place / Update Absentee Bid ─────────────────────────────────────────────

export async function placeAbsenteeBid(
  lotId: string,
  userId: string,
  maxAmount: number,
): Promise<{ id: string; lotId: string; userId: string; maxAmount: number }> {
  // 1. Verify lot + auction are accessible (preview or live)
  const [lotRow] = await db
    .select({
      lotId: lots.id,
      lotStatus: lots.status,
      auctionStatus: auctions.status,
      startingBid: lots.startingBid,
      auctionId: lots.auctionId,
    })
    .from(lots)
    .innerJoin(auctions, eq(auctions.id, lots.auctionId))
    .where(and(eq(lots.id, lotId), isNull(lots.deletedAt)))
    .limit(1);

  if (!lotRow) {
    throw new AbsenteeError('Lot not found', 'LOT_NOT_ACTIVE', 404);
  }

  const allowedAuctionStatuses = ['preview', 'live'];
  if (!allowedAuctionStatuses.includes(lotRow.auctionStatus)) {
    throw new AbsenteeError('Auction is not accepting absentee bids', 'AUCTION_NOT_LIVE', 400);
  }

  if (!['published', 'active'].includes(lotRow.lotStatus)) {
    throw new AbsenteeError('Lot is not available for absentee bids', 'LOT_NOT_ACTIVE', 400);
  }

  // 2. Verify registration
  const [registration] = await db
    .select({ id: bidRegistrations.id, isApproved: bidRegistrations.isApproved })
    .from(bidRegistrations)
    .where(
      and(
        eq(bidRegistrations.userId, userId),
        eq(bidRegistrations.auctionId, lotRow.auctionId),
      ),
    )
    .limit(1);

  if (!registration) {
    throw new AbsenteeError(
      'You must register for this auction before placing absentee bids',
      'NOT_REGISTERED',
      403,
    );
  }
  if (!registration.isApproved) {
    throw new AbsenteeError(
      'Your auction registration has not been approved yet',
      'NOT_REGISTERED',
      403,
    );
  }

  // 3. maxAmount must be at least the opening bid
  const minAcceptable = lotRow.startingBid ?? getNextMinBid(0);
  if (maxAmount < minAcceptable) {
    throw new AbsenteeError(
      `Maximum bid must be at least ${minAcceptable} PLN`,
      'AMOUNT_TOO_LOW',
      400,
    );
  }

  // 4. Upsert: one absentee bid per (lot, user)
  const [existing] = await db
    .select({ id: absenteeBids.id, maxAmount: absenteeBids.maxAmount })
    .from(absenteeBids)
    .where(and(eq(absenteeBids.lotId, lotId), eq(absenteeBids.userId, userId)))
    .limit(1);

  if (existing) {
    await db
      .update(absenteeBids)
      .set({ maxAmount, isActive: true })
      .where(eq(absenteeBids.id, existing.id));

    await logUpdate(
      'absentee_bids',
      existing.id,
      { maxAmount: existing.maxAmount, isActive: true },
      { maxAmount, isActive: true },
      userId,
      'user',
    ).catch(() => {});

    return { id: existing.id, lotId, userId, maxAmount };
  }

  const [inserted] = await db
    .insert(absenteeBids)
    .values({ lotId, userId, maxAmount, isActive: true })
    .returning({ id: absenteeBids.id });

  await logCreate(
    'absentee_bids',
    inserted.id,
    { lotId, userId, maxAmount, isActive: true },
    userId,
    'user',
  ).catch(() => {});

  return { id: inserted.id, lotId, userId, maxAmount };
}

// ─── Check if user has an active absentee bid ────────────────────────────────

export async function getUserAbsenteeBid(
  lotId: string,
  userId: string,
): Promise<{ hasAbsenteeBid: boolean }> {
  const [row] = await db
    .select({ id: absenteeBids.id })
    .from(absenteeBids)
    .where(
      and(
        eq(absenteeBids.lotId, lotId),
        eq(absenteeBids.userId, userId),
        eq(absenteeBids.isActive, true),
      ),
    )
    .limit(1);

  return { hasAbsenteeBid: !!row };
}

// ─── Cancel absentee bid ─────────────────────────────────────────────────────

export async function cancelAbsenteeBid(lotId: string, userId: string): Promise<void> {
  const [existing] = await db
    .select({ id: absenteeBids.id })
    .from(absenteeBids)
    .where(
      and(
        eq(absenteeBids.lotId, lotId),
        eq(absenteeBids.userId, userId),
        eq(absenteeBids.isActive, true),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new AbsenteeError('No active absentee bid found', 'NOT_FOUND', 404);
  }

  await db
    .update(absenteeBids)
    .set({ isActive: false })
    .where(eq(absenteeBids.id, existing.id));

  await logUpdate(
    'absentee_bids',
    existing.id,
    { isActive: true },
    { isActive: false },
    userId,
    'user',
  ).catch(() => {});
}

// ─── Process Absentee Bids (Proxy Engine) ───────────────────────────────────
// Called after every new bid to check if any absentee bid can auto-counter.

export async function processAbsenteeBids(
  lotId: string,
  currentBidAmount: number,
  currentBidUserId: string | null,
  auctionId: string,
): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Advisory lock — same key as bid-service to serialize
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [lotId]);

    // Re-read current highest bid inside the lock
    const highestResult = await client.query<{
      amount: number;
      user_id: string | null;
    }>(
      `SELECT b.amount, b.user_id
       FROM bids b
       LEFT JOIN bid_retractions br ON br.bid_id = b.id
       WHERE b.lot_id = $1
         AND br.id IS NULL
       ORDER BY b.amount DESC
       LIMIT 1`,
      [lotId],
    );

    const current = highestResult.rows[0];
    if (!current) {
      await client.query('ROLLBACK');
      return;
    }

    const nextMin = getNextMinBid(current.amount);

    // Find the highest eligible absentee bid that:
    // - is active
    // - belongs to a different user than the current highest bidder
    // - has maxAmount >= nextMin
    const absenteeResult = await client.query<{
      id: string;
      user_id: string;
      max_amount: number;
      registration_id: string;
      paddle_number: number;
    }>(
      `SELECT ab.id, ab.user_id, ab.max_amount, br.id AS registration_id, br.paddle_number
       FROM absentee_bids ab
       INNER JOIN lots l ON l.id = ab.lot_id
       INNER JOIN auctions a ON a.id = l.auction_id
       INNER JOIN bid_registrations br ON br.user_id = ab.user_id AND br.auction_id = a.id
       WHERE ab.lot_id = $1
         AND ab.is_active = true
         AND ab.user_id != $2
         AND ab.max_amount >= $3
         AND br.is_approved = true
       ORDER BY ab.max_amount DESC
       LIMIT 1`,
      [lotId, current.user_id ?? '', nextMin],
    );

    const absentee = absenteeResult.rows[0];
    if (!absentee) {
      await client.query('ROLLBACK');
      return;
    }

    // Determine the auto-bid amount: minimum needed to take the lead
    // Cap it at the absentee's max
    const autoBidAmount = Math.min(nextMin, absentee.max_amount);

    // Place the system bid
    await client.query(
      `UPDATE bids SET is_winning = false WHERE lot_id = $1 AND is_winning = true`,
      [lotId],
    );

    const insertResult = await client.query<{
      id: string;
      lot_id: string;
      user_id: string;
      amount: number;
      bid_type: string;
      is_winning: boolean;
      created_at: Date;
    }>(
      `INSERT INTO bids (lot_id, user_id, registration_id, amount, bid_type, paddle_number, is_winning)
       VALUES ($1, $2, $3, $4, 'system', $5, true)
       RETURNING id, lot_id, user_id, amount, bid_type, is_winning, created_at`,
      [lotId, absentee.user_id, absentee.registration_id, autoBidAmount, absentee.paddle_number],
    );

    const newBid = insertResult.rows[0];

    await client.query('COMMIT');

    // Emit real-time event (outside transaction)
    emitBid(auctionId, {
      lotId,
      auctionId,
      amount: autoBidAmount,
      isWinning: true,
      timestamp: new Date(newBid.created_at).toISOString(),
      nextMinBid: getNextMinBid(autoBidAmount),
    });

    // Audit log
    await logCreate(
      'bids',
      newBid.id,
      {
        lotId,
        userId: absentee.user_id,
        amount: autoBidAmount,
        bidType: 'system',
        isWinning: true,
      },
      'system',
      'system',
    ).catch(() => {});

    // If the absentee bid was fully used up (auto-bid == max), deactivate it
    if (autoBidAmount >= absentee.max_amount) {
      await db
        .update(absenteeBids)
        .set({ isActive: false })
        .where(eq(absenteeBids.id, absentee.id));
    }
  } catch (error) {
    await client.query('ROLLBACK');
    // Non-fatal: proxy bid failure should not break the original bid
    console.error('[absentee-service] processAbsenteeBids error:', error);
  } finally {
    client.release();
  }
}
