import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/connection';
import { media } from '@/db/schema';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { z } from 'zod';

const reorderSchema = z.object({
  items: z.array(z.object({
    id: z.string().uuid(),
    sortOrder: z.number().int().min(0),
  })),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ lotId: string }> },
) {
  try {
    await requireAdmin('media:write');
    const { lotId } = await params;

    const body = await request.json();
    const parsed = reorderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { items } = parsed.data;

    // Update sort orders in a transaction
    await db.transaction(async (tx) => {
      for (const item of items) {
        await tx
          .update(media)
          .set({ sortOrder: item.sortOrder })
          .where(eq(media.id, item.id));
      }
    });

    return NextResponse.json({ success: true, lotId });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Media reorder error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
