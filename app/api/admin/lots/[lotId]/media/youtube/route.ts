import { NextResponse } from 'next/server';
import { eq, and, isNull, max } from 'drizzle-orm';
import { db } from '@/db/connection';
import { media, lots } from '@/db/schema';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { z } from 'zod';

const YT_REGEX =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/;

const youtubeSchema = z.object({
  url: z.string().url().refine((url) => YT_REGEX.test(url), {
    message: 'Invalid YouTube URL',
  }),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ lotId: string }> },
) {
  try {
    const admin = await requireAdmin('media:write');
    const { lotId } = await params;

    // Verify lot exists
    const [lot] = await db
      .select({ id: lots.id })
      .from(lots)
      .where(and(eq(lots.id, lotId), isNull(lots.deletedAt)))
      .limit(1);

    if (!lot) {
      return NextResponse.json({ error: 'Lot not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = youtubeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { url } = parsed.data;
    const match = url.match(YT_REGEX);
    const videoId = match![1];
    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

    // Determine sort order
    const [maxSort] = await db
      .select({ maxSort: max(media.sortOrder) })
      .from(media)
      .where(and(eq(media.lotId, lotId), isNull(media.deletedAt)));
    const sortOrder = (maxSort?.maxSort ?? -1) + 1;

    const [record] = await db
      .insert(media)
      .values({
        lotId,
        mediaType: 'youtube',
        url,
        thumbnailUrl,
        sortOrder,
        isPrimary: false,
        uploadedBy: admin.id,
      })
      .returning();

    return NextResponse.json({ media: record }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('YouTube media POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
