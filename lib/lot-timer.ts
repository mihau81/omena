/**
 * Lot timer management — controls the countdown clock for timed online bidding.
 *
 * Each lot has a `closingAt` timestamp in the DB. The timer is not held in
 * memory; any process can read the remaining time from the database. SSE
 * clients receive timer events (start / extend / expired) via bid-events.ts.
 *
 * Anti-sniping: bid-service calls extendLotTimer() when a bid arrives within
 * the last 30 s, extending the window by 30 s. This is common practice in
 * online art auctions to replicate the organic "going once, going twice" rhythm.
 *
 * checkExpiredLots() has a process-level debounce guard (15 s) so that multiple
 * concurrent SSE connections on the same Node process don't each trigger a
 * full table scan on every heartbeat tick.
 */
import { eq, and, isNull, lt } from 'drizzle-orm';
import { db } from '@/db/connection';
import { lots, bids, bidRetractions, auctions } from '@/db/schema';
import { emitTimerEvent } from '@/lib/bid-events';
import { createNotification } from '@/lib/notifications';
import { generateInvoice } from '@/lib/invoice-service';

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
    .select({ id: bids.id, userId: bids.userId, amount: bids.amount })
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

  // 'passed' = lot did not sell (no bids or all retracted); 'sold' = hammer falls.
  // closingAt is cleared so the lot no longer appears as an active countdown.
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

  // When sold, send lot_won notification and queue invoice generation
  if (result === 'sold' && winningBid?.userId) {
    notifyWinnerAndQueueInvoice(lotId, auctionId, winningBid.userId, winningBid.amount).catch(
      () => {},
    );

    generateInvoice(lotId).catch(
      (err) => console.warn('[lot-timer] Invoice generation failed for lot', lotId, err),
    );
  }

  return true;
}

async function notifyWinnerAndQueueInvoice(
  lotId: string,
  auctionId: string,
  userId: string,
  hammerPrice: number,
): Promise<void> {
  const [[lotRow], [auctionRow]] = await Promise.all([
    db.select({ title: lots.title }).from(lots).where(eq(lots.id, lotId)).limit(1),
    db.select({ buyersPremiumRate: auctions.buyersPremiumRate }).from(auctions).where(eq(auctions.id, auctionId)).limit(1),
  ]);

  const rate = auctionRow?.buyersPremiumRate
    ? parseFloat(String(auctionRow.buyersPremiumRate))
    : 0.20;

  const buyersPremium = Math.round(hammerPrice * rate * 100) / 100;
  const totalAmount = hammerPrice + buyersPremium;
  const lotTitle = lotRow?.title ?? 'Lot';

  await createNotification(
    userId,
    'lot_won',
    'Gratulacje — wygrałeś lot!',
    `Wygrałeś lot "${lotTitle}". Faktura zostanie wysłana wkrótce.`,
    {
      lotId,
      auctionId,
      lotTitle,
      hammerPrice,
      buyersPremium,
      totalAmount,
    },
  );
}

// ─── Check All Expired Lots ─────────────────────────────────────────────────

// In-process debounce: each SSE connection calls checkExpiredLots() on every
// heartbeat. Without this guard, 50 concurrent connections would issue 50
// identical DB scans per tick. The 15 s window is intentionally shorter than
// the minimum lot timer duration so no lot closes undetected.
let lastExpiredCheck = 0;
/** @internal — reset guard for tests */
export function _resetExpiredCheckGuard() { lastExpiredCheck = 0; }

export async function checkExpiredLots(): Promise<void> {
  const ts = Date.now();
  if (ts - lastExpiredCheck < 15_000) return;
  lastExpiredCheck = ts;
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
