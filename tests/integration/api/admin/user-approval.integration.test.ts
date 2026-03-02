import { describe, it, expect, afterAll, vi, beforeEach } from 'vitest';
import { createRequest, callRouteHandler } from '@/tests/helpers/api';
import { createTestUser, createTestAdmin } from '@/tests/helpers/auth';
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

vi.mock('@/lib/notifications', () => ({
  createNotification: vi.fn().mockResolvedValue('notif-id'),
}));

const _g = globalThis as Record<string, unknown>;

describe('Admin user approval/rejection', () => {
  const db = getTestDb();
  let admin: Awaited<ReturnType<typeof createTestAdmin>>;

  beforeEach(async () => {
    admin = await createTestAdmin({
      email: `approval-admin-${Date.now()}@example.com`,
      role: 'super_admin',
    });

    // Set mock session to admin
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
    await db.execute(`DELETE FROM users WHERE email LIKE 'approval-test-%@example.com'`);
    await db.execute(`DELETE FROM admins WHERE email LIKE 'approval-admin-%@example.com'`);
    _g._omenaMockSession = null;
  });

  describe('POST /api/admin/users/[id]/approve', () => {
    it('approves a pending user', async () => {
      const user = await createTestUser({
        email: `approval-test-approve-${Date.now()}@example.com`,
        accountStatus: 'pending_approval',
        isActive: false,
      });

      const { POST } = await import('@/app/api/admin/users/[id]/approve/route');
      const request = createRequest('POST', `/api/admin/users/${user.id}/approve`);
      const context = { params: Promise.resolve({ id: user.id }) };
      const response = await POST(request, context as never);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toMatch(/approved/i);

      // Check DB
      const { users } = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');
      const [updated] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);

      expect(updated.accountStatus).toBe('approved');
      expect(updated.isActive).toBe(true);
      expect(updated.approvedAt).not.toBeNull();
      expect(updated.approvedBy).toBe(admin.id);
    });

    it('returns 400 for already approved user', async () => {
      const user = await createTestUser({
        email: `approval-test-already-${Date.now()}@example.com`,
        accountStatus: 'approved',
      });

      const { POST } = await import('@/app/api/admin/users/[id]/approve/route');
      const request = createRequest('POST', `/api/admin/users/${user.id}/approve`);
      const context = { params: Promise.resolve({ id: user.id }) };
      const response = await POST(request, context as never);

      expect(response.status).toBe(400);
    });

    it('returns 404 for non-existent user', async () => {
      const { POST } = await import('@/app/api/admin/users/[id]/approve/route');
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const request = createRequest('POST', `/api/admin/users/${fakeId}/approve`);
      const context = { params: Promise.resolve({ id: fakeId }) };
      const response = await POST(request, context as never);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/admin/users/[id]/reject', () => {
    it('rejects a pending user with reason', async () => {
      const user = await createTestUser({
        email: `approval-test-reject-${Date.now()}@example.com`,
        accountStatus: 'pending_approval',
      });

      const { POST } = await import('@/app/api/admin/users/[id]/reject/route');
      const request = new Request(`http://localhost:3002/api/admin/users/${user.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Incomplete application' }),
      });
      const context = { params: Promise.resolve({ id: user.id }) };
      const response = await POST(request, context as never);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toMatch(/rejected/i);

      // Check DB
      const { users } = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');
      const [updated] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);

      expect(updated.accountStatus).toBe('rejected');
      expect(updated.rejectedReason).toBe('Incomplete application');
    });

    it('rejects a user without reason', async () => {
      const user = await createTestUser({
        email: `approval-test-reject-noreason-${Date.now()}@example.com`,
        accountStatus: 'pending_approval',
      });

      const { POST } = await import('@/app/api/admin/users/[id]/reject/route');
      const request = new Request(`http://localhost:3002/api/admin/users/${user.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const context = { params: Promise.resolve({ id: user.id }) };
      const response = await POST(request, context as never);

      expect(response.status).toBe(200);
    });

    it('returns 400 for already rejected user', async () => {
      const user = await createTestUser({
        email: `approval-test-already-rej-${Date.now()}@example.com`,
        accountStatus: 'rejected',
      });

      const { POST } = await import('@/app/api/admin/users/[id]/reject/route');
      const request = new Request(`http://localhost:3002/api/admin/users/${user.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const context = { params: Promise.resolve({ id: user.id }) };
      const response = await POST(request, context as never);

      expect(response.status).toBe(400);
    });

    it('returns 404 for non-existent user', async () => {
      const { POST } = await import('@/app/api/admin/users/[id]/reject/route');
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const request = new Request(`http://localhost:3002/api/admin/users/${fakeId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const context = { params: Promise.resolve({ id: fakeId }) };
      const response = await POST(request, context as never);

      expect(response.status).toBe(404);
    });
  });
});
