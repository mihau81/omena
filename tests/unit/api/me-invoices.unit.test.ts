/**
 * Unit tests for GET /api/me/invoices
 * Coverage target: user invoices listing
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock auth ──────────────────────────────────────────────────────────────

const mockRequireApprovedUser = vi.fn();

vi.mock('@/lib/auth-utils', () => ({
  requireApprovedUser: (...args: unknown[]) => mockRequireApprovedUser(...args),
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
const mockInnerJoin = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();

const chainedDb = {
  select: mockSelect,
  from: mockFrom,
  innerJoin: mockInnerJoin,
  where: mockWhere,
  orderBy: mockOrderBy,
};

mockSelect.mockReturnValue(chainedDb);
mockFrom.mockReturnValue(chainedDb);
mockInnerJoin.mockReturnValue(chainedDb);
mockWhere.mockReturnValue(chainedDb);
mockOrderBy.mockResolvedValue([]);

vi.mock('@/db/connection', () => ({ db: chainedDb }));

vi.mock('@/db/schema', () => ({
  invoices: { id: 'id', userId: 'userId', auctionId: 'auctionId', lotId: 'lotId', invoiceNumber: 'invoiceNumber', hammerPrice: 'hammerPrice', buyersPremium: 'buyersPremium', totalAmount: 'totalAmount', status: 'status', dueDate: 'dueDate', paidAt: 'paidAt', createdAt: 'createdAt' },
  auctions: { id: 'id', title: 'title' },
  lots: { id: 'id', title: 'title', lotNumber: 'lotNumber' },
}));

// ─── Import AuthError ───────────────────────────────────────────────────────

const { AuthError } = await import('@/lib/auth-utils');

describe('GET /api/me/invoices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue(chainedDb);
    mockFrom.mockReturnValue(chainedDb);
    mockInnerJoin.mockReturnValue(chainedDb);
    mockWhere.mockReturnValue(chainedDb);
    mockOrderBy.mockResolvedValue([]);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireApprovedUser.mockRejectedValue(new AuthError('Authentication required', 401));

    const { GET } = await import('@/app/api/me/invoices/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 403 for non-user accounts', async () => {
    mockRequireApprovedUser.mockRejectedValue(new AuthError('User access required', 403));

    const { GET } = await import('@/app/api/me/invoices/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('User access required');
  });

  it('returns empty invoices list for user with no invoices', async () => {
    mockRequireApprovedUser.mockResolvedValue({ id: 'user-1' });
    mockOrderBy.mockResolvedValueOnce([]);

    const { GET } = await import('@/app/api/me/invoices/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.invoices).toEqual([]);
  });

  it('returns invoices with auction and lot data', async () => {
    mockRequireApprovedUser.mockResolvedValue({ id: 'user-1' });
    const rows = [
      {
        id: 'inv-1',
        invoiceNumber: 'INV-001',
        auctionTitle: 'Spring Auction',
        lotTitle: 'Sunset',
        lotNumber: 5,
        hammerPrice: 5000,
        buyersPremium: 1000,
        totalAmount: 6000,
        status: 'pending',
        dueDate: new Date(),
        paidAt: null,
        createdAt: new Date(),
      },
      {
        id: 'inv-2',
        invoiceNumber: 'INV-002',
        auctionTitle: 'Winter Auction',
        lotTitle: 'Dawn',
        lotNumber: 12,
        hammerPrice: 10000,
        buyersPremium: 2000,
        totalAmount: 12000,
        status: 'paid',
        dueDate: new Date(),
        paidAt: new Date(),
        createdAt: new Date(),
      },
    ];
    mockOrderBy.mockResolvedValueOnce(rows);

    const { GET } = await import('@/app/api/me/invoices/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.invoices).toHaveLength(2);
    expect(body.invoices[0].invoiceNumber).toBe('INV-001');
    expect(body.invoices[1].status).toBe('paid');
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireApprovedUser.mockRejectedValue(new Error('DB crash'));

    const { GET } = await import('@/app/api/me/invoices/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
