import { NextResponse } from 'next/server';
import { eq, isNull, and } from 'drizzle-orm';
import { db } from '@/db/connection';
import { lots } from '@/db/schema';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { getTranslationsForLot, upsertTranslation } from '@/db/queries/translations';

const SUPPORTED_LOCALES = ['pl', 'en', 'de', 'fr', 'uk'] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

function isValidLocale(locale: string): locale is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(locale);
}

// ─── GET: All translations for a lot ────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin('lots:read');
    const { id } = await params;

    const [lot] = await db
      .select({ id: lots.id })
      .from(lots)
      .where(and(eq(lots.id, id), isNull(lots.deletedAt)))
      .limit(1);

    if (!lot) {
      return NextResponse.json({ error: 'Lot not found' }, { status: 404 });
    }

    const translations = await getTranslationsForLot(id);

    return NextResponse.json({ translations });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Admin translations GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST: Create or update a translation ────────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin('lots:write');
    const { id } = await params;

    const [lot] = await db
      .select({ id: lots.id })
      .from(lots)
      .where(and(eq(lots.id, id), isNull(lots.deletedAt)))
      .limit(1);

    if (!lot) {
      return NextResponse.json({ error: 'Lot not found' }, { status: 404 });
    }

    const body = await request.json();
    const { locale, title, description, medium, provenance, exhibitions, conditionNotes } = body;

    if (!locale || !isValidLocale(locale)) {
      return NextResponse.json(
        { error: `Invalid locale. Must be one of: ${SUPPORTED_LOCALES.join(', ')}` },
        { status: 400 },
      );
    }

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const translation = await upsertTranslation(id, locale, {
      title: title.trim(),
      description: typeof description === 'string' ? description : '',
      medium: typeof medium === 'string' ? medium : '',
      provenance: Array.isArray(provenance) ? provenance.filter(Boolean) : [],
      exhibitions: Array.isArray(exhibitions) ? exhibitions.filter(Boolean) : [],
      conditionNotes: typeof conditionNotes === 'string' ? conditionNotes : '',
    });

    return NextResponse.json({ translation }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Admin translations POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
