import { NextResponse } from 'next/server';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { db } from '@/db/connection';
import { watchedLots, lots, auctions, media } from '@/db/schema';
import { requireApprovedUser, AuthError } from '@/lib/auth-utils';

// ─── GET /api/me/favorites ──────────────────────────────────────────────────

export async function GET() {
  try {
    const user = await requireApprovedUser();

    const rows = await db
      .select({
        lotId: watchedLots.lotId,
        addedAt: watchedLots.createdAt,
        lotTitle: lots.title,
        lotArtist: lots.artist,
        lotNumber: lots.lotNumber,
        lotStatus: lots.status,
        estimateMin: lots.estimateMin,
        estimateMax: lots.estimateMax,
        hammerPrice: lots.hammerPrice,
        auctionId: lots.auctionId,
        auctionTitle: auctions.title,
        auctionSlug: auctions.slug,
        imageUrl: media.thumbnailUrl,
      })
      .from(watchedLots)
      .innerJoin(lots, and(eq(lots.id, watchedLots.lotId), isNull(lots.deletedAt)))
      .innerJoin(auctions, and(eq(auctions.id, lots.auctionId), isNull(auctions.deletedAt)))
      .leftJoin(
        media,
        and(eq(media.lotId, lots.id), eq(media.isPrimary, true), isNull(media.deletedAt)),
      )
      .where(eq(watchedLots.userId, user.id))
      .orderBy(desc(watchedLots.createdAt));

    return NextResponse.json({ favorites: rows });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('[me/favorites] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST /api/me/favorites ─────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const user = await requireApprovedUser();
    const { lotId } = await request.json();

    if (!lotId || typeof lotId !== 'string') {
      return NextResponse.json({ error: 'lotId is required' }, { status: 400 });
    }

    await db
      .insert(watchedLots)
      .values({ userId: user.id, lotId })
      .onConflictDoNothing();

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('[me/favorites] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE /api/me/favorites ───────────────────────────────────────────────

export async function DELETE(request: Request) {
  try {
    const user = await requireApprovedUser();
    const { lotId } = await request.json();

    if (!lotId || typeof lotId !== 'string') {
      return NextResponse.json({ error: 'lotId is required' }, { status: 400 });
    }

    await db
      .delete(watchedLots)
      .where(and(eq(watchedLots.userId, user.id), eq(watchedLots.lotId, lotId)));

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('[me/favorites] DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
