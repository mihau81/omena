import { eq, and } from 'drizzle-orm';
import { db } from '../connection';
import { lotTranslations } from '../schema';

export type TranslationData = {
  title: string;
  description: string;
  medium: string;
  provenance: string[];
  exhibitions: string[];
  conditionNotes: string;
};

// ─── Get all translations for a lot ─────────────────────────────────────────

export async function getTranslationsForLot(lotId: string) {
  return db
    .select()
    .from(lotTranslations)
    .where(eq(lotTranslations.lotId, lotId));
}

// ─── Get a specific locale translation for a lot ─────────────────────────────

export async function getTranslation(lotId: string, locale: string) {
  const rows = await db
    .select()
    .from(lotTranslations)
    .where(and(eq(lotTranslations.lotId, lotId), eq(lotTranslations.locale, locale)))
    .limit(1);

  return rows[0] ?? null;
}

// ─── Create or update a translation (upsert) ─────────────────────────────────

export async function upsertTranslation(
  lotId: string,
  locale: string,
  data: TranslationData,
) {
  const existing = await getTranslation(lotId, locale);

  if (existing) {
    const [updated] = await db
      .update(lotTranslations)
      .set({
        title: data.title,
        description: data.description,
        medium: data.medium,
        provenance: data.provenance,
        exhibitions: data.exhibitions,
        conditionNotes: data.conditionNotes,
        updatedAt: new Date(),
      })
      .where(and(eq(lotTranslations.lotId, lotId), eq(lotTranslations.locale, locale)))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(lotTranslations)
    .values({
      lotId,
      locale,
      title: data.title,
      description: data.description,
      medium: data.medium,
      provenance: data.provenance,
      exhibitions: data.exhibitions,
      conditionNotes: data.conditionNotes ?? '',
    })
    .returning();
  return created;
}

// ─── Delete a translation ────────────────────────────────────────────────────

export async function deleteTranslation(lotId: string, locale: string) {
  const [deleted] = await db
    .delete(lotTranslations)
    .where(and(eq(lotTranslations.lotId, lotId), eq(lotTranslations.locale, locale)))
    .returning();
  return deleted ?? null;
}
