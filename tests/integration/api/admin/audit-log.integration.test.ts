import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createTestAdmin } from '@/tests/helpers/auth';
import { getTestDb } from '@/tests/helpers/db';

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

describe('Admin Audit Log API', () => {
  const db = getTestDb();
  let admin: Awaited<ReturnType<typeof createTestAdmin>>;

  beforeAll(async () => {
    admin = await createTestAdmin({ email: `admin-audit-test-${Date.now()}@example.com` });
    (globalThis as any)._omenaaMockSession = { user: { id: admin.id, email: admin.email, role: 'super_admin', name: admin.name, userType: 'admin', visibilityLevel: 2 } };

    // Insert some audit log entries for testing
    const { auditLog } = await import('@/db/schema');
    const { randomUUID } = await import('crypto');
    await db.insert(auditLog).values([
      {
        tableName: 'auctions',
        recordId: randomUUID(),
        action: 'INSERT',
        newData: { title: 'Test' },
        performedBy: admin.id,
        performedByType: 'admin',
      },
      {
        tableName: 'lots',
        recordId: randomUUID(),
        action: 'UPDATE',
        newData: { status: 'active' },
        performedBy: admin.id,
        performedByType: 'admin',
      },
    ]);
  });

  afterAll(async () => {
    const { auditLog: auditLogTable } = await import('@/db/schema');
    const { eq: eqAudit } = await import('drizzle-orm');
    await db.delete(auditLogTable).where(eqAudit(auditLogTable.performedBy, admin.id)).catch(() => {});
    await db.execute(`DELETE FROM admins WHERE email LIKE 'admin-audit-test-%@example.com'`);
  });

  describe('GET /api/admin/audit-log', () => {
    it('returns audit log entries', async () => {
      const { GET } = await import('@/app/api/admin/audit-log/route');
      const { NextRequest } = await import('next/server');

      const request = new NextRequest('http://localhost:3002/api/admin/audit-log');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('data');
      expect(data).toHaveProperty('total');
      expect(Array.isArray(data.data)).toBe(true);
    });

    it('filters by tableName', async () => {
      const { GET } = await import('@/app/api/admin/audit-log/route');
      const { NextRequest } = await import('next/server');

      const request = new NextRequest('http://localhost:3002/api/admin/audit-log?tableName=auctions');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      for (const entry of data.data) {
        expect(entry.tableName).toBe('auctions');
      }
    });

    it('filters by action', async () => {
      const { GET } = await import('@/app/api/admin/audit-log/route');
      const { NextRequest } = await import('next/server');

      const request = new NextRequest('http://localhost:3002/api/admin/audit-log?action=INSERT');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      for (const entry of data.data) {
        expect(entry.action).toBe('INSERT');
      }
    });

    it('filters by performedBy', async () => {
      const { GET } = await import('@/app/api/admin/audit-log/route');
      const { NextRequest } = await import('next/server');

      const request = new NextRequest(`http://localhost:3002/api/admin/audit-log?performedBy=${admin.id}`);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      const found = data.data.find((e: Record<string, string>) => e.performedBy === admin.id);
      expect(found).toBeDefined();
    });

    it('supports pagination', async () => {
      const { GET } = await import('@/app/api/admin/audit-log/route');
      const { NextRequest } = await import('next/server');

      const request = new NextRequest('http://localhost:3002/api/admin/audit-log?limit=1&page=1');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.length).toBeLessThanOrEqual(1);
    });

    it('returns ISO string dates', async () => {
      const { GET } = await import('@/app/api/admin/audit-log/route');
      const { NextRequest } = await import('next/server');

      const request = new NextRequest(`http://localhost:3002/api/admin/audit-log?performedBy=${admin.id}`);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      if (data.data.length > 0) {
        const firstEntry = data.data[0];
        // createdAt should be an ISO string
        expect(firstEntry.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      }
    });

    it('returns 401 without admin auth', async () => {
      const { GET } = await import('@/app/api/admin/audit-log/route');
      const { NextRequest } = await import('next/server');

      (globalThis as any)._omenaaMockSession = null;

      const request = new NextRequest('http://localhost:3002/api/admin/audit-log');
      const response = await GET(request);

      expect(response.status).toBe(401);
      (globalThis as any)._omenaaMockSession = { user: { id: admin.id, email: admin.email, role: 'super_admin', name: admin.name, userType: 'admin', visibilityLevel: 2 } };
    });
  });
});
