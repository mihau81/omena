import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth-utils';
import { AuthError } from '@/lib/auth-utils';
import { placeBid, getBidHistory, BidError } from '@/lib/bid-service';
import { bidLimiter } from '@/lib/rate-limiters';
import { getNextMinBid } from '@/app/lib/bidding';

const bidAmountSchema = z.object({
  amount: z.number().int().positive('Bid amount must be positive'),
});

// ─── POST: Place a bid on a lot ─────────────────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: lotId } = await params;

    // 1. Authenticate
    const user = await requireAuth();

    if (user.userType !== 'user') {
      return NextResponse.json(
        { error: 'Only registered users can place bids' },
        { status: 403 },
      );
    }

    // 2. Rate limit: 1 bid per lot per 3 seconds per user
    const rateLimitKey = `${user.id}:${lotId}`;
    const rl = bidLimiter.check(rateLimitKey);
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many bids. Please wait a few seconds.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetMs / 1000)) } },
      );
    }

    // 3. Parse and validate body
    const body = await request.json();
    const parsed = bidAmountSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // 4. Extract request metadata
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || undefined;
    const userAgent = request.headers.get('user-agent') || undefined;

    // 5. Place the bid
    const result = await placeBid(
      lotId,
      user.id,
      parsed.data.amount,
      ipAddress,
      userAgent,
    );

    return NextResponse.json(
      {
        bid: {
          id: result.bid.id,
          amount: result.bid.amount,
          isWinning: result.bid.isWinning,
          createdAt: result.bid.createdAt,
        },
        nextMinBid: result.nextMinBid,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof BidError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode },
      );
    }
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode },
      );
    }
    console.error('Bid placement error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

// ─── GET: Bid history for a lot (public, anonymized) ────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: lotId } = await params;

    const history = await getBidHistory(lotId);

    // Anonymize: only expose paddle number, not user identity
    const anonymized = history.map((row) => ({
      id: row.id,
      amount: row.amount,
      bidType: row.bidType,
      paddleNumber: row.paddleNumber,
      isWinning: row.isWinning,
      createdAt: row.createdAt,
      isRetracted: row.isRetracted,
    }));

    const currentHighest = anonymized.find((b) => b.isWinning && !b.isRetracted);
    const nextMinBid = currentHighest
      ? getNextMinBid(currentHighest.amount)
      : getNextMinBid(0);

    return NextResponse.json({
      bids: anonymized,
      currentHighestBid: currentHighest?.amount ?? null,
      nextMinBid,
      totalBids: anonymized.filter((b) => !b.isRetracted).length,
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
