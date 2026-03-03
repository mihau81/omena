import { describe, it, expect, afterAll, vi } from 'vitest';
import { createRequest, callRouteHandler } from '@/tests/helpers/api';
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

vi.mock('@/lib/audit', () => ({
  logCreate: vi.fn().mockResolvedValue(undefined),
  logUpdate: vi.fn().mockResolvedValue(undefined),
  logDelete: vi.fn().mockResolvedValue(undefined),
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/rate-limiters', () => ({
  registrationLimiter: { check: () => ({ success: true, remaining: 99 }) },
  inviteLimiter: { check: () => ({ success: true, remaining: 99 }) },
}));

describe('POST /api/auth/register/qr', () => {
  const db = getTestDb();
  const prefix = `rqr-${Date.now()}`;
  let qrId: string;
  let qrCode: string;

  afterAll(async () => {
    await db.execute(`DELETE FROM users WHERE email LIKE '${prefix}%@example.com'`);
    if (qrId) {
      await db.execute(`DELETE FROM qr_registrations WHERE id = '${qrId}'`);
    }
  });

  // Create a test QR registration
  async function setupQr(overrides: { maxUses?: number; isActive?: boolean; validOffset?: [number, number] } = {}) {
    const { qrRegistrations } = await import('@/db/schema');
    const code = `test-qr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();
    const [from, until] = overrides.validOffset ?? [-86400000, 86400000];

    const [entry] = await db
      .insert(qrRegistrations)
      .values({
        code,
        label: 'Test QR',
        validFrom: new Date(now + from),
        validUntil: new Date(now + until),
        maxUses: overrides.maxUses ?? null,
        isActive: overrides.isActive ?? true,
        createdBy: '00000000-0000-0000-0000-000000000001',
      })
      .returning();

    qrId = entry.id;
    qrCode = code;
    return { id: entry.id, code };
  }

  it('registers a user with valid QR code', async () => {
    const { code } = await setupQr();
    const { POST } = await import('@/app/api/auth/register/qr/route');

    const email = `${prefix}-ok@example.com`;
    const request = createRequest('POST', '/api/auth/register/qr', {
      email,
      name: 'QR Test User',
      qrCode: code,
    });

    const { status, data } = await callRouteHandler(POST, request);

    expect(status).toBe(201);
    expect((data as Record<string, string>).message).toMatch(/check your email/i);
    expect(data).toHaveProperty('userId');
  });

  it('sets registrationSource to qr_code', async () => {
    const { code } = await setupQr();
    const { POST } = await import('@/app/api/auth/register/qr/route');
    const { users } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');

    const email = `${prefix}-src@example.com`;
    const request = createRequest('POST', '/api/auth/register/qr', {
      email,
      name: 'Source Check',
      qrCode: code,
    });

    await callRouteHandler(POST, request);

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    expect(user.registrationSource).toBe('qr_code');
    expect(user.accountStatus).toBe('pending_verification');
  });

  it('increments QR use count', async () => {
    const { id, code } = await setupQr();
    const { POST } = await import('@/app/api/auth/register/qr/route');
    const { qrRegistrations } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');

    const request = createRequest('POST', '/api/auth/register/qr', {
      email: `${prefix}-cnt@example.com`,
      name: 'Count User',
      qrCode: code,
    });

    await callRouteHandler(POST, request);

    const [qr] = await db.select().from(qrRegistrations).where(eq(qrRegistrations.id, id)).limit(1);
    expect(qr.useCount).toBe(1);
  });

  it('returns 400 for invalid QR code', async () => {
    const { POST } = await import('@/app/api/auth/register/qr/route');

    const request = createRequest('POST', '/api/auth/register/qr', {
      email: `${prefix}-bad@example.com`,
      name: 'Bad QR',
      qrCode: 'nonexistent-code',
    });

    const { status, data } = await callRouteHandler(POST, request);
    expect(status).toBe(400);
    expect((data as Record<string, string>).error).toMatch(/invalid qr/i);
  });

  it('returns 400 for expired QR code', async () => {
    const { code } = await setupQr({ validOffset: [-172800000, -86400000] }); // expired yesterday
    const { POST } = await import('@/app/api/auth/register/qr/route');

    const request = createRequest('POST', '/api/auth/register/qr', {
      email: `${prefix}-exp@example.com`,
      name: 'Expired QR',
      qrCode: code,
    });

    const { status, data } = await callRouteHandler(POST, request);
    expect(status).toBe(400);
    expect((data as Record<string, string>).error).toMatch(/expired|not yet active/i);
  });

  it('returns 400 for max-uses-reached QR code', async () => {
    const { id, code } = await setupQr({ maxUses: 1 });
    const { POST } = await import('@/app/api/auth/register/qr/route');
    const { qrRegistrations } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');

    // Set useCount to maxUses
    await db.update(qrRegistrations).set({ useCount: 1 }).where(eq(qrRegistrations.id, id));

    const request = createRequest('POST', '/api/auth/register/qr', {
      email: `${prefix}-max@example.com`,
      name: 'Max QR',
      qrCode: code,
    });

    const { status, data } = await callRouteHandler(POST, request);
    expect(status).toBe(400);
    expect((data as Record<string, string>).error).toMatch(/usage limit/i);
  });

  it('returns 409 for duplicate email', async () => {
    const { code } = await setupQr();
    const { POST } = await import('@/app/api/auth/register/qr/route');

    const email = `${prefix}-dup@example.com`;

    // Create first user
    await callRouteHandler(POST, createRequest('POST', '/api/auth/register/qr', {
      email,
      name: 'First',
      qrCode: code,
    }));

    // Try duplicate with new QR
    const { code: code2 } = await setupQr();
    const { status } = await callRouteHandler(POST, createRequest('POST', '/api/auth/register/qr', {
      email,
      name: 'Duplicate',
      qrCode: code2,
    }));

    expect(status).toBe(409);
  });
});
