import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireAuth, AuthError } from '@/lib/auth-utils';
import { createPaymentIntent } from '@/lib/payment-service';
import { db } from '@/db/connection';
import { invoices } from '@/db/schema';

export const dynamic = 'force-dynamic';

// ─── POST /api/payments/create-intent ────────────────────────────────────────
// Creates a Stripe PaymentIntent for the given invoice.
// Body: { invoiceId: string }
// Returns: { clientSecret, paymentId, amount }

export async function POST(request: Request) {
  try {
    const user = await requireAuth();

    if (user.userType !== 'user') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { invoiceId } = body as { invoiceId?: string };

    if (!invoiceId || typeof invoiceId !== 'string') {
      return NextResponse.json({ error: 'invoiceId is required' }, { status: 400 });
    }

    // Verify the invoice belongs to the authenticated user
    const [invoice] = await db
      .select({ id: invoices.id, userId: invoices.userId, status: invoices.status })
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (invoice.status === 'paid') {
      return NextResponse.json({ error: 'Invoice is already paid' }, { status: 400 });
    }

    if (invoice.status === 'cancelled') {
      return NextResponse.json({ error: 'Invoice is cancelled' }, { status: 400 });
    }

    const result = await createPaymentIntent(invoiceId);

    return NextResponse.json({
      clientSecret: result.clientSecret,
      paymentId: result.paymentId,
      amount: result.amount,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    if (error instanceof Error) {
      // Sanitize error — don't leak Stripe internal details to client
      const safeMessage = error.message.includes('Stripe')
        ? 'Payment processing error. Please try again.'
        : error.message;
      return NextResponse.json({ error: safeMessage }, { status: 400 });
    }
    console.error('[payments/create-intent] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
