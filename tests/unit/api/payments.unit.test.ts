/**
 * Unit tests for payments routes:
 * - POST /api/payments/create-intent
 * - GET  /api/payments/status
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock auth ──────────────────────────────────────────────────────────────

const mockRequireAuth = vi.fn();

vi.mock('@/lib/auth-utils', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  AuthError: class AuthError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 401) {
      super(message);
      this.name = 'AuthError';
      this.statusCode = statusCode;
    }
  },
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: { GET: vi.fn(), POST: vi.fn() },
}));

// ─── Mock DB ────────────────────────────────────────────────────────────────

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();

const chainedDb = {
  select: mockSelect,
  from: mockFrom,
  where: mockWhere,
  limit: mockLimit,
};

mockSelect.mockReturnValue(chainedDb);
mockFrom.mockReturnValue(chainedDb);
mockWhere.mockReturnValue(chainedDb);
mockLimit.mockResolvedValue([]);

vi.mock('@/db/connection', () => ({ db: chainedDb }));

vi.mock('@/db/schema', () => ({
  invoices: { id: 'id', userId: 'userId', status: 'status', lotId: 'lotId' },
}));

// ─── Mock payment service ───────────────────────────────────────────────────

const mockCreatePaymentIntent = vi.fn();
const mockGetPaymentStatus = vi.fn();

vi.mock('@/lib/payment-service', () => ({
  createPaymentIntent: (...args: unknown[]) => mockCreatePaymentIntent(...args),
  getPaymentStatus: (...args: unknown[]) => mockGetPaymentStatus(...args),
}));

// ─── Import ─────────────────────────────────────────────────────────────────

const { AuthError } = await import('@/lib/auth-utils');

// ─── Helpers ────────────────────────────────────────────────────────────────

function makePostRequest(body: unknown) {
  return new Request('http://localhost:3000/api/payments/create-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeGetRequest(invoiceId?: string) {
  const url = invoiceId
    ? `http://localhost:3000/api/payments/status?invoiceId=${invoiceId}`
    : 'http://localhost:3000/api/payments/status';
  return new Request(url);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('POST /api/payments/create-intent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue(chainedDb);
    mockFrom.mockReturnValue(chainedDb);
    mockWhere.mockReturnValue(chainedDb);
    mockLimit.mockResolvedValue([]);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new AuthError('Authentication required', 401));

    const { POST } = await import('@/app/api/payments/create-intent/route');
    const res = await POST(makePostRequest({ invoiceId: 'inv-1' }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 403 for admin users', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'admin-1', userType: 'admin' });

    const { POST } = await import('@/app/api/payments/create-intent/route');
    const res = await POST(makePostRequest({ invoiceId: 'inv-1' }));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('Forbidden');
  });

  it('returns 400 when invoiceId is missing', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'user-1', userType: 'user' });

    const { POST } = await import('@/app/api/payments/create-intent/route');
    const res = await POST(makePostRequest({}));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('invoiceId is required');
  });

  it('returns 404 when invoice not found', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'user-1', userType: 'user' });
    mockLimit.mockResolvedValueOnce([]); // invoice not found

    const { POST } = await import('@/app/api/payments/create-intent/route');
    const res = await POST(makePostRequest({ invoiceId: 'inv-nonexistent' }));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Invoice not found');
  });

  it('returns 403 when invoice belongs to another user', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'user-1', userType: 'user' });
    mockLimit.mockResolvedValueOnce([{ id: 'inv-1', userId: 'user-2', status: 'pending' }]);

    const { POST } = await import('@/app/api/payments/create-intent/route');
    const res = await POST(makePostRequest({ invoiceId: 'inv-1' }));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('Forbidden');
  });

  it('returns 400 when invoice is already paid', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'user-1', userType: 'user' });
    mockLimit.mockResolvedValueOnce([{ id: 'inv-1', userId: 'user-1', status: 'paid' }]);

    const { POST } = await import('@/app/api/payments/create-intent/route');
    const res = await POST(makePostRequest({ invoiceId: 'inv-1' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invoice is already paid');
  });

  it('returns 400 when invoice is cancelled', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'user-1', userType: 'user' });
    mockLimit.mockResolvedValueOnce([{ id: 'inv-1', userId: 'user-1', status: 'cancelled' }]);

    const { POST } = await import('@/app/api/payments/create-intent/route');
    const res = await POST(makePostRequest({ invoiceId: 'inv-1' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invoice is cancelled');
  });

  it('creates payment intent successfully', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'user-1', userType: 'user' });
    mockLimit.mockResolvedValueOnce([{ id: 'inv-1', userId: 'user-1', status: 'pending' }]);
    mockCreatePaymentIntent.mockResolvedValue({
      clientSecret: 'pi_secret_123',
      paymentId: 'pay-1',
      amount: 5000,
    });

    const { POST } = await import('@/app/api/payments/create-intent/route');
    const res = await POST(makePostRequest({ invoiceId: 'inv-1' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.clientSecret).toBe('pi_secret_123');
    expect(body.paymentId).toBe('pay-1');
    expect(body.amount).toBe(5000);
  });

  it('sanitizes Stripe errors in response', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'user-1', userType: 'user' });
    mockLimit.mockResolvedValueOnce([{ id: 'inv-1', userId: 'user-1', status: 'pending' }]);
    mockCreatePaymentIntent.mockRejectedValue(new Error('Stripe API key invalid'));

    const { POST } = await import('@/app/api/payments/create-intent/route');
    const res = await POST(makePostRequest({ invoiceId: 'inv-1' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Payment processing error. Please try again.');
    // Should NOT leak Stripe details
    expect(body.error).not.toContain('Stripe');
  });

  it('passes through non-Stripe error messages', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'user-1', userType: 'user' });
    mockLimit.mockResolvedValueOnce([{ id: 'inv-1', userId: 'user-1', status: 'pending' }]);
    mockCreatePaymentIntent.mockRejectedValue(new Error('Amount too low'));

    const { POST } = await import('@/app/api/payments/create-intent/route');
    const res = await POST(makePostRequest({ invoiceId: 'inv-1' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Amount too low');
  });

  it('returns 500 on unexpected non-Error', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'user-1', userType: 'user' });
    mockLimit.mockResolvedValueOnce([{ id: 'inv-1', userId: 'user-1', status: 'pending' }]);
    mockCreatePaymentIntent.mockRejectedValue('string error');

    const { POST } = await import('@/app/api/payments/create-intent/route');
    const res = await POST(makePostRequest({ invoiceId: 'inv-1' }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe('GET /api/payments/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue(chainedDb);
    mockFrom.mockReturnValue(chainedDb);
    mockWhere.mockReturnValue(chainedDb);
    mockLimit.mockResolvedValue([]);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new AuthError('Authentication required', 401));

    const { GET } = await import('@/app/api/payments/status/route');
    const res = await GET(makeGetRequest('inv-1'));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 400 when invoiceId is missing', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'user-1', userType: 'user' });

    const { GET } = await import('@/app/api/payments/status/route');
    const res = await GET(makeGetRequest());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('invoiceId query parameter is required');
  });

  it('returns 404 when invoice not found (non-admin)', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'user-1', userType: 'user' });
    mockLimit.mockResolvedValueOnce([]);

    const { GET } = await import('@/app/api/payments/status/route');
    const res = await GET(makeGetRequest('inv-nonexistent'));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Invoice not found');
  });

  it('returns 403 when invoice belongs to another user', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'user-1', userType: 'user' });
    mockLimit.mockResolvedValueOnce([{ userId: 'user-2' }]);

    const { GET } = await import('@/app/api/payments/status/route');
    const res = await GET(makeGetRequest('inv-1'));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('Forbidden');
  });

  it('returns payment status for invoice owner', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'user-1', userType: 'user' });
    mockLimit.mockResolvedValueOnce([{ userId: 'user-1' }]);
    mockGetPaymentStatus.mockResolvedValue({ status: 'succeeded', amount: 5000 });

    const { GET } = await import('@/app/api/payments/status/route');
    const res = await GET(makeGetRequest('inv-1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.payment.status).toBe('succeeded');
  });

  it('skips ownership check for admin users', async () => {
    mockRequireAuth.mockResolvedValue({ id: 'admin-1', userType: 'admin' });
    mockGetPaymentStatus.mockResolvedValue({ status: 'pending', amount: 3000 });

    const { GET } = await import('@/app/api/payments/status/route');
    const res = await GET(makeGetRequest('inv-1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.payment.status).toBe('pending');
    // DB should not be queried for ownership
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Service down'));

    const { GET } = await import('@/app/api/payments/status/route');
    const res = await GET(makeGetRequest('inv-1'));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
