import { NextResponse } from 'next/server';
import { eq, and, isNull, asc } from 'drizzle-orm';
import { db } from '@/db/connection';
import { lots, media } from '@/db/schema';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { updateLotSchema } from '@/lib/validation/lot';
import { logUpdate, logDelete } from '@/lib/audit';

// ─── GET: Full lot detail with media ────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin('lots:read');
    const { id } = await params;

    const [lot] = await db
      .select()
      .from(lots)
      .where(and(eq(lots.id, id), isNull(lots.deletedAt)))
      .limit(1);

    if (!lot) {
      return NextResponse.json({ error: 'Lot not found' }, { status: 404 });
    }

    const lotMedia = await db
      .select()
      .from(media)
      .where(and(eq(media.lotId, id), isNull(media.deletedAt)))
      .orderBy(asc(media.sortOrder));

    return NextResponse.json({ lot, media: lotMedia });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Admin lot GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PATCH: Update lot fields ───────────────────────────────────────────────

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin('lots:write');
    const { id } = await params;

    const body = await request.json();
    const parsed = updateLotSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const [existing] = await db
      .select()
      .from(lots)
      .where(and(eq(lots.id, id), isNull(lots.deletedAt)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Lot not found' }, { status: 404 });
    }

    const data = parsed.data;
    const updateValues: Record<string, unknown> = {
      updatedAt: new Date(),
      updatedBy: admin.id,
    };

    if (data.lotNumber !== undefined) updateValues.lotNumber = data.lotNumber;
    if (data.title !== undefined) updateValues.title = data.title;
    if (data.artist !== undefined) updateValues.artist = data.artist;
    if (data.description !== undefined) updateValues.description = data.description;
    if (data.medium !== undefined) updateValues.medium = data.medium;
    if (data.dimensions !== undefined) updateValues.dimensions = data.dimensions;
    if (data.year !== undefined) updateValues.year = data.year;
    if (data.estimateMin !== undefined) updateValues.estimateMin = data.estimateMin;
    if (data.estimateMax !== undefined) updateValues.estimateMax = data.estimateMax;
    if (data.reservePrice !== undefined) updateValues.reservePrice = data.reservePrice;
    if (data.startingBid !== undefined) updateValues.startingBid = data.startingBid;
    if (data.visibilityOverride !== undefined) updateValues.visibilityOverride = data.visibilityOverride;
    if (data.provenance !== undefined) updateValues.provenance = data.provenance;
    if (data.exhibitions !== undefined) updateValues.exhibitions = data.exhibitions;
    if (data.literature !== undefined) updateValues.literature = data.literature;
    if (data.conditionNotes !== undefined) updateValues.conditionNotes = data.conditionNotes;
    if (data.notes !== undefined) updateValues.notes = data.notes;
    if (data.consignorId !== undefined) updateValues.consignorId = data.consignorId;

    const [updated] = await db
      .update(lots)
      .set(updateValues)
      .where(eq(lots.id, id))
      .returning();

    await logUpdate(
      'lots',
      id,
      existing as unknown as Record<string, unknown>,
      updated as unknown as Record<string, unknown>,
      admin.id,
      'admin',
    );

    return NextResponse.json({ lot: updated });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Admin lot PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE: Soft-delete lot ────────────────────────────────────────────────

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin('lots:write');
    const { id } = await params;

    const [existing] = await db
      .select()
      .from(lots)
      .where(and(eq(lots.id, id), isNull(lots.deletedAt)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Lot not found' }, { status: 404 });
    }

    const [deleted] = await db
      .update(lots)
      .set({ deletedAt: new Date(), updatedBy: admin.id })
      .where(eq(lots.id, id))
      .returning();

    await logDelete(
      'lots',
      id,
      existing as unknown as Record<string, unknown>,
      admin.id,
      'admin',
    );

    return NextResponse.json({ lot: deleted });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Admin lot DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
