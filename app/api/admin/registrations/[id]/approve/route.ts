import { NextResponse } from 'next/server';
import { eq, max } from 'drizzle-orm';
import { db } from '@/db/connection';
import { bidRegistrations, auctions, users } from '@/db/schema';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { logUpdate } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';

// ─── PATCH /api/admin/registrations/[id]/approve ─────────────────────────────

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin('registrations:manage');
    const { id } = await params;

    // Fetch registration
    const [existing] = await db
      .select()
      .from(bidRegistrations)
      .where(eq(bidRegistrations.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    if (existing.isApproved) {
      return NextResponse.json({ error: 'Registration is already approved' }, { status: 409 });
    }

    // Auto-assign next paddle number for this auction
    const [maxRow] = await db
      .select({ maxPaddle: max(bidRegistrations.paddleNumber) })
      .from(bidRegistrations)
      .where(eq(bidRegistrations.auctionId, existing.auctionId));

    const nextPaddle = (maxRow?.maxPaddle ?? 0) + 1;

    const now = new Date();

    const [updated] = await db
      .update(bidRegistrations)
      .set({
        isApproved: true,
        approvedBy: admin.id,
        approvedAt: now,
        paddleNumber: nextPaddle,
      })
      .where(eq(bidRegistrations.id, id))
      .returning();

    await logUpdate(
      'bid_registrations',
      id,
      existing as unknown as Record<string, unknown>,
      updated as unknown as Record<string, unknown>,
      admin.id,
      'admin',
    );

    // Fetch auction title for notification
    const [auction] = await db
      .select({ title: auctions.title, slug: auctions.slug })
      .from(auctions)
      .where(eq(auctions.id, existing.auctionId))
      .limit(1);

    if (auction) {
      const auctionTitle = auction.title;
      const paddleNumber = nextPaddle;

      // Non-blocking notification
      createNotification(
        existing.userId,
        'registration_approved',
        'Registration Approved',
        `Your registration for "${auctionTitle}" has been approved. Your paddle number is #${paddleNumber}.`,
        { auctionId: existing.auctionId, auctionTitle, paddleNumber },
      ).catch((err) => console.error('[registrations] Notification error:', err));
    }

    return NextResponse.json({ registration: updated, paddleNumber: nextPaddle });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('[registrations] approve PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
