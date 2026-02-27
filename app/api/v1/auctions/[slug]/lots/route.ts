/**
 * GET /api/v1/auctions/:slug/lots
 * Returns lots for a specific public auction.
 * Only returns lots with effective visibility = '0' (public).
 *
 * Query params:
 *   status   — filter by lot status (published|active|sold|passed), comma-separated
 *   limit    — max results (1–100, default 50)
 *   offset   — pagination offset (default 0)
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and, isNull, inArray, count, asc, isNotNull, lte, or } from 'drizzle-orm';
import { db } from '@/db/connection';
import { auctions, lots, media } from '@/db/schema';
import { validateApiKey, ApiKeyError } from '@/lib/api-key-auth';

const AUCTION_PUBLIC_STATUSES = ['preview', 'live', 'archive'] as const;
const ALLOWED_LOT_STATUSES = ['published', 'active', 'sold', 'passed'] as const;
type AllowedLotStatus = typeof ALLOWED_LOT_STATUSES[number];

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
    const { searchParams } = request.nextUrl;

    // Parse lot status filter
    const statusParam = searchParams.get('status');
    const requestedStatuses: AllowedLotStatus[] = statusParam
      ? statusParam.split(',').map((s) => s.trim()).filter((s): s is AllowedLotStatus =>
          (ALLOWED_LOT_STATUSES as readonly string[]).includes(s),
        )
      : [...ALLOWED_LOT_STATUSES];

    if (requestedStatuses.length === 0) {
      return NextResponse.json(
        { error: `Invalid lot status. Allowed: ${ALLOWED_LOT_STATUSES.join(', ')}` },
        { status: 400 },
      );
    }

    // Parse pagination
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10) || 50));
    const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10) || 0);

    // Verify the auction is public and accessible
    const [auction] = await db
      .select({ id: auctions.id, slug: auctions.slug })
      .from(auctions)
      .where(
        and(
          eq(auctions.slug, slug),
          eq(auctions.visibilityLevel, '0'),
          isNull(auctions.deletedAt),
          inArray(auctions.status, [...AUCTION_PUBLIC_STATUSES]),
        ),
      )
      .limit(1);

    if (!auction) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
    }

    // Public visibility filter for lots: lot override or inherit auction visibility
    // Since auction is already '0', lots with no override inherit '0'.
    // Lots with an explicit override must also be '0'.
    const lotVisibilityWhere = or(
      and(isNotNull(lots.visibilityOverride), lte(lots.visibilityOverride, '0')),
      isNull(lots.visibilityOverride),
    );

    const lotsWhere = and(
      eq(lots.auctionId, auction.id),
      isNull(lots.deletedAt),
      inArray(lots.status, requestedStatuses),
      lotVisibilityWhere,
    );

    // Count total
    const [{ total }] = await db
      .select({ total: count() })
      .from(lots)
      .where(lotsWhere);

    // Fetch lots with primary image
    const rows = await db
      .select({
        id: lots.id,
        auctionId: lots.auctionId,
        lotNumber: lots.lotNumber,
        title: lots.title,
        artist: lots.artist,
        description: lots.description,
        medium: lots.medium,
        dimensions: lots.dimensions,
        year: lots.year,
        estimateMin: lots.estimateMin,
        estimateMax: lots.estimateMax,
        startingBid: lots.startingBid,
        hammerPrice: lots.hammerPrice,
        status: lots.status,
        sortOrder: lots.sortOrder,
        createdAt: lots.createdAt,
        updatedAt: lots.updatedAt,
        primaryImageUrl: media.url,
        primaryThumbnailUrl: media.thumbnailUrl,
        primaryMediumUrl: media.mediumUrl,
      })
      .from(lots)
      .leftJoin(
        media,
        and(
          eq(media.lotId, lots.id),
          eq(media.isPrimary, true),
          isNull(media.deletedAt),
        ),
      )
      .where(lotsWhere)
      .orderBy(asc(lots.sortOrder))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      data: rows,
      meta: {
        total: Number(total),
        limit,
        offset,
        auctionSlug: auction.slug,
      },
    });
  } catch (error) {
    console.error('GET /api/v1/auctions/[slug]/lots error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
