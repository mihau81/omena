import { NextResponse } from 'next/server';
import { eq, isNull, and } from 'drizzle-orm';
import { db } from '@/db/connection';
import { lots } from '@/db/schema';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { getTranslation, upsertTranslation, deleteTranslation } from '@/db/queries/translations';

const SUPPORTED_LOCALES = ['pl', 'en', 'de', 'fr', 'uk'] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

function isValidLocale(locale: string): locale is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(locale);
}

// ─── GET: Single locale translation for a lot ────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; locale: string }> },
) {
  try {
    await requireAdmin('lots:read');
    const { id, locale } = await params;

    if (!isValidLocale(locale)) {
      return NextResponse.json(
        { error: `Invalid locale. Must be one of: ${SUPPORTED_LOCALES.join(', ')}` },
        { status: 400 },
      );
    }

    const [lot] = await db
      .select({ id: lots.id })
      .from(lots)
      .where(and(eq(lots.id, id), isNull(lots.deletedAt)))
      .limit(1);

    if (!lot) {
      return NextResponse.json({ error: 'Lot not found' }, { status: 404 });
    }

    const translation = await getTranslation(id, locale);

    if (!translation) {
      return NextResponse.json({ error: 'Translation not found' }, { status: 404 });
    }

    return NextResponse.json({ translation });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Admin translation locale GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PATCH: Update a specific locale translation ─────────────────────────────

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; locale: string }> },
) {
  try {
    await requireAdmin('lots:write');
    const { id, locale } = await params;

    if (!isValidLocale(locale)) {
      return NextResponse.json(
        { error: `Invalid locale. Must be one of: ${SUPPORTED_LOCALES.join(', ')}` },
        { status: 400 },
      );
    }

    const [lot] = await db
      .select({ id: lots.id })
      .from(lots)
      .where(and(eq(lots.id, id), isNull(lots.deletedAt)))
      .limit(1);

    if (!lot) {
      return NextResponse.json({ error: 'Lot not found' }, { status: 404 });
    }

    const body = await request.json();
    const { title, description, medium, provenance, exhibitions, conditionNotes } = body;

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

    return NextResponse.json({ translation });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Admin translation locale PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE: Remove a specific locale translation ────────────────────────────

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; locale: string }> },
) {
  try {
    await requireAdmin('lots:write');
    const { id, locale } = await params;

    if (!isValidLocale(locale)) {
      return NextResponse.json(
        { error: `Invalid locale. Must be one of: ${SUPPORTED_LOCALES.join(', ')}` },
        { status: 400 },
      );
    }

    const [lot] = await db
      .select({ id: lots.id })
      .from(lots)
      .where(and(eq(lots.id, id), isNull(lots.deletedAt)))
      .limit(1);

    if (!lot) {
      return NextResponse.json({ error: 'Lot not found' }, { status: 404 });
    }

    const deleted = await deleteTranslation(id, locale);

    if (!deleted) {
      return NextResponse.json({ error: 'Translation not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Admin translation locale DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
