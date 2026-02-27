import { eq, asc, sql, and, count, min } from 'drizzle-orm';
import { db } from '../connection';
import { auctions, lots, media } from '../schema';
import { notDeleted, auctionVisibilityFilter } from '../helpers';

export async function getAuctions(userVisibility: number) {
  // Fetch auctions with lot count and cover image URL
  const rows = await db
    .select({
      auction: auctions,
      lotCount: count(lots.id),
    })
    .from(auctions)
    .leftJoin(lots, and(eq(lots.auctionId, auctions.id), notDeleted(lots)))
    .where(auctionVisibilityFilter(userVisibility))
    .groupBy(auctions.id)
    .orderBy(asc(auctions.sortOrder));

  // Fetch cover images (primary media from first lot of each auction)
  const auctionIds = rows.map((r) => r.auction.id);
  const coverImages = auctionIds.length > 0
    ? await db
        .select({
          auctionId: lots.auctionId,
          url: min(media.url),
        })
        .from(media)
        .innerJoin(lots, eq(media.lotId, lots.id))
        .where(
          and(
            eq(media.isPrimary, true),
            notDeleted(media),
            notDeleted(lots),
          ),
        )
        .groupBy(lots.auctionId)
    : [];

  const coverMap = new Map(coverImages.map((c) => [c.auctionId, c.url]));

  return rows.map((row) => ({
    ...row.auction,
    lotCount: row.lotCount,
    coverImageUrl: coverMap.get(row.auction.id) ?? null,
  }));
}

export async function getAuctionBySlug(slug: string, userVisibility: number) {
  const rows = await db
    .select({
      auction: auctions,
      lotCount: count(lots.id),
    })
    .from(auctions)
    .leftJoin(lots, and(eq(lots.auctionId, auctions.id), notDeleted(lots)))
    .where(and(eq(auctions.slug, slug), auctionVisibilityFilter(userVisibility)))
    .groupBy(auctions.id)
    .limit(1);

  if (rows.length === 0) return null;

  // Get cover image
  const coverMedia = await db
    .select({ url: media.url })
    .from(media)
    .innerJoin(lots, eq(media.lotId, lots.id))
    .where(
      and(
        eq(lots.auctionId, rows[0].auction.id),
        eq(media.isPrimary, true),
        notDeleted(media),
        notDeleted(lots),
      ),
    )
    .limit(1);

  return {
    ...rows[0].auction,
    lotCount: rows[0].lotCount,
    coverImageUrl: coverMedia[0]?.url ?? null,
  };
}

export async function getAuctionById(id: string) {
  const rows = await db
    .select()
    .from(auctions)
    .where(and(eq(auctions.id, id), notDeleted(auctions)))
    .limit(1);

  return rows[0] ?? null;
}

export async function getAuctionWithLots(slug: string, userVisibility: number) {
  const auction = await getAuctionBySlug(slug, userVisibility);
  if (!auction) return null;

  // Get lots with their primary media
  const lotsWithMedia = await db
    .select({
      lot: lots,
      primaryImageUrl: media.url,
      primaryThumbnailUrl: media.thumbnailUrl,
    })
    .from(lots)
    .leftJoin(
      media,
      and(eq(media.lotId, lots.id), eq(media.isPrimary, true), notDeleted(media)),
    )
    .where(
      and(
        eq(lots.auctionId, auction.id),
        notDeleted(lots),
      ),
    )
    .orderBy(asc(lots.sortOrder));

  return {
    ...auction,
    lots: lotsWithMedia.map((row) => ({
      ...row.lot,
      primaryImageUrl: row.primaryImageUrl,
      primaryThumbnailUrl: row.primaryThumbnailUrl,
    })),
  };
}
