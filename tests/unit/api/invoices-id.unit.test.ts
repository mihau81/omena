/**
 * Unit tests for GET/PATCH /api/admin/invoices/[id]
 * Coverage target: invoice detail and status update
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

const mockGetInvoice = vi.fn();
const mockUpdateInvoiceStatus = vi.fn();

vi.mock('@/lib/invoice-service', () => ({
  getInvoice: (...args: unknown[]) => mockGetInvoice(...args),
  updateInvoiceStatus: (...args: unknown[]) => mockUpdateInvoiceStatus(...args),
}));

// ─── Mock invoice PDF ───────────────────────────────────────────────────────

const mockGenerateInvoiceHTML = vi.fn();

vi.mock('@/lib/invoice-pdf', () => ({
  generateInvoiceHTML: (...args: unknown[]) => mockGenerateInvoiceHTML(...args),
}));

// ─── Mock DB (for notes update in PATCH) ────────────────────────────────────

const mockUpdate = vi.fn();
const mockSet = vi.fn();
const mockWhere = vi.fn();

const chainedDb = {
  update: mockUpdate,
  set: mockSet,
  where: mockWhere,
};

mockUpdate.mockReturnValue(chainedDb);
mockSet.mockReturnValue(chainedDb);
mockWhere.mockResolvedValue(undefined);

vi.mock('@/db/connection', () => ({ db: chainedDb }));

vi.mock('@/db/schema', () => ({
  invoices: { id: 'id', notes: 'notes', updatedAt: 'updatedAt' },
}));

// ─── Import AuthError ───────────────────────────────────────────────────────

const { AuthError } = await import('@/lib/auth-utils');

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(method = 'GET', body?: unknown, queryString = '') {
  const url = `http://localhost:3000/api/admin/invoices/inv-1${queryString}`;
  const init: RequestInit = { method };
  if (body) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  return new Request(url, init);
}

function makeContext(id = 'inv-1') {
  return { params: Promise.resolve({ id }) };
}

const invoiceData = {
  id: 'inv-1',
  invoiceNumber: 'INV/2026/001',
  status: 'pending',
  totalAmount: 5000,
  buyerName: 'John Doe',
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/admin/invoices/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { GET } = await import('@/app/api/admin/invoices/[id]/route');
    const res = await GET(makeRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 404 when invoice not found', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGetInvoice.mockResolvedValue(null);

    const { GET } = await import('@/app/api/admin/invoices/[id]/route');
    const res = await GET(makeRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Invoice not found');
  });

  it('returns invoice JSON by default', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGetInvoice.mockResolvedValue(invoiceData);

    const { GET } = await import('@/app/api/admin/invoices/[id]/route');
    const res = await GET(makeRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.invoice).toEqual(invoiceData);
  });

  it('returns HTML when format=html', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockGetInvoice.mockResolvedValue(invoiceData);
    mockGenerateInvoiceHTML.mockReturnValue('<html><body>Invoice</body></html>');

    const { GET } = await import('@/app/api/admin/invoices/[id]/route');
    const res = await GET(makeRequest('GET', undefined, '?format=html'), makeContext());

    expect(res.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
    expect(res.headers.get('Content-Disposition')).toContain('INV-2026-001');
    const text = await res.text();
    expect(text).toContain('Invoice');
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Unexpected'));

    const { GET } = await import('@/app/api/admin/invoices/[id]/route');
    const res = await GET(makeRequest(), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});

describe('PATCH /api/admin/invoices/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockReturnValue(chainedDb);
    mockSet.mockReturnValue(chainedDb);
    mockWhere.mockResolvedValue(undefined);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { PATCH } = await import('@/app/api/admin/invoices/[id]/route');
    const res = await PATCH(makeRequest('PATCH', { status: 'paid' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 400 when status is missing', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });

    const { PATCH } = await import('@/app/api/admin/invoices/[id]/route');
    const res = await PATCH(makeRequest('PATCH', {}), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('Invalid status');
  });

  it('returns 400 when status is invalid', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });

    const { PATCH } = await import('@/app/api/admin/invoices/[id]/route');
    const res = await PATCH(makeRequest('PATCH', { status: 'unknown' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('Invalid status');
  });

  it('updates status successfully', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    const updated = { ...invoiceData, status: 'paid' };
    mockUpdateInvoiceStatus.mockResolvedValue(updated);

    const { PATCH } = await import('@/app/api/admin/invoices/[id]/route');
    const res = await PATCH(makeRequest('PATCH', { status: 'paid' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.invoice.status).toBe('paid');
  });

  it('updates notes alongside status', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockUpdateInvoiceStatus.mockResolvedValue({ ...invoiceData, status: 'sent' });

    const { PATCH } = await import('@/app/api/admin/invoices/[id]/route');
    const res = await PATCH(
      makeRequest('PATCH', { status: 'sent', notes: 'Sent via email' }),
      makeContext(),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('returns 400 when updateInvoiceStatus throws Error', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockUpdateInvoiceStatus.mockRejectedValue(new Error('Invoice not found'));

    const { PATCH } = await import('@/app/api/admin/invoices/[id]/route');
    const res = await PATCH(makeRequest('PATCH', { status: 'paid' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invoice not found');
  });

  it('returns 500 on unexpected non-Error', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockUpdateInvoiceStatus.mockRejectedValue('string error');

    const { PATCH } = await import('@/app/api/admin/invoices/[id]/route');
    const res = await PATCH(makeRequest('PATCH', { status: 'paid' }), makeContext());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
