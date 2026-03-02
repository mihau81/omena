import { eq, and, asc, desc, sql, ilike, or, count, max, gte, lte, inArray, isNull } from 'drizzle-orm';
import { db } from '../connection';
import { auctions, lots, media, bids, bidRetractions, lotTranslations } from '../schema';
import { notDeleted, lotVisibilityFilter } from '../helpers';

export type LotCategory = 'malarstwo' | 'rzezba' | 'grafika' | 'fotografia' | 'rzemiosto' | 'design' | 'bizuteria' | 'inne';

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
  categories?: LotCategory[];
  estimateMin?: number;
  estimateMax?: number;
  sortBy?: 'lot_number' | 'estimate_asc' | 'estimate_desc' | 'relevance';
  page?: number;
  limit?: number;
}) {
  const { query, userVisibility, auctionId, categories, estimateMin, estimateMax, sortBy = 'lot_number', page = 1, limit = 20 } = params;
  const offset = (page - 1) * limit;
  const hasQuery = query.length >= 2;

  // Build text search condition: full-text (tsvector) OR trigram similarity fallback
  const textConditions = hasQuery
    ? or(
        // Full-text match via search_vector (fast, indexed GIN)
        sql`${lots.searchVector} @@ plainto_tsquery('simple', ${query})`,
        // Trigram similarity for fuzzy/partial matches (also indexed)
        sql`similarity(${lots.title}, ${query}) > 0.3`,
        sql`similarity(${lots.artist}, ${query}) > 0.3`,
      )
    : undefined;

  const whereClause = and(
    lotVisibilityFilter(userVisibility),
    auctionId ? eq(lots.auctionId, auctionId) : undefined,
    categories && categories.length > 0 ? inArray(lots.category, categories) : undefined,
    estimateMin != null ? gte(lots.estimateMin, estimateMin) : undefined,
    estimateMax != null ? lte(lots.estimateMax, estimateMax) : undefined,
    textConditions,
  );

  // Relevance order: ts_rank DESC when searching, otherwise user-selected sort
  const orderBy = hasQuery && sortBy === 'lot_number'
    ? sql`ts_rank(${lots.searchVector}, plainto_tsquery('simple', ${query})) DESC, ${lots.sortOrder} ASC`
    : sortBy === 'estimate_asc'
      ? asc(lots.estimateMin)
      : sortBy === 'estimate_desc'
        ? desc(lots.estimateMin)
        : asc(lots.sortOrder);

  const countQuery = db
    .select({ count: count() })
    .from(lots)
    .innerJoin(auctions, eq(lots.auctionId, auctions.id))
    .where(whereClause);

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
    .where(whereClause)
    .orderBy(orderBy)
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

export async function getSoldLots(params: {
  artistQuery?: string;
  categories?: LotCategory[];
  priceMin?: number;
  priceMax?: number;
  auctionId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
}) {
  const { artistQuery, categories, priceMin, priceMax, auctionId, dateFrom, dateTo, page = 1, limit = 24 } = params;
  const offset = (page - 1) * limit;

  const whereClause = and(
    isNull(lots.deletedAt),
    isNull(auctions.deletedAt),
    eq(lots.status, 'sold'),
    inArray(auctions.status, ['reconciliation', 'archive']),
    auctionId ? eq(lots.auctionId, auctionId) : undefined,
    categories && categories.length > 0 ? inArray(lots.category, categories) : undefined,
    artistQuery ? ilike(lots.artist, `%${artistQuery}%`) : undefined,
    priceMin != null ? gte(lots.hammerPrice, priceMin) : undefined,
    priceMax != null ? lte(lots.hammerPrice, priceMax) : undefined,
    dateFrom ? gte(auctions.endDate, dateFrom) : undefined,
    dateTo ? lte(auctions.endDate, dateTo) : undefined,
  );

  const [{ total }] = await db
    .select({ total: count() })
    .from(lots)
    .innerJoin(auctions, eq(lots.auctionId, auctions.id))
    .where(whereClause);

  const rows = await db
    .select({
      lot: lots,
      auctionSlug: auctions.slug,
      auctionTitle: auctions.title,
      auctionEndDate: auctions.endDate,
      primaryImageUrl: media.url,
      primaryThumbnailUrl: media.thumbnailUrl,
    })
    .from(lots)
    .innerJoin(auctions, eq(lots.auctionId, auctions.id))
    .leftJoin(
      media,
      and(eq(media.lotId, lots.id), eq(media.isPrimary, true), notDeleted(media)),
    )
    .where(whereClause)
    .orderBy(desc(auctions.endDate), asc(lots.sortOrder))
    .limit(limit)
    .offset(offset);

  return {
    lots: rows.map((row) => ({
      ...row.lot,
      auctionSlug: row.auctionSlug,
      auctionTitle: row.auctionTitle,
      auctionEndDate: row.auctionEndDate,
      primaryImageUrl: row.primaryImageUrl,
      primaryThumbnailUrl: row.primaryThumbnailUrl,
    })),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(Number(total) / limit),
    },
  };
}

export async function getAuctionsForResults() {
  const rows = await db
    .select({
      id: auctions.id,
      slug: auctions.slug,
      title: auctions.title,
      endDate: auctions.endDate,
    })
    .from(auctions)
    .where(and(
      isNull(auctions.deletedAt),
      inArray(auctions.status, ['reconciliation', 'archive']),
    ))
    .orderBy(desc(auctions.endDate));

  return rows;
}

export async function getDistinctArtists(query?: string) {
  const rows = await db
    .selectDistinct({ artist: lots.artist })
    .from(lots)
    .innerJoin(auctions, eq(lots.auctionId, auctions.id))
    .where(and(
      isNull(lots.deletedAt),
      isNull(auctions.deletedAt),
      query ? ilike(lots.artist, `%${query}%`) : undefined,
    ))
    .orderBy(asc(lots.artist))
    .limit(20);

  return rows.map((r) => r.artist).filter(Boolean);
}
