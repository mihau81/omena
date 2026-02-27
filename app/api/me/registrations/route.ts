import { NextResponse } from 'next/server';
import { eq, desc, isNull, and } from 'drizzle-orm';
import { db } from '@/db/connection';
import { bidRegistrations, auctions } from '@/db/schema';
import { requireAuth, AuthError } from '@/lib/auth-utils';

// ─── GET /api/me/registrations ───────────────────────────────────────────────

export async function GET() {
  try {
    const user = await requireAuth();

    if (user.userType !== 'user') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rows = await db
      .select({
        id: bidRegistrations.id,
        auctionId: bidRegistrations.auctionId,
        auctionTitle: auctions.title,
        auctionSlug: auctions.slug,
        auctionStartDate: auctions.startDate,
        paddleNumber: bidRegistrations.paddleNumber,
        isApproved: bidRegistrations.isApproved,
        approvedBy: bidRegistrations.approvedBy,
        approvedAt: bidRegistrations.approvedAt,
        depositPaid: bidRegistrations.depositPaid,
        notes: bidRegistrations.notes,
        createdAt: bidRegistrations.createdAt,
      })
      .from(bidRegistrations)
      .innerJoin(auctions, and(eq(auctions.id, bidRegistrations.auctionId), isNull(auctions.deletedAt)))
      .where(eq(bidRegistrations.userId, user.id))
      .orderBy(desc(bidRegistrations.createdAt));

    const registrations = rows.map((r) => ({
      id: r.id,
      auctionId: r.auctionId,
      auctionTitle: r.auctionTitle,
      auctionSlug: r.auctionSlug,
      auctionStartDate: r.auctionStartDate,
      paddleNumber: r.isApproved ? r.paddleNumber : null,
      depositPaid: r.depositPaid,
      approvedAt: r.approvedAt,
      notes: r.isApproved ? null : (r.approvedBy !== null ? r.notes : null), // show rejection reason only
      createdAt: r.createdAt,
      status: r.isApproved
        ? 'approved'
        : r.approvedBy !== null
          ? 'rejected'
          : 'pending',
    }));

    return NextResponse.json({ registrations });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('[me/registrations] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
