import { describe, it, expect, afterAll, vi, beforeEach } from 'vitest';
import { createRequest, callRouteHandler } from '@/tests/helpers/api';
import { createTestAdmin } from '@/tests/helpers/auth';
import { getTestDb } from '@/tests/helpers/db';


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

vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
}));

const _g = globalThis as Record<string, unknown>;

describe('Admin QR Registrations API', () => {
  const db = getTestDb();
  let admin: Awaited<ReturnType<typeof createTestAdmin>>;
  const createdIds: string[] = [];

  beforeEach(async () => {
    admin = await createTestAdmin({
      email: `qr-admin-${Date.now()}@example.com`,
      role: 'super_admin',
    });

    _g._omenaMockSession = {
      user: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        userType: 'admin',
        visibilityLevel: 2,
        role: 'super_admin',
      },
    };
  });

  afterAll(async () => {
    for (const id of createdIds) {
      await db.execute(`DELETE FROM qr_registrations WHERE id = '${id}'`);
    }
    await db.execute(`DELETE FROM admins WHERE email LIKE 'qr-admin-%@example.com'`);
    _g._omenaMockSession = null;
  });

  describe('GET /api/admin/qr-registrations', () => {
    it('returns list of QR registrations', async () => {
      const { GET } = await import('@/app/api/admin/qr-registrations/route');
      const request = createRequest('GET', '/api/admin/qr-registrations');
      const { status, data } = await callRouteHandler(GET, request);

      expect(status).toBe(200);
      expect(data).toHaveProperty('data');
      expect(Array.isArray((data as Record<string, unknown[]>).data)).toBe(true);
    });
  });

  describe('POST /api/admin/qr-registrations', () => {
    it('creates a QR registration', async () => {
      const { POST } = await import('@/app/api/admin/qr-registrations/route');

      const request = createRequest('POST', '/api/admin/qr-registrations', {
        label: 'Test QR Event',
        validFrom: new Date(Date.now() - 86400000).toISOString(),
        validUntil: new Date(Date.now() + 86400000).toISOString(),
        maxUses: 100,
      });

      const { status, data } = await callRouteHandler(POST, request);

      expect(status).toBe(201);
      const entry = (data as Record<string, Record<string, unknown>>).data;
      expect(entry).toHaveProperty('id');
      expect(entry).toHaveProperty('code');
      expect(entry.label).toBe('Test QR Event');
      expect(entry.maxUses).toBe(100);
      createdIds.push(entry.id as string);
    });

    it('creates QR without maxUses (unlimited)', async () => {
      const { POST } = await import('@/app/api/admin/qr-registrations/route');

      const request = createRequest('POST', '/api/admin/qr-registrations', {
        label: 'Unlimited QR',
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 86400000).toISOString(),
      });

      const { status, data } = await callRouteHandler(POST, request);
      expect(status).toBe(201);
      const entry = (data as Record<string, Record<string, unknown>>).data;
      expect(entry.maxUses).toBeNull();
      createdIds.push(entry.id as string);
    });

    it('returns 400 for missing label', async () => {
      const { POST } = await import('@/app/api/admin/qr-registrations/route');

      const request = createRequest('POST', '/api/admin/qr-registrations', {
        validFrom: new Date().toISOString(),
        validUntil: new Date(Date.now() + 86400000).toISOString(),
      });

      const { status } = await callRouteHandler(POST, request);
      expect(status).toBe(400);
    });
  });

  describe('DELETE /api/admin/qr-registrations/[id]', () => {
    it('deactivates a QR registration', async () => {
      // Create one first
      const { POST } = await import('@/app/api/admin/qr-registrations/route');
      const { status: createStatus, data: createData } = await callRouteHandler(POST,
        createRequest('POST', '/api/admin/qr-registrations', {
          label: 'To Deactivate',
          validFrom: new Date().toISOString(),
          validUntil: new Date(Date.now() + 86400000).toISOString(),
        }),
      );
      expect(createStatus).toBe(201);
      const id = (createData as Record<string, Record<string, string>>).data.id;
      createdIds.push(id);

      const { DELETE } = await import('@/app/api/admin/qr-registrations/[id]/route');
      const request = createRequest('DELETE', `/api/admin/qr-registrations/${id}`);
      const context = { params: Promise.resolve({ id }) };
      const response = await DELETE(request, context as never);

      expect(response.status).toBe(200);

      // Verify it's deactivated in DB
      const { qrRegistrations } = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');
      const [qr] = await db.select().from(qrRegistrations).where(eq(qrRegistrations.id, id)).limit(1);
      expect(qr.isActive).toBe(false);
    });

    it('returns 404 for non-existent ID', async () => {
      const { DELETE } = await import('@/app/api/admin/qr-registrations/[id]/route');
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const request = createRequest('DELETE', `/api/admin/qr-registrations/${fakeId}`);
      const context = { params: Promise.resolve({ id: fakeId }) };
      const response = await DELETE(request, context as never);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/admin/qr-registrations/[id]/users', () => {
    it('returns users registered with QR code', async () => {
      const { GET } = await import('@/app/api/admin/qr-registrations/[id]/users/route');
      const fakeId = '00000000-0000-0000-0000-000000000001';
      const request = createRequest('GET', `/api/admin/qr-registrations/${fakeId}/users`);
      const context = { params: Promise.resolve({ id: fakeId }) };
      const response = await GET(request, context as never);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('users');
      expect(Array.isArray(data.users)).toBe(true);
    });
  });
});
