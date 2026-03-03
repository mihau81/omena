import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createRequest, callRouteHandler } from '@/tests/helpers/api';
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
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

describe('Admin Auctions API', () => {
  const db = getTestDb();
  let admin: Awaited<ReturnType<typeof createTestAdmin>>;
  const createdAuctionIds: string[] = [];

  const validAuctionData = () => ({
    title: 'Integration Test Auction',
    slug: `int-test-auction-${Date.now()}`,
    description: 'Test auction for integration tests',
    category: 'paintings',
    startDate: new Date(Date.now() + 7 * 24 * 3600000).toISOString(),
    endDate: new Date(Date.now() + 7 * 24 * 3600000 + 4 * 3600000).toISOString(),
    location: 'Warsaw, Poland',
    curator: 'Test Curator',
    visibilityLevel: '0',
    buyersPremiumRate: '0.2000',
  });

  beforeAll(async () => {
    admin = await createTestAdmin({ email: `admin-auctions-test-${Date.now()}@example.com` });
    (globalThis as any)._omenaaMockSession = { user: { id: admin.id, email: admin.email, role: admin.role, name: admin.name, userType: 'admin', visibilityLevel: 2 } };
  });

  afterAll(async () => {
    const { auctions } = await import('@/db/schema');
    const { inArray } = await import('drizzle-orm');
    if (createdAuctionIds.length > 0) {
      await db.delete(auctions).where(inArray(auctions.id, createdAuctionIds)).catch(() => {});
    }
    await db.execute(`DELETE FROM admins WHERE email LIKE 'admin-auctions-test-%@example.com'`);
  });

  describe('GET /api/admin/auctions', () => {
    it('returns list of auctions when authenticated', async () => {
      const { GET } = await import('@/app/api/admin/auctions/route');

      const request = createRequest('GET', '/api/admin/auctions');
      const { status, data } = await callRouteHandler(GET, request);

      expect(status).toBe(200);
      expect(data).toHaveProperty('auctions');
      expect(Array.isArray((data as Record<string, unknown>).auctions)).toBe(true);
    });

    it('returns 401 when unauthenticated', async () => {
      const { GET } = await import('@/app/api/admin/auctions/route');
      (globalThis as any)._omenaaMockSession = null;

      const request = createRequest('GET', '/api/admin/auctions');
      const { status } = await callRouteHandler(GET, request);

      expect(status).toBe(401);
      (globalThis as any)._omenaaMockSession = { user: { id: admin.id, email: admin.email, role: admin.role, name: admin.name, userType: 'admin', visibilityLevel: 2 } };
    });
  });

  describe('POST /api/admin/auctions', () => {
    it('creates auction successfully', async () => {
      const { POST } = await import('@/app/api/admin/auctions/route');

      const data = validAuctionData();
      const request = createRequest('POST', '/api/admin/auctions', data);
      const { status, data: responseData } = await callRouteHandler(POST, request);

      expect(status).toBe(201);
      expect(responseData).toHaveProperty('auction');
      const auction = (responseData as Record<string, Record<string, unknown>>).auction;
      expect(auction.title).toBe(data.title);
      expect(auction.slug).toBe(data.slug);
      expect(auction.status).toBe('draft');

      createdAuctionIds.push(auction.id as string);
    });

    it('returns 409 when slug already exists', async () => {
      const { POST } = await import('@/app/api/admin/auctions/route');

      const data = validAuctionData();
      // Create first
      const r1 = await callRouteHandler(POST, createRequest('POST', '/api/admin/auctions', data));
      createdAuctionIds.push((r1.data as Record<string, Record<string, unknown>>).auction.id as string);

      // Try duplicate slug
      const r2 = await callRouteHandler(POST, createRequest('POST', '/api/admin/auctions', data));

      expect(r2.status).toBe(409);
      expect(r2.data).toHaveProperty('error', 'Slug already exists');
    });

    it('returns 400 for missing required fields', async () => {
      const { POST } = await import('@/app/api/admin/auctions/route');

      const request = createRequest('POST', '/api/admin/auctions', {
        title: 'Missing Slug',
        // slug missing
      });

      const { status, data } = await callRouteHandler(POST, request);

      expect(status).toBe(400);
      expect(data).toHaveProperty('error', 'Validation failed');
    });

    it('returns 401 without admin auth', async () => {
      const { POST } = await import('@/app/api/admin/auctions/route');
      (globalThis as any)._omenaaMockSession = null;

      const request = createRequest('POST', '/api/admin/auctions', validAuctionData());
      const { status } = await callRouteHandler(POST, request);

      expect(status).toBe(401);
      (globalThis as any)._omenaaMockSession = { user: { id: admin.id, email: admin.email, role: admin.role, name: admin.name, userType: 'admin', visibilityLevel: 2 } };
    });
  });

  describe('GET /api/admin/auctions/[id]', () => {
    let auctionId: string;

    beforeAll(async () => {
      const { POST } = await import('@/app/api/admin/auctions/route');
      const result = await callRouteHandler(POST, createRequest('POST', '/api/admin/auctions', validAuctionData()));
      auctionId = (result.data as Record<string, Record<string, unknown>>).auction.id as string;
      createdAuctionIds.push(auctionId);
    });

    it('returns auction by ID', async () => {
      const { GET } = await import('@/app/api/admin/auctions/[id]/route');

      const request = createRequest('GET', `/api/admin/auctions/${auctionId}`);
      const { status, data } = await callRouteHandler(GET, request, { params: Promise.resolve({ id: auctionId }) });

      expect(status).toBe(200);
      expect(data).toHaveProperty('auction');
      expect((data as Record<string, Record<string, unknown>>).auction.id).toBe(auctionId);
    });

    it('returns 404 for non-existent auction', async () => {
      const { GET } = await import('@/app/api/admin/auctions/[id]/route');
      const { randomUUID } = await import('crypto');

      const fakeId = randomUUID();
      const request = createRequest('GET', `/api/admin/auctions/${fakeId}`);
      const { status } = await callRouteHandler(GET, request, { params: Promise.resolve({ id: fakeId }) });

      expect(status).toBe(404);
    });
  });

  describe('PATCH /api/admin/auctions/[id]', () => {
    let auctionId: string;

    beforeAll(async () => {
      const { POST } = await import('@/app/api/admin/auctions/route');
      const result = await callRouteHandler(POST, createRequest('POST', '/api/admin/auctions', validAuctionData()));
      auctionId = (result.data as Record<string, Record<string, unknown>>).auction.id as string;
      createdAuctionIds.push(auctionId);
    });

    it('updates auction fields', async () => {
      const { PATCH } = await import('@/app/api/admin/auctions/[id]/route');

      const request = createRequest('PATCH', `/api/admin/auctions/${auctionId}`, {
        title: 'Updated Title',
        location: 'Krakow',
      });
      const { status, data } = await callRouteHandler(PATCH, request, { params: Promise.resolve({ id: auctionId }) });

      expect(status).toBe(200);
      expect((data as Record<string, Record<string, unknown>>).auction.title).toBe('Updated Title');
      expect((data as Record<string, Record<string, unknown>>).auction.location).toBe('Krakow');
    });

    it('returns 404 for non-existent auction', async () => {
      const { PATCH } = await import('@/app/api/admin/auctions/[id]/route');
      const { randomUUID } = await import('crypto');

      const fakeId = randomUUID();
      const request = createRequest('PATCH', `/api/admin/auctions/${fakeId}`, { title: 'Updated' });
      const { status } = await callRouteHandler(PATCH, request, { params: Promise.resolve({ id: fakeId }) });

      expect(status).toBe(404);
    });
  });

  describe('DELETE /api/admin/auctions/[id]', () => {
    it('soft-deletes an auction', async () => {
      const { POST } = await import('@/app/api/admin/auctions/route');
      const { DELETE, GET } = await import('@/app/api/admin/auctions/[id]/route');

      // Create an auction to delete
      const data = validAuctionData();
      const createResult = await callRouteHandler(POST, createRequest('POST', '/api/admin/auctions', data));
      const auctionId = (createResult.data as Record<string, Record<string, unknown>>).auction.id as string;

      // Delete it
      const deleteResult = await callRouteHandler(DELETE, createRequest('DELETE', `/api/admin/auctions/${auctionId}`), { params: Promise.resolve({ id: auctionId }) });

      expect(deleteResult.status).toBe(200);
      expect((deleteResult.data as Record<string, Record<string, unknown>>).auction.deletedAt).not.toBeNull();

      // Verify it's gone from GET
      const getResult = await callRouteHandler(GET, createRequest('GET', `/api/admin/auctions/${auctionId}`), { params: Promise.resolve({ id: auctionId }) });
      expect(getResult.status).toBe(404);
    });

    it('returns 404 for non-existent auction', async () => {
      const { DELETE } = await import('@/app/api/admin/auctions/[id]/route');
      const { randomUUID } = await import('crypto');

      const fakeId = randomUUID();
      const { status } = await callRouteHandler(DELETE, createRequest('DELETE', `/api/admin/auctions/${fakeId}`), { params: Promise.resolve({ id: fakeId }) });

      expect(status).toBe(404);
    });
  });
});
