import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/connection';
import { bidRegistrations, auctions } from '@/db/schema';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { logUpdate } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';

// ─── PATCH /api/admin/registrations/[id]/reject ───────────────────────────────

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin('registrations:manage');
    const { id } = await params;

    const body = await request.json().catch(() => ({}));
    const reason: string | undefined = typeof body.reason === 'string' ? body.reason.trim() : undefined;

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
      return NextResponse.json({ error: 'Cannot reject an already approved registration' }, { status: 409 });
    }

    // Already rejected (approvedBy set but isApproved false)
    if (existing.approvedBy !== null) {
      return NextResponse.json({ error: 'Registration has already been rejected' }, { status: 409 });
    }

    const now = new Date();

    // Mark rejected: isApproved stays false, but approvedBy+approvedAt set to distinguish from pending
    const [updated] = await db
      .update(bidRegistrations)
      .set({
        isApproved: false,
        approvedBy: admin.id,
        approvedAt: now,
        notes: reason ?? existing.notes ?? '',
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
      .select({ title: auctions.title })
      .from(auctions)
      .where(eq(auctions.id, existing.auctionId))
      .limit(1);

    if (auction) {
      const auctionTitle = auction.title;

      createNotification(
        existing.userId,
        'registration_rejected',
        'Registration Not Approved',
        `Your registration for "${auctionTitle}" was not approved.${reason ? ` Reason: ${reason}` : ''}`,
        { auctionId: existing.auctionId, auctionTitle, rejectionReason: reason },
      ).catch((err) => console.error('[registrations] Notification error:', err));
    }

    return NextResponse.json({ registration: updated });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('[registrations] reject PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
