/**
 * GET /api/v1/lots/:id
 * Returns a single public lot with all images, estimates, and current bid info.
 * Only returns lots from public auctions (visibility_level = '0').
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and, isNull, isNotNull, lte, or, inArray, count, max } from 'drizzle-orm';
import { db } from '@/db/connection';
import { auctions, lots, media, bids, bidRetractions } from '@/db/schema';
import { validateApiKey, ApiKeyError } from '@/lib/api-key-auth';
import { sql } from 'drizzle-orm';

const AUCTION_PUBLIC_STATUSES = ['preview', 'live', 'archive'] as const;
const LOT_PUBLIC_STATUSES = ['published', 'active', 'sold', 'passed'] as const;

type RouteParams = { params: Promise<{ id: string }> };

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
    const { id } = await params;

    // Lot visibility: override must be '0', or inherit from auction which must be '0'
    const lotVisibilityWhere = or(
      and(isNotNull(lots.visibilityOverride), lte(lots.visibilityOverride, '0')),
      isNull(lots.visibilityOverride),
    );

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
        provenance: lots.provenance,
        exhibitions: lots.exhibitions,
        literature: lots.literature,
        sortOrder: lots.sortOrder,
        createdAt: lots.createdAt,
        updatedAt: lots.updatedAt,
        auctionSlug: auctions.slug,
        auctionTitle: auctions.title,
        auctionStatus: auctions.status,
        auctionStartDate: auctions.startDate,
        auctionEndDate: auctions.endDate,
      })
      .from(lots)
      .innerJoin(auctions, eq(lots.auctionId, auctions.id))
      .where(
        and(
          eq(lots.id, id),
          isNull(lots.deletedAt),
          isNull(auctions.deletedAt),
          eq(auctions.visibilityLevel, '0'),
          inArray(auctions.status, [...AUCTION_PUBLIC_STATUSES]),
          inArray(lots.status, [...LOT_PUBLIC_STATUSES]),
          lotVisibilityWhere,
        ),
      )
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Lot not found' }, { status: 404 });
    }

    const lot = rows[0];

    // Get all lot media (images + YouTube)
    const lotMedia = await db
      .select({
        id: media.id,
        mediaType: media.mediaType,
        url: media.url,
        thumbnailUrl: media.thumbnailUrl,
        mediumUrl: media.mediumUrl,
        largeUrl: media.largeUrl,
        altText: media.altText,
        width: media.width,
        height: media.height,
        isPrimary: media.isPrimary,
        sortOrder: media.sortOrder,
      })
      .from(media)
      .where(and(eq(media.lotId, id), isNull(media.deletedAt)))
      .orderBy(media.sortOrder);

    // Get bid stats (excluding retracted bids)
    const bidStats = await db
      .select({
        bidCount: count(bids.id),
        currentBid: max(bids.amount),
      })
      .from(bids)
      .leftJoin(bidRetractions, eq(bidRetractions.bidId, bids.id))
      .where(
        and(
          eq(bids.lotId, id),
          sql`${bidRetractions.id} IS NULL`,
        ),
      );

    return NextResponse.json({
      data: {
        ...lot,
        images: lotMedia,
        bidCount: bidStats[0]?.bidCount ?? 0,
        currentBid: bidStats[0]?.currentBid ?? null,
      },
    });
  } catch (error) {
    console.error('GET /api/v1/lots/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
