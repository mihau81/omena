import { eq, desc } from 'drizzle-orm';
import type Stripe from 'stripe';
import { db } from '@/db/connection';
import { payments, invoices } from '@/db/schema';
import { logCreate, logUpdate } from '@/lib/audit';

// ─── Types ───────────────────────────────────────────────────────────────────

export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded';
export type PaymentProvider = 'stripe' | 'przelewy24' | 'transfer';

export interface PaymentRecord {
  id: string;
  invoiceId: string;
  provider: string;
  externalId: string | null;
  amount: number;
  currency: string;
  status: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ─── Create Stripe PaymentIntent ─────────────────────────────────────────────

export async function createPaymentIntent(invoiceId: string): Promise<{
  clientSecret: string;
  paymentId: string;
  amount: number;
}> {
  // Load the invoice
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);

  if (!invoice) {
    throw new Error(`Invoice ${invoiceId} not found`);
  }

  if (invoice.status === 'paid' || invoice.status === 'cancelled') {
    throw new Error(`Invoice is already ${invoice.status}`);
  }

  // Check for an existing pending/processing payment
  const [existing] = await db
    .select()
    .from(payments)
    .where(eq(payments.invoiceId, invoiceId))
    .orderBy(desc(payments.createdAt))
    .limit(1);

  // If there's an existing pending Stripe payment with a valid externalId, reuse it
  if (
    existing &&
    existing.provider === 'stripe' &&
    (existing.status === 'pending' || existing.status === 'processing') &&
    existing.externalId
  ) {
    // Retrieve the PaymentIntent from Stripe to get the latest client_secret
    const { stripe } = await import('@/lib/stripe');
    const intent = await stripe.paymentIntents.retrieve(existing.externalId);

    if (intent.status !== 'canceled' && intent.client_secret) {
      return {
        clientSecret: intent.client_secret,
        paymentId: existing.id,
        amount: existing.amount,
      };
    }
  }

  // Convert PLN (integer, already in PLN units) to grosze for Stripe
  // The invoice stores amounts in PLN (integer), Stripe expects grosze (smallest unit)
  const amountInGrosze = invoice.totalAmount * 100;

  const { stripe } = await import('@/lib/stripe');

  const intent = await stripe.paymentIntents.create({
    amount: amountInGrosze,
    currency: invoice.currency.toLowerCase(),
    metadata: {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      userId: invoice.userId,
    },
    description: `Invoice ${invoice.invoiceNumber}`,
  });

  if (!intent.client_secret) {
    throw new Error('Failed to get client_secret from Stripe PaymentIntent');
  }

  // Persist payment record
  const [created] = await db.insert(payments).values({
    invoiceId: invoice.id,
    provider: 'stripe',
    externalId: intent.id,
    amount: amountInGrosze,
    currency: invoice.currency,
    status: 'pending',
    metadata: { intentStatus: intent.status },
  }).returning();

  await logCreate(
    'payments',
    created.id,
    {
      invoiceId: created.invoiceId,
      provider: created.provider,
      externalId: created.externalId,
      amount: created.amount,
      currency: created.currency,
      status: created.status,
    },
    invoice.userId,
    'user',
  );

  return {
    clientSecret: intent.client_secret,
    paymentId: created.id,
    amount: amountInGrosze,
  };
}

// ─── Handle Stripe webhook events ────────────────────────────────────────────

export async function handlePaymentWebhook(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'payment_intent.succeeded': {
      const intent = event.data.object as Stripe.PaymentIntent;
      await onPaymentSucceeded(intent);
      break;
    }
    case 'payment_intent.payment_failed': {
      const intent = event.data.object as Stripe.PaymentIntent;
      await onPaymentFailed(intent);
      break;
    }
    case 'payment_intent.processing': {
      const intent = event.data.object as Stripe.PaymentIntent;
      await onPaymentProcessing(intent);
      break;
    }
    default:
      // Ignore other event types
      break;
  }
}

async function onPaymentSucceeded(intent: Stripe.PaymentIntent): Promise<void> {
  // Find the payment record by externalId
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.externalId, intent.id))
    .limit(1);

  if (!payment) {
    console.error(`[payment-service] No payment record found for intent ${intent.id}`);
    return;
  }

  const oldData = { status: payment.status };

  // Update payment to succeeded
  const [updated] = await db
    .update(payments)
    .set({
      status: 'succeeded',
      metadata: { ...(payment.metadata as object), intentStatus: intent.status },
      updatedAt: new Date(),
    })
    .where(eq(payments.id, payment.id))
    .returning();

  await logUpdate(
    'payments',
    payment.id,
    oldData,
    { status: 'succeeded' },
    'system',
    'system',
  );

  // Update the invoice to 'paid'
  const [invoice] = await db
    .select({ status: invoices.status })
    .from(invoices)
    .where(eq(invoices.id, payment.invoiceId))
    .limit(1);

  if (invoice && invoice.status !== 'paid') {
    const oldInvoiceData = { status: invoice.status };
    await db
      .update(invoices)
      .set({ status: 'paid', paidAt: new Date(), updatedAt: new Date() })
      .where(eq(invoices.id, payment.invoiceId));

    await logUpdate(
      'invoices',
      payment.invoiceId,
      oldInvoiceData,
      { status: 'paid', paidAt: new Date().toISOString() },
      'system',
      'system',
    );
  }

  void updated;
}

async function onPaymentFailed(intent: Stripe.PaymentIntent): Promise<void> {
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.externalId, intent.id))
    .limit(1);

  if (!payment) {
    console.error(`[payment-service] No payment record found for intent ${intent.id}`);
    return;
  }

  const oldData = { status: payment.status };

  await db
    .update(payments)
    .set({
      status: 'failed',
      metadata: {
        ...(payment.metadata as object),
        intentStatus: intent.status,
        failureCode: intent.last_payment_error?.code,
        failureMessage: intent.last_payment_error?.message,
      },
      updatedAt: new Date(),
    })
    .where(eq(payments.id, payment.id));

  await logUpdate(
    'payments',
    payment.id,
    oldData,
    { status: 'failed' },
    'system',
    'system',
  );
}

async function onPaymentProcessing(intent: Stripe.PaymentIntent): Promise<void> {
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.externalId, intent.id))
    .limit(1);

  if (!payment) return;

  await db
    .update(payments)
    .set({
      status: 'processing',
      metadata: { ...(payment.metadata as object), intentStatus: intent.status },
      updatedAt: new Date(),
    })
    .where(eq(payments.id, payment.id));
}

// ─── Get payment status for an invoice ───────────────────────────────────────

export async function getPaymentStatus(invoiceId: string): Promise<PaymentRecord | null> {
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.invoiceId, invoiceId))
    .orderBy(desc(payments.createdAt))
    .limit(1);

  if (!payment) return null;

  return {
    id: payment.id,
    invoiceId: payment.invoiceId,
    provider: payment.provider,
    externalId: payment.externalId,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    metadata: (payment.metadata ?? {}) as Record<string, unknown>,
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
  };
}

// ─── List all payments for an invoice ────────────────────────────────────────

export async function listPaymentsForInvoice(invoiceId: string): Promise<PaymentRecord[]> {
  const rows = await db
    .select()
    .from(payments)
    .where(eq(payments.invoiceId, invoiceId))
    .orderBy(desc(payments.createdAt));

  return rows.map((p) => ({
    id: p.id,
    invoiceId: p.invoiceId,
    provider: p.provider,
    externalId: p.externalId,
    amount: p.amount,
    currency: p.currency,
    status: p.status,
    metadata: (p.metadata ?? {}) as Record<string, unknown>,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));
}
