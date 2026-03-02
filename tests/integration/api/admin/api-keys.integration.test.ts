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

describe('Admin API Keys', () => {
  const db = getTestDb();
  let admin: Awaited<ReturnType<typeof createTestAdmin>>;
  const createdKeyIds: string[] = [];

  beforeAll(async () => {
    admin = await createTestAdmin({ email: `admin-keys-test-${Date.now()}@example.com` });
    (globalThis as any)._omenaMockSession = { user: { id: admin.id, email: admin.email, role: 'super_admin', name: admin.name, userType: 'admin', visibilityLevel: 2 } };
  });

  afterAll(async () => {
    const { apiKeys } = await import('@/db/schema');
    const { inArray } = await import('drizzle-orm');
    if (createdKeyIds.length > 0) {
      await db.delete(apiKeys).where(inArray(apiKeys.id, createdKeyIds)).catch(() => {});
    }
    await db.execute(`DELETE FROM admins WHERE email LIKE 'admin-keys-test-%@example.com'`);
  });

  describe('POST /api/admin/api-keys', () => {
    it('creates a new API key and returns plain key once', async () => {
      const { POST } = await import('@/app/api/admin/api-keys/route');

      const response = await POST(new Request('http://localhost:3002/api/admin/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Integration Key',
          rateLimit: 1000,
          permissions: ['lots:read', 'auctions:read'],
        }),
      }));
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toHaveProperty('apiKey');
      expect(data).toHaveProperty('plainKey');
      expect(typeof data.plainKey).toBe('string');
      expect(data.plainKey.length).toBeGreaterThan(10);
      // The plain key should NOT be hashed
      expect(data.plainKey).not.toMatch(/^\$2[ab]\$/);
      // The key should not expose keyHash
      expect(data.apiKey).not.toHaveProperty('keyHash');
      createdKeyIds.push(data.apiKey.id);
    });

    it('returns 400 when name is missing', async () => {
      const { POST } = await import('@/app/api/admin/api-keys/route');

      const response = await POST(new Request('http://localhost:3002/api/admin/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rateLimit: 1000 }),
      }));

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty('error', 'Name is required');
    });

    it('returns 400 for invalid rateLimit', async () => {
      const { POST } = await import('@/app/api/admin/api-keys/route');

      const response = await POST(new Request('http://localhost:3002/api/admin/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test Key', rateLimit: -1 }),
      }));

      expect(response.status).toBe(400);
    });

    it('returns 401 without admin auth', async () => {
      const { POST } = await import('@/app/api/admin/api-keys/route');
      (globalThis as any)._omenaMockSession = null;

      const response = await POST(new Request('http://localhost:3002/api/admin/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Unauthorized Key' }),
      }));

      expect(response.status).toBe(401);
      (globalThis as any)._omenaMockSession = { user: { id: admin.id, email: admin.email, role: 'super_admin', name: admin.name, userType: 'admin', visibilityLevel: 2 } };
    });
  });

  describe('GET /api/admin/api-keys', () => {
    it('lists all API keys without exposing keyHash', async () => {
      const { GET } = await import('@/app/api/admin/api-keys/route');

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('apiKeys');
      expect(data).toHaveProperty('total');
      expect(Array.isArray(data.apiKeys)).toBe(true);

      // Ensure keyHash is NOT in any key
      for (const key of data.apiKeys) {
        expect(key).not.toHaveProperty('keyHash');
        expect(key).toHaveProperty('keyPrefix');
        expect(key).toHaveProperty('name');
        expect(key).toHaveProperty('isActive');
      }
    });
  });

  describe('PATCH /api/admin/api-keys/[id] (deactivate)', () => {
    it('deactivates an API key', async () => {
      const { POST } = await import('@/app/api/admin/api-keys/route');
      const { PATCH } = await import('@/app/api/admin/api-keys/[id]/route');

      // Create a key to deactivate
      const createResp = await POST(new Request('http://localhost:3002/api/admin/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Key to Deactivate' }),
      }));
      const created = await createResp.json();
      const keyId = created.apiKey.id;
      createdKeyIds.push(keyId);

      // Deactivate it
      const { NextRequest } = await import('next/server');
      const patchResp = await PATCH(
        new NextRequest(`http://localhost:3002/api/admin/api-keys/${keyId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: false }),
        }),
        { params: Promise.resolve({ id: keyId }) },
      );
      const patchData = await patchResp.json();

      expect(patchResp.status).toBe(200);
      expect(patchData.apiKey.isActive).toBe(false);
    });
  });

  describe('DELETE /api/admin/api-keys/[id]', () => {
    it('deletes an API key', async () => {
      const { POST } = await import('@/app/api/admin/api-keys/route');
      const { DELETE } = await import('@/app/api/admin/api-keys/[id]/route');

      // Create a key to delete
      const createResp = await POST(new Request('http://localhost:3002/api/admin/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Key to Delete' }),
      }));
      const created = await createResp.json();
      const keyId = created.apiKey.id;

      const deleteResp = await DELETE(
        new Request(`http://localhost:3002/api/admin/api-keys/${keyId}`),
        { params: Promise.resolve({ id: keyId }) },
      );

      expect(deleteResp.status).toBe(200);
    });
  });
});
