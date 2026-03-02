/**
 * GET /api/v1/lots/search
 * Search public lots by title, artist, year range.
 * Only returns lots from public auctions (visibility_level = '0').
 *
 * Query params:
 *   q           — search term (title or artist, min 2 chars)
 *   artist      — exact/partial artist name filter
 *   category    — lot category filter (comma-separated): malarstwo,rzezba,grafika,fotografia,rzemiosto,design,bizuteria,inne
 *   yearMin     — minimum creation year (inclusive)
 *   yearMax     — maximum creation year (inclusive)
 *   estimateMin — minimum estimate in PLN
 *   estimateMax — maximum estimate in PLN
 *   status      — lot status filter (published|active|sold|passed), comma-separated
 *   sortBy      — sort order: lot_number (default), estimate_asc, estimate_desc
 *   limit       — max results (1–100, default 20)
 *   offset      — pagination offset (default 0)
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and, isNull, isNotNull, lte, or, inArray, count, asc, desc, ilike, gte, sql } from 'drizzle-orm';
import { db } from '@/db/connection';
import { auctions, lots, media } from '@/db/schema';
import { validateApiKey, ApiKeyError } from '@/lib/api-key-auth';

const AUCTION_PUBLIC_STATUSES = ['preview', 'live', 'archive'] as const;
const ALLOWED_LOT_STATUSES = ['published', 'active', 'sold', 'passed'] as const;
const LOT_CATEGORIES = ['malarstwo', 'rzezba', 'grafika', 'fotografia', 'rzemiosto', 'design', 'bizuteria', 'inne'] as const;
type AllowedLotStatus = typeof ALLOWED_LOT_STATUSES[number];
type LotCategory = typeof LOT_CATEGORIES[number];

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
    const estimateMinParam = searchParams.get('estimateMin');
    const estimateMaxParam = searchParams.get('estimateMax');
    const sortByParam = searchParams.get('sortBy') ?? 'lot_number';

    // Parse lot category filter
    const categoryParam = searchParams.get('category');
    const requestedCategories: LotCategory[] = categoryParam
      ? categoryParam.split(',').map((c) => c.trim()).filter((c): c is LotCategory =>
          (LOT_CATEGORIES as readonly string[]).includes(c),
        )
      : [];

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
    const estimateMin = estimateMinParam ? parseInt(estimateMinParam, 10) : null;
    const estimateMax = estimateMaxParam ? parseInt(estimateMaxParam, 10) : null;

    if (yearMin !== null && isNaN(yearMin)) {
      return NextResponse.json({ error: 'Invalid yearMin parameter' }, { status: 400 });
    }
    if (yearMax !== null && isNaN(yearMax)) {
      return NextResponse.json({ error: 'Invalid yearMax parameter' }, { status: 400 });
    }
    if (estimateMin !== null && isNaN(estimateMin)) {
      return NextResponse.json({ error: 'Invalid estimateMin parameter' }, { status: 400 });
    }
    if (estimateMax !== null && isNaN(estimateMax)) {
      return NextResponse.json({ error: 'Invalid estimateMax parameter' }, { status: 400 });
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
      // Full-text search via tsvector (GIN indexed) + trigram similarity for fuzzy matching
      conditions.push(
        or(
          sql`${lots.searchVector} @@ plainto_tsquery('simple', ${q})`,
          sql`similarity(${lots.title}, ${q}) > 0.3`,
          sql`similarity(${lots.artist}, ${q}) > 0.3`,
        )!,
      );
    }

    if (artistFilter) {
      conditions.push(ilike(lots.artist, `%${artistFilter}%`));
    }

    if (requestedCategories.length > 0) {
      conditions.push(inArray(lots.category, requestedCategories));
    }

    if (yearMin !== null) {
      conditions.push(gte(lots.year, yearMin));
    }
    if (yearMax !== null) {
      conditions.push(lte(lots.year, yearMax));
    }
    if (estimateMin !== null) {
      conditions.push(gte(lots.estimateMin, estimateMin));
    }
    if (estimateMax !== null) {
      conditions.push(lte(lots.estimateMax, estimateMax));
    }

    const whereClause = and(...conditions);

    const orderBy = sortByParam === 'estimate_asc'
      ? asc(lots.estimateMin)
      : sortByParam === 'estimate_desc'
        ? desc(lots.estimateMin)
        : [asc(auctions.sortOrder), asc(lots.sortOrder)] as const;

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
        category: lots.category,
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
      .orderBy(
        // When searching by relevance, rank by ts_rank DESC first
        ...(q.length >= 2 && sortByParam === 'lot_number'
          ? [sql`ts_rank(${lots.searchVector}, plainto_tsquery('simple', ${q})) DESC`, asc(auctions.sortOrder), asc(lots.sortOrder)]
          : sortByParam === 'estimate_asc'
            ? [asc(lots.estimateMin)]
            : sortByParam === 'estimate_desc'
              ? [desc(lots.estimateMin)]
              : [asc(auctions.sortOrder), asc(lots.sortOrder)]
        ),
      )
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
