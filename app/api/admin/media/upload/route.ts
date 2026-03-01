import { NextResponse } from 'next/server';
import { eq, and, isNull, max } from 'drizzle-orm';
import { db } from '@/db/connection';
import { media, lots } from '@/db/schema';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { processAndUploadImage } from '@/lib/image-pipeline';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin('media:write');

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const lotId = formData.get('lotId') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!lotId) {
      return NextResponse.json({ error: 'lotId is required' }, { status: 400 });
    }

    // Validate lot exists
    const [lot] = await db
      .select({ id: lots.id })
      .from(lots)
      .where(and(eq(lots.id, lotId), isNull(lots.deletedAt)))
      .limit(1);

    if (!lot) {
      return NextResponse.json({ error: 'Lot not found' }, { status: 404 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type: ${file.type}. Allowed: jpg, png, webp` },
        { status: 400 },
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Validate file magic bytes (don't trust client Content-Type)
    const MAGIC_BYTES: Record<string, number[]> = {
      'image/jpeg': [0xFF, 0xD8, 0xFF],
      'image/png': [0x89, 0x50, 0x4E, 0x47],
      'image/webp': [0x52, 0x49, 0x46, 0x46], // RIFF header
    };
    const header = [...buffer.subarray(0, 4)];
    const isValidMagic = Object.values(MAGIC_BYTES).some(
      (magic) => magic.every((byte, i) => header[i] === byte),
    );
    if (!isValidMagic) {
      return NextResponse.json(
        { error: 'Invalid file content. File does not appear to be a valid image.' },
        { status: 400 },
      );
    }

    const processed = await processAndUploadImage(buffer, file.name);

    // Determine sort order
    const [maxSort] = await db
      .select({ maxSort: max(media.sortOrder) })
      .from(media)
      .where(and(eq(media.lotId, lotId), isNull(media.deletedAt)));
    const sortOrder = (maxSort?.maxSort ?? -1) + 1;

    // Check if this is the first image (make it primary)
    const existingMedia = await db
      .select({ id: media.id })
      .from(media)
      .where(and(eq(media.lotId, lotId), isNull(media.deletedAt)))
      .limit(1);
    const isPrimary = existingMedia.length === 0;

    const [record] = await db
      .insert(media)
      .values({
        lotId,
        mediaType: 'image',
        url: processed.url,
        thumbnailUrl: processed.thumbnailUrl,
        mediumUrl: processed.mediumUrl,
        largeUrl: processed.largeUrl,
        originalFilename: file.name,
        mimeType: processed.mimeType,
        fileSize: processed.fileSize,
        width: processed.width,
        height: processed.height,
        sortOrder,
        isPrimary,
        uploadedBy: admin.id,
      })
      .returning();

    return NextResponse.json({ media: record }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Media upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
