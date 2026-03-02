import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from '@/tests/helpers/db';
import { createTestUser } from '@/tests/helpers/auth';

describe('Invoice Service Integration Tests', () => {
  const db = getTestDb();
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let auctionId: string;
  let lotId: string;
  let bidId: string;
  let invoiceId: string;

  beforeAll(async () => {
    const { randomUUID } = await import('crypto');
    const { auctions, lots, bids, bidRegistrations } = await import('@/db/schema');

    user = await createTestUser({ email: `inv-svc-user-${Date.now()}@example.com` });

    auctionId = randomUUID();
    await db.insert(auctions).values({
      id: auctionId,
      slug: `inv-svc-auction-${Date.now()}`,
      title: 'Invoice Service Test Auction',
      description: 'Test',
      category: 'mixed',
      startDate: new Date(Date.now() - 3600000),
      endDate: new Date(Date.now() + 3600000),
      location: 'Warsaw',
      curator: 'Test',
      status: 'live',
      visibilityLevel: '0',
      buyersPremiumRate: '0.2000', // 20% flat rate
    });

    // Create lot in 'sold' status with a hammer price
    lotId = randomUUID();
    await db.insert(lots).values({
      id: lotId,
      auctionId,
      lotNumber: 1,
      title: 'Invoice Service Test Artwork',
      artist: 'Test Artist',
      description: 'Test',
      medium: 'Oil',
      dimensions: '50x70',
      status: 'sold',
      startingBid: 1000,
      hammerPrice: 5000,
    });

    // Create a winning bid from the user
    const regId = randomUUID();
    await db.insert(bidRegistrations).values({
      id: regId,
      userId: user.id,
      auctionId,
      paddleNumber: 1,
      isApproved: true,
      approvedAt: new Date(),
    });

    bidId = randomUUID();
    await db.insert(bids).values({
      id: bidId,
      lotId,
      userId: user.id,
      registrationId: regId,
      amount: 5000,
      isWinning: true,
      bidType: 'online',
    });
  });

  afterAll(async () => {
    const { auctions, lots, bids, bidRegistrations, invoices } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');

    await db.delete(invoices).where(eq(invoices.lotId, lotId)).catch(() => {});
    await db.delete(bids).where(eq(bids.lotId, lotId)).catch(() => {});
    await db.delete(bidRegistrations).where(eq(bidRegistrations.auctionId, auctionId)).catch(() => {});
    await db.delete(lots).where(eq(lots.id, lotId)).catch(() => {});
    await db.delete(auctions).where(eq(auctions.id, auctionId)).catch(() => {});
    await db.execute(`DELETE FROM users WHERE email LIKE 'inv-svc-user-%@example.com'`);
  });

  describe('generateInvoice', () => {
    it('generates invoice with flat premium calculation (20% of 5000 = 1000)', async () => {
      const { generateInvoice } = await import('@/lib/invoice-service');

      const invoice = await generateInvoice(lotId);
      invoiceId = invoice.id;

      expect(invoice).toHaveProperty('id');
      expect(invoice).toHaveProperty('invoiceNumber');
      expect(invoice.lotId).toBe(lotId);
      expect(invoice.auctionId).toBe(auctionId);
      expect(invoice.userId).toBe(user.id);
      expect(invoice.hammerPrice).toBe(5000);
      expect(invoice.buyersPremium).toBe(1000); // 20% of 5000
      expect(invoice.totalAmount).toBe(6000); // 5000 + 1000
      expect(invoice.currency).toBe('PLN');
      expect(invoice.status).toBe('pending');
      expect(invoice.invoiceNumber).toMatch(/^OMENA\/\d{4}\/\d{3}$/);
    });

    it('throws when lot is not found', async () => {
      const { generateInvoice } = await import('@/lib/invoice-service');
      const { randomUUID } = await import('crypto');

      await expect(generateInvoice(randomUUID())).rejects.toThrow(/not found/i);
    });

    it('throws when lot is not sold', async () => {
      const { generateInvoice } = await import('@/lib/invoice-service');
      const { randomUUID } = await import('crypto');
      const { lots } = await import('@/db/schema');

      // Create a non-sold lot
      const draftLotId = randomUUID();
      await db.insert(lots).values({
        id: draftLotId,
        auctionId,
        lotNumber: 99,
        title: 'Draft Lot',
        artist: 'Test',
        description: 'Test',
        medium: 'Oil',
        dimensions: '10x10',
        status: 'active',
      });

      try {
        await expect(generateInvoice(draftLotId)).rejects.toThrow(/not sold/i);
      } finally {
        const { eq } = await import('drizzle-orm');
        await db.delete(lots).where(eq(lots.id, draftLotId)).catch(() => {});
      }
    });

    it('throws when invoice already exists for lot', async () => {
      const { generateInvoice } = await import('@/lib/invoice-service');

      // Try to generate again — should fail since one already exists
      await expect(generateInvoice(lotId)).rejects.toThrow(/already exists/i);
    });
  });

  describe('getInvoice', () => {
    it('returns invoice with joined details', async () => {
      const { getInvoice } = await import('@/lib/invoice-service');

      const invoice = await getInvoice(invoiceId);

      expect(invoice).not.toBeNull();
      expect(invoice!.id).toBe(invoiceId);
      expect(invoice!.hammerPrice).toBe(5000);
      expect(invoice!.totalAmount).toBe(6000);
      expect(invoice!.userName).toBeDefined();
      expect(invoice!.userEmail).toContain('@example.com');
      expect(invoice!.lotTitle).toBe('Invoice Service Test Artwork');
      expect(invoice!.lotNumber).toBe(1);
      expect(invoice!.auctionTitle).toBe('Invoice Service Test Auction');
      expect(invoice!.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO string
    });

    it('returns null for non-existent invoice', async () => {
      const { getInvoice } = await import('@/lib/invoice-service');
      const { randomUUID } = await import('crypto');

      const result = await getInvoice(randomUUID());
      expect(result).toBeNull();
    });
  });

  describe('listInvoices', () => {
    it('returns invoices without filters', async () => {
      const { listInvoices } = await import('@/lib/invoice-service');

      const results = await listInvoices();

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    });

    it('filters by auctionId', async () => {
      const { listInvoices } = await import('@/lib/invoice-service');

      const results = await listInvoices({ auctionId });

      expect(results.length).toBeGreaterThan(0);
      for (const inv of results) {
        expect(inv.auctionId).toBe(auctionId);
      }
    });

    it('filters by status', async () => {
      const { listInvoices } = await import('@/lib/invoice-service');

      const results = await listInvoices({ status: 'pending', auctionId });

      expect(results.length).toBeGreaterThan(0);
      for (const inv of results) {
        expect(inv.status).toBe('pending');
      }
    });

    it('filters by userId', async () => {
      const { listInvoices } = await import('@/lib/invoice-service');

      const results = await listInvoices({ userId: user.id });

      expect(results.length).toBeGreaterThan(0);
      for (const inv of results) {
        expect(inv.userId).toBe(user.id);
      }
    });

    it('returns empty array for unknown auctionId', async () => {
      const { listInvoices } = await import('@/lib/invoice-service');
      const { randomUUID } = await import('crypto');

      const results = await listInvoices({ auctionId: randomUUID() });
      expect(results).toEqual([]);
    });
  });

  describe('updateInvoiceStatus', () => {
    it('transitions pending → sent', async () => {
      const { updateInvoiceStatus } = await import('@/lib/invoice-service');

      const updated = await updateInvoiceStatus(invoiceId, 'sent');

      expect(updated.status).toBe('sent');
    });

    it('transitions sent → paid and sets paidAt', async () => {
      const { updateInvoiceStatus } = await import('@/lib/invoice-service');

      const updated = await updateInvoiceStatus(invoiceId, 'paid');

      expect(updated.status).toBe('paid');
      expect(updated.paidAt).not.toBeNull();
    });

    it('throws for invalid transition (paid → sent)', async () => {
      const { updateInvoiceStatus } = await import('@/lib/invoice-service');

      await expect(updateInvoiceStatus(invoiceId, 'sent')).rejects.toThrow(/cannot transition/i);
    });

    it('throws for non-existent invoice', async () => {
      const { updateInvoiceStatus } = await import('@/lib/invoice-service');
      const { randomUUID } = await import('crypto');

      await expect(updateInvoiceStatus(randomUUID(), 'sent')).rejects.toThrow(/not found/i);
    });
  });
});
