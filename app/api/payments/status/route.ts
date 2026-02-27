import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireAuth, AuthError } from '@/lib/auth-utils';
import { getPaymentStatus } from '@/lib/payment-service';
import { db } from '@/db/connection';
import { invoices } from '@/db/schema';

export const dynamic = 'force-dynamic';

// ─── GET /api/payments/status?invoiceId=xxx ───────────────────────────────────
// Returns the latest payment status for a given invoice.
// Accessible by the invoice owner or admin.

export async function GET(request: Request) {
  try {
    const user = await requireAuth();

    const { searchParams } = new URL(request.url);
    const invoiceId = searchParams.get('invoiceId');

    if (!invoiceId) {
      return NextResponse.json({ error: 'invoiceId query parameter is required' }, { status: 400 });
    }

    // Verify invoice ownership (unless admin)
    if (user.userType !== 'admin') {
      const [invoice] = await db
        .select({ userId: invoices.userId })
        .from(invoices)
        .where(eq(invoices.id, invoiceId))
        .limit(1);

      if (!invoice) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
      }

      if (invoice.userId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const payment = await getPaymentStatus(invoiceId);

    return NextResponse.json({ payment });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('[payments/status] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
