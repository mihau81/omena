import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/connection';
import { auctions } from '@/db/schema';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { reorderAuctionsSchema } from '@/lib/validation/auction';

// ─── POST: Bulk reorder auctions ─────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    await requireAdmin('auctions:write');

    const body = await request.json();
    const parsed = reorderAuctionsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { items } = parsed.data;
    const now = new Date();

    // Update all sort orders in sequence (pg doesn't have bulk update with different values easily)
    await db.transaction(async (tx) => {
      for (const item of items) {
        await tx
          .update(auctions)
          .set({ sortOrder: item.sortOrder, updatedAt: now })
          .where(eq(auctions.id, item.id));
      }
    });

    return NextResponse.json({ success: true, updated: items.length });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Admin auctions reorder error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
