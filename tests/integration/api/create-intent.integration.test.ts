import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createRequest, callRouteHandler } from '@/tests/helpers/api';
import { getTestDb } from '@/tests/helpers/db';
import { createTestUser } from '@/tests/helpers/auth';

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

// Mock the payment service to control Stripe interaction
vi.mock('@/lib/payment-service', () => ({
  createPaymentIntent: vi.fn().mockResolvedValue({
    clientSecret: 'pi_test_secret',
    paymentId: 'pay_test_123',
    amount: 12300,
  }),
  handlePaymentWebhook: vi.fn().mockResolvedValue(undefined),
}));

describe('POST /api/payments/create-intent', () => {
  const db = getTestDb();
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let auctionId: string;
  let lotId: string;
  let invoiceId: string;

  beforeAll(async () => {
    const { randomUUID } = await import('crypto');
    const { auctions, lots, invoices } = await import('@/db/schema');

    user = await createTestUser({ email: `payment-test-user-${Date.now()}@example.com` });

    auctionId = randomUUID();
    await db.insert(auctions).values({
      id: auctionId,
      slug: `payment-test-auction-${Date.now()}`,
      title: 'Payment Test Auction',
      description: 'Test',
      category: 'mixed',
      startDate: new Date(),
      endDate: new Date(Date.now() + 3600000),
      location: 'Warsaw',
      curator: 'Test',
      status: 'archive',
      visibilityLevel: '0',
      buyersPremiumRate: '0.2000',
    });

    lotId = randomUUID();
    await db.insert(lots).values({
      id: lotId,
      auctionId,
      lotNumber: 1,
      title: 'Payment Test Artwork',
      artist: 'Test Artist',
      description: 'Test',
      medium: 'Oil',
      dimensions: '50x70',
      status: 'sold',
      hammerPrice: 10000,
    });

    invoiceId = randomUUID();
    await db.insert(invoices).values({
      id: invoiceId,
      invoiceNumber: `OMENA/2026/001-${Date.now()}`,
      userId: user.id,
      auctionId,
      lotId,
      hammerPrice: 10000,
      buyersPremium: 2000,
      totalAmount: 12000,
      currency: 'PLN',
      status: 'pending',
      dueDate: new Date(Date.now() + 14 * 24 * 3600000),
    });
  });

  afterAll(async () => {
    const { auctions, lots, invoices, payments } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');
    await db.delete(payments).where(eq(payments.invoiceId, invoiceId)).catch(() => {});
    await db.delete(invoices).where(eq(invoices.id, invoiceId)).catch(() => {});
    await db.delete(lots).where(eq(lots.id, lotId)).catch(() => {});
    await db.delete(auctions).where(eq(auctions.id, auctionId)).catch(() => {});
    await db.execute(`DELETE FROM users WHERE email LIKE 'payment-test-user-%@example.com'`);
  });

  it('creates payment intent for valid invoice', async () => {
    const { POST } = await import('@/app/api/payments/create-intent/route');
    (globalThis as any)._omenaMockSession = { user: { id: user.id, email: user.email, name: user.name, userType: 'user', visibilityLevel: 0, role: null } };

    const request = createRequest('POST', '/api/payments/create-intent', { invoiceId });
    const { status, data } = await callRouteHandler(POST, request);

    expect(status).toBe(200);
    expect(data).toHaveProperty('clientSecret');
    expect(data).toHaveProperty('paymentId');
    expect(data).toHaveProperty('amount');
  });

  it('returns 401 when unauthenticated', async () => {
    const { POST } = await import('@/app/api/payments/create-intent/route');
    (globalThis as any)._omenaMockSession = null;

    const request = createRequest('POST', '/api/payments/create-intent', { invoiceId });
    const { status } = await callRouteHandler(POST, request);

    expect(status).toBe(401);
  });

  it('returns 404 for non-existent invoice', async () => {
    const { POST } = await import('@/app/api/payments/create-intent/route');
    const { randomUUID } = await import('crypto');
    (globalThis as any)._omenaMockSession = { user: { id: user.id, email: user.email, name: user.name, userType: 'user', visibilityLevel: 0, role: null } };

    const request = createRequest('POST', '/api/payments/create-intent', { invoiceId: randomUUID() });
    const { status, data } = await callRouteHandler(POST, request);

    expect(status).toBe(404);
    expect(data).toHaveProperty('error', 'Invoice not found');
  });

  it('returns 400 for already paid invoice', async () => {
    const { POST } = await import('@/app/api/payments/create-intent/route');
    const { randomUUID } = await import('crypto');
    const { invoices } = await import('@/db/schema');

    const paidInvoiceId = randomUUID();
    await db.insert(invoices).values({
      id: paidInvoiceId,
      invoiceNumber: `OMENA/2026/PAID-${Date.now()}`,
      userId: user.id,
      auctionId,
      lotId,
      hammerPrice: 10000,
      buyersPremium: 2000,
      totalAmount: 12000,
      currency: 'PLN',
      status: 'paid',
      dueDate: new Date(Date.now() + 14 * 24 * 3600000),
    });

    (globalThis as any)._omenaMockSession = { user: { id: user.id, email: user.email, name: user.name, userType: 'user', visibilityLevel: 0, role: null } };

    const request = createRequest('POST', '/api/payments/create-intent', { invoiceId: paidInvoiceId });
    const { status, data } = await callRouteHandler(POST, request);

    expect(status).toBe(400);
    expect(data).toHaveProperty('error', 'Invoice is already paid');

    const { eq } = await import('drizzle-orm');
    await db.delete(invoices).where(eq(invoices.id, paidInvoiceId)).catch(() => {});
  });

  it('returns 400 when invoiceId is missing', async () => {
    const { POST } = await import('@/app/api/payments/create-intent/route');
    (globalThis as any)._omenaMockSession = { user: { id: user.id, email: user.email, name: user.name, userType: 'user', visibilityLevel: 0, role: null } };

    const request = createRequest('POST', '/api/payments/create-intent', {});
    const { status, data } = await callRouteHandler(POST, request);

    expect(status).toBe(400);
    expect(data).toHaveProperty('error', 'invoiceId is required');
  });
});
