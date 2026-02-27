/**
 * GET /api/v1/auctions
 * Public read-only endpoint for third-party platforms (Invaluable, Artnet, Barnebys).
 * Returns published/live/archive auctions with visibility_level = '0' (public).
 *
 * Query params:
 *   status   — filter by auction status (published|live|archive), comma-separated
 *   limit    — max results (1–100, default 20)
 *   offset   — pagination offset (default 0)
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and, isNull, inArray, count, asc } from 'drizzle-orm';
import { db } from '@/db/connection';
import { auctions, lots } from '@/db/schema';
import { validateApiKey, ApiKeyError } from '@/lib/api-key-auth';

const ALLOWED_STATUSES = ['preview', 'live', 'archive'] as const;
type AllowedStatus = typeof ALLOWED_STATUSES[number];

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

    // Parse status filter
    const statusParam = searchParams.get('status');
    const requestedStatuses: AllowedStatus[] = statusParam
      ? statusParam.split(',').map((s) => s.trim()).filter((s): s is AllowedStatus =>
          (ALLOWED_STATUSES as readonly string[]).includes(s),
        )
      : [...ALLOWED_STATUSES];

    if (requestedStatuses.length === 0) {
      return NextResponse.json(
        { error: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}` },
        { status: 400 },
      );
    }

    // Parse pagination
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10) || 20));
    const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10) || 0);

    // Base filter: public visibility, not deleted, allowed statuses
    const baseWhere = and(
      eq(auctions.visibilityLevel, '0'),
      isNull(auctions.deletedAt),
      inArray(auctions.status, requestedStatuses),
    );

    // Count total
    const [{ total }] = await db
      .select({ total: count() })
      .from(auctions)
      .where(baseWhere);

    // Fetch auctions with lot count
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
      .where(baseWhere)
      .groupBy(auctions.id)
      .orderBy(asc(auctions.sortOrder))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      data: rows,
      meta: {
        total: Number(total),
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('GET /api/v1/auctions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
