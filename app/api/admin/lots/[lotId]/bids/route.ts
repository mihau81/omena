import { NextResponse } from 'next/server';
import { eq, and, desc, isNull, sql } from 'drizzle-orm';
import { db, pool } from '@/db/connection';
import { bids, bidRetractions, lots, users } from '@/db/schema';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { getNextMinBid } from '@/app/lib/bidding';
import { logCreate } from '@/lib/audit';
import { emitBid } from '@/lib/bid-events';

// ─── GET: Full bid history with user names (admin, not anonymized) ──────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lotId: string }> },
) {
  try {
    await requireAdmin('bids:enter');
    const { lotId } = await params;

    const [lot] = await db
      .select({ id: lots.id, title: lots.title })
      .from(lots)
      .where(and(eq(lots.id, lotId), isNull(lots.deletedAt)))
      .limit(1);

    if (!lot) {
      return NextResponse.json({ error: 'Lot not found' }, { status: 404 });
    }

    const bidHistory = await db
      .select({
        id: bids.id,
        amount: bids.amount,
        bidType: bids.bidType,
        paddleNumber: bids.paddleNumber,
        isWinning: bids.isWinning,
        createdAt: bids.createdAt,
        userName: users.name,
        userEmail: users.email,
        isRetracted: sql<boolean>`${bidRetractions.id} IS NOT NULL`,
        retractionReason: bidRetractions.reason,
      })
      .from(bids)
      .leftJoin(users, eq(users.id, bids.userId))
      .leftJoin(bidRetractions, eq(bidRetractions.bidId, bids.id))
      .where(eq(bids.lotId, lotId))
      .orderBy(desc(bids.createdAt));

    // Calculate nextMinBid from highest non-retracted bid
    const highestNonRetracted = bidHistory.find((b) => !b.isRetracted);
    const highestAmount = highestNonRetracted?.amount ?? 0;
    const nextMinBid = getNextMinBid(highestAmount);

    return NextResponse.json({ bids: bidHistory, nextMinBid, currentHighestBid: highestAmount });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Admin lot bids GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST: Enter phone/floor bid on behalf of a client ──────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ lotId: string }> },
) {
  try {
    const admin = await requireAdmin('bids:enter');
    const { lotId } = await params;

    const body = await request.json();
    const { amount, bidType, paddleNumber } = body;

    if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invalid bid amount' }, { status: 400 });
    }
    if (!['phone', 'floor'].includes(bidType)) {
      return NextResponse.json({ error: "bidType must be 'phone' or 'floor'" }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Advisory lock on lot to prevent race conditions
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [lotId]);

      // Check lot exists
      const lotResult = await client.query(
        `SELECT l.id, l.starting_bid, a.id AS auction_id
         FROM lots l
         INNER JOIN auctions a ON a.id = l.auction_id
         WHERE l.id = $1 AND l.deleted_at IS NULL`,
        [lotId],
      );

      if (lotResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'Lot not found' }, { status: 404 });
      }

      const lotRow = lotResult.rows[0];

      // Get current highest non-retracted bid
      const highestResult = await client.query(
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
        return NextResponse.json(
          { error: `Bid must be at least ${minBid} PLN`, minBid },
          { status: 400 },
        );
      }

      // Mark previous winning bid as not winning
      if (highestResult.rows.length > 0) {
        await client.query(
          `UPDATE bids SET is_winning = false WHERE lot_id = $1 AND is_winning = true`,
          [lotId],
        );
      }

      // Insert the bid (userId = NULL for phone/floor)
      const insertResult = await client.query(
        `INSERT INTO bids (lot_id, user_id, registration_id, amount, bid_type, paddle_number, is_winning)
         VALUES ($1, NULL, NULL, $2, $3, $4, true)
         RETURNING id, lot_id, amount, bid_type, is_winning, created_at`,
        [lotId, amount, bidType, paddleNumber ?? null],
      );

      const newBid = insertResult.rows[0];
      await client.query('COMMIT');

      // Audit log (non-critical)
      await logCreate(
        'bids',
        newBid.id,
        { lotId, amount, bidType, paddleNumber: paddleNumber ?? null, enteredByAdminId: admin.id },
        admin.id,
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

      return NextResponse.json(
        {
          bid: {
            id: newBid.id,
            lotId: newBid.lot_id,
            amount: newBid.amount,
            bidType: newBid.bid_type,
            isWinning: newBid.is_winning,
            createdAt: newBid.created_at,
          },
          nextMinBid: getNextMinBid(amount),
        },
        { status: 201 },
      );
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Admin lot bids POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
