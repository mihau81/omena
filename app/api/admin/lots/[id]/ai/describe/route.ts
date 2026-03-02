import { NextResponse } from 'next/server';
import { eq, and, isNull, asc } from 'drizzle-orm';
import { db } from '@/db/connection';
import { lots, media } from '@/db/schema';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { generateLotDescription, isAIEnabled } from '@/lib/ai';

export async function POST(
  _request: Request,
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

    const [lot] = await db
      .select()
      .from(lots)
      .where(and(eq(lots.id, id), isNull(lots.deletedAt)))
      .limit(1);

    if (!lot) {
      return NextResponse.json({ error: 'Lot not found' }, { status: 404 });
    }

    const lotMedia = await db
      .select({ url: media.largeUrl, thumbnailUrl: media.thumbnailUrl, isPrimary: media.isPrimary })
      .from(media)
      .where(and(eq(media.lotId, id), isNull(media.deletedAt), eq(media.mediaType, 'image')))
      .orderBy(asc(media.sortOrder))
      .limit(4);

    const imageUrls = lotMedia
      .map((m) => m.url ?? m.thumbnailUrl)
      .filter((url): url is string => Boolean(url));

    if (imageUrls.length === 0) {
      return NextResponse.json(
        { error: 'No images available for this lot. Upload images first.' },
        { status: 400 },
      );
    }

    const description = await generateLotDescription(imageUrls, {
      title: lot.title,
      artist: lot.artist,
      year: lot.year,
      medium: lot.medium,
      dimensions: lot.dimensions,
      category: lot.category,
    });

    return NextResponse.json({ description });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('AI describe error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI generation failed' },
      { status: 500 },
    );
  }
}
