import { eq, and, asc } from 'drizzle-orm';
import { db } from '../connection';
import { media } from '../schema';
import { notDeleted } from '../helpers';

export async function getMediaForLot(lotId: string) {
  return db
    .select()
    .from(media)
    .where(and(eq(media.lotId, lotId), notDeleted(media)))
    .orderBy(asc(media.sortOrder));
}

export async function getPrimaryMedia(lotId: string) {
  // Try isPrimary first
  const primary = await db
    .select()
    .from(media)
    .where(and(eq(media.lotId, lotId), eq(media.isPrimary, true), notDeleted(media)))
    .limit(1);

  if (primary.length > 0) return primary[0];

  // Fallback to first by sort order
  const first = await db
    .select()
    .from(media)
    .where(and(eq(media.lotId, lotId), notDeleted(media)))
    .orderBy(asc(media.sortOrder))
    .limit(1);

  return first[0] ?? null;
}
