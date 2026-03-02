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

describe('Admin Users API', () => {
  const db = getTestDb();
  let admin: Awaited<ReturnType<typeof createTestAdmin>>;

  beforeAll(async () => {
    admin = await createTestAdmin({ email: `admin-users-test-${Date.now()}@example.com` });
    (globalThis as any)._omenaMockSession = { user: { id: admin.id, email: admin.email, role: admin.role, name: admin.name, userType: 'admin', visibilityLevel: 2 } };
  });

  afterAll(async () => {
    await db.execute(`DELETE FROM users WHERE email LIKE 'users-test-%@example.com'`);
    await db.execute(`DELETE FROM admins WHERE email LIKE 'admin-users-test-%@example.com'`);
  });

  describe('GET /api/admin/users', () => {
    it('returns list of users', async () => {
      const { GET } = await import('@/app/api/admin/users/route');
      const { NextRequest } = await import('next/server');

      const request = new NextRequest('http://localhost:3002/api/admin/users');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('data');
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('supports search by email', async () => {
      const { GET } = await import('@/app/api/admin/users/route');
      const { NextRequest } = await import('next/server');

      // Create a searchable user
      const { users } = await import('@/db/schema');
      const { randomUUID } = await import('crypto');
      const bcrypt = await import('bcryptjs');
      const uniqueEmail = `users-test-search-${Date.now()}@example.com`;
      await db.insert(users).values({
        id: randomUUID(),
        email: uniqueEmail,
        name: 'Searchable User',
        passwordHash: await bcrypt.default.hash('pass', 1),
        visibilityLevel: '0',
      });

      const request = new NextRequest(`http://localhost:3002/api/admin/users?search=${encodeURIComponent('users-test-search')}`);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      const found = data.data.find((u: Record<string, string>) => u.email === uniqueEmail);
      expect(found).toBeDefined();
    });

    it('returns 401 without admin auth', async () => {
      const { GET } = await import('@/app/api/admin/users/route');
      const { NextRequest } = await import('next/server');

      (globalThis as any)._omenaMockSession = null;

      const request = new NextRequest('http://localhost:3002/api/admin/users');
      const response = await GET(request);

      expect(response.status).toBe(401);
      (globalThis as any)._omenaMockSession = { user: { id: admin.id, email: admin.email, role: admin.role, name: admin.name, userType: 'admin', visibilityLevel: 2 } };
    });
  });

  describe('POST /api/admin/users', () => {
    it('creates a new user', async () => {
      const { POST } = await import('@/app/api/admin/users/route');
      const { NextRequest } = await import('next/server');

      const email = `users-test-create-${Date.now()}@example.com`;
      const request = new NextRequest('http://localhost:3002/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name: 'Admin Created User',
          visibilityLevel: '0',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toHaveProperty('user');
      expect(data).toHaveProperty('tempPassword');
      expect(data.user.email).toBe(email);
    });

    it('returns 409 for duplicate email', async () => {
      const { POST } = await import('@/app/api/admin/users/route');
      const { NextRequest } = await import('next/server');

      const email = `users-test-dup-${Date.now()}@example.com`;
      const body = JSON.stringify({ email, name: 'Dup User', visibilityLevel: '0' });

      // Create once
      await POST(new NextRequest('http://localhost:3002/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      }));

      // Try again
      const response = await POST(new NextRequest('http://localhost:3002/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      }));

      expect(response.status).toBe(409);
    });

    it('returns 400 for invalid email format', async () => {
      const { POST } = await import('@/app/api/admin/users/route');
      const { NextRequest } = await import('next/server');

      const request = new NextRequest('http://localhost:3002/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'not-valid', name: 'Bad User' }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/admin/users/[id]', () => {
    it('returns user detail by ID', async () => {
      const { GET } = await import('@/app/api/admin/users/[id]/route');
      const { NextRequest } = await import('next/server');
      const { users } = await import('@/db/schema');
      const { randomUUID } = await import('crypto');
      const bcrypt = await import('bcryptjs');

      const userId = randomUUID();
      const email = `users-test-detail-${Date.now()}@example.com`;
      await db.insert(users).values({
        id: userId,
        email,
        name: 'Detail User',
        passwordHash: await bcrypt.default.hash('pass', 1),
        visibilityLevel: '0',
      });

      const response = await GET(
        new NextRequest(`http://localhost:3002/api/admin/users/${userId}`),
        { params: Promise.resolve({ id: userId }) },
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('user');
      expect((data as Record<string, Record<string, unknown>>).user.id).toBe(userId);
    });

    it('returns 404 for non-existent user', async () => {
      const { GET } = await import('@/app/api/admin/users/[id]/route');
      const { NextRequest } = await import('next/server');
      const { randomUUID } = await import('crypto');

      const fakeId = randomUUID();
      const response = await GET(
        new NextRequest(`http://localhost:3002/api/admin/users/${fakeId}`),
        { params: Promise.resolve({ id: fakeId }) },
      );

      expect(response.status).toBe(404);
    });

    it('returns user with bids when include=bids', async () => {
      const { GET } = await import('@/app/api/admin/users/[id]/route');
      const { NextRequest } = await import('next/server');
      const { users } = await import('@/db/schema');
      const { randomUUID } = await import('crypto');
      const bcrypt = await import('bcryptjs');

      const userId = randomUUID();
      await db.insert(users).values({
        id: userId,
        email: `users-test-bids-${Date.now()}@example.com`,
        name: 'Bids User',
        passwordHash: await bcrypt.default.hash('pass', 1),
        visibilityLevel: '0',
      });

      const response = await GET(
        new NextRequest(`http://localhost:3002/api/admin/users/${userId}?include=bids`),
        { params: Promise.resolve({ id: userId }) },
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('user');
      expect(data).toHaveProperty('bids');
    });

    it('returns user with registrations when include=registrations', async () => {
      const { GET } = await import('@/app/api/admin/users/[id]/route');
      const { NextRequest } = await import('next/server');
      const { users } = await import('@/db/schema');
      const { randomUUID } = await import('crypto');
      const bcrypt = await import('bcryptjs');

      const userId = randomUUID();
      await db.insert(users).values({
        id: userId,
        email: `users-test-regs-${Date.now()}@example.com`,
        name: 'Regs User',
        passwordHash: await bcrypt.default.hash('pass', 1),
        visibilityLevel: '0',
      });

      const response = await GET(
        new NextRequest(`http://localhost:3002/api/admin/users/${userId}?include=registrations`),
        { params: Promise.resolve({ id: userId }) },
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('user');
      expect(data).toHaveProperty('registrations');
    });

    it('returns user with watched lots when include=watched', async () => {
      const { GET } = await import('@/app/api/admin/users/[id]/route');
      const { NextRequest } = await import('next/server');
      const { users } = await import('@/db/schema');
      const { randomUUID } = await import('crypto');
      const bcrypt = await import('bcryptjs');

      const userId = randomUUID();
      await db.insert(users).values({
        id: userId,
        email: `users-test-watched-${Date.now()}@example.com`,
        name: 'Watched User',
        passwordHash: await bcrypt.default.hash('pass', 1),
        visibilityLevel: '0',
      });

      const response = await GET(
        new NextRequest(`http://localhost:3002/api/admin/users/${userId}?include=watched`),
        { params: Promise.resolve({ id: userId }) },
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('user');
      expect(data).toHaveProperty('watched');
    });
  });

  describe('PATCH /api/admin/users/[id]', () => {
    let userId: string;

    beforeAll(async () => {
      const { users } = await import('@/db/schema');
      const { randomUUID } = await import('crypto');
      const bcrypt = await import('bcryptjs');

      userId = randomUUID();
      await db.insert(users).values({
        id: userId,
        email: `users-test-patch-${Date.now()}@example.com`,
        name: 'Patch User',
        passwordHash: await bcrypt.default.hash('pass', 1),
        visibilityLevel: '0',
      });
    });

    it('updates user name and city', async () => {
      const { PATCH } = await import('@/app/api/admin/users/[id]/route');
      const { NextRequest } = await import('next/server');

      const response = await PATCH(
        new NextRequest(`http://localhost:3002/api/admin/users/${userId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Updated Name', city: 'Warsaw' }),
        }),
        { params: Promise.resolve({ id: userId }) },
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('user');
      expect((data as Record<string, Record<string, unknown>>).user.name).toBe('Updated Name');
    });

    it('updates user with only isActive field', async () => {
      const { PATCH } = await import('@/app/api/admin/users/[id]/route');
      const { NextRequest } = await import('next/server');

      const response = await PATCH(
        new NextRequest(`http://localhost:3002/api/admin/users/${userId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: false }),
        }),
        { params: Promise.resolve({ id: userId }) },
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect((data as Record<string, Record<string, unknown>>).user.isActive).toBe(false);
    });

    it('returns 400 for invalid field value', async () => {
      const { PATCH } = await import('@/app/api/admin/users/[id]/route');
      const { NextRequest } = await import('next/server');

      const response = await PATCH(
        new NextRequest(`http://localhost:3002/api/admin/users/${userId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'not-a-valid-email' }),
        }),
        { params: Promise.resolve({ id: userId }) },
      );

      expect(response.status).toBe(400);
    });

    it('returns 404 when patching non-existent user', async () => {
      const { PATCH } = await import('@/app/api/admin/users/[id]/route');
      const { NextRequest } = await import('next/server');
      const { randomUUID } = await import('crypto');

      const fakeId = randomUUID();
      const response = await PATCH(
        new NextRequest(`http://localhost:3002/api/admin/users/${fakeId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Ghost' }),
        }),
        { params: Promise.resolve({ id: fakeId }) },
      );

      expect(response.status).toBe(404);
    });

    it('returns 401 without admin auth on PATCH', async () => {
      const { PATCH } = await import('@/app/api/admin/users/[id]/route');
      const { NextRequest } = await import('next/server');

      (globalThis as any)._omenaMockSession = null;

      const response = await PATCH(
        new NextRequest(`http://localhost:3002/api/admin/users/${userId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Unauthorized' }),
        }),
        { params: Promise.resolve({ id: userId }) },
      );

      expect(response.status).toBe(401);
      (globalThis as any)._omenaMockSession = { user: { id: admin.id, email: admin.email, role: admin.role, name: admin.name, userType: 'admin', visibilityLevel: 2 } };
    });
  });

  describe('DELETE /api/admin/users/[id]', () => {
    it('soft-deletes a user', async () => {
      const { DELETE } = await import('@/app/api/admin/users/[id]/route');
      const { NextRequest } = await import('next/server');
      const { users } = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');
      const { randomUUID } = await import('crypto');
      const bcrypt = await import('bcryptjs');

      const userId = randomUUID();
      await db.insert(users).values({
        id: userId,
        email: `users-test-delete-${Date.now()}@example.com`,
        name: 'Delete User',
        passwordHash: await bcrypt.default.hash('pass', 1),
        visibilityLevel: '0',
      });

      const response = await DELETE(
        new NextRequest(`http://localhost:3002/api/admin/users/${userId}`),
        { params: Promise.resolve({ id: userId }) },
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify soft-deleted
      const [user] = await db.select({ deletedAt: users.deletedAt, isActive: users.isActive }).from(users).where(eq(users.id, userId));
      expect(user.deletedAt).not.toBeNull();
      expect(user.isActive).toBe(false);
    });

    it('returns 404 when deleting non-existent user', async () => {
      const { DELETE } = await import('@/app/api/admin/users/[id]/route');
      const { NextRequest } = await import('next/server');
      const { randomUUID } = await import('crypto');

      const fakeId = randomUUID();
      const response = await DELETE(
        new NextRequest(`http://localhost:3002/api/admin/users/${fakeId}`),
        { params: Promise.resolve({ id: fakeId }) },
      );

      expect(response.status).toBe(404);
    });

    it('returns 401 without admin auth on DELETE', async () => {
      const { DELETE } = await import('@/app/api/admin/users/[id]/route');
      const { NextRequest } = await import('next/server');
      const { randomUUID } = await import('crypto');

      (globalThis as any)._omenaMockSession = null;

      const fakeId = randomUUID();
      const response = await DELETE(
        new NextRequest(`http://localhost:3002/api/admin/users/${fakeId}`),
        { params: Promise.resolve({ id: fakeId }) },
      );

      expect(response.status).toBe(401);
      (globalThis as any)._omenaMockSession = { user: { id: admin.id, email: admin.email, role: admin.role, name: admin.name, userType: 'admin', visibilityLevel: 2 } };
    });
  });
});
