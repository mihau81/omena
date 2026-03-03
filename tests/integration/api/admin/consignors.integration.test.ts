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

describe('Admin Consignors API', () => {
  const db = getTestDb();
  let admin: Awaited<ReturnType<typeof createTestAdmin>>;
  const createdIds: string[] = [];

  const validConsignorData = () => ({
    name: 'Test Consignor',
    email: `consignor-${Date.now()}@example.com`,
    phone: '+48123456789',
    address: 'ul. Testowa 1',
    city: 'Warsaw',
    postalCode: '00-001',
    country: 'Poland',
    commissionRate: '0.1000',
  });

  beforeAll(async () => {
    admin = await createTestAdmin({ email: `admin-consignors-test-${Date.now()}@example.com` });
    (globalThis as any)._omenaaMockSession = { user: { id: admin.id, email: admin.email, role: admin.role, name: admin.name, userType: 'admin', visibilityLevel: 2 } };
  });

  afterAll(async () => {
    const { consignors } = await import('@/db/schema');
    const { inArray } = await import('drizzle-orm');
    if (createdIds.length > 0) {
      await db.delete(consignors).where(inArray(consignors.id, createdIds)).catch(() => {});
    }
    await db.execute(`DELETE FROM admins WHERE email LIKE 'admin-consignors-test-%@example.com'`);
  });

  describe('GET /api/admin/consignors', () => {
    it('returns list of consignors', async () => {
      const { GET } = await import('@/app/api/admin/consignors/route');
      const { NextRequest } = await import('next/server');

      const request = new NextRequest('http://localhost:3002/api/admin/consignors');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('data');
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('supports search by name', async () => {
      const { GET } = await import('@/app/api/admin/consignors/route');
      const { NextRequest } = await import('next/server');
      const { POST } = await import('@/app/api/admin/consignors/route');

      // Create a searchable consignor
      const data = { ...validConsignorData(), name: 'Unique Search Name Consignor' };
      const createResp = await POST(new NextRequest('http://localhost:3002/api/admin/consignors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }));
      const created = await createResp.json();
      createdIds.push(created.consignor.id);

      const request = new NextRequest('http://localhost:3002/api/admin/consignors?search=Unique+Search+Name');
      const response = await GET(request);
      const searchData = await response.json();

      expect(response.status).toBe(200);
      const found = searchData.data.find((c: Record<string, string>) => c.id === created.consignor.id);
      expect(found).toBeDefined();
    });
  });

  describe('POST /api/admin/consignors', () => {
    it('creates a consignor successfully', async () => {
      const { POST } = await import('@/app/api/admin/consignors/route');
      const { NextRequest } = await import('next/server');

      const data = validConsignorData();
      const request = new NextRequest('http://localhost:3002/api/admin/consignors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const response = await POST(request);
      const responseData = await response.json();

      expect(response.status).toBe(201);
      expect(responseData).toHaveProperty('consignor');
      expect(responseData.consignor.name).toBe(data.name);
      createdIds.push(responseData.consignor.id);
    });

    it('returns 400 for missing required fields', async () => {
      const { POST } = await import('@/app/api/admin/consignors/route');
      const { NextRequest } = await import('next/server');

      const request = new NextRequest('http://localhost:3002/api/admin/consignors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // missing name which is required
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });
  });

  describe('PATCH /api/admin/consignors/[id]', () => {
    it('updates consignor fields', async () => {
      const { POST } = await import('@/app/api/admin/consignors/route');
      const { PATCH } = await import('@/app/api/admin/consignors/[id]/route');
      const { NextRequest } = await import('next/server');

      // Create consignor
      const data = validConsignorData();
      const createResp = await POST(new NextRequest('http://localhost:3002/api/admin/consignors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }));
      const created = await createResp.json();
      const consignorId = created.consignor.id;
      createdIds.push(consignorId);

      // Update it
      const patchResp = await PATCH(
        new NextRequest(`http://localhost:3002/api/admin/consignors/${consignorId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Updated Consignor Name' }),
        }),
        { params: Promise.resolve({ id: consignorId }) },
      );

      const patchData = await patchResp.json();
      expect(patchResp.status).toBe(200);
      expect(patchData.consignor.name).toBe('Updated Consignor Name');
    });
  });

  describe('DELETE /api/admin/consignors/[id]', () => {
    it('soft-deletes a consignor', async () => {
      const { POST } = await import('@/app/api/admin/consignors/route');
      const { DELETE } = await import('@/app/api/admin/consignors/[id]/route');
      const { NextRequest } = await import('next/server');

      // Create consignor
      const createResp = await POST(new NextRequest('http://localhost:3002/api/admin/consignors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validConsignorData()),
      }));
      const created = await createResp.json();
      const consignorId = created.consignor.id;

      const deleteResp = await DELETE(
        new Request(`http://localhost:3002/api/admin/consignors/${consignorId}`),
        { params: Promise.resolve({ id: consignorId }) },
      );

      expect(deleteResp.status).toBe(200);
    });
  });
});
