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

describe('Admin Two-Factor Authentication (TOTP)', () => {
  const db = getTestDb();
  let admin: Awaited<ReturnType<typeof createTestAdmin>>;

  beforeAll(async () => {
    admin = await createTestAdmin({ email: `admin-2fa-test-${Date.now()}@example.com` });
    (globalThis as any)._omenaMockSession = { user: { id: admin.id, email: admin.email, role: admin.role, name: admin.name, userType: 'admin', visibilityLevel: 2 } };
  });

  afterAll(async () => {
    await db.execute(`DELETE FROM admins WHERE email LIKE 'admin-2fa-test-%@example.com'`);
  });

  describe('POST /api/admin/2fa/setup', () => {
    it('generates a TOTP secret and QR code without saving', async () => {
      const { POST } = await import('@/app/api/admin/2fa/setup/route');

      const response = await POST(new Request('http://localhost:3002/api/admin/2fa/setup', {
        method: 'POST',
      }));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('secret');
      expect(data).toHaveProperty('qrCodeDataURL');
      expect(data).toHaveProperty('message');
      expect(typeof data.secret).toBe('string');
      expect(data.secret.length).toBeGreaterThan(10);
      // QR code should be a data URL
      expect(data.qrCodeDataURL).toMatch(/^data:image\/png;base64,/);

      // Verify the secret is NOT saved to DB yet
      const { admins } = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');
      const [adminRow] = await db.select({ totpEnabled: admins.totpEnabled, totpSecret: admins.totpSecret })
        .from(admins)
        .where(eq(admins.id, admin.id));

      expect(adminRow.totpEnabled).toBe(false);
      expect(adminRow.totpSecret).toBeNull();
    });

    it('returns 401 when unauthenticated', async () => {
      const { POST } = await import('@/app/api/admin/2fa/setup/route');

      (globalThis as any)._omenaMockSession = null;

      const response = await POST(new Request('http://localhost:3002/api/admin/2fa/setup', {
        method: 'POST',
      }));

      expect(response.status).toBe(401);
      (globalThis as any)._omenaMockSession = { user: { id: admin.id, email: admin.email, role: admin.role, name: admin.name, userType: 'admin', visibilityLevel: 2 } };
    });
  });

  describe('POST /api/admin/2fa/enable', () => {
    it('returns 400 for invalid token format (not 6 digits)', async () => {
      const { POST } = await import('@/app/api/admin/2fa/enable/route');

      const response = await POST(new Request('http://localhost:3002/api/admin/2fa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: 'VALID_SECRET_123', token: '12345' }), // too short
      }));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toHaveProperty('error');
    });

    it('returns 401 for invalid TOTP verification', async () => {
      const { POST } = await import('@/app/api/admin/2fa/enable/route');

      // Use a valid secret format but wrong code
      const { generateTOTPSecret } = await import('@/lib/totp');
      const { secret } = generateTOTPSecret(admin.email);

      const response = await POST(new Request('http://localhost:3002/api/admin/2fa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, token: '000000' }), // Wrong code
      }));
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data).toHaveProperty('error');
    });

    it('enables TOTP with valid token', async () => {
      const { POST } = await import('@/app/api/admin/2fa/enable/route');
      const { generateTOTPSecret } = await import('@/lib/totp');
      const OTPAuth = await import('otpauth');

      const { secret } = generateTOTPSecret(admin.email);

      // Generate a valid current TOTP token
      const totp = new OTPAuth.TOTP({
        issuer: 'Omena CMS',
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(secret),
      });
      const token = totp.generate();

      const response = await POST(new Request('http://localhost:3002/api/admin/2fa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, token }),
      }));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('message');

      // Verify TOTP is now enabled in DB
      const { admins } = await import('@/db/schema');
      const { eq } = await import('drizzle-orm');
      const [adminRow] = await db.select({ totpEnabled: admins.totpEnabled })
        .from(admins)
        .where(eq(admins.id, admin.id));

      expect(adminRow.totpEnabled).toBe(true);

      // Clean up - disable TOTP for other tests
      const { admins: adminsTable } = await import('@/db/schema');
      const { eq: eqCleanup } = await import('drizzle-orm');
      await db.update(adminsTable).set({ totpEnabled: false, totpSecret: null }).where(eqCleanup(adminsTable.id, admin.id));
    });
  });

  describe('POST /api/admin/2fa/verify', () => {
    it('returns 400 when TOTP is not enabled', async () => {
      const { POST } = await import('@/app/api/admin/2fa/verify/route');

      const response = await POST(new Request('http://localhost:3002/api/admin/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: '123456' }),
      }));
      const data = await response.json();

      // Should fail because TOTP is not enabled
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('returns 400 for invalid token format', async () => {
      const { POST } = await import('@/app/api/admin/2fa/verify/route');

      const response = await POST(new Request('http://localhost:3002/api/admin/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'abc' }), // non-numeric
      }));
      const data = await response.json();

      expect(response.status).toBe(400);
    });
  });
});
