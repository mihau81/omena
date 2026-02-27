import { NextResponse } from 'next/server';
import { eq, and, isNull, asc, max } from 'drizzle-orm';
import { db } from '@/db/connection';
import { lots, media, auctions } from '@/db/schema';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { createLotSchema } from '@/lib/validation/lot';
import { logCreate } from '@/lib/audit';

// ─── GET: List lots for an auction ──────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ auctionId: string }> },
) {
  try {
    await requireAdmin('lots:read');
    const { auctionId } = await params;

    const rows = await db
      .select({
        lot: lots,
        primaryThumbnailUrl: media.thumbnailUrl,
      })
      .from(lots)
      .leftJoin(
        media,
        and(eq(media.lotId, lots.id), eq(media.isPrimary, true), isNull(media.deletedAt)),
      )
      .where(and(eq(lots.auctionId, auctionId), isNull(lots.deletedAt)))
      .orderBy(asc(lots.sortOrder), asc(lots.lotNumber));

    return NextResponse.json({
      lots: rows.map((r) => ({
        ...r.lot,
        primaryThumbnailUrl: r.primaryThumbnailUrl,
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Admin lots GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST: Create a new lot ─────────────────────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ auctionId: string }> },
) {
  try {
    const admin = await requireAdmin('lots:write');
    const { auctionId } = await params;

    // Verify auction exists
    const [auction] = await db
      .select({ id: auctions.id })
      .from(auctions)
      .where(and(eq(auctions.id, auctionId), isNull(auctions.deletedAt)))
      .limit(1);

    if (!auction) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
    }

    const body = await request.json();

    // Auto-assign next lot number if not provided
    let lotNumber = body.lotNumber;
    if (!lotNumber) {
      const [result] = await db
        .select({ maxNum: max(lots.lotNumber) })
        .from(lots)
        .where(and(eq(lots.auctionId, auctionId), isNull(lots.deletedAt)));
      lotNumber = (result?.maxNum ?? 0) + 1;
    }

    const parsed = createLotSchema.safeParse({ ...body, auctionId, lotNumber });
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const data = parsed.data;

    // Auto-assign sortOrder
    const [maxSort] = await db
      .select({ maxSort: max(lots.sortOrder) })
      .from(lots)
      .where(and(eq(lots.auctionId, auctionId), isNull(lots.deletedAt)));
    const sortOrder = (maxSort?.maxSort ?? -1) + 1;

    const [created] = await db
      .insert(lots)
      .values({
        auctionId: data.auctionId,
        lotNumber: data.lotNumber,
        title: data.title,
        artist: data.artist,
        description: data.description,
        medium: data.medium,
        dimensions: data.dimensions,
        year: data.year ?? null,
        estimateMin: data.estimateMin,
        estimateMax: data.estimateMax,
        reservePrice: data.reservePrice ?? null,
        startingBid: data.startingBid ?? null,
        visibilityOverride: data.visibilityOverride ?? null,
        provenance: data.provenance,
        exhibitions: data.exhibitions,
        literature: data.literature,
        conditionNotes: data.conditionNotes,
        notes: data.notes,
        consignorId: data.consignorId ?? null,
        sortOrder,
        createdBy: admin.id,
        updatedBy: admin.id,
      })
      .returning();

    await logCreate(
      'lots',
      created.id,
      created as unknown as Record<string, unknown>,
      admin.id,
      'admin',
    );

    return NextResponse.json({ lot: created }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Admin lot POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
