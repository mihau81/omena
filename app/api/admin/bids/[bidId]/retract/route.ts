import { NextResponse } from 'next/server';
import { pool } from '@/db/connection';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { logCreate } from '@/lib/audit';
import { emitBid } from '@/lib/bid-events';
import { getNextMinBid } from '@/app/lib/bidding';

// ─── POST: Retract a bid (admin only) ───────────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ bidId: string }> },
) {
  try {
    const admin = await requireAdmin('bids:retract');
    const { bidId } = await params;

    const body = await request.json();
    const { reason } = body;

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return NextResponse.json({ error: 'Reason is required' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Load the bid + lot info
      const bidResult = await client.query(
        `SELECT b.id, b.lot_id, b.amount, b.is_winning,
                l.auction_id
         FROM bids b
         INNER JOIN lots l ON l.id = b.lot_id
         WHERE b.id = $1`,
        [bidId],
      );

      if (bidResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'Bid not found' }, { status: 404 });
      }

      const bid = bidResult.rows[0];

      // Check not already retracted
      const existingRetraction = await client.query(
        `SELECT id FROM bid_retractions WHERE bid_id = $1`,
        [bidId],
      );

      if (existingRetraction.rows.length > 0) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'Bid is already retracted' }, { status: 409 });
      }

      // Create the retraction record
      await client.query(
        `INSERT INTO bid_retractions (bid_id, reason, retracted_by)
         VALUES ($1, $2, $3)`,
        [bidId, reason.trim(), admin.id],
      );

      let newWinningAmount = 0;
      let newWinnerId: string | null = null;

      if (bid.is_winning) {
        // Mark this bid as not winning
        await client.query(`UPDATE bids SET is_winning = false WHERE id = $1`, [bidId]);

        // Find the next highest non-retracted bid for this lot
        const nextHighestResult = await client.query(
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
          retractedByAdminId: admin.id,
          wasWinning: bid.is_winning,
          newWinnerId,
        },
        admin.id,
        'admin',
      ).catch(() => {});

      // Emit real-time event if bid was winning (so clients update)
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

      return NextResponse.json({ success: true, newWinningAmount });
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
    console.error('Admin bid retract POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
