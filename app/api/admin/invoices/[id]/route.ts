import { NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { getInvoice, updateInvoiceStatus, type InvoiceStatus } from '@/lib/invoice-service';
import { generateInvoiceHTML } from '@/lib/invoice-pdf';

const VALID_STATUSES: InvoiceStatus[] = ['pending', 'sent', 'paid', 'overdue', 'cancelled'];

// ─── GET: Fetch single invoice (with HTML download option) ──────────────────

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin('invoices:manage');
    const { id } = await params;

    const invoice = await getInvoice(id);
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // If ?format=html, return the printable HTML invoice
    const { searchParams } = new URL(request.url);
    if (searchParams.get('format') === 'html') {
      const html = generateInvoiceHTML(invoice);
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `inline; filename="${invoice.invoiceNumber.replace(/\//g, '-')}.html"`,
        },
      });
    }

    return NextResponse.json({ invoice });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Admin invoice GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PATCH: Update invoice status ───────────────────────────────────────────

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin('invoices:manage');
    const { id } = await params;

    const body = await request.json();
    const { status, notes } = body;

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 },
      );
    }

    if (notes !== undefined) {
      // Update notes separately if provided
      const { db } = await import('@/db/connection');
      const { invoices } = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');
      await db.update(invoices).set({ notes, updatedAt: new Date() }).where(eq(invoices.id, id));
    }

    const updated = await updateInvoiceStatus(id, status as InvoiceStatus);
    return NextResponse.json({ invoice: updated });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Admin invoice PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
