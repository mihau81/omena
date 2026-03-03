import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createRequest, callRouteHandler } from '@/tests/helpers/api';
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
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

describe('Admin Settings API', () => {
  const db = getTestDb();
  let admin: Awaited<ReturnType<typeof createTestAdmin>>;
  const createdSettingIds: string[] = [];

  beforeAll(async () => {
    admin = await createTestAdmin({ email: `admin-settings-test-${Date.now()}@example.com`, role: 'super_admin' });
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

    // Seed a test setting for PATCH tests
    const { settings } = await import('@/db/schema');
    const [row] = await db
      .insert(settings)
      .values({
        key: `test_setting_${Date.now()}`,
        value: 'original_value',
        category: 'test',
        label: 'Test Setting',
        description: 'A setting created for integration tests',
      })
      .returning();
    createdSettingIds.push(row.id);
  });

  afterAll(async () => {
    const { settings } = await import('@/db/schema');
    const { inArray } = await import('drizzle-orm');
    if (createdSettingIds.length > 0) {
      await db.delete(settings).where(inArray(settings.id, createdSettingIds)).catch(() => {});
    }
    await db.execute(`DELETE FROM admins WHERE email LIKE 'admin-settings-test-%@example.com'`);
  });

  describe('GET /api/admin/settings', () => {
    it('returns all settings grouped by category', async () => {
      const { GET } = await import('@/app/api/admin/settings/route');

      const request = createRequest('GET', '/api/admin/settings');
      const { status, data } = await callRouteHandler(GET, request);

      expect(status).toBe(200);
      expect(data).toHaveProperty('settings');
      const settingsData = (data as Record<string, unknown>).settings;
      expect(typeof settingsData).toBe('object');
      expect(settingsData).not.toBeNull();

      // Verify the test category with our seeded setting exists
      const grouped = settingsData as Record<string, Array<Record<string, unknown>>>;
      expect(grouped).toHaveProperty('test');
      expect(Array.isArray(grouped.test)).toBe(true);
      expect(grouped.test.length).toBeGreaterThanOrEqual(1);
    });

    it('returns 401 when unauthenticated', async () => {
      const { GET } = await import('@/app/api/admin/settings/route');
      (globalThis as any)._omenaaMockSession = null;

      const request = createRequest('GET', '/api/admin/settings');
      const { status } = await callRouteHandler(GET, request);

      expect(status).toBe(401);

      // Restore session
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
    });

    it('returns 403 for non-admin users', async () => {
      const { GET } = await import('@/app/api/admin/settings/route');
      (globalThis as any)._omenaaMockSession = {
        user: { id: 'user-id', email: 'user@example.com', role: null, name: 'User', userType: 'user', visibilityLevel: 0 },
      };

      const request = createRequest('GET', '/api/admin/settings');
      const { status } = await callRouteHandler(GET, request);

      expect(status).toBe(403);

      // Restore admin session
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
    });
  });

  describe('PATCH /api/admin/settings', () => {
    it('updates settings by key-value pairs', async () => {
      const { PATCH, GET } = await import('@/app/api/admin/settings/route');

      // Get the test setting key
      const { settings } = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');
      const [testSetting] = await db
        .select()
        .from(settings)
        .where(eq(settings.id, createdSettingIds[0]))
        .limit(1);

      const request = createRequest('PATCH', '/api/admin/settings', {
        [testSetting.key]: 'updated_value',
      });
      const { status, data } = await callRouteHandler(PATCH, request);

      expect(status).toBe(200);
      expect(data).toHaveProperty('updated');
      expect((data as Record<string, string[]>).updated).toContain(testSetting.key);

      // Verify the value was actually changed
      const getRequest = createRequest('GET', '/api/admin/settings');
      const { data: getData } = await callRouteHandler(GET, getRequest);
      const grouped = (getData as Record<string, Record<string, Array<Record<string, unknown>>>>).settings;
      const testSettings = grouped.test;
      const updated = testSettings.find((s) => s.key === testSetting.key);
      expect(updated?.value).toBe('updated_value');
    });

    it('ignores non-existent keys silently', async () => {
      const { PATCH } = await import('@/app/api/admin/settings/route');

      const request = createRequest('PATCH', '/api/admin/settings', {
        non_existent_key_12345: 'some_value',
      });
      const { status, data } = await callRouteHandler(PATCH, request);

      expect(status).toBe(200);
      expect((data as Record<string, string[]>).updated).toEqual([]);
    });

    it('returns 400 for invalid request body', async () => {
      const { PATCH } = await import('@/app/api/admin/settings/route');

      // Send a non-object body (string)
      const { NextRequest } = await import('next/server');
      const request = new NextRequest('http://localhost:3002/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(null),
      });
      const { status } = await callRouteHandler(PATCH, request);

      expect(status).toBe(400);
    });

    it('returns 401 when unauthenticated', async () => {
      const { PATCH } = await import('@/app/api/admin/settings/route');
      (globalThis as any)._omenaaMockSession = null;

      const request = createRequest('PATCH', '/api/admin/settings', { key: 'value' });
      const { status } = await callRouteHandler(PATCH, request);

      expect(status).toBe(401);

      // Restore session
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
    });

    it('returns 403 for non-admin users', async () => {
      const { PATCH } = await import('@/app/api/admin/settings/route');
      (globalThis as any)._omenaaMockSession = {
        user: { id: 'user-id', email: 'user@example.com', role: null, name: 'User', userType: 'user', visibilityLevel: 0 },
      };

      const request = createRequest('PATCH', '/api/admin/settings', { key: 'value' });
      const { status } = await callRouteHandler(PATCH, request);

      expect(status).toBe(403);

      // Restore admin session
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
    });
  });
});
