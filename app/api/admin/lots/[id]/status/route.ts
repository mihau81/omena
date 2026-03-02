import { NextResponse } from 'next/server';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@/db/connection';
import { lots, auctions } from '@/db/schema';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { updateLotStatusSchema } from '@/lib/validation/lot';
import { logUpdate } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';
import { getWinningBid } from '@/lib/bid-service';

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['catalogued'],
  catalogued: ['published', 'draft'],
  published: ['active', 'catalogued', 'withdrawn'],
  active: ['sold', 'passed', 'withdrawn'],
  sold: [],
  passed: ['active'],
  withdrawn: [],
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin('lots:write');
    const { id } = await params;

    const body = await request.json();
    const parsed = updateLotStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const [existing] = await db
      .select()
      .from(lots)
      .where(and(eq(lots.id, id), isNull(lots.deletedAt)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Lot not found' }, { status: 404 });
    }

    const newStatus = parsed.data.status;
    const allowed = VALID_TRANSITIONS[existing.status] ?? [];

    if (!allowed.includes(newStatus)) {
      return NextResponse.json(
        { error: `Cannot transition from '${existing.status}' to '${newStatus}'` },
        { status: 400 },
      );
    }

    const [updated] = await db
      .update(lots)
      .set({
        status: newStatus,
        updatedAt: new Date(),
        updatedBy: admin.id,
      })
      .where(eq(lots.id, id))
      .returning();

    await logUpdate(
      'lots',
      id,
      existing as unknown as Record<string, unknown>,
      updated as unknown as Record<string, unknown>,
      admin.id,
      'admin',
    );

    // When lot is sold, notify the winning bidder
    if (newStatus === 'sold') {
      notifyLotWon(id, existing.title, existing.auctionId, existing.hammerPrice).catch(
        (err) => console.warn('[lot/status] lot_won notification failed:', err),
      );
    }

    return NextResponse.json({ lot: updated });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Admin lot status PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function notifyLotWon(
  lotId: string,
  lotTitle: string,
  auctionId: string,
  hammerPrice: number | null,
): Promise<void> {
  const winning = await getWinningBid(lotId);
  if (!winning || !winning.userId) return;

  const [auctionRow] = await db
    .select({ buyersPremiumRate: auctions.buyersPremiumRate })
    .from(auctions)
    .where(eq(auctions.id, auctionId))
    .limit(1);

  const rate = auctionRow?.buyersPremiumRate
    ? parseFloat(String(auctionRow.buyersPremiumRate))
    : 0.20;

  const hammer = hammerPrice ?? winning.amount;
  const buyersPremium = Math.round(hammer * rate * 100) / 100;
  const totalAmount = hammer + buyersPremium;

  await createNotification(
    winning.userId,
    'lot_won',
    'Gratulacje — wygrałeś lot!',
    `Wygrałeś lot "${lotTitle}". Faktura zostanie wysłana wkrótce.`,
    {
      lotId,
      auctionId,
      lotTitle,
      hammerPrice: hammer,
      buyersPremium,
      totalAmount,
    },
  );
}
