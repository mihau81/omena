import { NextResponse } from 'next/server';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@/db/connection';
import { lots } from '@/db/schema';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { translateDescription, isAIEnabled } from '@/lib/ai';

const SUPPORTED_LOCALES = ['en', 'de', 'fr', 'uk'] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin('lots:write');
    const { id } = await params;

    if (!isAIEnabled()) {
      return NextResponse.json(
        { error: 'AI features are not configured. Set ANTHROPIC_API_KEY.' },
        { status: 503 },
      );
    }

    const body = await request.json();
    const { locale } = body as { locale?: string };

    if (!locale || !SUPPORTED_LOCALES.includes(locale as SupportedLocale)) {
      return NextResponse.json(
        { error: `Invalid locale. Supported: ${SUPPORTED_LOCALES.join(', ')}` },
        { status: 400 },
      );
    }

    const [lot] = await db
      .select({ description: lots.description })
      .from(lots)
      .where(and(eq(lots.id, id), isNull(lots.deletedAt)))
      .limit(1);

    if (!lot) {
      return NextResponse.json({ error: 'Lot not found' }, { status: 404 });
    }

    if (!lot.description?.trim()) {
      return NextResponse.json(
        { error: 'Lot has no Polish description to translate. Generate or write one first.' },
        { status: 400 },
      );
    }

    const translated = await translateDescription(lot.description, locale);

    return NextResponse.json({ locale, description: translated });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('AI translate error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Translation failed' },
      { status: 500 },
    );
  }
}
