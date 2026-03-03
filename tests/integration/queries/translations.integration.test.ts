import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from '@/tests/helpers/db';
import {
  getTranslationsForLot,
  getTranslation,
  upsertTranslation,
  deleteTranslation,
} from '@/db/queries/translations';

describe('db/queries/translations', () => {
  const db = getTestDb();
  let auctionId: string;
  let lotId: string;
  let lotIdEmpty: string;

  beforeAll(async () => {
    const { randomUUID } = await import('crypto');
    const { auctions, lots, lotTranslations } = await import('@/db/schema');

    // Create auction
    auctionId = randomUUID();
    await db.insert(auctions).values({
      id: auctionId,
      slug: `translations-test-auction-${Date.now()}`,
      title: 'Translations Test Auction',
      description: 'Test auction for translation queries',
      category: 'mixed',
      startDate: new Date(),
      endDate: new Date(Date.now() + 3600000),
      location: 'Warsaw',
      curator: 'Test',
      status: 'live',
      visibilityLevel: '0',
      buyersPremiumRate: '0.2000',
    });

    // Create lots
    lotId = randomUUID();
    await db.insert(lots).values({
      id: lotId,
      auctionId,
      lotNumber: 1,
      title: 'Translations Test Lot',
      artist: 'Piotr Nowak',
      description: 'A painting by Piotr Nowak',
      medium: 'Olej na plotnie',
      dimensions: '100x80',
      status: 'active',
    });

    lotIdEmpty = randomUUID();
    await db.insert(lots).values({
      id: lotIdEmpty,
      auctionId,
      lotNumber: 2,
      title: 'No Translations Lot',
      artist: 'Anonymous',
      description: 'Empty translation lot',
      medium: 'Unknown',
      dimensions: '10x10',
      status: 'active',
    });

    // Seed some translations
    await db.insert(lotTranslations).values([
      {
        lotId,
        locale: 'en',
        title: 'English Title',
        description: 'English description',
        medium: 'Oil on canvas',
        provenance: ['Gallery XYZ, London'],
        exhibitions: ['Summer Exhibition 2024'],
        conditionNotes: 'Very good condition',
      },
      {
        lotId,
        locale: 'de',
        title: 'Deutscher Titel',
        description: 'Deutsche Beschreibung',
        medium: 'Ol auf Leinwand',
        provenance: ['Galerie ABC, Berlin'],
        exhibitions: ['Winterausstellung 2024'],
        conditionNotes: 'Sehr guter Zustand',
      },
      {
        lotId,
        locale: 'fr',
        title: 'Titre Francais',
        description: 'Description francaise',
        medium: 'Huile sur toile',
        provenance: [],
        exhibitions: [],
        conditionNotes: '',
      },
    ]);
  });

  afterAll(async () => {
    const { auctions, lots, lotTranslations } = await import('@/db/schema');
    const { eq, inArray } = await import('drizzle-orm');

    await db.delete(lotTranslations).where(inArray(lotTranslations.lotId, [lotId, lotIdEmpty])).catch(() => {});
    await db.delete(lots).where(inArray(lots.id, [lotId, lotIdEmpty])).catch(() => {});
    await db.delete(auctions).where(eq(auctions.id, auctionId)).catch(() => {});
  });

  // ─── getTranslationsForLot ──────────────────────────────────────────────────

  describe('getTranslationsForLot', () => {
    it('returns all translations for a lot', async () => {
      const result = await getTranslationsForLot(lotId);
      expect(result.length).toBe(3);
    });

    it('returns translations with correct locale values', async () => {
      const result = await getTranslationsForLot(lotId);
      const locales = result.map((t) => t.locale).sort();
      expect(locales).toEqual(['de', 'en', 'fr']);
    });

    it('returns full translation fields', async () => {
      const result = await getTranslationsForLot(lotId);
      const en = result.find((t) => t.locale === 'en');
      expect(en).toBeDefined();
      expect(en!.title).toBe('English Title');
      expect(en!.description).toBe('English description');
      expect(en!.medium).toBe('Oil on canvas');
      expect(en!.conditionNotes).toBe('Very good condition');
    });

    it('returns provenance and exhibitions as arrays', async () => {
      const result = await getTranslationsForLot(lotId);
      const en = result.find((t) => t.locale === 'en');
      expect(Array.isArray(en!.provenance)).toBe(true);
      expect(en!.provenance).toEqual(['Gallery XYZ, London']);
      expect(Array.isArray(en!.exhibitions)).toBe(true);
      expect(en!.exhibitions).toEqual(['Summer Exhibition 2024']);
    });

    it('handles empty provenance and exhibitions arrays', async () => {
      const result = await getTranslationsForLot(lotId);
      const fr = result.find((t) => t.locale === 'fr');
      expect(fr!.provenance).toEqual([]);
      expect(fr!.exhibitions).toEqual([]);
    });

    it('returns empty array for lot with no translations', async () => {
      const result = await getTranslationsForLot(lotIdEmpty);
      expect(result).toEqual([]);
    });

    it('returns empty array for unknown lot id', async () => {
      const { randomUUID } = await import('crypto');
      const result = await getTranslationsForLot(randomUUID());
      expect(result).toEqual([]);
    });
  });

  // ─── getTranslation ─────────────────────────────────────────────────────────

  describe('getTranslation', () => {
    it('returns a specific locale translation', async () => {
      const result = await getTranslation(lotId, 'en');
      expect(result).not.toBeNull();
      expect(result!.locale).toBe('en');
      expect(result!.title).toBe('English Title');
    });

    it('returns the German translation', async () => {
      const result = await getTranslation(lotId, 'de');
      expect(result).not.toBeNull();
      expect(result!.title).toBe('Deutscher Titel');
      expect(result!.medium).toBe('Ol auf Leinwand');
    });

    it('returns null for non-existing locale', async () => {
      const result = await getTranslation(lotId, 'uk');
      expect(result).toBeNull();
    });

    it('returns null for unknown lot id', async () => {
      const { randomUUID } = await import('crypto');
      const result = await getTranslation(randomUUID(), 'en');
      expect(result).toBeNull();
    });

    it('returns null for lot with no translations at all', async () => {
      const result = await getTranslation(lotIdEmpty, 'en');
      expect(result).toBeNull();
    });
  });

  // ─── upsertTranslation ─────────────────────────────────────────────────────

  describe('upsertTranslation', () => {
    it('creates a new translation when it does not exist', async () => {
      const data = {
        title: 'Ukrainian Title',
        description: 'Ukrainian description',
        medium: 'Oliia na polotni',
        provenance: ['Museum Kyiv'],
        exhibitions: ['Exhibition 2025'],
        conditionNotes: 'Good',
      };

      const result = await upsertTranslation(lotId, 'uk', data);
      expect(result).toBeDefined();
      expect(result.locale).toBe('uk');
      expect(result.title).toBe('Ukrainian Title');
      expect(result.lotId).toBe(lotId);
    });

    it('updates an existing translation', async () => {
      const data = {
        title: 'Updated English Title',
        description: 'Updated English description',
        medium: 'Oil on linen',
        provenance: ['Gallery XYZ, London', 'Private collection'],
        exhibitions: ['Summer Exhibition 2024', 'Winter Exhibition 2025'],
        conditionNotes: 'Excellent condition',
      };

      const result = await upsertTranslation(lotId, 'en', data);
      expect(result).toBeDefined();
      expect(result.title).toBe('Updated English Title');
      expect(result.description).toBe('Updated English description');
      expect(result.medium).toBe('Oil on linen');
      expect(result.conditionNotes).toBe('Excellent condition');
    });

    it('preserves the lotId and locale on update', async () => {
      const data = {
        title: 'Another update',
        description: 'Another update desc',
        medium: 'Mixed media',
        provenance: [],
        exhibitions: [],
        conditionNotes: '',
      };

      const result = await upsertTranslation(lotId, 'en', data);
      expect(result.lotId).toBe(lotId);
      expect(result.locale).toBe('en');
    });

    it('sets updatedAt on update', async () => {
      const before = await getTranslation(lotId, 'de');
      expect(before).not.toBeNull();

      // Wait a small amount to ensure timestamp differs
      await new Promise((r) => setTimeout(r, 50));

      const data = {
        title: 'Aktualisierter Titel',
        description: 'Aktualisierte Beschreibung',
        medium: 'Ol auf Leinwand',
        provenance: [],
        exhibitions: [],
        conditionNotes: '',
      };

      const result = await upsertTranslation(lotId, 'de', data);
      const afterUpdatedAt = new Date(result.updatedAt).getTime();
      const beforeUpdatedAt = new Date(before!.updatedAt).getTime();
      expect(afterUpdatedAt).toBeGreaterThanOrEqual(beforeUpdatedAt);
    });

    it('creates translation for a lot that had none', async () => {
      const data = {
        title: 'First translation for empty lot',
        description: 'Description',
        medium: 'Bronze',
        provenance: [],
        exhibitions: [],
        conditionNotes: '',
      };

      const result = await upsertTranslation(lotIdEmpty, 'pl', data);
      expect(result).toBeDefined();
      expect(result.lotId).toBe(lotIdEmpty);
      expect(result.locale).toBe('pl');
      expect(result.title).toBe('First translation for empty lot');

      // Verify it's in the database
      const check = await getTranslation(lotIdEmpty, 'pl');
      expect(check).not.toBeNull();
      expect(check!.title).toBe('First translation for empty lot');
    });

    it('handles empty provenance and exhibitions', async () => {
      const data = {
        title: 'Sparse Translation',
        description: '',
        medium: '',
        provenance: [],
        exhibitions: [],
        conditionNotes: '',
      };

      const result = await upsertTranslation(lotIdEmpty, 'en', data);
      expect(result.provenance).toEqual([]);
      expect(result.exhibitions).toEqual([]);
    });
  });

  // ─── deleteTranslation ──────────────────────────────────────────────────────

  describe('deleteTranslation', () => {
    it('deletes an existing translation and returns it', async () => {
      // First ensure the uk translation exists from upsert test
      const existing = await getTranslation(lotId, 'uk');
      if (!existing) {
        await upsertTranslation(lotId, 'uk', {
          title: 'To delete',
          description: '',
          medium: '',
          provenance: [],
          exhibitions: [],
          conditionNotes: '',
        });
      }

      const result = await deleteTranslation(lotId, 'uk');
      expect(result).not.toBeNull();
      expect(result!.locale).toBe('uk');
      expect(result!.lotId).toBe(lotId);
    });

    it('returns null after deletion (translation no longer exists)', async () => {
      const check = await getTranslation(lotId, 'uk');
      expect(check).toBeNull();
    });

    it('returns null when deleting non-existing translation', async () => {
      const result = await deleteTranslation(lotId, 'ja');
      expect(result).toBeNull();
    });

    it('returns null when deleting from unknown lot', async () => {
      const { randomUUID } = await import('crypto');
      const result = await deleteTranslation(randomUUID(), 'en');
      expect(result).toBeNull();
    });

    it('does not affect other translations when deleting one', async () => {
      // Ensure we have en and de still
      const before = await getTranslationsForLot(lotId);
      const beforeCount = before.length;

      // Create a temporary translation to delete
      await upsertTranslation(lotId, 'it', {
        title: 'Titolo Italiano',
        description: 'Descrizione',
        medium: 'Olio',
        provenance: [],
        exhibitions: [],
        conditionNotes: '',
      });

      // Delete it
      await deleteTranslation(lotId, 'it');

      // Verify other translations are untouched
      const after = await getTranslationsForLot(lotId);
      expect(after.length).toBe(beforeCount);
    });

    it('can delete and recreate a translation for the same locale', async () => {
      // Create
      await upsertTranslation(lotId, 'es', {
        title: 'Titulo Espanol',
        description: 'Descripcion',
        medium: 'Oleo',
        provenance: [],
        exhibitions: [],
        conditionNotes: '',
      });

      // Delete
      const deleted = await deleteTranslation(lotId, 'es');
      expect(deleted).not.toBeNull();

      // Recreate
      const recreated = await upsertTranslation(lotId, 'es', {
        title: 'Nuevo Titulo',
        description: 'Nueva descripcion',
        medium: 'Acrilico',
        provenance: ['Madrid Gallery'],
        exhibitions: [],
        conditionNotes: 'Bueno',
      });

      expect(recreated.title).toBe('Nuevo Titulo');

      // Cleanup
      await deleteTranslation(lotId, 'es');
    });
  });
});
