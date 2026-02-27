import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { getConsignors, createConsignor } from '@/db/queries/consignors';
import { createConsignorSchema } from '@/lib/validation/consignor';
import { logCreate } from '@/lib/audit';

// ─── GET: List consignors with search + pagination ───────────────────────────

export async function GET(request: NextRequest) {
  try {
    await requireAdmin('lots:read');

    const { searchParams } = request.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const search = searchParams.get('search') || undefined;
    const isActiveParam = searchParams.get('isActive');
    const isActive = isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : undefined;

    const result = await getConsignors({ search, isActive, page, limit });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('List consignors error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST: Create consignor ──────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin('lots:write');

    const body = await request.json();
    const parsed = createConsignorSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const consignor = await createConsignor(parsed.data);

    await logCreate(
      'consignors',
      consignor.id,
      consignor as unknown as Record<string, unknown>,
      admin.id,
      'admin',
    );

    return NextResponse.json({ consignor }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Create consignor error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
