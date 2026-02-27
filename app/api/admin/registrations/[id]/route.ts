import { NextRequest, NextResponse } from 'next/server';
import { eq, max } from 'drizzle-orm';
import { db } from '@/db/connection';
import { bidRegistrations, users, auctions } from '@/db/schema';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { logUpdate } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';

type RouteParams = { params: Promise<{ id: string }> };

// ─── GET /api/admin/registrations/[id] ───────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: RouteParams,
) {
  try {
    await requireAdmin('registrations:manage');
    const { id } = await params;

    const [row] = await db
      .select({
        id: bidRegistrations.id,
        userId: bidRegistrations.userId,
        auctionId: bidRegistrations.auctionId,
        userName: users.name,
        userEmail: users.email,
        paddleNumber: bidRegistrations.paddleNumber,
        isApproved: bidRegistrations.isApproved,
        approvedBy: bidRegistrations.approvedBy,
        approvedAt: bidRegistrations.approvedAt,
        depositPaid: bidRegistrations.depositPaid,
        notes: bidRegistrations.notes,
        createdAt: bidRegistrations.createdAt,
      })
      .from(bidRegistrations)
      .innerJoin(users, eq(users.id, bidRegistrations.userId))
      .where(eq(bidRegistrations.id, id))
      .limit(1);

    if (!row) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    const status: 'pending' | 'approved' | 'rejected' = row.isApproved
      ? 'approved'
      : row.approvedBy !== null
        ? 'rejected'
        : 'pending';

    return NextResponse.json({ registration: { ...row, status } });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('[registration] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PATCH /api/admin/registrations/[id] ─────────────────────────────────────
// Body: { action: 'approve' | 'reject', notes?: string }

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams,
) {
  try {
    const admin = await requireAdmin('registrations:manage');
    const { id } = await params;

    const body = await request.json().catch(() => ({}));
    const action: string | undefined = typeof body.action === 'string' ? body.action : undefined;
    const notes: string | undefined = typeof body.notes === 'string' ? body.notes.trim() : undefined;

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject".' },
        { status: 400 },
      );
    }

    // Fetch existing registration
    const [existing] = await db
      .select()
      .from(bidRegistrations)
      .where(eq(bidRegistrations.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 });
    }

    // Fetch auction title for notification
    const [auction] = await db
      .select({ title: auctions.title, slug: auctions.slug })
      .from(auctions)
      .where(eq(auctions.id, existing.auctionId))
      .limit(1);

    const now = new Date();

    if (action === 'approve') {
      if (existing.isApproved) {
        return NextResponse.json({ error: 'Registration is already approved' }, { status: 409 });
      }

      // Auto-assign next paddle number for this auction
      const [maxRow] = await db
        .select({ maxPaddle: max(bidRegistrations.paddleNumber) })
        .from(bidRegistrations)
        .where(eq(bidRegistrations.auctionId, existing.auctionId));

      const nextPaddle = (maxRow?.maxPaddle ?? 0) + 1;

      const [updated] = await db
        .update(bidRegistrations)
        .set({
          isApproved: true,
          approvedBy: admin.id,
          approvedAt: now,
          paddleNumber: nextPaddle,
          ...(notes !== undefined && { notes }),
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

      if (auction) {
        createNotification(
          existing.userId,
          'registration_approved',
          'Registration Approved',
          `Your registration for "${auction.title}" has been approved. Your paddle number is #${nextPaddle}.`,
          { auctionId: existing.auctionId, auctionTitle: auction.title, paddleNumber: nextPaddle },
        ).catch((err) => console.error('[registration] Notification error:', err));
      }

      return NextResponse.json({ registration: updated, paddleNumber: nextPaddle });
    }

    // action === 'reject'
    if (existing.isApproved) {
      return NextResponse.json({ error: 'Cannot reject an already approved registration' }, { status: 409 });
    }
    if (existing.approvedBy !== null) {
      return NextResponse.json({ error: 'Registration has already been rejected' }, { status: 409 });
    }

    const [updated] = await db
      .update(bidRegistrations)
      .set({
        isApproved: false,
        approvedBy: admin.id,
        approvedAt: now,
        notes: notes ?? existing.notes ?? '',
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

    if (auction) {
      createNotification(
        existing.userId,
        'registration_rejected',
        'Registration Not Approved',
        `Your registration for "${auction.title}" was not approved.${notes ? ` Reason: ${notes}` : ''}`,
        { auctionId: existing.auctionId, auctionTitle: auction.title, rejectionReason: notes },
      ).catch((err) => console.error('[registration] Notification error:', err));
    }

    return NextResponse.json({ registration: updated });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('[registration] PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
