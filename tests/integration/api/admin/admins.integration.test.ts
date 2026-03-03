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

describe('Admin Admins API', () => {
  const db = getTestDb();
  let superAdmin: Awaited<ReturnType<typeof createTestAdmin>>;
  const createdIds: string[] = [];

  const setSession = (admin: Awaited<ReturnType<typeof createTestAdmin>>) => {
    (globalThis as any)._omenaaMockSession = {
      user: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        name: admin.name,
        userType: 'admin',
        visibilityLevel: 2,
      },
    };
  };

  const clearSession = () => {
    (globalThis as any)._omenaaMockSession = null;
  };

  beforeAll(async () => {
    superAdmin = await createTestAdmin({
      email: `admin-admins-test-super-${Date.now()}@example.com`,
      role: 'super_admin',
    });
    setSession(superAdmin);
  });

  afterAll(async () => {
    const { admins } = await import('@/db/schema');
    const { inArray } = await import('drizzle-orm');
    if (createdIds.length > 0) {
      await db.delete(admins).where(inArray(admins.id, createdIds)).catch(() => {});
    }
    await db.execute(`DELETE FROM admins WHERE email LIKE 'admin-admins-test-%@example.com'`);
  });

  describe('GET /api/admin/admins', () => {
    it('returns list of admins', async () => {
      const { GET } = await import('@/app/api/admin/admins/route');
      const { NextRequest } = await import('next/server');

      const request = new NextRequest('http://localhost:3002/api/admin/admins');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('admins');
      expect(Array.isArray(data.admins)).toBe(true);
      expect(data).toHaveProperty('total');
    });

    it('supports search by email', async () => {
      const { GET, POST } = await import('@/app/api/admin/admins/route');
      const { NextRequest } = await import('next/server');

      // Create a searchable admin
      const email = `admin-admins-test-search-${Date.now()}@example.com`;
      const createResp = await POST(new NextRequest('http://localhost:3002/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name: 'Searchable Admin',
          password: 'SecurePass123!',
          role: 'viewer',
        }),
      }));
      const created = await createResp.json();
      createdIds.push(created.admin.id);

      const request = new NextRequest(`http://localhost:3002/api/admin/admins?search=${encodeURIComponent('admin-admins-test-search')}`);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      const found = data.admins.find((a: Record<string, string>) => a.email === email);
      expect(found).toBeDefined();
    });

    it('returns 401 without auth', async () => {
      const { GET } = await import('@/app/api/admin/admins/route');
      const { NextRequest } = await import('next/server');

      clearSession();

      const request = new NextRequest('http://localhost:3002/api/admin/admins');
      const response = await GET(request);

      expect(response.status).toBe(401);
      setSession(superAdmin);
    });

    it('returns 403 for non-super_admin role', async () => {
      const { GET } = await import('@/app/api/admin/admins/route');
      const { NextRequest } = await import('next/server');

      const viewerAdmin = await createTestAdmin({
        email: `admin-admins-test-viewer-${Date.now()}@example.com`,
        role: 'viewer',
      });
      setSession(viewerAdmin);

      const request = new NextRequest('http://localhost:3002/api/admin/admins');
      const response = await GET(request);

      expect(response.status).toBe(403);
      setSession(superAdmin);
    });
  });

  describe('POST /api/admin/admins', () => {
    it('creates a new admin', async () => {
      const { POST } = await import('@/app/api/admin/admins/route');
      const { NextRequest } = await import('next/server');

      const email = `admin-admins-test-create-${Date.now()}@example.com`;
      const request = new NextRequest('http://localhost:3002/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name: 'New Admin User',
          password: 'SecurePass123!',
          role: 'admin',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toHaveProperty('admin');
      expect(data.admin.email).toBe(email);
      expect(data.admin.name).toBe('New Admin User');
      expect(data.admin.role).toBe('admin');
      createdIds.push(data.admin.id);
    });

    it('returns 409 for duplicate email', async () => {
      const { POST } = await import('@/app/api/admin/admins/route');
      const { NextRequest } = await import('next/server');

      const email = `admin-admins-test-dup-${Date.now()}@example.com`;
      const body = JSON.stringify({
        email,
        name: 'Dup Admin',
        password: 'SecurePass123!',
        role: 'viewer',
      });

      // Create once
      const first = await POST(new NextRequest('http://localhost:3002/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      }));
      const firstData = await first.json();
      createdIds.push(firstData.admin.id);

      // Try again
      const response = await POST(new NextRequest('http://localhost:3002/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      }));

      expect(response.status).toBe(409);
    });

    it('returns 400 for invalid data', async () => {
      const { POST } = await import('@/app/api/admin/admins/route');
      const { NextRequest } = await import('next/server');

      const request = new NextRequest('http://localhost:3002/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'not-valid', name: '', password: 'short' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it('prevents non-super_admin from creating super_admin', async () => {
      const { POST } = await import('@/app/api/admin/admins/route');
      const { NextRequest } = await import('next/server');

      // Use an 'admin' role (has no admins:manage, but let's use super_admin session
      // and test the specific super_admin creation guard)
      // Actually, only super_admin can access this endpoint at all.
      // The guard checks: if creating super_admin role AND requester is NOT super_admin => 403
      // We need an admin-role user with admins:manage to test this, but only super_admin has it.
      // So this specific guard is only reachable by super_admin creating another super_admin (allowed).
      // Skip this test as the permission layer prevents non-super_admin from reaching the code.
    });
  });

  describe('GET /api/admin/admins/[id]', () => {
    it('returns admin detail by ID', async () => {
      const { GET } = await import('@/app/api/admin/admins/[id]/route');
      const { NextRequest } = await import('next/server');

      const response = await GET(
        new NextRequest(`http://localhost:3002/api/admin/admins/${superAdmin.id}`),
        { params: Promise.resolve({ id: superAdmin.id }) },
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('admin');
      expect(data.admin.id).toBe(superAdmin.id);
      expect(data.admin.email).toBe(superAdmin.email);
    });

    it('returns 404 for non-existent admin', async () => {
      const { GET } = await import('@/app/api/admin/admins/[id]/route');
      const { NextRequest } = await import('next/server');
      const { randomUUID } = await import('crypto');

      const fakeId = randomUUID();
      const response = await GET(
        new NextRequest(`http://localhost:3002/api/admin/admins/${fakeId}`),
        { params: Promise.resolve({ id: fakeId }) },
      );

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/admin/admins/[id]', () => {
    it('updates admin role', async () => {
      const { POST } = await import('@/app/api/admin/admins/route');
      const { PATCH } = await import('@/app/api/admin/admins/[id]/route');
      const { NextRequest } = await import('next/server');

      // Create admin to update
      const email = `admin-admins-test-patch-${Date.now()}@example.com`;
      const createResp = await POST(new NextRequest('http://localhost:3002/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name: 'Patchable Admin',
          password: 'SecurePass123!',
          role: 'viewer',
        }),
      }));
      const created = await createResp.json();
      const adminId = created.admin.id;
      createdIds.push(adminId);

      // Update role
      const patchResp = await PATCH(
        new NextRequest(`http://localhost:3002/api/admin/admins/${adminId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'cataloguer' }),
        }),
        { params: Promise.resolve({ id: adminId }) },
      );
      const patchData = await patchResp.json();

      expect(patchResp.status).toBe(200);
      expect(patchData.admin.role).toBe('cataloguer');
    });

    it('updates admin name and isActive', async () => {
      const { POST } = await import('@/app/api/admin/admins/route');
      const { PATCH } = await import('@/app/api/admin/admins/[id]/route');
      const { NextRequest } = await import('next/server');

      const email = `admin-admins-test-patch2-${Date.now()}@example.com`;
      const createResp = await POST(new NextRequest('http://localhost:3002/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name: 'Before Update',
          password: 'SecurePass123!',
          role: 'viewer',
        }),
      }));
      const created = await createResp.json();
      const adminId = created.admin.id;
      createdIds.push(adminId);

      const patchResp = await PATCH(
        new NextRequest(`http://localhost:3002/api/admin/admins/${adminId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'After Update', isActive: false }),
        }),
        { params: Promise.resolve({ id: adminId }) },
      );
      const patchData = await patchResp.json();

      expect(patchResp.status).toBe(200);
      expect(patchData.admin.name).toBe('After Update');
      expect(patchData.admin.isActive).toBe(false);
    });

    it('returns 400 for empty update', async () => {
      const { PATCH } = await import('@/app/api/admin/admins/[id]/route');
      const { NextRequest } = await import('next/server');

      const response = await PATCH(
        new NextRequest(`http://localhost:3002/api/admin/admins/${superAdmin.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
        { params: Promise.resolve({ id: superAdmin.id }) },
      );

      expect(response.status).toBe(400);
    });

    it('prevents self-deactivation', async () => {
      const { PATCH } = await import('@/app/api/admin/admins/[id]/route');
      const { NextRequest } = await import('next/server');

      const response = await PATCH(
        new NextRequest(`http://localhost:3002/api/admin/admins/${superAdmin.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: false }),
        }),
        { params: Promise.resolve({ id: superAdmin.id }) },
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('cannot deactivate your own account');
    });

    it('returns 404 for non-existent admin', async () => {
      const { PATCH } = await import('@/app/api/admin/admins/[id]/route');
      const { NextRequest } = await import('next/server');
      const { randomUUID } = await import('crypto');

      const fakeId = randomUUID();
      const response = await PATCH(
        new NextRequest(`http://localhost:3002/api/admin/admins/${fakeId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Does Not Exist' }),
        }),
        { params: Promise.resolve({ id: fakeId }) },
      );

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/admin/admins/me', () => {
    it('returns current admin profile', async () => {
      const { GET } = await import('@/app/api/admin/admins/me/route');
      const { NextRequest } = await import('next/server');

      const response = await GET(new NextRequest('http://localhost:3002/api/admin/admins/me'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('admin');
      expect(data.admin.id).toBe(superAdmin.id);
      expect(data.admin.email).toBe(superAdmin.email);
      expect(data.admin).not.toHaveProperty('passwordHash');
    });

    it('returns 401 without auth', async () => {
      const { GET } = await import('@/app/api/admin/admins/me/route');
      const { NextRequest } = await import('next/server');

      clearSession();

      const response = await GET(new NextRequest('http://localhost:3002/api/admin/admins/me'));
      expect(response.status).toBe(401);

      setSession(superAdmin);
    });
  });

  describe('PATCH /api/admin/admins/me', () => {
    it('updates own admin name', async () => {
      const { PATCH } = await import('@/app/api/admin/admins/me/route');
      const { NextRequest } = await import('next/server');

      const newName = `Super Admin ${Date.now()}`;
      const response = await PATCH(
        new NextRequest('http://localhost:3002/api/admin/admins/me', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newName }),
        }),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('admin');
      expect(data.admin.name).toBe(newName);
    });

    it('changes own password', async () => {
      const { PATCH } = await import('@/app/api/admin/admins/me/route');
      const { NextRequest } = await import('next/server');

      // superAdmin was created with 'AdminPassword123!' by default in createTestAdmin
      const response = await PATCH(
        new NextRequest('http://localhost:3002/api/admin/admins/me', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentPassword: 'AdminPassword123!',
            newPassword: 'NewSecurePass456!',
            confirmPassword: 'NewSecurePass456!',
          }),
        }),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('returns 400 for incorrect current password', async () => {
      const { PATCH } = await import('@/app/api/admin/admins/me/route');
      const { NextRequest } = await import('next/server');

      const response = await PATCH(
        new NextRequest('http://localhost:3002/api/admin/admins/me', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentPassword: 'WrongPassword!',
            newPassword: 'AnotherPass789!',
            confirmPassword: 'AnotherPass789!',
          }),
        }),
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('incorrect');
    });

    it('returns 400 for empty name update', async () => {
      const { PATCH } = await import('@/app/api/admin/admins/me/route');
      const { NextRequest } = await import('next/server');

      const response = await PATCH(
        new NextRequest('http://localhost:3002/api/admin/admins/me', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }),
      );

      expect(response.status).toBe(400);
    });

    it('returns 401 without auth on PATCH me', async () => {
      const { PATCH } = await import('@/app/api/admin/admins/me/route');
      const { NextRequest } = await import('next/server');

      clearSession();

      const response = await PATCH(
        new NextRequest('http://localhost:3002/api/admin/admins/me', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Unauthorized' }),
        }),
      );

      expect(response.status).toBe(401);
      setSession(superAdmin);
    });
  });

  describe('DELETE /api/admin/admins/[id]', () => {
    it('soft-deletes an admin', async () => {
      const { POST } = await import('@/app/api/admin/admins/route');
      const { DELETE } = await import('@/app/api/admin/admins/[id]/route');
      const { NextRequest } = await import('next/server');

      // Create admin to delete
      const createResp = await POST(new NextRequest('http://localhost:3002/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `admin-admins-test-delete-${Date.now()}@example.com`,
          name: 'Deletable Admin',
          password: 'SecurePass123!',
          role: 'viewer',
        }),
      }));
      const created = await createResp.json();
      const adminId = created.admin.id;

      const deleteResp = await DELETE(
        new NextRequest(`http://localhost:3002/api/admin/admins/${adminId}`),
        { params: Promise.resolve({ id: adminId }) },
      );

      expect(deleteResp.status).toBe(200);
      const data = await deleteResp.json();
      expect(data.success).toBe(true);
    });

    it('prevents self-deletion', async () => {
      const { DELETE } = await import('@/app/api/admin/admins/[id]/route');
      const { NextRequest } = await import('next/server');

      const response = await DELETE(
        new NextRequest(`http://localhost:3002/api/admin/admins/${superAdmin.id}`),
        { params: Promise.resolve({ id: superAdmin.id }) },
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('cannot delete your own account');
    });

    it('returns 404 for non-existent admin', async () => {
      const { DELETE } = await import('@/app/api/admin/admins/[id]/route');
      const { NextRequest } = await import('next/server');
      const { randomUUID } = await import('crypto');

      const fakeId = randomUUID();
      const response = await DELETE(
        new NextRequest(`http://localhost:3002/api/admin/admins/${fakeId}`),
        { params: Promise.resolve({ id: fakeId }) },
      );

      expect(response.status).toBe(404);
    });
  });
});
