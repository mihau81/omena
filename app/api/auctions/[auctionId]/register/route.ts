import { NextResponse } from 'next/server';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '@/db/connection';
import { bidRegistrations, auctions } from '@/db/schema';
import { requireAuth, AuthError } from '@/lib/auth-utils';
import { logCreate } from '@/lib/audit';

// ─── POST: Register for an auction ─────────────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ auctionId: string }> },
) {
  try {
    const { auctionId } = await params;

    // 1. Authenticate
    const user = await requireAuth();

    if (user.userType !== 'user') {
      return NextResponse.json(
        { error: 'Only registered users can register for auctions' },
        { status: 403 },
      );
    }

    // 2. Verify auction exists and is in a registrable state
    const [auction] = await db
      .select({ id: auctions.id, status: auctions.status, title: auctions.title })
      .from(auctions)
      .where(eq(auctions.id, auctionId))
      .limit(1);

    if (!auction) {
      return NextResponse.json(
        { error: 'Auction not found' },
        { status: 404 },
      );
    }

    if (auction.status !== 'preview' && auction.status !== 'live') {
      return NextResponse.json(
        { error: 'This auction is not open for registration' },
        { status: 400 },
      );
    }

    // 3. Check if already registered
    const [existing] = await db
      .select({ id: bidRegistrations.id })
      .from(bidRegistrations)
      .where(
        and(
          eq(bidRegistrations.userId, user.id),
          eq(bidRegistrations.auctionId, auctionId),
        ),
      )
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: 'You are already registered for this auction' },
        { status: 409 },
      );
    }

    // 4. Generate next paddle number for this auction
    const [maxPaddle] = await db
      .select({
        maxPaddle: sql<number>`COALESCE(MAX(${bidRegistrations.paddleNumber}), 0)`,
      })
      .from(bidRegistrations)
      .where(eq(bidRegistrations.auctionId, auctionId));

    const nextPaddle = (maxPaddle?.maxPaddle ?? 0) + 1;

    // 5. Create registration (not approved yet)
    const [registration] = await db
      .insert(bidRegistrations)
      .values({
        userId: user.id,
        auctionId,
        paddleNumber: nextPaddle,
        isApproved: false,
      })
      .returning();

    // 6. Audit log
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || undefined;

    await logCreate(
      'bid_registrations',
      registration.id,
      {
        userId: user.id,
        auctionId,
        paddleNumber: nextPaddle,
        isApproved: false,
      },
      user.id,
      'user',
      ipAddress,
    ).catch(() => {
      // Non-critical
    });

    return NextResponse.json(
      {
        registration: {
          id: registration.id,
          auctionId: registration.auctionId,
          paddleNumber: registration.paddleNumber,
          isApproved: registration.isApproved,
          createdAt: registration.createdAt,
        },
        message: 'Registration submitted. Awaiting admin approval.',
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }
    console.error('Auction registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
