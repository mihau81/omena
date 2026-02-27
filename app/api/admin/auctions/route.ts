import { NextResponse } from 'next/server';
import { eq, asc, and, isNull, count } from 'drizzle-orm';
import { db } from '@/db/connection';
import { auctions, lots } from '@/db/schema';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { createAuctionSchema } from '@/lib/validation/auction';
import { logCreate } from '@/lib/audit';

// ─── GET: List all auctions (admin sees everything including drafts) ─────────

export async function GET() {
  try {
    await requireAdmin('auctions:read');

    const rows = await db
      .select({
        auction: auctions,
        lotCount: count(lots.id),
      })
      .from(auctions)
      .leftJoin(lots, and(eq(lots.auctionId, auctions.id), isNull(lots.deletedAt)))
      .where(isNull(auctions.deletedAt))
      .groupBy(auctions.id)
      .orderBy(asc(auctions.sortOrder));

    const result = rows.map((row) => ({
      ...row.auction,
      lotCount: row.lotCount,
    }));

    return NextResponse.json({ auctions: result });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Admin auctions GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST: Create a new auction ──────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin('auctions:write');

    const body = await request.json();
    const parsed = createAuctionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const data = parsed.data;

    // Check slug uniqueness
    const existing = await db
      .select({ id: auctions.id })
      .from(auctions)
      .where(eq(auctions.slug, data.slug))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: 'Slug already exists', details: { fieldErrors: { slug: ['This slug is already in use'] } } },
        { status: 409 },
      );
    }

    const [created] = await db.insert(auctions).values({
      title: data.title,
      slug: data.slug,
      description: data.description,
      category: data.category,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      location: data.location,
      curator: data.curator,
      visibilityLevel: data.visibilityLevel,
      buyersPremiumRate: data.buyersPremiumRate,
      notes: data.notes,
      createdBy: admin.id,
      updatedBy: admin.id,
    }).returning();

    await logCreate('auctions', created.id, created as unknown as Record<string, unknown>, admin.id, 'admin');

    return NextResponse.json({ auction: created }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Admin auctions POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
