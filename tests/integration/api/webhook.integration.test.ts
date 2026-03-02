import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { createRequest, callRouteHandler } from '@/tests/helpers/api';
import { getTestDb } from '@/tests/helpers/db';

const mockAuth = vi.hoisted(() => {
  const _g = globalThis as Record<string, unknown>;
  if (!_g._omenaMockAuth) {
    _g._omenaMockSession = null;
    _g._omenaMockAuth = vi.fn().mockImplementation(async () => _g._omenaMockSession);
  }
  return _g._omenaMockAuth as ReturnType<typeof vi.fn>;
});

vi.mock('@/lib/auth', () => ({
  auth: mockAuth,
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: { GET: vi.fn(), POST: vi.fn() },
}));

vi.mock('@/lib/audit', () => ({
  logCreate: vi.fn().mockResolvedValue(undefined),
  logUpdate: vi.fn().mockResolvedValue(undefined),
  logDelete: vi.fn().mockResolvedValue(undefined),
}));

// Mock the payment service
vi.mock('@/lib/payment-service', () => ({
  createPaymentIntent: vi.fn().mockResolvedValue({
    clientSecret: 'pi_test_secret',
    paymentId: 'pay_test_123',
    amount: 12300,
  }),
  handlePaymentWebhook: vi.fn().mockResolvedValue(undefined),
}));

// Mock Stripe module — webhook handler imports stripe dynamically
vi.mock('@/lib/stripe', () => ({
  stripe: {
    paymentIntents: {
      create: vi.fn(),
      retrieve: vi.fn(),
    },
    webhooks: {
      constructEvent: vi.fn().mockImplementation((payload: Buffer) => {
        return JSON.parse(payload.toString());
      }),
    },
  },
}));

describe('POST /api/payments/webhook', () => {
  const WEBHOOK_SECRET = 'whsec_test_secret';

  beforeAll(() => {
    process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });

  afterAll(() => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  function createWebhookRequest(eventType: string, eventData: Record<string, unknown>) {
    const event = {
      id: `evt_test_${Date.now()}`,
      type: eventType,
      data: { object: eventData },
    };
    const body = JSON.stringify(event);
    return new Request('http://localhost:3002/api/payments/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 'test_sig_123',
      },
      body,
    });
  }

  it('returns 400 when stripe-signature header is missing', async () => {
    const { POST } = await import('@/app/api/payments/webhook/route');

    const request = new Request('http://localhost:3002/api/payments/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'payment_intent.succeeded' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toHaveProperty('error', 'Missing stripe-signature header');
  });

  it('handles payment_intent.succeeded event', async () => {
    const { POST } = await import('@/app/api/payments/webhook/route');
    const { handlePaymentWebhook } = await import('@/lib/payment-service');

    const request = createWebhookRequest('payment_intent.succeeded', {
      id: 'pi_test_123',
      status: 'succeeded',
      amount: 12000,
      metadata: { invoiceId: 'inv_test_123' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('received', true);
    expect(handlePaymentWebhook).toHaveBeenCalled();
  });

  it('handles payment_intent.payment_failed event', async () => {
    const { POST } = await import('@/app/api/payments/webhook/route');
    const { handlePaymentWebhook } = await import('@/lib/payment-service');

    const request = createWebhookRequest('payment_intent.payment_failed', {
      id: 'pi_test_456',
      status: 'requires_payment_method',
      metadata: { invoiceId: 'inv_test_456' },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('received', true);
    expect(handlePaymentWebhook).toHaveBeenCalled();
  });

  it('returns 400 when signature verification fails', async () => {
    const { POST } = await import('@/app/api/payments/webhook/route');
    const { stripe } = await import('@/lib/stripe');

    // Make constructEvent throw an error
    (stripe.webhooks.constructEvent as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw new Error('No signatures found matching the expected signature for payload');
    });

    const request = createWebhookRequest('payment_intent.succeeded', { id: 'pi_bad' });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect((data as Record<string, string>).error).toContain('Webhook error');
  });

  it('returns 500 when STRIPE_WEBHOOK_SECRET is not configured', async () => {
    const { POST } = await import('@/app/api/payments/webhook/route');

    delete process.env.STRIPE_WEBHOOK_SECRET;
    try {
      const request = createWebhookRequest('payment_intent.succeeded', { id: 'pi_test' });
      const response = await POST(request);
      expect(response.status).toBe(500);
    } finally {
      process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
    }
  });
});
