import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getTestDb } from '@/tests/helpers/db';
import { createTestAdmin, createTestUser } from '@/tests/helpers/auth';

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
}));

vi.mock('@/lib/notifications', () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
}));

describe('Admin Registrations API', () => {
  const db = getTestDb();
  let admin: Awaited<ReturnType<typeof createTestAdmin>>;
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let auctionId: string;
  let registrationId: string;

  beforeAll(async () => {
    const { randomUUID } = await import('crypto');
    const { auctions, bidRegistrations } = await import('@/db/schema');

    admin = await createTestAdmin({ email: `admin-reg-test-${Date.now()}@example.com` });
    user = await createTestUser({ email: `user-reg-test-${Date.now()}@example.com` });

    (globalThis as any)._omenaMockSession = { user: { id: admin.id, email: admin.email, role: admin.role, name: admin.name, userType: 'admin', visibilityLevel: 2 } };

    // Create an auction
    auctionId = randomUUID();
    await db.insert(auctions).values({
      id: auctionId,
      slug: `reg-test-auction-${Date.now()}`,
      title: 'Registration Test Auction',
      description: 'Test',
      category: 'mixed',
      startDate: new Date(Date.now() + 86400000),
      endDate: new Date(Date.now() + 90000000),
      location: 'Warsaw',
      curator: 'Test',
      status: 'preview',
      visibilityLevel: '0',
      buyersPremiumRate: '0.2000',
    });

    // Create a pending registration (paddle_number=0 indicates pending/unassigned)
    registrationId = randomUUID();
    await db.insert(bidRegistrations).values({
      id: registrationId,
      userId: user.id,
      auctionId,
      paddleNumber: 0,
      isApproved: false,
    });
  });

  afterAll(async () => {
    const { auctions, bidRegistrations } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');
    await db.delete(bidRegistrations).where(eq(bidRegistrations.auctionId, auctionId)).catch(() => {});
    await db.delete(auctions).where(eq(auctions.id, auctionId)).catch(() => {});
    await db.execute(`DELETE FROM users WHERE email LIKE 'user-reg-test-%@example.com'`);
    await db.execute(`DELETE FROM admins WHERE email LIKE 'admin-reg-test-%@example.com'`);
  });

  describe('GET /api/admin/auctions/[id]/registrations', () => {
    it('returns registrations for an auction', async () => {
      const { GET } = await import('@/app/api/admin/auctions/[id]/registrations/route');
      const { NextRequest } = await import('next/server');

      const request = new NextRequest(`http://localhost:3002/api/admin/auctions/${auctionId}/registrations`);
      const response = await GET(request, { params: Promise.resolve({ id: auctionId }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('registrations');
      expect(Array.isArray(data.registrations)).toBe(true);
      expect(data.registrations.length).toBeGreaterThanOrEqual(1);
    });

    it('filters by pending status', async () => {
      const { GET } = await import('@/app/api/admin/auctions/[id]/registrations/route');
      const { NextRequest } = await import('next/server');

      const request = new NextRequest(`http://localhost:3002/api/admin/auctions/${auctionId}/registrations?status=pending`);
      const response = await GET(request, { params: Promise.resolve({ id: auctionId }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      const pending = data.registrations.filter((r: Record<string, string>) => r.status === 'pending');
      expect(pending.length).toBeGreaterThanOrEqual(1);
    });

    it('returns 404 for non-existent auction', async () => {
      const { GET } = await import('@/app/api/admin/auctions/[id]/registrations/route');
      const { NextRequest } = await import('next/server');
      const { randomUUID } = await import('crypto');

      const fakeId = randomUUID();
      const request = new NextRequest(`http://localhost:3002/api/admin/auctions/${fakeId}/registrations`);
      const response = await GET(request, { params: Promise.resolve({ id: fakeId }) });

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/admin/registrations/[id]/approve', () => {
    it('approves a pending registration and assigns paddle number', async () => {
      const { PATCH } = await import('@/app/api/admin/registrations/[id]/approve/route');

      const response = await PATCH(
        new Request(`http://localhost:3002/api/admin/registrations/${registrationId}/approve`, {
          method: 'PATCH',
        }),
        { params: Promise.resolve({ id: registrationId }) },
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('registration');
      expect(data).toHaveProperty('paddleNumber');
      expect(data.registration.isApproved).toBe(true);
      expect(data.paddleNumber).toBeGreaterThan(0);
    });

    it('returns 409 when registration is already approved', async () => {
      const { PATCH } = await import('@/app/api/admin/registrations/[id]/approve/route');

      // registrationId is already approved from previous test
      const response = await PATCH(
        new Request(`http://localhost:3002/api/admin/registrations/${registrationId}/approve`, {
          method: 'PATCH',
        }),
        { params: Promise.resolve({ id: registrationId }) },
      );

      expect(response.status).toBe(409);
    });

    it('returns 404 for non-existent registration', async () => {
      const { PATCH } = await import('@/app/api/admin/registrations/[id]/approve/route');
      const { randomUUID } = await import('crypto');

      const fakeId = randomUUID();
      const response = await PATCH(
        new Request(`http://localhost:3002/api/admin/registrations/${fakeId}/approve`, {
          method: 'PATCH',
        }),
        { params: Promise.resolve({ id: fakeId }) },
      );

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/admin/auctions/[id]/registrations (bulk)', () => {
    it('bulk approves pending registrations', async () => {
      const { PATCH } = await import('@/app/api/admin/auctions/[id]/registrations/route');
      const { NextRequest } = await import('next/server');

      // Create a fresh pending registration for bulk approval
      const { randomUUID } = await import('crypto');
      const { bidRegistrations } = await import('@/db/schema');
      const user2 = await createTestUser({ email: `user-bulk-reg-${Date.now()}@example.com` });
      const bulkRegId = randomUUID();
      await db.insert(bidRegistrations).values({
        id: bulkRegId,
        userId: user2.id,
        auctionId,
        paddleNumber: 0,
        isApproved: false,
      });

      const request = new NextRequest(`http://localhost:3002/api/admin/auctions/${auctionId}/registrations`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk_approve', ids: [bulkRegId] }),
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: auctionId }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('approved');
      expect(data.approved).toBeGreaterThanOrEqual(1);

      // Clean up: delete registrations before user (FK constraint)
      const { eq: eqCleanup } = await import('drizzle-orm');
      await db.delete(bidRegistrations).where(eqCleanup(bidRegistrations.id, bulkRegId)).catch(() => {});
      await db.execute(`DELETE FROM users WHERE email LIKE 'user-bulk-reg-%@example.com'`);
    });

    it('returns 400 for invalid action', async () => {
      const { PATCH } = await import('@/app/api/admin/auctions/[id]/registrations/route');
      const { NextRequest } = await import('next/server');

      const request = new NextRequest(`http://localhost:3002/api/admin/auctions/${auctionId}/registrations`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'invalid_action', ids: [registrationId] }),
      });

      const response = await PATCH(request, { params: Promise.resolve({ id: auctionId }) });
      expect(response.status).toBe(400);
    });
  });
});
