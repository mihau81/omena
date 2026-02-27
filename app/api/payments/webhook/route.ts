import { NextResponse } from 'next/server';
import { handlePaymentWebhook } from '@/lib/payment-service';

export const dynamic = 'force-dynamic';

// ─── POST /api/payments/webhook ──────────────────────────────────────────────
// Stripe webhook handler.
// Processes: payment_intent.succeeded, payment_intent.payment_failed,
//            payment_intent.processing

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('[payments/webhook] STRIPE_WEBHOOK_SECRET is not configured');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  // Read the raw body for signature verification
  const rawBody = await request.arrayBuffer();
  const bodyBuffer = Buffer.from(rawBody);

  let event;
  try {
    const { stripe } = await import('@/lib/stripe');
    event = stripe.webhooks.constructEvent(bodyBuffer, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Signature verification failed';
    console.error('[payments/webhook] Signature verification failed:', message);
    return NextResponse.json({ error: `Webhook error: ${message}` }, { status: 400 });
  }

  try {
    await handlePaymentWebhook(event);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[payments/webhook] Handler error:', error);
    // Return 200 so Stripe does not retry — the error has been logged
    return NextResponse.json({ received: true, error: 'Handler error logged' });
  }
}
