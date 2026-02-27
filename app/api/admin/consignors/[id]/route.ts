import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import {
  getConsignorById,
  getConsignorLots,
  updateConsignor,
  deleteConsignor,
} from '@/db/queries/consignors';
import { updateConsignorSchema } from '@/lib/validation/consignor';
import { logUpdate, logDelete } from '@/lib/audit';

type RouteParams = { params: Promise<{ id: string }> };

// ─── GET: Consignor detail + lots ────────────────────────────────────────────

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await requireAdmin('lots:read');
    const { id } = await params;

    const consignor = await getConsignorById(id);
    if (!consignor) {
      return NextResponse.json({ error: 'Consignor not found' }, { status: 404 });
    }

    const lots = await getConsignorLots(id);

    return NextResponse.json({ consignor, lots });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Get consignor error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PATCH: Update consignor ─────────────────────────────────────────────────

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireAdmin('lots:write');
    const { id } = await params;

    const existing = await getConsignorById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Consignor not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updateConsignorSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    if (Object.keys(parsed.data).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const updated = await updateConsignor(id, parsed.data);

    const oldData: Record<string, unknown> = {};
    const newData: Record<string, unknown> = {};
    for (const key of Object.keys(parsed.data) as (keyof typeof parsed.data)[]) {
      oldData[key] = existing[key as keyof typeof existing];
      newData[key] = parsed.data[key];
    }
    await logUpdate('consignors', id, oldData, newData, admin.id, 'admin');

    return NextResponse.json({ consignor: updated });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Update consignor error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE: Soft-delete consignor ───────────────────────────────────────────

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireAdmin('lots:write');
    const { id } = await params;

    const existing = await getConsignorById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Consignor not found' }, { status: 404 });
    }

    await deleteConsignor(id);

    await logDelete(
      'consignors',
      id,
      { name: existing.name, email: existing.email },
      admin.id,
      'admin',
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Delete consignor error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
