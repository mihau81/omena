import { NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { generateInvoice, getInvoice } from '@/lib/invoice-service';
import { db } from '@/db/connection';
import { invoices } from '@/db/schema';
import { eq } from 'drizzle-orm';

// ─── POST: Generate invoice for a sold lot ──────────────────────────────────

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ lotId: string }> },
) {
  try {
    await requireAdmin('invoices:manage');
    const { lotId } = await params;

    const created = await generateInvoice(lotId);
    const withDetails = await getInvoice(created.id);

    return NextResponse.json({ invoice: withDetails }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Admin lot invoice POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── GET: Fetch invoice for a specific lot ──────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ lotId: string }> },
) {
  try {
    await requireAdmin('invoices:manage');
    const { lotId } = await params;

    const [row] = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.lotId, lotId))
      .limit(1);

    if (!row) {
      return NextResponse.json({ invoice: null });
    }

    const invoice = await getInvoice(row.id);
    return NextResponse.json({ invoice });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Admin lot invoice GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
