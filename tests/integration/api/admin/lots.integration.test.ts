import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getTestDb } from '@/tests/helpers/db';
import { createTestAdmin } from '@/tests/helpers/auth';

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

describe('Admin Lots API', () => {
  const db = getTestDb();
  let admin: Awaited<ReturnType<typeof createTestAdmin>>;
  let auctionId: string;
  const createdLotIds: string[] = [];

  beforeAll(async () => {
    const { randomUUID } = await import('crypto');
    const { auctions } = await import('@/db/schema');

    admin = await createTestAdmin({ email: `admin-lots-test-${Date.now()}@example.com` });
    (globalThis as any)._omenaaMockSession = { user: { id: admin.id, email: admin.email, role: admin.role, name: admin.name, userType: 'admin', visibilityLevel: 2 } };

    // Create a test auction
    auctionId = randomUUID();
    await db.insert(auctions).values({
      id: auctionId,
      slug: `lots-test-auction-${Date.now()}`,
      title: 'Lots Test Auction',
      description: 'Test',
      category: 'mixed',
      startDate: new Date(Date.now() + 86400000),
      endDate: new Date(Date.now() + 90000000),
      location: 'Warsaw',
      curator: 'Test',
      status: 'draft',
      visibilityLevel: '0',
      buyersPremiumRate: '0.2000',
    });
  });

  afterAll(async () => {
    const { auctions, lots } = await import('@/db/schema');
    const { eq, inArray } = await import('drizzle-orm');
    if (createdLotIds.length > 0) {
      await db.delete(lots).where(inArray(lots.id, createdLotIds)).catch(() => {});
    }
    await db.delete(lots).where(eq(lots.auctionId, auctionId)).catch(() => {});
    await db.delete(auctions).where(eq(auctions.id, auctionId)).catch(() => {});
    await db.execute(`DELETE FROM admins WHERE email LIKE 'admin-lots-test-%@example.com'`);
  });

  const validLotData = (lotNumber: number) => ({
    lotNumber,
    title: 'Test Artwork',
    artist: 'Test Artist',
    description: 'A beautiful painting',
    medium: 'Oil on canvas',
    dimensions: '50 x 70 cm',
    year: 2020,
    estimateMin: 5000,
    estimateMax: 10000,
  });

  describe('GET /api/admin/auctions/[id]/lots', () => {
    it('returns lots for an auction', async () => {
      const { GET } = await import('@/app/api/admin/auctions/[id]/lots/route');
      const { NextRequest } = await import('next/server');

      const request = new NextRequest(`http://localhost:3002/api/admin/auctions/${auctionId}/lots`);
      const response = await GET(request, { params: Promise.resolve({ id: auctionId }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('lots');
      expect(Array.isArray(data.lots)).toBe(true);
    });

    it('returns 401 without admin auth', async () => {
      const { GET } = await import('@/app/api/admin/auctions/[id]/lots/route');
      const { NextRequest } = await import('next/server');

      (globalThis as any)._omenaaMockSession = null;

      const request = new NextRequest(`http://localhost:3002/api/admin/auctions/${auctionId}/lots`);
      const response = await GET(request, { params: Promise.resolve({ id: auctionId }) });

      expect(response.status).toBe(401);
      (globalThis as any)._omenaaMockSession = { user: { id: admin.id, email: admin.email, role: admin.role, name: admin.name, userType: 'admin', visibilityLevel: 2 } };
    });
  });

  describe('POST /api/admin/auctions/[id]/lots', () => {
    it('creates a lot in an auction', async () => {
      const { POST } = await import('@/app/api/admin/auctions/[id]/lots/route');
      const { NextRequest } = await import('next/server');

      const lotData = validLotData(1);
      const request = new NextRequest(`http://localhost:3002/api/admin/auctions/${auctionId}/lots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lotData),
      });

      const response = await POST(request, { params: Promise.resolve({ id: auctionId }) });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toHaveProperty('lot');
      expect(data.lot.title).toBe(lotData.title);
      expect(data.lot.auctionId).toBe(auctionId);
      expect(data.lot.status).toBe('draft');
      createdLotIds.push(data.lot.id);
    });

    it('returns 400 for missing required fields', async () => {
      const { POST } = await import('@/app/api/admin/auctions/[id]/lots/route');
      const { NextRequest } = await import('next/server');

      const request = new NextRequest(`http://localhost:3002/api/admin/auctions/${auctionId}/lots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '' }), // empty title fails validation (min 1)
      });

      const response = await POST(request, { params: Promise.resolve({ id: auctionId }) });
      expect(response.status).toBe(400);
    });

    it('returns 404 for non-existent auction', async () => {
      const { POST } = await import('@/app/api/admin/auctions/[id]/lots/route');
      const { NextRequest } = await import('next/server');
      const { randomUUID } = await import('crypto');

      const fakeId = randomUUID();
      const request = new NextRequest(`http://localhost:3002/api/admin/auctions/${fakeId}/lots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validLotData(2)),
      });

      const response = await POST(request, { params: Promise.resolve({ id: fakeId }) });
      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/admin/lots/[id]', () => {
    let lotId: string;

    beforeAll(async () => {
      const { POST } = await import('@/app/api/admin/auctions/[id]/lots/route');
      const { NextRequest } = await import('next/server');

      const request = new NextRequest(`http://localhost:3002/api/admin/auctions/${auctionId}/lots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validLotData(3)),
      });

      const response = await POST(request, { params: Promise.resolve({ id: auctionId }) });
      const data = await response.json();
      lotId = data.lot.id;
      createdLotIds.push(lotId);
    });

    it('updates lot fields', async () => {
      const { PATCH } = await import('@/app/api/admin/lots/[id]/route');

      const response = await PATCH(
        new Request(`http://localhost:3002/api/admin/lots/${lotId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Updated Artwork Title', estimateMin: 7000 }),
        }),
        { params: Promise.resolve({ id: lotId }) },
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('lot');
      expect(data.lot.title).toBe('Updated Artwork Title');
    });

    it('returns 404 for non-existent lot', async () => {
      const { PATCH } = await import('@/app/api/admin/lots/[id]/route');
      const { randomUUID } = await import('crypto');

      const fakeId = randomUUID();
      const response = await PATCH(
        new Request(`http://localhost:3002/api/admin/lots/${fakeId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Non-existent' }),
        }),
        { params: Promise.resolve({ id: fakeId }) },
      );

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/admin/lots/[id]', () => {
    it('soft-deletes a lot', async () => {
      const { POST } = await import('@/app/api/admin/auctions/[id]/lots/route');
      const { DELETE, PATCH } = await import('@/app/api/admin/lots/[id]/route');
      const { NextRequest } = await import('next/server');

      // Create a lot to delete
      const createResp = await POST(
        new NextRequest(`http://localhost:3002/api/admin/auctions/${auctionId}/lots`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(validLotData(99)),
        }),
        { params: Promise.resolve({ id: auctionId }) },
      );
      const created = await createResp.json();
      const lotId = created.lot.id;

      // Delete it
      const deleteResp = await DELETE(
        new Request(`http://localhost:3002/api/admin/lots/${lotId}`),
        { params: Promise.resolve({ id: lotId }) },
      );

      expect(deleteResp.status).toBe(200);

      // Verify it's soft-deleted
      const { lots } = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');
      const [lot] = await db.select({ deletedAt: lots.deletedAt }).from(lots).where(eq(lots.id, lotId));
      expect(lot.deletedAt).not.toBeNull();
    });
  });

  describe('PATCH /api/admin/lots/[id]/status', () => {
    let lotId: string;

    beforeAll(async () => {
      const { POST } = await import('@/app/api/admin/auctions/[id]/lots/route');
      const { NextRequest } = await import('next/server');

      const request = new NextRequest(`http://localhost:3002/api/admin/auctions/${auctionId}/lots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validLotData(10)),
      });

      const response = await POST(request, { params: Promise.resolve({ id: auctionId }) });
      const data = await response.json();
      lotId = data.lot.id;
      createdLotIds.push(lotId);
    });

    it('transitions lot from draft to catalogued', async () => {
      const { PATCH } = await import('@/app/api/admin/lots/[id]/status/route');

      const response = await PATCH(
        new Request(`http://localhost:3002/api/admin/lots/${lotId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'catalogued' }),
        }),
        { params: Promise.resolve({ id: lotId }) },
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.lot.status).toBe('catalogued');
    });
  });
});
