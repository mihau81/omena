import { NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { listSettlements, generateSettlement } from '@/db/queries/settlements';

// ─── GET: List settlements with optional filters ──────────────────────────────

export async function GET(request: Request) {
  try {
    await requireAdmin('invoices:manage');

    const { searchParams } = new URL(request.url);
    const consignorId = searchParams.get('consignorId') ?? undefined;
    const auctionId   = searchParams.get('auctionId') ?? undefined;
    const status      = searchParams.get('status') ?? undefined;
    const limit       = parseInt(searchParams.get('limit') ?? '100', 10);
    const offset      = parseInt(searchParams.get('offset') ?? '0', 10);

    const data = await listSettlements({ consignorId, auctionId, status, limit, offset });

    return NextResponse.json({ settlements: data });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Admin settlements GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST: Generate settlement for consignor + auction ────────────────────────

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin('invoices:manage');

    const body = await request.json();
    const { consignorId, auctionId } = body;

    if (!consignorId || typeof consignorId !== 'string') {
      return NextResponse.json({ error: 'consignorId is required' }, { status: 400 });
    }
    if (!auctionId || typeof auctionId !== 'string') {
      return NextResponse.json({ error: 'auctionId is required' }, { status: 400 });
    }

    const settlement = await generateSettlement({
      consignorId,
      auctionId,
      createdBy: admin.id,
    });

    return NextResponse.json({ settlement }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof Error) {
      // Business logic errors (duplicate, no lots, etc.)
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error('Admin settlements POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
