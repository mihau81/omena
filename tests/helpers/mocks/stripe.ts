import { vi } from 'vitest';
import type Stripe from 'stripe';

// ─── Mock payment intents store ───────────────────────────────────────────────

const mockPaymentIntents = new Map<string, Stripe.PaymentIntent>();

let intentCounter = 0;

export function createMockPaymentIntent(
  overrides: Partial<Stripe.PaymentIntent> = {},
): Stripe.PaymentIntent {
  const id = `pi_test_${++intentCounter}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const intent = {
    id,
    object: 'payment_intent',
    amount: 10000,
    amount_capturable: 0,
    amount_details: { tip: {} },
    amount_received: 0,
    application: null,
    application_fee_amount: null,
    automatic_payment_methods: null,
    canceled_at: null,
    cancellation_reason: null,
    capture_method: 'automatic',
    client_secret: `${id}_secret_test`,
    confirmation_method: 'automatic',
    created: Math.floor(Date.now() / 1000),
    currency: 'pln',
    customer: null,
    customer_account: null,
    description: null,
    last_payment_error: null,
    latest_charge: null,
    livemode: false,
    metadata: {},
    next_action: null,
    on_behalf_of: null,
    payment_method: null,
    payment_method_configuration_details: null,
    payment_method_options: {},
    payment_method_types: ['card'],
    processing: null,
    receipt_email: null,
    review: null,
    setup_future_usage: null,
    shipping: null,
    source: null,
    statement_descriptor: null,
    statement_descriptor_suffix: null,
    status: 'requires_payment_method',
    transfer_data: null,
    transfer_group: null,
    ...overrides,
  } as Stripe.PaymentIntent;
  mockPaymentIntents.set(id, intent);
  return intent;
}

// ─── Stripe mock module ───────────────────────────────────────────────────────

export const mockStripe = {
  paymentIntents: {
    create: vi.fn().mockImplementation(
      async (params: Stripe.PaymentIntentCreateParams) => {
        return createMockPaymentIntent({
          amount: params.amount,
          currency: params.currency,
          metadata: params.metadata as Record<string, string>,
        });
      },
    ),
    retrieve: vi.fn().mockImplementation(async (id: string) => {
      const intent = mockPaymentIntents.get(id);
      if (!intent) throw new Error(`No such payment_intent: '${id}'`);
      return intent;
    }),
    confirm: vi.fn().mockImplementation(async (id: string) => {
      const intent = mockPaymentIntents.get(id);
      if (!intent) throw new Error(`No such payment_intent: '${id}'`);
      const updated = { ...intent, status: 'succeeded' as const };
      mockPaymentIntents.set(id, updated);
      return updated;
    }),
    cancel: vi.fn().mockImplementation(async (id: string) => {
      const intent = mockPaymentIntents.get(id);
      if (!intent) throw new Error(`No such payment_intent: '${id}'`);
      const updated = { ...intent, status: 'canceled' as const };
      mockPaymentIntents.set(id, updated);
      return updated;
    }),
  },
  webhooks: {
    constructEvent: vi.fn().mockImplementation(
      (payload: string | Buffer, _sig: string, _secret: string) => {
        const body = typeof payload === 'string' ? payload : payload.toString();
        return JSON.parse(body);
      },
    ),
  },
};

/**
 * Clears all stored mock payment intents and resets call history.
 */
export function resetStripeMocks() {
  mockPaymentIntents.clear();
  intentCounter = 0;
  vi.clearAllMocks();
}

/**
 * Simulates a Stripe webhook event for testing webhook handlers.
 */
export function createWebhookEvent(
  type: string,
  data: Stripe.Event.Data,
): Stripe.Event {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return {
    id: `evt_test_${Date.now()}`,
    object: 'event',
    api_version: '2026-02-25.clover',
    created: Math.floor(Date.now() / 1000),
    data,
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
    type: type as Stripe.Event['type'],
  } as Stripe.Event;
}
