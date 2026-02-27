/**
 * GET /api/v1/lots/search
 * Search public lots by title, artist, year range.
 * Only returns lots from public auctions (visibility_level = '0').
 *
 * Query params:
 *   q        — search term (title or artist, min 2 chars)
 *   artist   — exact/partial artist name filter
 *   yearMin  — minimum creation year (inclusive)
 *   yearMax  — maximum creation year (inclusive)
 *   status   — lot status filter (published|active|sold|passed), comma-separated
 *   limit    — max results (1–100, default 20)
 *   offset   — pagination offset (default 0)
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and, isNull, isNotNull, lte, or, inArray, count, asc, ilike, gte } from 'drizzle-orm';
import { db } from '@/db/connection';
import { auctions, lots, media } from '@/db/schema';
import { validateApiKey, ApiKeyError } from '@/lib/api-key-auth';

const AUCTION_PUBLIC_STATUSES = ['preview', 'live', 'archive'] as const;
const ALLOWED_LOT_STATUSES = ['published', 'active', 'sold', 'passed'] as const;
type AllowedLotStatus = typeof ALLOWED_LOT_STATUSES[number];

export async function GET(request: NextRequest) {
  try {
    await validateApiKey(request);
  } catch (error) {
    if (error instanceof ApiKeyError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
  }

  try {
    const { searchParams } = request.nextUrl;

    const q = searchParams.get('q') ?? '';
    const artistFilter = searchParams.get('artist') ?? '';
    const yearMinParam = searchParams.get('yearMin');
    const yearMaxParam = searchParams.get('yearMax');

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
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10) || 20));
    const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10) || 0);

    // Validate year params
    const yearMin = yearMinParam ? parseInt(yearMinParam, 10) : null;
    const yearMax = yearMaxParam ? parseInt(yearMaxParam, 10) : null;

    if (yearMin !== null && isNaN(yearMin)) {
      return NextResponse.json({ error: 'Invalid yearMin parameter' }, { status: 400 });
    }
    if (yearMax !== null && isNaN(yearMax)) {
      return NextResponse.json({ error: 'Invalid yearMax parameter' }, { status: 400 });
    }
    if (q.length > 0 && q.length < 2) {
      return NextResponse.json({ error: 'Search query must be at least 2 characters' }, { status: 400 });
    }

    // Lot visibility filter
    const lotVisibilityWhere = or(
      and(isNotNull(lots.visibilityOverride), lte(lots.visibilityOverride, '0')),
      isNull(lots.visibilityOverride),
    );

    // Build filter conditions
    const conditions = [
      isNull(lots.deletedAt),
      isNull(auctions.deletedAt),
      eq(auctions.visibilityLevel, '0'),
      inArray(auctions.status, [...AUCTION_PUBLIC_STATUSES]),
      inArray(lots.status, requestedStatuses),
      lotVisibilityWhere,
    ];

    if (q.length >= 2) {
      const pattern = `%${q}%`;
      conditions.push(
        or(
          ilike(lots.title, pattern),
          ilike(lots.artist, pattern),
        )!,
      );
    }

    if (artistFilter) {
      conditions.push(ilike(lots.artist, `%${artistFilter}%`));
    }

    if (yearMin !== null) {
      conditions.push(gte(lots.year, yearMin));
    }
    if (yearMax !== null) {
      conditions.push(lte(lots.year, yearMax));
    }

    const whereClause = and(...conditions);

    // Count total
    const [{ total }] = await db
      .select({ total: count() })
      .from(lots)
      .innerJoin(auctions, eq(lots.auctionId, auctions.id))
      .where(whereClause);

    // Fetch results with primary image
    const rows = await db
      .select({
        id: lots.id,
        auctionId: lots.auctionId,
        lotNumber: lots.lotNumber,
        title: lots.title,
        artist: lots.artist,
        medium: lots.medium,
        dimensions: lots.dimensions,
        year: lots.year,
        estimateMin: lots.estimateMin,
        estimateMax: lots.estimateMax,
        hammerPrice: lots.hammerPrice,
        status: lots.status,
        sortOrder: lots.sortOrder,
        createdAt: lots.createdAt,
        auctionSlug: auctions.slug,
        auctionTitle: auctions.title,
        auctionStatus: auctions.status,
        auctionStartDate: auctions.startDate,
        auctionEndDate: auctions.endDate,
        primaryImageUrl: media.url,
        primaryThumbnailUrl: media.thumbnailUrl,
        primaryMediumUrl: media.mediumUrl,
      })
      .from(lots)
      .innerJoin(auctions, eq(lots.auctionId, auctions.id))
      .leftJoin(
        media,
        and(
          eq(media.lotId, lots.id),
          eq(media.isPrimary, true),
          isNull(media.deletedAt),
        ),
      )
      .where(whereClause)
      .orderBy(asc(auctions.sortOrder), asc(lots.sortOrder))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      data: rows,
      meta: {
        total: Number(total),
        limit,
        offset,
        query: q || null,
      },
    });
  } catch (error) {
    console.error('GET /api/v1/lots/search error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
