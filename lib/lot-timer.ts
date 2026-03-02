import { eq, and, isNull, lt } from 'drizzle-orm';
import { db } from '@/db/connection';
import { lots, bids, bidRetractions } from '@/db/schema';
import { emitTimerEvent } from '@/lib/bid-events';

// ─── Start Timer ─────────────────────────────────────────────────────────────

export async function startLotTimer(
  lotId: string,
  durationSeconds: number,
): Promise<Date> {
  const closingAt = new Date(Date.now() + durationSeconds * 1000);

  const [updated] = await db
    .update(lots)
    .set({
      closingAt,
      timerDuration: durationSeconds,
      updatedAt: new Date(),
    })
    .where(and(eq(lots.id, lotId), isNull(lots.deletedAt)))
    .returning({ auctionId: lots.auctionId });

  if (updated) {
    emitTimerEvent(updated.auctionId, {
      type: 'lot:timer:start',
      lotId,
      closingAt: closingAt.toISOString(),
      durationSeconds,
    });
  }

  return closingAt;
}

// ─── Extend Timer (anti-sniping) ─────────────────────────────────────────────

export async function extendLotTimer(
  lotId: string,
  extensionSeconds = 30,
): Promise<Date | null> {
  const [lot] = await db
    .select({ closingAt: lots.closingAt, auctionId: lots.auctionId })
    .from(lots)
    .where(and(eq(lots.id, lotId), isNull(lots.deletedAt)))
    .limit(1);

  if (!lot?.closingAt) return null;

  const newClosingAt = new Date(lot.closingAt.getTime() + extensionSeconds * 1000);

  await db
    .update(lots)
    .set({ closingAt: newClosingAt, updatedAt: new Date() })
    .where(eq(lots.id, lotId));

  emitTimerEvent(lot.auctionId, {
    type: 'lot:timer:extend',
    lotId,
    newClosingAt: newClosingAt.toISOString(),
    reason: 'anti-sniping',
  });

  return newClosingAt;
}

// ─── Stop Timer ──────────────────────────────────────────────────────────────

export async function stopLotTimer(lotId: string): Promise<void> {
  const [updated] = await db
    .update(lots)
    .set({ closingAt: null, updatedAt: new Date() })
    .where(and(eq(lots.id, lotId), isNull(lots.deletedAt)))
    .returning({ auctionId: lots.auctionId });

  if (updated) {
    emitTimerEvent(updated.auctionId, {
      type: 'lot:timer:stopped',
      lotId,
    });
  }
}

// ─── Check Expired ───────────────────────────────────────────────────────────

export async function checkLotExpired(lotId: string): Promise<boolean> {
  const [lot] = await db
    .select({ closingAt: lots.closingAt, status: lots.status, auctionId: lots.auctionId })
    .from(lots)
    .where(and(eq(lots.id, lotId), isNull(lots.deletedAt)))
    .limit(1);

  if (!lot || !lot.closingAt || lot.status !== 'active') return false;
  if (lot.closingAt > new Date()) return false;

  return closeLot(lotId, lot.auctionId);
}

// ─── Close Lot (internal) ────────────────────────────────────────────────────

async function closeLot(lotId: string, auctionId: string): Promise<boolean> {
  const [winningBid] = await db
    .select({ id: bids.id, amount: bids.amount })
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

  const result = winningBid ? 'sold' : 'passed';

  await db
    .update(lots)
    .set({
      status: result,
      closingAt: null,
      hammerPrice: winningBid ? winningBid.amount : null,
      updatedAt: new Date(),
    })
    .where(eq(lots.id, lotId));

  emitTimerEvent(auctionId, {
    type: 'lot:timer:expired',
    lotId,
    result,
  });

  return true;
}

// ─── Check All Expired Lots ─────────────────────────────────────────────────

export async function checkExpiredLots(): Promise<void> {
  const now = new Date();

  const expiredLots = await db
    .select({ id: lots.id, auctionId: lots.auctionId })
    .from(lots)
    .where(
      and(
        eq(lots.status, 'active'),
        isNull(lots.deletedAt),
        lt(lots.closingAt, now),
      ),
    );

  await Promise.allSettled(
    expiredLots.map((lot) => closeLot(lot.id, lot.auctionId)),
  );
}
