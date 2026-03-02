import { NextResponse } from 'next/server';
import { eq, desc } from 'drizzle-orm';
import { db } from '@/db/connection';
import { invoices, auctions, lots } from '@/db/schema';
import { requireApprovedUser, AuthError } from '@/lib/auth-utils';

// ─── GET /api/me/invoices ───────────────────────────────────────────────────

export async function GET() {
  try {
    const user = await requireApprovedUser();

    const rows = await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        auctionTitle: auctions.title,
        lotTitle: lots.title,
        lotNumber: lots.lotNumber,
        hammerPrice: invoices.hammerPrice,
        buyersPremium: invoices.buyersPremium,
        totalAmount: invoices.totalAmount,
        status: invoices.status,
        dueDate: invoices.dueDate,
        paidAt: invoices.paidAt,
        createdAt: invoices.createdAt,
      })
      .from(invoices)
      .innerJoin(auctions, eq(auctions.id, invoices.auctionId))
      .innerJoin(lots, eq(lots.id, invoices.lotId))
      .where(eq(invoices.userId, user.id))
      .orderBy(desc(invoices.createdAt));

    return NextResponse.json({ invoices: rows });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('[me/invoices] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
