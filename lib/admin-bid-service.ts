import { sql } from 'drizzle-orm';
import { db, pool } from '@/db/connection';
import { getNextMinBid } from '@/app/lib/bidding';
import { logCreate } from '@/lib/audit';
import { emitBid } from '@/lib/bid-events';
import { processAbsenteeBids } from '@/lib/absentee-service';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AdminBidResult {
  bid: {
    id: string;
    lotId: string;
    amount: number;
    bidType: string;
    paddleNumber: number | null;
    isWinning: boolean;
    createdAt: Date;
  };
  nextMinBid: number;
}

export interface RetractBidResult {
  retracted: boolean;
  newWinningAmount: number;
}

export class AdminBidError extends Error {
  constructor(
    message: string,
    public code:
      | 'LOT_NOT_FOUND'
      | 'AUCTION_NOT_LIVE'
      | 'LOT_NOT_ACTIVE'
      | 'BID_TOO_LOW'
      | 'BID_NOT_FOUND'
      | 'ALREADY_RETRACTED'
      | 'INVALID_BID_TYPE',
    public statusCode: number,
  ) {
    super(message);
    this.name = 'AdminBidError';
  }
}

// ─── Place Admin Bid (phone / floor) ────────────────────────────────────────

export async function placeAdminBid(
  lotId: string,
  amount: number,
  bidType: 'phone' | 'floor',
  adminId: string,
  paddleNumber?: number | null,
  notes?: string | null,
): Promise<AdminBidResult> {
  if (!['phone', 'floor'].includes(bidType)) {
    throw new AdminBidError(
      "bidType must be 'phone' or 'floor'",
      'INVALID_BID_TYPE',
      400,
    );
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Advisory lock on lot to prevent race conditions
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtext($1))`,
      [lotId],
    );

    // Load lot + auction
    const lotResult = await client.query<{
      id: string;
      lot_status: string;
      auction_id: string;
      auction_status: string;
      starting_bid: number | null;
    }>(
      `SELECT l.id, l.status AS lot_status, l.starting_bid,
              a.id AS auction_id, a.status AS auction_status
       FROM lots l
       INNER JOIN auctions a ON a.id = l.auction_id
       WHERE l.id = $1 AND l.deleted_at IS NULL`,
      [lotId],
    );

    if (lotResult.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new AdminBidError('Lot not found', 'LOT_NOT_FOUND', 404);
    }

    const lotRow = lotResult.rows[0];

    if (lotRow.auction_status !== 'live') {
      await client.query('ROLLBACK');
      throw new AdminBidError('Auction is not live', 'AUCTION_NOT_LIVE', 400);
    }

    if (lotRow.lot_status !== 'active') {
      await client.query('ROLLBACK');
      throw new AdminBidError('Lot is not active for bidding', 'LOT_NOT_ACTIVE', 400);
    }

    // Get current highest non-retracted bid
    const highestResult = await client.query<{
      amount: number;
      id: string;
    }>(
      `SELECT b.amount, b.id
       FROM bids b
       LEFT JOIN bid_retractions br ON br.bid_id = b.id
       WHERE b.lot_id = $1 AND br.id IS NULL
       ORDER BY b.amount DESC
       LIMIT 1`,
      [lotId],
    );

    const currentHighestAmount: number = highestResult.rows[0]?.amount ?? 0;
    const minBid =
      currentHighestAmount === 0
        ? (lotRow.starting_bid ?? getNextMinBid(0))
        : getNextMinBid(currentHighestAmount);

    if (amount < minBid) {
      await client.query('ROLLBACK');
      throw new AdminBidError(
        `Bid must be at least ${minBid} PLN`,
        'BID_TOO_LOW',
        400,
      );
    }

    // Mark previous winning bid as not winning
    if (highestResult.rows.length > 0) {
      await client.query(
        `UPDATE bids SET is_winning = false WHERE lot_id = $1 AND is_winning = true`,
        [lotId],
      );
    }

    // Insert the bid (userId = NULL for phone/floor bids — entered on behalf)
    const insertResult = await client.query<{
      id: string;
      lot_id: string;
      amount: number;
      bid_type: string;
      paddle_number: number | null;
      is_winning: boolean;
      created_at: Date;
    }>(
      `INSERT INTO bids (lot_id, user_id, registration_id, amount, bid_type, paddle_number, is_winning)
       VALUES ($1, NULL, NULL, $2, $3, $4, true)
       RETURNING id, lot_id, amount, bid_type, paddle_number, is_winning, created_at`,
      [lotId, amount, bidType, paddleNumber ?? null],
    );

    const newBid = insertResult.rows[0];

    await client.query('COMMIT');

    // Audit log (non-critical)
    await logCreate(
      'bids',
      newBid.id,
      {
        lotId,
        amount,
        bidType,
        paddleNumber: paddleNumber ?? null,
        notes: notes ?? null,
        enteredByAdminId: adminId,
      },
      adminId,
      'admin',
    ).catch(() => {});

    // Emit real-time event
    emitBid(lotRow.auction_id, {
      lotId,
      auctionId: lotRow.auction_id,
      amount,
      isWinning: true,
      timestamp: new Date(newBid.created_at).toISOString(),
      nextMinBid: getNextMinBid(amount),
    });

    // Trigger proxy bid engine (non-blocking)
    processAbsenteeBids(lotId, amount, null, lotRow.auction_id).catch(() => {});

    return {
      bid: {
        id: newBid.id,
        lotId: newBid.lot_id,
        amount: newBid.amount,
        bidType: newBid.bid_type,
        paddleNumber: newBid.paddle_number,
        isWinning: newBid.is_winning,
        createdAt: newBid.created_at,
      },
      nextMinBid: getNextMinBid(amount),
    };
  } catch (error) {
    // ROLLBACK only if we haven't already rolled back or committed
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw error;
  } finally {
    client.release();
  }
}

// ─── Retract Bid ─────────────────────────────────────────────────────────────

export async function retractBid(
  bidId: string,
  reason: string,
  adminId: string,
): Promise<RetractBidResult> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Load the bid + lot info
    const bidResult = await client.query<{
      id: string;
      lot_id: string;
      amount: number;
      is_winning: boolean;
      auction_id: string;
    }>(
      `SELECT b.id, b.lot_id, b.amount, b.is_winning,
              l.auction_id
       FROM bids b
       INNER JOIN lots l ON l.id = b.lot_id
       WHERE b.id = $1`,
      [bidId],
    );

    if (bidResult.rows.length === 0) {
      await client.query('ROLLBACK');
      throw new AdminBidError('Bid not found', 'BID_NOT_FOUND', 404);
    }

    const bid = bidResult.rows[0];

    // Check not already retracted
    const existingRetraction = await client.query(
      `SELECT id FROM bid_retractions WHERE bid_id = $1`,
      [bidId],
    );

    if (existingRetraction.rows.length > 0) {
      await client.query('ROLLBACK');
      throw new AdminBidError('Bid is already retracted', 'ALREADY_RETRACTED', 409);
    }

    // Create the retraction record
    await client.query(
      `INSERT INTO bid_retractions (bid_id, reason, retracted_by)
       VALUES ($1, $2, $3)`,
      [bidId, reason.trim(), adminId],
    );

    let newWinningAmount = 0;
    let newWinnerId: string | null = null;

    if (bid.is_winning) {
      // Mark this bid as not winning
      await client.query(`UPDATE bids SET is_winning = false WHERE id = $1`, [bidId]);

      // Find the next highest non-retracted bid for this lot
      const nextHighestResult = await client.query<{
        id: string;
        amount: number;
      }>(
        `SELECT b.id, b.amount
         FROM bids b
         LEFT JOIN bid_retractions br ON br.bid_id = b.id
         WHERE b.lot_id = $1 AND b.id != $2 AND br.id IS NULL
         ORDER BY b.amount DESC
         LIMIT 1`,
        [bid.lot_id, bidId],
      );

      if (nextHighestResult.rows.length > 0) {
        const nextWinner = nextHighestResult.rows[0];
        await client.query(`UPDATE bids SET is_winning = true WHERE id = $1`, [nextWinner.id]);
        newWinningAmount = nextWinner.amount;
        newWinnerId = nextWinner.id;
      }
    }

    await client.query('COMMIT');

    // Audit log (non-critical)
    await logCreate(
      'bid_retractions',
      bidId,
      {
        bidId,
        reason: reason.trim(),
        retractedByAdminId: adminId,
        wasWinning: bid.is_winning,
        newWinnerId,
      },
      adminId,
      'admin',
    ).catch(() => {});

    // Emit real-time event if bid was winning so clients update their view
    if (bid.is_winning) {
      emitBid(bid.auction_id, {
        lotId: bid.lot_id,
        auctionId: bid.auction_id,
        amount: newWinningAmount,
        isWinning: true,
        timestamp: new Date().toISOString(),
        nextMinBid: getNextMinBid(newWinningAmount),
      });
    }

    return {
      retracted: true,
      newWinningAmount,
    };
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw error;
  } finally {
    client.release();
  }
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export interface LotWithBidSummary {
  id: string;
  lotNumber: number;
  title: string;
  artist: string;
  status: string;
  startingBid: number | null;
  estimateMin: number;
  estimateMax: number;
  currentHighestBid: number;
  nextMinBid: number;
  bidCount: number;
}

export async function getAuctionLotsWithBidSummary(
  auctionId: string,
): Promise<LotWithBidSummary[]> {
  const rows = await db.execute(sql`
    SELECT
      l.id,
      l.lot_number AS "lotNumber",
      l.title,
      l.artist,
      l.status,
      l.starting_bid AS "startingBid",
      l.estimate_min AS "estimateMin",
      l.estimate_max AS "estimateMax",
      COALESCE(MAX(CASE WHEN br.id IS NULL THEN b.amount END), 0) AS "currentHighestBid",
      COUNT(b.id)::int AS "bidCount"
    FROM lots l
    LEFT JOIN bids b ON b.lot_id = l.id
    LEFT JOIN bid_retractions br ON br.bid_id = b.id
    WHERE l.auction_id = ${auctionId} AND l.deleted_at IS NULL
    GROUP BY l.id
    ORDER BY l.sort_order ASC, l.lot_number ASC
  `);

  type Row = {
    id: string;
    lotNumber: number;
    title: string;
    artist: string;
    status: string;
    startingBid: number | null;
    estimateMin: number;
    estimateMax: number;
    currentHighestBid: number;
    bidCount: number;
  };

  return (rows.rows as Row[]).map((r) => ({
    ...r,
    currentHighestBid: Number(r.currentHighestBid),
    nextMinBid:
      Number(r.currentHighestBid) === 0
        ? (r.startingBid ?? getNextMinBid(0))
        : getNextMinBid(Number(r.currentHighestBid)),
  }));
}

export interface AdminBidRow {
  id: string;
  amount: number;
  bidType: string;
  paddleNumber: number | null;
  isWinning: boolean;
  createdAt: string;
  userName: string | null;
  userEmail: string | null;
  isRetracted: boolean;
  retractionReason: string | null;
}

export async function getLotBidHistory(lotId: string): Promise<{
  bids: AdminBidRow[];
  currentHighestBid: number;
  nextMinBid: number;
}> {
  type BidHistoryRow = {
    id: string;
    amount: number;
    bidType: string;
    paddleNumber: number | null;
    isWinning: boolean;
    createdAt: string;
    userName: string | null;
    userEmail: string | null;
    isRetracted: boolean;
    retractionReason: string | null;
  };

  const result = await db.execute(sql`
    SELECT
      b.id,
      b.amount,
      b.bid_type AS "bidType",
      b.paddle_number AS "paddleNumber",
      b.is_winning AS "isWinning",
      b.created_at AS "createdAt",
      u.name AS "userName",
      u.email AS "userEmail",
      (br.id IS NOT NULL) AS "isRetracted",
      br.reason AS "retractionReason"
    FROM bids b
    LEFT JOIN users u ON u.id = b.user_id
    LEFT JOIN bid_retractions br ON br.bid_id = b.id
    WHERE b.lot_id = ${lotId}
    ORDER BY b.created_at DESC
  `);

  const bidRows = result.rows as BidHistoryRow[];
  const highest = bidRows.find((b) => !b.isRetracted);
  const currentHighestBid = highest ? Number(highest.amount) : 0;

  return {
    bids: bidRows.map((b) => ({ ...b, amount: Number(b.amount) })),
    currentHighestBid,
    nextMinBid: getNextMinBid(currentHighestBid),
  };
}
