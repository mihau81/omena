import { eq, and, asc, desc, sql, ilike, count, max, avg, isNull, inArray } from 'drizzle-orm';
import { db } from '../connection';
import { artists, lots, auctions, media } from '../schema';
import { notDeleted } from '../helpers';

// ─── List artists ─────────────────────────────────────────────────────────────

export async function getArtists(params: {
  search?: string;
  page?: number;
  limit?: number;
} = {}) {
  const { search, page = 1, limit = 50 } = params;
  const offset = (page - 1) * limit;

  const whereClause = and(
    isNull(artists.deletedAt),
    search ? ilike(artists.name, `%${search}%`) : undefined,
  );

  const [{ total }] = await db
    .select({ total: count() })
    .from(artists)
    .where(whereClause);

  const rows = await db
    .select({
      artist: artists,
      lotCount: count(lots.id),
    })
    .from(artists)
    .leftJoin(lots, and(eq(lots.artistId, artists.id), isNull(lots.deletedAt)))
    .where(whereClause)
    .groupBy(artists.id)
    .orderBy(asc(artists.name))
    .limit(limit)
    .offset(offset);

  return {
    data: rows.map((r) => ({ ...r.artist, lotCount: Number(r.lotCount) })),
    total: Number(total),
    page,
    limit,
    totalPages: Math.ceil(Number(total) / limit),
  };
}

// ─── Get artist by ID ─────────────────────────────────────────────────────────

export async function getArtistById(id: string) {
  const rows = await db
    .select()
    .from(artists)
    .where(and(eq(artists.id, id), isNull(artists.deletedAt)))
    .limit(1);

  return rows[0] ?? null;
}

// ─── Get artist by slug ───────────────────────────────────────────────────────

export async function getArtistBySlug(slug: string) {
  const rows = await db
    .select()
    .from(artists)
    .where(and(eq(artists.slug, slug), isNull(artists.deletedAt)))
    .limit(1);

  return rows[0] ?? null;
}

// ─── Get artist with stats + lots ────────────────────────────────────────────

export async function getArtistWithLots(slug: string) {
  const artist = await getArtistBySlug(slug);
  if (!artist) return null;

  // Run all three independent queries in parallel
  const [statsRows, soldLots, availableLots] = await Promise.all([
    // Price stats from sold lots
    db
      .select({
        totalSold: count(lots.id),
        avgHammer: avg(lots.hammerPrice),
        maxHammer: max(lots.hammerPrice),
      })
      .from(lots)
      .innerJoin(auctions, eq(lots.auctionId, auctions.id))
      .where(
        and(
          eq(lots.artistId, artist.id),
          eq(lots.status, 'sold'),
          isNull(lots.deletedAt),
          isNull(auctions.deletedAt),
        ),
      ),

    // Sold lots (auction results)
    db
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
      .where(
        and(
          eq(lots.artistId, artist.id),
          eq(lots.status, 'sold'),
          isNull(lots.deletedAt),
          isNull(auctions.deletedAt),
        ),
      )
      .orderBy(desc(auctions.endDate), asc(lots.sortOrder))
      .limit(50),

    // Active/published lots
    db
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
          eq(lots.artistId, artist.id),
          sql`${lots.status} IN ('published', 'active')`,
          isNull(lots.deletedAt),
          isNull(auctions.deletedAt),
        ),
      )
      .orderBy(asc(lots.sortOrder)),
  ]);

  const stats = statsRows[0];

  return {
    artist,
    stats: {
      totalSold: Number(stats?.totalSold ?? 0),
      avgHammer: stats?.avgHammer ? Math.round(Number(stats.avgHammer)) : null,
      maxHammer: stats?.maxHammer ? Number(stats.maxHammer) : null,
    },
    soldLots: soldLots.map((r) => ({
      ...r.lot,
      auctionSlug: r.auctionSlug,
      auctionTitle: r.auctionTitle,
      auctionEndDate: r.auctionEndDate,
      primaryImageUrl: r.primaryImageUrl,
      primaryThumbnailUrl: r.primaryThumbnailUrl,
    })),
    availableLots: availableLots.map((r) => ({
      ...r.lot,
      auctionSlug: r.auctionSlug,
      auctionTitle: r.auctionTitle,
      primaryImageUrl: r.primaryImageUrl,
      primaryThumbnailUrl: r.primaryThumbnailUrl,
    })),
  };
}

// ─── Get unlinked lots matching artist name ───────────────────────────────────

export async function getUnlinkedLotsByArtistName(artistName: string, limit = 50) {
  const rows = await db
    .select({
      lot: lots,
      auctionTitle: auctions.title,
      auctionSlug: auctions.slug,
    })
    .from(lots)
    .innerJoin(auctions, eq(lots.auctionId, auctions.id))
    .where(
      and(
        isNull(lots.artistId),
        ilike(lots.artist, artistName),
        isNull(lots.deletedAt),
        isNull(auctions.deletedAt),
      ),
    )
    .orderBy(desc(auctions.endDate), asc(lots.sortOrder))
    .limit(limit);

  return rows.map((r) => ({
    ...r.lot,
    auctionTitle: r.auctionTitle,
    auctionSlug: r.auctionSlug,
  }));
}

// ─── Create artist ────────────────────────────────────────────────────────────

export async function createArtist(data: {
  slug: string;
  name: string;
  nationality?: string | null;
  birthYear?: number | null;
  deathYear?: number | null;
  bio?: string | null;
  imageUrl?: string | null;
}) {
  const rows = await db
    .insert(artists)
    .values(data)
    .returning();

  return rows[0];
}

// ─── Update artist ────────────────────────────────────────────────────────────

export async function updateArtist(
  id: string,
  data: Partial<{
    slug: string;
    name: string;
    nationality: string | null;
    birthYear: number | null;
    deathYear: number | null;
    bio: string | null;
    imageUrl: string | null;
  }>,
) {
  const rows = await db
    .update(artists)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(artists.id, id), isNull(artists.deletedAt)))
    .returning();

  return rows[0] ?? null;
}

// ─── Soft delete artist ───────────────────────────────────────────────────────

export async function deleteArtist(id: string) {
  await db
    .update(artists)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(artists.id, id));
}

// ─── Bulk-link lots to artist ─────────────────────────────────────────────────

export async function linkLotsToArtist(artistId: string, lotIds: string[]) {
  if (lotIds.length === 0) return;
  await db
    .update(lots)
    .set({ artistId, updatedAt: new Date() })
    .where(inArray(lots.id, lotIds));
}

// ─── Public: list all artists alphabetically with lot counts ─────────────────

export async function getPublicArtists(search?: string) {
  const whereClause = and(
    isNull(artists.deletedAt),
    search && search.length >= 2 ? ilike(artists.name, `%${search}%`) : undefined,
  );

  const rows = await db
    .select({
      artist: artists,
      lotCount: count(lots.id),
    })
    .from(artists)
    .leftJoin(
      lots,
      and(
        eq(lots.artistId, artists.id),
        isNull(lots.deletedAt),
        sql`${lots.status} IN ('published', 'active', 'sold')`,
      ),
    )
    .where(whereClause)
    .groupBy(artists.id)
    .orderBy(asc(artists.name));

  return rows.map((r) => ({ ...r.artist, lotCount: Number(r.lotCount) }));
}
