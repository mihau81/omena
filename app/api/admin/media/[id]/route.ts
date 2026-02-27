import { NextResponse } from 'next/server';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@/db/connection';
import { media } from '@/db/schema';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { logDelete } from '@/lib/audit';

// ─── PATCH: Set as primary image ────────────────────────────────────────────

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin('media:write');
    const { id } = await params;

    const body = await request.json();

    const [existing] = await db
      .select()
      .from(media)
      .where(and(eq(media.id, id), isNull(media.deletedAt)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }

    if (body.isPrimary === true && existing.lotId) {
      // Unset all other primary flags for this lot
      await db
        .update(media)
        .set({ isPrimary: false })
        .where(and(eq(media.lotId, existing.lotId), isNull(media.deletedAt)));

      // Set this one as primary
      await db
        .update(media)
        .set({ isPrimary: true })
        .where(eq(media.id, id));
    }

    const [updated] = await db
      .select()
      .from(media)
      .where(eq(media.id, id))
      .limit(1);

    return NextResponse.json({ media: updated });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Media PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE: Soft-delete media ──────────────────────────────────────────────

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin('media:write');
    const { id } = await params;

    const [existing] = await db
      .select()
      .from(media)
      .where(and(eq(media.id, id), isNull(media.deletedAt)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }

    await db
      .update(media)
      .set({ deletedAt: new Date() })
      .where(eq(media.id, id));

    await logDelete(
      'media',
      id,
      existing as unknown as Record<string, unknown>,
      admin.id,
      'admin',
    );

    // If this was primary, promote the next one
    if (existing.isPrimary && existing.lotId) {
      const [next] = await db
        .select()
        .from(media)
        .where(and(eq(media.lotId, existing.lotId), isNull(media.deletedAt)))
        .orderBy(media.sortOrder)
        .limit(1);

      if (next) {
        await db
          .update(media)
          .set({ isPrimary: true })
          .where(eq(media.id, next.id));
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Media DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
