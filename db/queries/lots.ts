import { eq, and, asc, desc, sql, ilike, or, count, max } from 'drizzle-orm';
import { db } from '../connection';
import { auctions, lots, media, bids, bidRetractions, lotTranslations } from '../schema';
import { notDeleted, lotVisibilityFilter } from '../helpers';

export async function getLotsByAuction(auctionId: string, userVisibility: number) {
  const rows = await db
    .select({
      lot: lots,
      primaryImageUrl: media.url,
      primaryThumbnailUrl: media.thumbnailUrl,
    })
    .from(lots)
    .innerJoin(auctions, eq(lots.auctionId, auctions.id))
    .leftJoin(
      media,
      and(eq(media.lotId, lots.id), eq(media.isPrimary, true), notDeleted(media)),
    )
    .where(
      and(
        eq(lots.auctionId, auctionId),
        lotVisibilityFilter(userVisibility),
      ),
    )
    .orderBy(asc(lots.sortOrder));

  return rows.map((row) => ({
    ...row.lot,
    primaryImageUrl: row.primaryImageUrl,
    primaryThumbnailUrl: row.primaryThumbnailUrl,
  }));
}

export async function getLotById(
  id: string,
  userVisibility: number,
  locale?: string,
) {
  const rows = await db
    .select({
      lot: lots,
      auctionSlug: auctions.slug,
      auctionTitle: auctions.title,
    })
    .from(lots)
    .innerJoin(auctions, eq(lots.auctionId, auctions.id))
    .where(
      and(
        eq(lots.id, id),
        lotVisibilityFilter(userVisibility),
      ),
    )
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0];

  // Get all media
  const lotMedia = await db
    .select()
    .from(media)
    .where(and(eq(media.lotId, id), notDeleted(media)))
    .orderBy(asc(media.sortOrder));

  // Get bid stats (exclude retracted bids)
  const bidStats = await db
    .select({
      bidCount: count(bids.id),
      highestBid: max(bids.amount),
    })
    .from(bids)
    .leftJoin(bidRetractions, eq(bidRetractions.bidId, bids.id))
    .where(
      and(
        eq(bids.lotId, id),
        sql`${bidRetractions.id} IS NULL`,
      ),
    );

  const baseLot = {
    ...row.lot,
    auctionSlug: row.auctionSlug,
    auctionTitle: row.auctionTitle,
    media: lotMedia,
    bidCount: bidStats[0]?.bidCount ?? 0,
    highestBid: bidStats[0]?.highestBid ?? null,
  };

  // If a locale is requested and it is not the default Polish, try to overlay translation
  if (locale && locale !== 'pl') {
    const translationRows = await db
      .select()
      .from(lotTranslations)
      .where(and(eq(lotTranslations.lotId, id), eq(lotTranslations.locale, locale)))
      .limit(1);

    const translation = translationRows[0];
    if (translation) {
      return {
        ...baseLot,
        title: translation.title || baseLot.title,
        description: translation.description || baseLot.description,
        medium: translation.medium || baseLot.medium,
        provenance: Array.isArray(translation.provenance) && translation.provenance.length > 0
          ? translation.provenance as string[]
          : baseLot.provenance,
        exhibitions: Array.isArray(translation.exhibitions) && translation.exhibitions.length > 0
          ? translation.exhibitions as string[]
          : baseLot.exhibitions,
        conditionNotes: translation.conditionNotes ?? baseLot.conditionNotes,
      };
    }
  }

  return baseLot;
}

export async function getLotByAuctionAndNumber(
  auctionSlug: string,
  lotNumber: number,
  userVisibility: number,
) {
  const rows = await db
    .select({
      lot: lots,
      auctionSlug: auctions.slug,
      auctionTitle: auctions.title,
    })
    .from(lots)
    .innerJoin(auctions, eq(lots.auctionId, auctions.id))
    .where(
      and(
        eq(auctions.slug, auctionSlug),
        eq(lots.lotNumber, lotNumber),
        lotVisibilityFilter(userVisibility),
      ),
    )
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0];

  // Get all media
  const lotMedia = await db
    .select()
    .from(media)
    .where(and(eq(media.lotId, row.lot.id), notDeleted(media)))
    .orderBy(asc(media.sortOrder));

  // Get bid stats (exclude retracted bids)
  const bidStats = await db
    .select({
      bidCount: count(bids.id),
      highestBid: max(bids.amount),
    })
    .from(bids)
    .leftJoin(bidRetractions, eq(bidRetractions.bidId, bids.id))
    .where(
      and(
        eq(bids.lotId, row.lot.id),
        sql`${bidRetractions.id} IS NULL`,
      ),
    );

  return {
    ...row.lot,
    auctionSlug: row.auctionSlug,
    auctionTitle: row.auctionTitle,
    media: lotMedia,
    bidCount: bidStats[0]?.bidCount ?? 0,
    highestBid: bidStats[0]?.highestBid ?? null,
  };
}

export async function searchLots(params: {
  query: string;
  userVisibility: number;
  auctionId?: string;
  page?: number;
  limit?: number;
}) {
  const { query, userVisibility, auctionId, page = 1, limit = 20 } = params;
  const pattern = `%${query}%`;
  const offset = (page - 1) * limit;

  const countQuery = db
    .select({ count: count() })
    .from(lots)
    .innerJoin(auctions, eq(lots.auctionId, auctions.id))
    .where(
      and(
        lotVisibilityFilter(userVisibility),
        auctionId ? eq(lots.auctionId, auctionId) : undefined,
        or(
          ilike(lots.title, pattern),
          ilike(lots.artist, pattern),
          ilike(lots.description, pattern),
          // Search in JSONB arrays
          sql`${lots.provenance}::text ILIKE ${pattern}`,
          sql`${lots.exhibitions}::text ILIKE ${pattern}`,
        ),
      ),
    );

  const rows = await db
    .select({
      lot: lots,
      auctionSlug: auctions.slug,
      auctionTitle: auctions.title,
      primaryImageUrl: media.url,
      primaryThumbnailUrl: media.thumbnailUrl,
    })
    .from(lots)
    .innerJoin(auctions, eq(lots.auctionId, auctions.id))
    .leftJoin(
      media,
      and(eq(media.lotId, lots.id), eq(media.isPrimary, true), notDeleted(media)),
    )
    .where(
      and(
        lotVisibilityFilter(userVisibility),
        auctionId ? eq(lots.auctionId, auctionId) : undefined,
        or(
          ilike(lots.title, pattern),
          ilike(lots.artist, pattern),
          ilike(lots.description, pattern),
          // Search in JSONB arrays
          sql`${lots.provenance}::text ILIKE ${pattern}`,
          sql`${lots.exhibitions}::text ILIKE ${pattern}`,
        ),
      ),
    )
    .orderBy(asc(lots.sortOrder))
    .limit(limit)
    .offset(offset);

  const [{ count: total }] = await countQuery;

  return {
    lots: rows.map((row) => ({
      ...row.lot,
      auctionSlug: row.auctionSlug,
      auctionTitle: row.auctionTitle,
      primaryImageUrl: row.primaryImageUrl,
      primaryThumbnailUrl: row.primaryThumbnailUrl,
    })),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}
