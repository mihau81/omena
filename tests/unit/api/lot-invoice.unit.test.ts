/**
 * Unit tests for GET/POST /api/admin/lots/[id]/invoice
 * Coverage target: lot invoice generation and retrieval
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
  invoices: { id: 'id', lotId: 'lotId' },
}));

// ─── Mock invoice service ───────────────────────────────────────────────────

const mockGenerateInvoice = vi.fn();
const mockGetInvoice = vi.fn();

vi.mock('@/lib/invoice-service', () => ({
  generateInvoice: (...args: unknown[]) => mockGenerateInvoice(...args),
  getInvoice: (...args: unknown[]) => mockGetInvoice(...args),
}));

// ─── Import ─────────────────────────────────────────────────────────────────

const { AuthError } = await import('@/lib/auth-utils');

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeGetRequest() {
  return new Request('http://localhost:3000/api/admin/lots/lot-1/invoice');
}

function makePostRequest() {
  return new Request('http://localhost:3000/api/admin/lots/lot-1/invoice', {
    method: 'POST',
  });
}

function makeContext(id = 'lot-1') {
  return { params: Promise.resolve({ id }) };
}

describe('POST /api/admin/lots/[id]/invoice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { POST } = await import('@/app/api/admin/lots/[id]/invoice/route');
    const res = await POST(makePostRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 403 when admin lacks invoices:manage permission', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Missing permission: invoices:manage', 403));

    const { POST } = await import('@/app/api/admin/lots/[id]/invoice/route');
    const res = await POST(makePostRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('Missing permission: invoices:manage');
  });

  it('generates invoice successfully', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGenerateInvoice.mockResolvedValue({ id: 'inv-1' });
    const invoiceDetail = { id: 'inv-1', number: 'INV-001', amount: 5000 };
    mockGetInvoice.mockResolvedValue(invoiceDetail);

    const { POST } = await import('@/app/api/admin/lots/[id]/invoice/route');
    const res = await POST(makePostRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.invoice).toEqual(invoiceDetail);
    expect(mockGenerateInvoice).toHaveBeenCalledWith('lot-1');
  });

  it('returns 400 when invoice generation fails with known error', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGenerateInvoice.mockRejectedValue(new Error('Lot is not sold'));

    const { POST } = await import('@/app/api/admin/lots/[id]/invoice/route');
    const res = await POST(makePostRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Lot is not sold');
  });

  it('returns 500 on unexpected non-Error', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGenerateInvoice.mockRejectedValue('unexpected');

    const { POST } = await import('@/app/api/admin/lots/[id]/invoice/route');
    const res = await POST(makePostRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});

describe('GET /api/admin/lots/[id]/invoice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue(chainedDb);
    mockFrom.mockReturnValue(chainedDb);
    mockWhere.mockReturnValue(chainedDb);
    mockLimit.mockResolvedValue([]);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { GET } = await import('@/app/api/admin/lots/[id]/invoice/route');
    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns null when lot has no invoice', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([]); // no invoice row

    const { GET } = await import('@/app/api/admin/lots/[id]/invoice/route');
    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.invoice).toBeNull();
  });

  it('returns invoice details when invoice exists', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([{ id: 'inv-1' }]); // invoice row found
    const invoiceDetail = { id: 'inv-1', number: 'INV-001', amount: 5000, lotId: 'lot-1' };
    mockGetInvoice.mockResolvedValue(invoiceDetail);

    const { GET } = await import('@/app/api/admin/lots/[id]/invoice/route');
    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.invoice).toEqual(invoiceDetail);
    expect(mockGetInvoice).toHaveBeenCalledWith('inv-1');
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('DB down'));

    const { GET } = await import('@/app/api/admin/lots/[id]/invoice/route');
    const res = await GET(makeGetRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
