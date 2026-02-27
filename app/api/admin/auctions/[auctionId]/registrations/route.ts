import { NextRequest, NextResponse } from 'next/server';
import { eq, desc, isNull, and, max } from 'drizzle-orm';
import { db } from '@/db/connection';
import { bidRegistrations, users, auctions } from '@/db/schema';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { logUpdate } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';

type RouteParams = { params: Promise<{ auctionId: string }> };

// ─── GET /api/admin/auctions/[auctionId]/registrations ───────────────────────
// Optional query param: ?status=pending|approved|rejected

export async function GET(
  request: NextRequest,
  { params }: RouteParams,
) {
  try {
    await requireAdmin('registrations:manage');
    const { auctionId } = await params;

    const statusFilter = request.nextUrl.searchParams.get('status') as
      | 'pending'
      | 'approved'
      | 'rejected'
      | null;

    // Verify auction exists
    const [auction] = await db
      .select({ id: auctions.id, title: auctions.title })
      .from(auctions)
      .where(and(eq(auctions.id, auctionId), isNull(auctions.deletedAt)))
      .limit(1);

    if (!auction) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
    }

    const rows = await db
      .select({
        id: bidRegistrations.id,
        userId: bidRegistrations.userId,
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
      .where(eq(bidRegistrations.auctionId, auctionId))
      .orderBy(desc(bidRegistrations.createdAt));

    // Derive status from fields
    const allRegistrations = rows.map((r) => ({
      ...r,
      status: (r.isApproved
        ? 'approved'
        : r.approvedBy !== null
          ? 'rejected'
          : 'pending') as 'pending' | 'approved' | 'rejected',
    }));

    // Apply status filter if provided
    const registrations =
      statusFilter && ['pending', 'approved', 'rejected'].includes(statusFilter)
        ? allRegistrations.filter((r) => r.status === statusFilter)
        : allRegistrations;

    return NextResponse.json({ auction, registrations });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('[registrations] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PATCH /api/admin/auctions/[auctionId]/registrations ─────────────────────
// Body: { action: 'bulk_approve', ids: string[] }

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams,
) {
  try {
    const admin = await requireAdmin('registrations:manage');
    const { auctionId } = await params;

    const body = await request.json().catch(() => ({}));
    const { action, ids } = body as { action?: string; ids?: string[] };

    if (action !== 'bulk_approve') {
      return NextResponse.json({ error: 'Invalid action. Only "bulk_approve" is supported.' }, { status: 400 });
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'ids must be a non-empty array' }, { status: 400 });
    }

    // Verify auction exists
    const [auction] = await db
      .select({ id: auctions.id, title: auctions.title })
      .from(auctions)
      .where(and(eq(auctions.id, auctionId), isNull(auctions.deletedAt)))
      .limit(1);

    if (!auction) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
    }

    // Fetch all pending registrations that are in the provided ids
    const pending = await db
      .select()
      .from(bidRegistrations)
      .where(and(eq(bidRegistrations.auctionId, auctionId), eq(bidRegistrations.isApproved, false)));

    const toApprove = pending.filter(
      (r) => ids.includes(r.id) && r.approvedBy === null,
    );

    if (toApprove.length === 0) {
      return NextResponse.json({ approved: 0, skipped: ids.length });
    }

    const now = new Date();
    const results: { id: string; paddleNumber: number }[] = [];

    for (const reg of toApprove) {
      // Get current max paddle for this auction (re-query each iteration to avoid race)
      const [maxRow] = await db
        .select({ maxPaddle: max(bidRegistrations.paddleNumber) })
        .from(bidRegistrations)
        .where(eq(bidRegistrations.auctionId, auctionId));

      const nextPaddle = (maxRow?.maxPaddle ?? 0) + 1;

      const [updated] = await db
        .update(bidRegistrations)
        .set({
          isApproved: true,
          approvedBy: admin.id,
          approvedAt: now,
          paddleNumber: nextPaddle,
        })
        .where(eq(bidRegistrations.id, reg.id))
        .returning();

      await logUpdate(
        'bid_registrations',
        reg.id,
        reg as unknown as Record<string, unknown>,
        updated as unknown as Record<string, unknown>,
        admin.id,
        'admin',
      );

      // Non-blocking notification
      createNotification(
        reg.userId,
        'registration_approved',
        'Registration Approved',
        `Your registration for "${auction.title}" has been approved. Your paddle number is #${nextPaddle}.`,
        { auctionId, auctionTitle: auction.title, paddleNumber: nextPaddle },
      ).catch((err) => console.error('[registrations] Notification error:', err));

      results.push({ id: reg.id, paddleNumber: nextPaddle });
    }

    return NextResponse.json({
      approved: results.length,
      skipped: ids.length - results.length,
      results,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('[registrations] bulk_approve PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
