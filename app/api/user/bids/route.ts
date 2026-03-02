import { NextResponse } from 'next/server';
import { eq, and, desc, isNull, sql } from 'drizzle-orm';
import { db } from '@/db/connection';
import { bids, bidRetractions, lots, auctions, media } from '@/db/schema';
import { auth } from '@/lib/auth';

// ─── GET: Fetch current user's bids with lot/auction details ────────────────

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.userType !== 'user') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const userId = session.user.id;

    // Fetch all non-retracted bids for this user, with lot + auction data
    const userBids = await db
      .select({
        bidId: bids.id,
        bidAmount: bids.amount,
        bidCreatedAt: bids.createdAt,
        bidIsWinning: bids.isWinning,
        lotId: lots.id,
        lotTitle: lots.title,
        lotArtist: lots.artist,
        lotNumber: lots.lotNumber,
        lotStatus: lots.status,
        auctionId: auctions.id,
        auctionSlug: auctions.slug,
        auctionTitle: auctions.title,
        auctionStatus: auctions.status,
      })
      .from(bids)
      .innerJoin(lots, eq(bids.lotId, lots.id))
      .innerJoin(auctions, eq(lots.auctionId, auctions.id))
      .leftJoin(bidRetractions, eq(bidRetractions.bidId, bids.id))
      .where(
        and(
          eq(bids.userId, userId),
          isNull(bidRetractions.id),   // Exclude retracted bids
          isNull(lots.deletedAt),
          isNull(auctions.deletedAt),
        ),
      )
      .orderBy(desc(bids.amount));

    // Group by lot — take highest bid per lot
    const seenLots = new Set<string>();
    const lotBids = userBids.filter((b) => {
      if (seenLots.has(b.lotId)) return false;
      seenLots.add(b.lotId);
      return true;
    });

    // Get primary image for each lot (batch query)
    const lotIds = lotBids.map((b) => b.lotId);
    let imageMap: Record<string, string> = {};

    if (lotIds.length > 0) {
      const images = await db
        .select({
          lotId: media.lotId,
          thumbnailUrl: media.thumbnailUrl,
          url: media.url,
          isPrimary: media.isPrimary,
          sortOrder: media.sortOrder,
        })
        .from(media)
        .where(
          and(
            sql`${media.lotId} IN (${sql.join(lotIds.map(id => sql`${id}`), sql`, `)})`,
            eq(media.mediaType, 'image'),
            isNull(media.deletedAt),
          ),
        )
        .orderBy(desc(media.isPrimary), media.sortOrder);

      // Keep first (primary / lowest sort) image per lot
      for (const img of images) {
        if (img.lotId && !imageMap[img.lotId]) {
          imageMap[img.lotId] = img.thumbnailUrl ?? img.url;
        }
      }
    }

    // Enrich with image URLs
    const result = lotBids.map((b) => ({
      lotId: b.lotId,
      lotTitle: b.lotTitle,
      lotArtist: b.lotArtist,
      lotNumber: b.lotNumber,
      lotStatus: b.lotStatus,
      auctionSlug: b.auctionSlug,
      auctionTitle: b.auctionTitle,
      auctionStatus: b.auctionStatus,
      bidAmount: b.bidAmount,
      bidCreatedAt: b.bidCreatedAt,
      isWinning: b.bidIsWinning,
      imageUrl: imageMap[b.lotId] ?? null,
    }));

    return NextResponse.json({ bids: result });
  } catch (error) {
    console.error('User bids GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
