import { NextResponse } from 'next/server';
import { eq, and, isNull, count } from 'drizzle-orm';
import { db } from '@/db/connection';
import { auctions, lots } from '@/db/schema';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { updateAuctionSchema } from '@/lib/validation/auction';
import { logUpdate, logDelete } from '@/lib/audit';

// ─── GET: Full auction detail with lot count ─────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin('auctions:read');
    const { id } = await params;

    const rows = await db
      .select({
        auction: auctions,
        lotCount: count(lots.id),
      })
      .from(auctions)
      .leftJoin(lots, and(eq(lots.auctionId, auctions.id), isNull(lots.deletedAt)))
      .where(and(eq(auctions.id, id), isNull(auctions.deletedAt)))
      .groupBy(auctions.id)
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
    }

    return NextResponse.json({
      auction: { ...rows[0].auction, lotCount: rows[0].lotCount },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Admin auction GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PATCH: Update auction fields ────────────────────────────────────────────

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin('auctions:write');
    const { id } = await params;

    const body = await request.json();
    const parsed = updateAuctionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    // Fetch existing
    const [existing] = await db
      .select()
      .from(auctions)
      .where(and(eq(auctions.id, id), isNull(auctions.deletedAt)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
    }

    const data = parsed.data;

    // If slug is being changed, check uniqueness
    if (data.slug && data.slug !== existing.slug) {
      const slugExists = await db
        .select({ id: auctions.id })
        .from(auctions)
        .where(eq(auctions.slug, data.slug))
        .limit(1);

      if (slugExists.length > 0) {
        return NextResponse.json(
          { error: 'Slug already exists', details: { fieldErrors: { slug: ['This slug is already in use'] } } },
          { status: 409 },
        );
      }
    }

    const updateValues: Record<string, unknown> = {
      updatedAt: new Date(),
      updatedBy: admin.id,
    };

    if (data.title !== undefined) updateValues.title = data.title;
    if (data.slug !== undefined) updateValues.slug = data.slug;
    if (data.description !== undefined) updateValues.description = data.description;
    if (data.category !== undefined) updateValues.category = data.category;
    if (data.startDate !== undefined) updateValues.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) updateValues.endDate = new Date(data.endDate);
    if (data.location !== undefined) updateValues.location = data.location;
    if (data.curator !== undefined) updateValues.curator = data.curator;
    if (data.visibilityLevel !== undefined) updateValues.visibilityLevel = data.visibilityLevel;
    if (data.buyersPremiumRate !== undefined) updateValues.buyersPremiumRate = data.buyersPremiumRate;
    if (data.notes !== undefined) updateValues.notes = data.notes;

    const [updated] = await db
      .update(auctions)
      .set(updateValues)
      .where(eq(auctions.id, id))
      .returning();

    await logUpdate(
      'auctions',
      id,
      existing as unknown as Record<string, unknown>,
      updated as unknown as Record<string, unknown>,
      admin.id,
      'admin',
    );

    return NextResponse.json({ auction: updated });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Admin auction PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE: Soft-delete auction ─────────────────────────────────────────────

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin('auctions:write');
    const { id } = await params;

    const [existing] = await db
      .select()
      .from(auctions)
      .where(and(eq(auctions.id, id), isNull(auctions.deletedAt)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
    }

    const [deleted] = await db
      .update(auctions)
      .set({ deletedAt: new Date(), updatedBy: admin.id })
      .where(eq(auctions.id, id))
      .returning();

    await logDelete(
      'auctions',
      id,
      existing as unknown as Record<string, unknown>,
      admin.id,
      'admin',
    );

    return NextResponse.json({ auction: deleted });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Admin auction DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
