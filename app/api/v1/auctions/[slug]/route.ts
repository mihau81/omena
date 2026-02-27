/**
 * GET /api/v1/auctions/:slug
 * Returns a single public auction with lot count.
 * Only returns auctions with visibility_level = '0' and status in (preview|live|archive).
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and, isNull, inArray, count } from 'drizzle-orm';
import { db } from '@/db/connection';
import { auctions, lots } from '@/db/schema';
import { validateApiKey, ApiKeyError } from '@/lib/api-key-auth';

const PUBLIC_STATUSES = ['preview', 'live', 'archive'] as const;

type RouteParams = { params: Promise<{ slug: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await validateApiKey(request);
  } catch (error) {
    if (error instanceof ApiKeyError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
  }

  try {
    const { slug } = await params;

    const rows = await db
      .select({
        id: auctions.id,
        slug: auctions.slug,
        title: auctions.title,
        description: auctions.description,
        category: auctions.category,
        startDate: auctions.startDate,
        endDate: auctions.endDate,
        location: auctions.location,
        curator: auctions.curator,
        status: auctions.status,
        visibilityLevel: auctions.visibilityLevel,
        buyersPremiumRate: auctions.buyersPremiumRate,
        createdAt: auctions.createdAt,
        updatedAt: auctions.updatedAt,
        lotCount: count(lots.id),
      })
      .from(auctions)
      .leftJoin(
        lots,
        and(
          eq(lots.auctionId, auctions.id),
          isNull(lots.deletedAt),
        ),
      )
      .where(
        and(
          eq(auctions.slug, slug),
          eq(auctions.visibilityLevel, '0'),
          isNull(auctions.deletedAt),
          inArray(auctions.status, [...PUBLIC_STATUSES]),
        ),
      )
      .groupBy(auctions.id)
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
    }

    return NextResponse.json({ data: rows[0] });
  } catch (error) {
    console.error('GET /api/v1/auctions/[slug] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
