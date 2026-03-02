import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { getSettlementById, updateSettlementStatus } from '@/db/queries/settlements';

type RouteParams = { params: Promise<{ id: string }> };

// ─── GET: Settlement detail with items ────────────────────────────────────────

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin('invoices:manage');
    const { id } = await params;

    const settlement = await getSettlementById(id);
    if (!settlement) {
      return NextResponse.json({ error: 'Settlement not found' }, { status: 404 });
    }

    return NextResponse.json({ settlement });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Admin settlement GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PATCH: Update settlement status ─────────────────────────────────────────

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin('invoices:manage');
    const { id } = await params;

    const existing = await getSettlementById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Settlement not found' }, { status: 404 });
    }

    const body = await request.json();
    const { status, bankReference, notes } = body;

    const validStatuses = ['pending', 'approved', 'paid'];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${validStatuses.join(', ')}` },
        { status: 400 },
      );
    }

    // Validate transitions
    const allowedTransitions: Record<string, string[]> = {
      pending:  ['approved'],
      approved: ['paid'],
      paid:     [],
    };
    const allowed = allowedTransitions[existing.status] ?? [];
    if (!allowed.includes(status)) {
      return NextResponse.json(
        { error: `Cannot transition from '${existing.status}' to '${status}'` },
        { status: 422 },
      );
    }

    if (status === 'paid' && !bankReference) {
      return NextResponse.json(
        { error: 'bankReference is required when marking as paid' },
        { status: 400 },
      );
    }

    const updated = await updateSettlementStatus(
      id,
      status as 'pending' | 'approved' | 'paid',
      bankReference ?? null,
      notes ?? null,
    );

    return NextResponse.json({ settlement: updated });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Admin settlement PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
