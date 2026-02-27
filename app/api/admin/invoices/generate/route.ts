import { NextResponse } from 'next/server';
import { eq, and, isNull } from 'drizzle-orm';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { generateInvoice, getInvoice } from '@/lib/invoice-service';
import { db } from '@/db/connection';
import { lots, invoices } from '@/db/schema';

// ─── POST: Generate invoice(s) ──────────────────────────────────────────────
//
// Body shapes:
//   { lotId: string }       — generate a single invoice for one sold lot
//   { auctionId: string }   — batch-generate invoices for ALL sold lots in auction

export async function POST(request: Request) {
  try {
    await requireAdmin('invoices:manage');

    const body = await request.json();
    const { lotId, auctionId } = body as { lotId?: string; auctionId?: string };

    // ── Single lot ──────────────────────────────────────────────────────────
    if (lotId) {
      const created = await generateInvoice(lotId);
      const withDetails = await getInvoice(created.id);
      return NextResponse.json({ invoice: withDetails }, { status: 201 });
    }

    // ── Batch for auction ───────────────────────────────────────────────────
    if (auctionId) {
      // Find all sold lots in this auction that do NOT yet have an invoice
      const soldLots = await db
        .select({ id: lots.id })
        .from(lots)
        .where(
          and(
            eq(lots.auctionId, auctionId),
            eq(lots.status, 'sold'),
            isNull(lots.deletedAt),
          ),
        );

      if (soldLots.length === 0) {
        return NextResponse.json(
          { message: 'No sold lots found for this auction', generated: 0, skipped: 0, errors: [] },
          { status: 200 },
        );
      }

      // Filter out lots that already have invoices
      const existingInvoices = await db
        .select({ lotId: invoices.lotId })
        .from(invoices)
        .where(eq(invoices.auctionId, auctionId));

      const alreadyInvoiced = new Set(existingInvoices.map((r) => r.lotId));

      const lotsToProcess = soldLots.filter((l) => !alreadyInvoiced.has(l.id));
      const skipped = soldLots.length - lotsToProcess.length;

      const generated: string[] = [];
      const errors: Array<{ lotId: string; error: string }> = [];

      for (const lot of lotsToProcess) {
        try {
          const created = await generateInvoice(lot.id);
          generated.push(created.id);
        } catch (err) {
          errors.push({
            lotId: lot.id,
            error: err instanceof Error ? err.message : 'Unknown error',
          });
        }
      }

      return NextResponse.json(
        {
          message: `Generated ${generated.length} invoice(s)`,
          generated: generated.length,
          skipped,
          errors,
          invoiceIds: generated,
        },
        { status: 201 },
      );
    }

    return NextResponse.json(
      { error: 'Provide either lotId or auctionId' },
      { status: 400 },
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Admin invoices generate POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
