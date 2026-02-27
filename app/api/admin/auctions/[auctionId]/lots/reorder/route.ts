import { NextResponse } from 'next/server';
import { eq, and, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/connection';
import { lots, auctions } from '@/db/schema';
import { requireAdmin, AuthError } from '@/lib/auth-utils';

const reorderLotsSchema = z.object({
  items: z.array(z.object({
    id: z.string().uuid(),
    sortOrder: z.number().int().min(0),
  })).min(1),
});

// ─── POST: Bulk reorder lots within an auction ───────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ auctionId: string }> },
) {
  try {
    await requireAdmin('lots:order');
    const { auctionId } = await params;

    // Verify auction exists
    const [auction] = await db
      .select({ id: auctions.id })
      .from(auctions)
      .where(and(eq(auctions.id, auctionId), isNull(auctions.deletedAt)))
      .limit(1);

    if (!auction) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = reorderLotsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { items } = parsed.data;

    await db.transaction(async (tx) => {
      for (const item of items) {
        await tx
          .update(lots)
          .set({ sortOrder: item.sortOrder, updatedAt: new Date() })
          .where(and(eq(lots.id, item.id), eq(lots.auctionId, auctionId), isNull(lots.deletedAt)));
      }
    });

    return NextResponse.json({ success: true, updated: items.length });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Admin lots reorder error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
