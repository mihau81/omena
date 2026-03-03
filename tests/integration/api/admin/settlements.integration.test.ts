import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createRequest, callRouteHandler } from '@/tests/helpers/api';
import { getTestDb } from '@/tests/helpers/db';
import { createTestAdmin } from '@/tests/helpers/auth';

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
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

describe('Admin Settlements API', () => {
  const db = getTestDb();
  let admin: Awaited<ReturnType<typeof createTestAdmin>>;
  let testConsignorId: string;
  let testAuctionId: string;
  let testLotId: string;
  const createdSettlementIds: string[] = [];

  beforeAll(async () => {
    admin = await createTestAdmin({ email: `admin-settlements-test-${Date.now()}@example.com` });
    (globalThis as any)._omenaMockSession = {
      user: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        name: admin.name,
        userType: 'admin',
        visibilityLevel: 2,
      },
    };

    // Create test consignor for settlement generation
    const { consignors, auctions, lots } = await import('@/db/schema');
    const ts = Date.now();

    const [consignor] = await db
      .insert(consignors)
      .values({
        name: `Settlement Test Consignor ${ts}`,
        email: `consignor-settle-${ts}@example.com`,
        commissionRate: '0.1000',
      })
      .returning();
    testConsignorId = consignor.id;

    // Create test auction
    const [auction] = await db
      .insert(auctions)
      .values({
        title: `Settlement Test Auction ${ts}`,
        slug: `settle-test-auction-${ts}`,
        description: 'Auction for settlement integration tests',
        category: 'paintings',
        startDate: new Date(Date.now() + 7 * 24 * 3600000),
        endDate: new Date(Date.now() + 7 * 24 * 3600000 + 4 * 3600000),
        status: 'archive',
        visibilityLevel: '0',
        buyersPremiumRate: '0.2000',
      })
      .returning();
    testAuctionId = auction.id;

    // Create a sold lot for the consignor in the auction
    const [lot] = await db
      .insert(lots)
      .values({
        auctionId: testAuctionId,
        consignorId: testConsignorId,
        title: `Settlement Test Lot ${ts}`,
        lotNumber: 9999,
        sortOrder: 9999,
        status: 'sold',
        hammerPrice: 10000,
        estimateMin: 5000,
        estimateMax: 15000,
        artist: 'Test Artist',
        category: 'malarstwo',
        visibilityLevel: '0',
      })
      .returning();
    testLotId = lot.id;
  });

  afterAll(async () => {
    const { settlements, settlementItems, lots, auctions, consignors } = await import('@/db/schema');
    const { inArray, eq } = await import('drizzle-orm');

    // Clean up settlement items first (FK constraint)
    if (createdSettlementIds.length > 0) {
      await db.delete(settlementItems).where(inArray(settlementItems.settlementId, createdSettlementIds)).catch(() => {});
      await db.delete(settlements).where(inArray(settlements.id, createdSettlementIds)).catch(() => {});
    }

    // Clean up test lots, auctions, consignors
    if (testLotId) await db.delete(lots).where(eq(lots.id, testLotId)).catch(() => {});
    if (testAuctionId) await db.delete(auctions).where(eq(auctions.id, testAuctionId)).catch(() => {});
    if (testConsignorId) await db.delete(consignors).where(eq(consignors.id, testConsignorId)).catch(() => {});
    await db.execute(`DELETE FROM admins WHERE email LIKE 'admin-settlements-test-%@example.com'`);
  });

  describe('GET /api/admin/settlements', () => {
    it('returns list of settlements when authenticated', async () => {
      const { GET } = await import('@/app/api/admin/settlements/route');

      const request = createRequest('GET', '/api/admin/settlements');
      const { status, data } = await callRouteHandler(GET, request);

      expect(status).toBe(200);
      expect(data).toHaveProperty('settlements');
      expect(Array.isArray((data as Record<string, unknown>).settlements)).toBe(true);
    });

    it('supports filtering by consignorId', async () => {
      const { GET } = await import('@/app/api/admin/settlements/route');

      const request = createRequest('GET', `/api/admin/settlements?consignorId=${testConsignorId}`);
      const { status, data } = await callRouteHandler(GET, request);

      expect(status).toBe(200);
      expect(data).toHaveProperty('settlements');
    });

    it('supports filtering by status', async () => {
      const { GET } = await import('@/app/api/admin/settlements/route');

      const request = createRequest('GET', '/api/admin/settlements?status=pending');
      const { status, data } = await callRouteHandler(GET, request);

      expect(status).toBe(200);
      expect(data).toHaveProperty('settlements');
      const settlements = (data as Record<string, Array<Record<string, unknown>>>).settlements;
      for (const s of settlements) {
        expect(s.status).toBe('pending');
      }
    });

    it('returns 401 when unauthenticated', async () => {
      const { GET } = await import('@/app/api/admin/settlements/route');
      (globalThis as any)._omenaMockSession = null;

      const request = createRequest('GET', '/api/admin/settlements');
      const { status } = await callRouteHandler(GET, request);

      expect(status).toBe(401);

      (globalThis as any)._omenaMockSession = {
        user: { id: admin.id, email: admin.email, role: admin.role, name: admin.name, userType: 'admin', visibilityLevel: 2 },
      };
    });
  });

  describe('POST /api/admin/settlements', () => {
    it('generates settlement for consignor + auction', async () => {
      const { POST } = await import('@/app/api/admin/settlements/route');

      const request = createRequest('POST', '/api/admin/settlements', {
        consignorId: testConsignorId,
        auctionId: testAuctionId,
      });
      const { status, data } = await callRouteHandler(POST, request);

      expect(status).toBe(201);
      expect(data).toHaveProperty('settlement');
      const settlement = (data as Record<string, Record<string, unknown>>).settlement;
      expect(settlement.consignorId).toBe(testConsignorId);
      expect(settlement.auctionId).toBe(testAuctionId);
      expect(settlement.status).toBe('pending');
      expect(settlement.totalHammer).toBe(10000);
      expect(settlement.commissionAmount).toBe(1000); // 10% of 10000
      expect(settlement.netPayout).toBe(9000);

      createdSettlementIds.push(settlement.id as string);
    });

    it('returns 422 for duplicate settlement (same consignor+auction)', async () => {
      const { POST } = await import('@/app/api/admin/settlements/route');

      // The settlement was already created in previous test
      const request = createRequest('POST', '/api/admin/settlements', {
        consignorId: testConsignorId,
        auctionId: testAuctionId,
      });
      const { status, data } = await callRouteHandler(POST, request);

      expect(status).toBe(422);
      expect((data as Record<string, string>).error).toContain('already exists');
    });

    it('returns 400 when consignorId is missing', async () => {
      const { POST } = await import('@/app/api/admin/settlements/route');

      const request = createRequest('POST', '/api/admin/settlements', {
        auctionId: testAuctionId,
      });
      const { status, data } = await callRouteHandler(POST, request);

      expect(status).toBe(400);
      expect((data as Record<string, string>).error).toContain('consignorId');
    });

    it('returns 400 when auctionId is missing', async () => {
      const { POST } = await import('@/app/api/admin/settlements/route');

      const request = createRequest('POST', '/api/admin/settlements', {
        consignorId: testConsignorId,
      });
      const { status, data } = await callRouteHandler(POST, request);

      expect(status).toBe(400);
      expect((data as Record<string, string>).error).toContain('auctionId');
    });

    it('returns 401 when unauthenticated', async () => {
      const { POST } = await import('@/app/api/admin/settlements/route');
      (globalThis as any)._omenaMockSession = null;

      const request = createRequest('POST', '/api/admin/settlements', {
        consignorId: testConsignorId,
        auctionId: testAuctionId,
      });
      const { status } = await callRouteHandler(POST, request);

      expect(status).toBe(401);

      (globalThis as any)._omenaMockSession = {
        user: { id: admin.id, email: admin.email, role: admin.role, name: admin.name, userType: 'admin', visibilityLevel: 2 },
      };
    });
  });

  describe('GET /api/admin/settlements/[id]', () => {
    it('returns settlement detail with items', async () => {
      const { GET } = await import('@/app/api/admin/settlements/[id]/route');

      // Use the settlement created from POST tests
      const settlementId = createdSettlementIds[0];
      if (!settlementId) return; // skip if POST test didn't run

      const request = createRequest('GET', `/api/admin/settlements/${settlementId}`);
      const { status, data } = await callRouteHandler(GET, request, {
        params: Promise.resolve({ id: settlementId }),
      });

      expect(status).toBe(200);
      expect(data).toHaveProperty('settlement');
      const settlement = (data as Record<string, Record<string, unknown>>).settlement;
      expect(settlement.id).toBe(settlementId);
      expect(settlement).toHaveProperty('items');
      expect(Array.isArray(settlement.items)).toBe(true);
    });

    it('returns 404 for non-existent settlement', async () => {
      const { GET } = await import('@/app/api/admin/settlements/[id]/route');
      const { randomUUID } = await import('crypto');

      const fakeId = randomUUID();
      const request = createRequest('GET', `/api/admin/settlements/${fakeId}`);
      const { status } = await callRouteHandler(GET, request, {
        params: Promise.resolve({ id: fakeId }),
      });

      expect(status).toBe(404);
    });
  });

  describe('PATCH /api/admin/settlements/[id]', () => {
    it('transitions settlement from pending to approved', async () => {
      const { PATCH } = await import('@/app/api/admin/settlements/[id]/route');

      const settlementId = createdSettlementIds[0];
      if (!settlementId) return;

      const request = createRequest('PATCH', `/api/admin/settlements/${settlementId}`, {
        status: 'approved',
        notes: 'Approved for payment',
      });
      const { status, data } = await callRouteHandler(PATCH, request, {
        params: Promise.resolve({ id: settlementId }),
      });

      expect(status).toBe(200);
      expect(data).toHaveProperty('settlement');
      const settlement = (data as Record<string, Record<string, unknown>>).settlement;
      expect(settlement.status).toBe('approved');
    });

    it('transitions settlement from approved to paid with bankReference', async () => {
      const { PATCH } = await import('@/app/api/admin/settlements/[id]/route');

      const settlementId = createdSettlementIds[0];
      if (!settlementId) return;

      const request = createRequest('PATCH', `/api/admin/settlements/${settlementId}`, {
        status: 'paid',
        bankReference: 'TRANSFER-2026-001',
        notes: 'Payment sent',
      });
      const { status, data } = await callRouteHandler(PATCH, request, {
        params: Promise.resolve({ id: settlementId }),
      });

      expect(status).toBe(200);
      const settlement = (data as Record<string, Record<string, unknown>>).settlement;
      expect(settlement.status).toBe('paid');
      expect(settlement.bankReference).toBe('TRANSFER-2026-001');
      expect(settlement.paidAt).not.toBeNull();
    });

    it('returns 422 for invalid status transition (paid -> pending)', async () => {
      const { PATCH } = await import('@/app/api/admin/settlements/[id]/route');

      const settlementId = createdSettlementIds[0];
      if (!settlementId) return;

      const request = createRequest('PATCH', `/api/admin/settlements/${settlementId}`, {
        status: 'pending',
      });
      const { status, data } = await callRouteHandler(PATCH, request, {
        params: Promise.resolve({ id: settlementId }),
      });

      expect(status).toBe(422);
      expect((data as Record<string, string>).error).toContain('Cannot transition');
    });

    it('returns 400 for invalid status value', async () => {
      const { PATCH } = await import('@/app/api/admin/settlements/[id]/route');

      const settlementId = createdSettlementIds[0];
      if (!settlementId) return;

      const request = createRequest('PATCH', `/api/admin/settlements/${settlementId}`, {
        status: 'invalid_status',
      });
      const { status, data } = await callRouteHandler(PATCH, request, {
        params: Promise.resolve({ id: settlementId }),
      });

      expect(status).toBe(400);
      expect((data as Record<string, string>).error).toContain('status must be one of');
    });

    it('returns 404 for non-existent settlement', async () => {
      const { PATCH } = await import('@/app/api/admin/settlements/[id]/route');
      const { randomUUID } = await import('crypto');

      const fakeId = randomUUID();
      const request = createRequest('PATCH', `/api/admin/settlements/${fakeId}`, {
        status: 'approved',
      });
      const { status } = await callRouteHandler(PATCH, request, {
        params: Promise.resolve({ id: fakeId }),
      });

      expect(status).toBe(404);
    });
  });
});
