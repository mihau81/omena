import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
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
}));

const VALID_CSV = `lot_number,title,artist,description,medium,dimensions,year,estimate_min,estimate_max,reserve_price,starting_bid,provenance,exhibitions
1,Sunset Painting,Jan Nowak,Beautiful oil painting,Oil on canvas,50x70 cm,2020,5000,8000,,,Gallery A;Gallery B,Expo 2021
2,Abstract Study,Anna Kowalska,Abstract work,Acrylic,40x60 cm,,3000,5000,,,,`;

function createCsvFormData(csvContent: string, filename = 'lots.csv'): FormData {
  const formData = new FormData();
  const file = new File([csvContent], filename, { type: 'text/csv' });
  formData.append('file', file);
  return formData;
}

describe('Admin Lots Import API', () => {
  const db = getTestDb();
  let admin: Awaited<ReturnType<typeof createTestAdmin>>;
  let auctionId: string;

  beforeAll(async () => {
    const { randomUUID } = await import('crypto');
    const { auctions } = await import('@/db/schema');

    admin = await createTestAdmin({ email: `admin-lots-import-test-${Date.now()}@example.com` });
    (globalThis as any)._omenaMockSession = { user: { id: admin.id, email: admin.email, role: admin.role, name: admin.name, userType: 'admin', visibilityLevel: 2 } };

    auctionId = randomUUID();
    await db.insert(auctions).values({
      id: auctionId,
      slug: `lots-import-test-auction-${Date.now()}`,
      title: 'Lots Import Test Auction',
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
    const { eq } = await import('drizzle-orm');
    await db.delete(lots).where(eq(lots.auctionId, auctionId)).catch(() => {});
    await db.delete(auctions).where(eq(auctions.id, auctionId)).catch(() => {});
    await db.execute(`DELETE FROM admins WHERE email LIKE 'admin-lots-import-test-%@example.com'`);
  });

  describe('POST /api/admin/auctions/[id]/lots/import (preview)', () => {
    it('returns parsed rows in preview mode (no ?confirm)', async () => {
      const { POST } = await import('@/app/api/admin/auctions/[id]/lots/import/route');

      const formData = createCsvFormData(VALID_CSV);
      const request = new Request(`http://localhost:3002/api/admin/auctions/${auctionId}/lots/import`, {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request, { params: Promise.resolve({ id: auctionId }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.validCount).toBe(2);
      expect(data.valid).toHaveLength(2);
      expect(data.valid[0].title).toBe('Sunset Painting');
      expect(data.valid[1].title).toBe('Abstract Study');
      expect(data.totalRows).toBe(2);
    });

    it('returns validation errors for invalid CSV data in preview', async () => {
      const { POST } = await import('@/app/api/admin/auctions/[id]/lots/import/route');

      const invalidCsv = `lot_number,title,estimate_min,estimate_max
abc,Missing Number,5000,8000
2,,3000,5000`;

      const formData = createCsvFormData(invalidCsv);
      const request = new Request(`http://localhost:3002/api/admin/auctions/${auctionId}/lots/import`, {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request, { params: Promise.resolve({ id: auctionId }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.errors.length).toBeGreaterThan(0);
      expect(data.validCount).toBe(0);
    });

    it('returns 400 for non-CSV file extension', async () => {
      const { POST } = await import('@/app/api/admin/auctions/[id]/lots/import/route');

      const formData = createCsvFormData('some data', 'lots.txt');
      const request = new Request(`http://localhost:3002/api/admin/auctions/${auctionId}/lots/import`, {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request, { params: Promise.resolve({ id: auctionId }) });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toMatch(/csv/i);
    });

    it('returns 400 for empty file', async () => {
      const { POST } = await import('@/app/api/admin/auctions/[id]/lots/import/route');

      const formData = createCsvFormData('', 'empty.csv');
      const request = new Request(`http://localhost:3002/api/admin/auctions/${auctionId}/lots/import`, {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request, { params: Promise.resolve({ id: auctionId }) });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toMatch(/empty/i);
    });

    it('returns 400 when no file is provided', async () => {
      const { POST } = await import('@/app/api/admin/auctions/[id]/lots/import/route');

      const formData = new FormData();
      const request = new Request(`http://localhost:3002/api/admin/auctions/${auctionId}/lots/import`, {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request, { params: Promise.resolve({ id: auctionId }) });
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toMatch(/no file/i);
    });
  });

  describe('POST /api/admin/auctions/[id]/lots/import?confirm=true (import)', () => {
    it('imports lots into the database', async () => {
      const { POST } = await import('@/app/api/admin/auctions/[id]/lots/import/route');
      const { lots } = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');

      const formData = createCsvFormData(VALID_CSV);
      const request = new Request(`http://localhost:3002/api/admin/auctions/${auctionId}/lots/import?confirm=true`, {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request, { params: Promise.resolve({ id: auctionId }) });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.imported).toBe(2);
      expect(data.skipped).toBe(0);
      expect(data.totalRows).toBe(2);

      // Verify lots were actually created in the database
      const dbLots = await db.select().from(lots).where(eq(lots.auctionId, auctionId));
      expect(dbLots.length).toBeGreaterThanOrEqual(2);

      const titles = dbLots.map((l) => l.title);
      expect(titles).toContain('Sunset Painting');
      expect(titles).toContain('Abstract Study');
    });

    it('returns 422 when all rows are invalid', async () => {
      const { POST } = await import('@/app/api/admin/auctions/[id]/lots/import/route');

      const invalidCsv = `lot_number,title
abc,
-1,`;

      const formData = createCsvFormData(invalidCsv);
      const request = new Request(`http://localhost:3002/api/admin/auctions/${auctionId}/lots/import?confirm=true`, {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request, { params: Promise.resolve({ id: auctionId }) });
      expect(response.status).toBe(422);
      const data = await response.json();
      expect(data.error).toMatch(/no valid rows/i);
    });

    it('returns 404 for non-existent auction', async () => {
      const { POST } = await import('@/app/api/admin/auctions/[id]/lots/import/route');
      const { randomUUID } = await import('crypto');

      const fakeId = randomUUID();
      const formData = createCsvFormData(VALID_CSV);
      const request = new Request(`http://localhost:3002/api/admin/auctions/${fakeId}/lots/import?confirm=true`, {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request, { params: Promise.resolve({ id: fakeId }) });
      expect(response.status).toBe(404);
    });
  });

  describe('Auth checks', () => {
    it('returns 401 without admin auth', async () => {
      const { POST } = await import('@/app/api/admin/auctions/[id]/lots/import/route');

      (globalThis as any)._omenaMockSession = null;

      const formData = createCsvFormData(VALID_CSV);
      const request = new Request(`http://localhost:3002/api/admin/auctions/${auctionId}/lots/import`, {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request, { params: Promise.resolve({ id: auctionId }) });
      expect(response.status).toBe(401);

      // Restore session for other tests
      (globalThis as any)._omenaMockSession = { user: { id: admin.id, email: admin.email, role: admin.role, name: admin.name, userType: 'admin', visibilityLevel: 2 } };
    });
  });

  describe('GET /api/admin/lots/import-template', () => {
    it('returns CSV template file', async () => {
      const { GET } = await import('@/app/api/admin/lots/import-template/route');

      const response = await GET();

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('text/csv');
      expect(response.headers.get('Content-Disposition')).toContain('lot-import-template.csv');

      const body = await response.text();
      expect(body).toContain('lot_number');
      expect(body).toContain('title');
      expect(body).toContain('estimate_min');
    });

    it('returns 401 without admin auth', async () => {
      const { GET } = await import('@/app/api/admin/lots/import-template/route');

      (globalThis as any)._omenaMockSession = null;

      const response = await GET();
      expect(response.status).toBe(401);

      // Restore session
      (globalThis as any)._omenaMockSession = { user: { id: admin.id, email: admin.email, role: admin.role, name: admin.name, userType: 'admin', visibilityLevel: 2 } };
    });
  });
});
