/**
 * Unit tests for /api/admin/invoices (GET)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock auth ──────────────────────────────────────────────────────────────

const mockRequireAdmin = vi.fn();

vi.mock('@/lib/auth-utils', () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
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

// ─── Mock invoice service ───────────────────────────────────────────────────

const mockListInvoices = vi.fn();

vi.mock('@/lib/invoice-service', () => ({
  listInvoices: (...args: unknown[]) => mockListInvoices(...args),
}));

// ─── Mock DB ────────────────────────────────────────────────────────────────

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();

const chainedDb = {
  select: mockSelect,
  from: mockFrom,
  where: mockWhere,
};

mockSelect.mockReturnValue(chainedDb);
mockFrom.mockReturnValue(chainedDb);
mockWhere.mockResolvedValue([]);

vi.mock('@/db/connection', () => ({ db: chainedDb }));

vi.mock('@/db/schema', () => ({
  payments: { id: 'id', invoiceId: 'invoiceId', status: 'status', provider: 'provider', externalId: 'externalId', createdAt: 'createdAt' },
}));

vi.mock('drizzle-orm', () => ({
  inArray: vi.fn((...args: unknown[]) => ({ _inArray: args })),
}));

// ─── Import ─────────────────────────────────────────────────────────────────

const { AuthError } = await import('@/lib/auth-utils');

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost:3000/api/admin/invoices');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString(), { method: 'GET' });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/admin/invoices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue(chainedDb);
    mockFrom.mockReturnValue(chainedDb);
    mockWhere.mockResolvedValue([]);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { GET } = await import('@/app/api/admin/invoices/route');
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 403 when admin lacks invoices:manage permission', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Missing permission: invoices:manage', 403));

    const { GET } = await import('@/app/api/admin/invoices/route');
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toContain('Missing permission');
  });

  it('returns invoices with payment data', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });

    const invoices = [
      { id: 'inv-1', number: 'INV-001', status: 'issued', totalAmount: 5000 },
      { id: 'inv-2', number: 'INV-002', status: 'paid', totalAmount: 10000 },
    ];
    mockListInvoices.mockResolvedValue(invoices);

    const paymentRows = [
      { invoiceId: 'inv-1', status: 'pending', provider: 'stripe', externalId: 'pi_1', createdAt: new Date('2024-01-01') },
      { invoiceId: 'inv-2', status: 'completed', provider: 'przelewy24', externalId: 'p24_1', createdAt: new Date('2024-01-02') },
    ];
    mockWhere.mockResolvedValueOnce(paymentRows);

    const { GET } = await import('@/app/api/admin/invoices/route');
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.invoices).toHaveLength(2);
    expect(body.invoices[0].payment).toEqual({
      status: 'pending',
      provider: 'stripe',
      externalId: 'pi_1',
    });
    expect(body.invoices[1].payment).toEqual({
      status: 'completed',
      provider: 'przelewy24',
      externalId: 'p24_1',
    });
  });

  it('returns invoices without payment data when no payments exist', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });

    const invoices = [
      { id: 'inv-1', number: 'INV-001', status: 'draft', totalAmount: 5000 },
    ];
    mockListInvoices.mockResolvedValue(invoices);
    mockWhere.mockResolvedValueOnce([]);

    const { GET } = await import('@/app/api/admin/invoices/route');
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.invoices[0].payment).toBeNull();
  });

  it('passes filters from query params to listInvoices', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockListInvoices.mockResolvedValue([]);

    const { GET } = await import('@/app/api/admin/invoices/route');
    await GET(makeRequest({ status: 'paid', auctionId: 'auc-1', userId: 'user-1', limit: '50', offset: '10' }));

    expect(mockListInvoices).toHaveBeenCalledWith({
      status: 'paid',
      auctionId: 'auc-1',
      userId: 'user-1',
      limit: 50,
      offset: 10,
    });
  });

  it('returns empty list when no invoices exist', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockListInvoices.mockResolvedValue([]);

    const { GET } = await import('@/app/api/admin/invoices/route');
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.invoices).toEqual([]);
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('DB crash'));

    const { GET } = await import('@/app/api/admin/invoices/route');
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
