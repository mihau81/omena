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

describe('Admin Whitelists API', () => {
  const db = getTestDb();
  const prefix = `wl-${Date.now()}`;
  let admin: Awaited<ReturnType<typeof createTestAdmin>>;

  beforeEach(async () => {
    admin = await createTestAdmin({
      email: `wl-admin-${Date.now()}@example.com`,
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
    await db.execute(`DELETE FROM user_whitelists WHERE email LIKE '${prefix}%@example.com'`);
    await db.execute(`DELETE FROM admins WHERE email LIKE 'wl-admin-%@example.com'`);
    _g._omenaMockSession = null;
  });

  describe('GET /api/admin/whitelists', () => {
    it('returns list of whitelist entries', async () => {
      const { GET } = await import('@/app/api/admin/whitelists/route');
      const request = createRequest('GET', '/api/admin/whitelists');
      const { status, data } = await callRouteHandler(GET, request);

      expect(status).toBe(200);
      expect(data).toHaveProperty('data');
      expect(Array.isArray((data as Record<string, unknown[]>).data)).toBe(true);
    });
  });

  describe('POST /api/admin/whitelists', () => {
    it('adds an email to whitelist', async () => {
      const { POST } = await import('@/app/api/admin/whitelists/route');
      const email = `${prefix}-add@example.com`;

      const request = createRequest('POST', '/api/admin/whitelists', {
        email,
        name: 'Whitelist User',
      });

      const { status, data } = await callRouteHandler(POST, request);

      expect(status).toBe(201);
      const entry = (data as Record<string, Record<string, unknown>>).data;
      expect(entry.email).toBe(email);
      expect(entry.name).toBe('Whitelist User');
    });

    it('returns 409 for duplicate email', async () => {
      const { POST } = await import('@/app/api/admin/whitelists/route');
      const email = `${prefix}-dup@example.com`;

      await callRouteHandler(POST, createRequest('POST', '/api/admin/whitelists', { email }));
      const { status } = await callRouteHandler(POST, createRequest('POST', '/api/admin/whitelists', { email }));

      expect(status).toBe(409);
    });

    it('returns 400 for invalid email', async () => {
      const { POST } = await import('@/app/api/admin/whitelists/route');

      const { status } = await callRouteHandler(POST, createRequest('POST', '/api/admin/whitelists', {
        email: 'not-an-email',
      }));

      expect(status).toBe(400);
    });
  });

  describe('DELETE /api/admin/whitelists/[id]', () => {
    it('deletes a whitelist entry', async () => {
      const { POST } = await import('@/app/api/admin/whitelists/route');
      const email = `${prefix}-del@example.com`;
      const { data: createData } = await callRouteHandler(POST,
        createRequest('POST', '/api/admin/whitelists', { email }),
      );
      const id = (createData as Record<string, Record<string, string>>).data.id;

      const { DELETE } = await import('@/app/api/admin/whitelists/[id]/route');
      const request = createRequest('DELETE', `/api/admin/whitelists/${id}`);
      const context = { params: Promise.resolve({ id }) };
      const response = await DELETE(request, context as never);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.message).toMatch(/deleted/i);
    });

    it('returns 404 for non-existent entry', async () => {
      const { DELETE } = await import('@/app/api/admin/whitelists/[id]/route');
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const request = createRequest('DELETE', `/api/admin/whitelists/${fakeId}`);
      const context = { params: Promise.resolve({ id: fakeId }) };
      const response = await DELETE(request, context as never);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/admin/whitelists/import', () => {
    it('imports CSV file', async () => {
      const { POST } = await import('@/app/api/admin/whitelists/import/route');

      const csvContent = `email,name,notes
${prefix}-csv1@example.com,User One,VIP
${prefix}-csv2@example.com,User Two,
${prefix}-csv3@example.com,,`;

      const file = new File([csvContent], 'whitelist.csv', { type: 'text/csv' });
      const formData = new FormData();
      formData.append('file', file);

      const request = new Request('http://localhost:3002/api/admin/whitelists/import', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.imported).toBeGreaterThanOrEqual(1);
    });

    it('returns 400 when no file uploaded', async () => {
      const { POST } = await import('@/app/api/admin/whitelists/import/route');

      const formData = new FormData();
      const request = new Request('http://localhost:3002/api/admin/whitelists/import', {
        method: 'POST',
        body: formData,
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });
  });
});
