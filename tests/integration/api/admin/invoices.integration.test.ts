import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getTestDb } from '@/tests/helpers/db';
import { createTestAdmin, createTestUser } from '@/tests/helpers/auth';

const mockAuth = vi.hoisted(() => {
  const _g = globalThis as Record<string, unknown>;
  if (!_g._omenaaMockAuth) {
    _g._omenaaMockSession = null;
    _g._omenaaMockAuth = vi.fn().mockImplementation(async () => _g._omenaaMockSession);
  }
  return _g._omenaaMockAuth as ReturnType<typeof vi.fn>;
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

describe('Admin Invoices API', () => {
  const db = getTestDb();
  let admin: Awaited<ReturnType<typeof createTestAdmin>>;
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let auctionId: string;
  let lotId: string;
  let invoiceId: string;

  beforeAll(async () => {
    const { randomUUID } = await import('crypto');
    const { auctions, lots, invoices } = await import('@/db/schema');

    admin = await createTestAdmin({ email: `admin-inv-test-${Date.now()}@example.com` });
    user = await createTestUser({ email: `user-inv-test-${Date.now()}@example.com` });

    (globalThis as any)._omenaaMockSession = { user: { id: admin.id, email: admin.email, role: admin.role, name: admin.name, userType: 'admin', visibilityLevel: 2 } };

    auctionId = randomUUID();
    await db.insert(auctions).values({
      id: auctionId,
      slug: `inv-test-auction-${Date.now()}`,
      title: 'Invoice Test Auction',
      description: 'Test',
      category: 'mixed',
      startDate: new Date(Date.now() - 3600000),
      endDate: new Date(Date.now() + 3600000),
      location: 'Warsaw',
      curator: 'Test',
      status: 'reconciliation',
      visibilityLevel: '0',
      buyersPremiumRate: '0.2000',
    });

    lotId = randomUUID();
    await db.insert(lots).values({
      id: lotId,
      auctionId,
      lotNumber: 1,
      title: 'Invoice Test Artwork',
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
      invoiceNumber: `OMENAA/2026/INV-${Date.now()}`,
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
    await db.delete(invoices).where(eq(invoices.auctionId, auctionId)).catch(() => {});
    await db.delete(lots).where(eq(lots.id, lotId)).catch(() => {});
    await db.delete(auctions).where(eq(auctions.id, auctionId)).catch(() => {});
    await db.execute(`DELETE FROM users WHERE email LIKE 'user-inv-test-%@example.com'`);
    await db.execute(`DELETE FROM admins WHERE email LIKE 'admin-inv-test-%@example.com'`);
  });

  describe('GET /api/admin/invoices', () => {
    it('returns list of invoices', async () => {
      const { GET } = await import('@/app/api/admin/invoices/route');

      const response = await GET(new Request('http://localhost:3002/api/admin/invoices'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('invoices');
      expect(Array.isArray(data.invoices)).toBe(true);
    });

    it('filters by status', async () => {
      const { GET } = await import('@/app/api/admin/invoices/route');

      const response = await GET(new Request('http://localhost:3002/api/admin/invoices?status=pending'));
      const data = await response.json();

      expect(response.status).toBe(200);
      // All returned invoices should be pending
      const nonPending = data.invoices.filter((i: Record<string, string>) => i.status !== 'pending');
      expect(nonPending.length).toBe(0);
    });

    it('filters by auctionId', async () => {
      const { GET } = await import('@/app/api/admin/invoices/route');

      const response = await GET(new Request(`http://localhost:3002/api/admin/invoices?auctionId=${auctionId}`));
      const data = await response.json();

      expect(response.status).toBe(200);
      const found = data.invoices.find((i: Record<string, string>) => i.id === invoiceId);
      expect(found).toBeDefined();
    });

    it('returns 401 without admin auth', async () => {
      const { GET } = await import('@/app/api/admin/invoices/route');

      (globalThis as any)._omenaaMockSession = null;
      const response = await GET(new Request('http://localhost:3002/api/admin/invoices'));
      expect(response.status).toBe(401);

      (globalThis as any)._omenaaMockSession = { user: { id: admin.id, email: admin.email, role: admin.role, name: admin.name, userType: 'admin', visibilityLevel: 2 } };
    });
  });

  describe('GET /api/admin/invoices/[id]', () => {
    it('returns invoice detail', async () => {
      const { GET } = await import('@/app/api/admin/invoices/[id]/route');

      const response = await GET(
        new Request(`http://localhost:3002/api/admin/invoices/${invoiceId}`),
        { params: Promise.resolve({ id: invoiceId }) },
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('invoice');
      expect((data as Record<string, Record<string, unknown>>).invoice.id).toBe(invoiceId);
    });

    it('returns 404 for non-existent invoice', async () => {
      const { GET } = await import('@/app/api/admin/invoices/[id]/route');
      const { randomUUID } = await import('crypto');

      const fakeId = randomUUID();
      const response = await GET(
        new Request(`http://localhost:3002/api/admin/invoices/${fakeId}`),
        { params: Promise.resolve({ id: fakeId }) },
      );

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/admin/invoices/[id] (status transitions)', () => {
    it('transitions invoice from pending to sent', async () => {
      const { PATCH } = await import('@/app/api/admin/invoices/[id]/route');

      const response = await PATCH(
        new Request(`http://localhost:3002/api/admin/invoices/${invoiceId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'sent' }),
        }),
        { params: Promise.resolve({ id: invoiceId }) },
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect((data as Record<string, Record<string, unknown>>).invoice.status).toBe('sent');
    });

    it('transitions invoice from sent to paid', async () => {
      const { PATCH } = await import('@/app/api/admin/invoices/[id]/route');

      const response = await PATCH(
        new Request(`http://localhost:3002/api/admin/invoices/${invoiceId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'paid' }),
        }),
        { params: Promise.resolve({ id: invoiceId }) },
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect((data as Record<string, Record<string, unknown>>).invoice.status).toBe('paid');
    });
  });

  describe('GET /api/admin/invoices/[id] (HTML format)', () => {
    it('returns HTML when format=html', async () => {
      const { GET } = await import('@/app/api/admin/invoices/[id]/route');

      const response = await GET(
        new Request(`http://localhost:3002/api/admin/invoices/${invoiceId}?format=html`),
        { params: Promise.resolve({ id: invoiceId }) },
      );

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('text/html');
      const html = await response.text();
      expect(html).toContain('<!DOCTYPE html>');
    });
  });

  describe('PATCH /api/admin/invoices/[id] (with notes)', () => {
    let pendingInvoiceId: string;

    beforeAll(async () => {
      const { randomUUID } = await import('crypto');
      const { invoices } = await import('@/db/schema');

      pendingInvoiceId = randomUUID();
      await db.insert(invoices).values({
        id: pendingInvoiceId,
        invoiceNumber: `OMENAA/2026/NOTES-${Date.now()}`,
        userId: user.id,
        auctionId,
        lotId,
        hammerPrice: 5000,
        buyersPremium: 1000,
        totalAmount: 6000,
        currency: 'PLN',
        status: 'pending',
        dueDate: new Date(Date.now() + 14 * 24 * 3600000),
      });
    });

    afterAll(async () => {
      const { invoices } = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');
      await db.delete(invoices).where(eq(invoices.id, pendingInvoiceId)).catch(() => {});
    });

    it('updates invoice status and notes together', async () => {
      const { PATCH } = await import('@/app/api/admin/invoices/[id]/route');

      const response = await PATCH(
        new Request(`http://localhost:3002/api/admin/invoices/${pendingInvoiceId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'sent', notes: 'Sent via email on 2026-02-28' }),
        }),
        { params: Promise.resolve({ id: pendingInvoiceId }) },
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect((data as Record<string, Record<string, unknown>>).invoice.status).toBe('sent');
    });

    it('returns 400 for invalid status', async () => {
      const { PATCH } = await import('@/app/api/admin/invoices/[id]/route');

      const response = await PATCH(
        new Request(`http://localhost:3002/api/admin/invoices/${invoiceId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'not-valid' }),
        }),
        { params: Promise.resolve({ id: invoiceId }) },
      );

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/admin/lots/[id]/invoice', () => {
    it('returns invoice for a lot that has one', async () => {
      const { GET } = await import('@/app/api/admin/lots/[id]/invoice/route');

      const response = await GET(
        new Request(`http://localhost:3002/api/admin/lots/${lotId}/invoice`),
        { params: Promise.resolve({ id: lotId }) },
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('invoice');
      expect((data as Record<string, Record<string, unknown>>).invoice).not.toBeNull();
    });

    it('returns null invoice for a lot with no invoice', async () => {
      const { GET } = await import('@/app/api/admin/lots/[id]/invoice/route');
      const { randomUUID } = await import('crypto');
      const { lots } = await import('@/db/schema');

      const noInvoiceLotId = randomUUID();
      await db.insert(lots).values({
        id: noInvoiceLotId,
        auctionId,
        lotNumber: 200,
        title: 'No Invoice Lot',
        artist: 'Artist',
        description: 'Test',
        medium: 'Oil',
        dimensions: '10x10',
        status: 'sold',
        hammerPrice: 1000,
      });

      try {
        const response = await GET(
          new Request(`http://localhost:3002/api/admin/lots/${noInvoiceLotId}/invoice`),
          { params: Promise.resolve({ id: noInvoiceLotId }) },
        );
        const data = await response.json();

        expect(response.status).toBe(200);
        expect((data as Record<string, null>).invoice).toBeNull();
      } finally {
        const { eq } = await import('drizzle-orm');
        await db.delete(lots).where(eq(lots.id, noInvoiceLotId)).catch(() => {});
      }
    });

    it('returns 401 without admin auth on lot invoice GET', async () => {
      const { GET } = await import('@/app/api/admin/lots/[id]/invoice/route');

      (globalThis as any)._omenaaMockSession = null;

      const response = await GET(
        new Request(`http://localhost:3002/api/admin/lots/${lotId}/invoice`),
        { params: Promise.resolve({ id: lotId }) },
      );

      expect(response.status).toBe(401);
      (globalThis as any)._omenaaMockSession = { user: { id: admin.id, email: admin.email, role: admin.role, name: admin.name, userType: 'admin', visibilityLevel: 2 } };
    });
  });

  describe('POST /api/admin/lots/[id]/invoice', () => {
    it('generates invoice for a sold lot', async () => {
      const { POST } = await import('@/app/api/admin/lots/[id]/invoice/route');

      // Create a new sold lot with a winning bid for invoice generation
      const { randomUUID } = await import('crypto');
      const { lots, bids, bidRegistrations } = await import('@/db/schema');

      const newUser = await createTestUser({ email: `user-inv-gen-${Date.now()}@example.com` });
      const newLotId = randomUUID();
      await db.insert(lots).values({
        id: newLotId,
        auctionId,
        lotNumber: 99,
        title: 'Invoice Generation Test Lot',
        artist: 'Artist',
        description: 'Test',
        medium: 'Oil',
        dimensions: '50x70',
        status: 'sold',
        hammerPrice: 5000,
      });

      const regId = randomUUID();
      await db.insert(bidRegistrations).values({
        id: regId,
        userId: newUser.id,
        auctionId,
        paddleNumber: 99,
        isApproved: true,
      });

      const bidId = randomUUID();
      await db.insert(bids).values({
        id: bidId,
        lotId: newLotId,
        userId: newUser.id,
        registrationId: regId,
        amount: 5000,
        bidType: 'online',
        isWinning: true,
      });

      try {
        const response = await POST(
          new Request(`http://localhost:3002/api/admin/lots/${newLotId}/invoice`, { method: 'POST' }),
          { params: Promise.resolve({ id: newLotId }) },
        );
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data).toHaveProperty('invoice');
        expect((data as Record<string, Record<string, unknown>>).invoice.lotId).toBe(newLotId);

        // Clean up the generated invoice
        const { invoices } = await import('@/db/schema');
        const { eq } = await import('drizzle-orm');
        await db.delete(invoices).where(eq(invoices.lotId, newLotId)).catch(() => {});
      } finally {
        const { eq } = await import('drizzle-orm');
        await db.delete(bids).where(eq(bids.id, bidId)).catch(() => {});
        await db.delete(bidRegistrations).where(eq(bidRegistrations.id, regId)).catch(() => {});
        await db.delete(lots).where(eq(lots.id, newLotId)).catch(() => {});
        await db.execute(`DELETE FROM users WHERE email LIKE 'user-inv-gen-%@example.com'`);
      }
    });
  });
});
