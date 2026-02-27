import { NextResponse } from 'next/server';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@/db/connection';
import { auctions } from '@/db/schema';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { updateAuctionStatusSchema } from '@/lib/validation/auction';
import { logUpdate } from '@/lib/audit';

// Valid status transitions
const VALID_TRANSITIONS: Record<string, string> = {
  draft: 'preview',
  preview: 'live',
  live: 'reconciliation',
  reconciliation: 'archive',
};

// ─── PATCH: Change auction status ────────────────────────────────────────────

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireAdmin('auctions:status');
    const { id } = await params;

    const body = await request.json();
    const parsed = updateAuctionStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const newStatus = parsed.data.status;

    // Fetch current auction
    const [existing] = await db
      .select()
      .from(auctions)
      .where(and(eq(auctions.id, id), isNull(auctions.deletedAt)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 });
    }

    // Validate status transition
    const allowedNext = VALID_TRANSITIONS[existing.status];
    if (allowedNext !== newStatus) {
      return NextResponse.json(
        {
          error: 'Invalid status transition',
          details: {
            currentStatus: existing.status,
            requestedStatus: newStatus,
            allowedTransition: allowedNext ?? 'none (terminal state)',
          },
        },
        { status: 422 },
      );
    }

    const [updated] = await db
      .update(auctions)
      .set({
        status: newStatus,
        updatedAt: new Date(),
        updatedBy: admin.id,
      })
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
    console.error('Admin auction status PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
