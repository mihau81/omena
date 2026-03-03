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

describe('POST /api/auth/register', () => {
  const db = getTestDb();

  afterAll(async () => {
    await db.execute(
      `DELETE FROM users WHERE email LIKE 'register-test-%@example.com'`
    );
  });

  it('creates a new user with pending_verification status', async () => {
    const { POST } = await import('@/app/api/auth/register/route');

    const email = `register-test-${Date.now()}@example.com`;
    const request = createRequest('POST', '/api/auth/register', {
      email,
      name: 'New Test User',
      password: 'SecurePassword123!',
    });

    const { status, data } = await callRouteHandler(POST, request);

    expect(status).toBe(201);
    expect(data).toHaveProperty('message');
    expect((data as Record<string, string>).message).toMatch(/check your email/i);
    expect(data).toHaveProperty('userId');
  });

  it('creates user without password (optional)', async () => {
    const { POST } = await import('@/app/api/auth/register/route');

    const email = `register-test-nopwd-${Date.now()}@example.com`;
    const request = createRequest('POST', '/api/auth/register', {
      email,
      name: 'No Password User',
    });

    const { status, data } = await callRouteHandler(POST, request);

    expect(status).toBe(201);
    expect(data).toHaveProperty('userId');
  });

  it('creates user with phone number', async () => {
    const { POST } = await import('@/app/api/auth/register/route');

    const email = `register-test-phone-${Date.now()}@example.com`;
    const request = createRequest('POST', '/api/auth/register', {
      email,
      name: 'Phone User',
      phone: '+48 123 456 789',
    });

    const { status } = await callRouteHandler(POST, request);
    expect(status).toBe(201);
  });

  it('returns 409 when email already exists', async () => {
    const { POST } = await import('@/app/api/auth/register/route');

    const email = `register-test-dup-${Date.now()}@example.com`;

    // Create first user
    await callRouteHandler(POST, createRequest('POST', '/api/auth/register', {
      email,
      name: 'First User',
      password: 'SecurePassword123!',
    }));

    // Try to create duplicate
    const { status, data } = await callRouteHandler(POST, createRequest('POST', '/api/auth/register', {
      email,
      name: 'Duplicate User',
      password: 'AnotherPassword123!',
    }));

    expect(status).toBe(409);
    expect(data).toHaveProperty('error', 'An account with this email already exists');
  });

  it('returns 400 for invalid email', async () => {
    const { POST } = await import('@/app/api/auth/register/route');

    const request = createRequest('POST', '/api/auth/register', {
      email: 'not-an-email',
      name: 'Test User',
      password: 'SecurePassword123!',
    });

    const { status, data } = await callRouteHandler(POST, request);

    expect(status).toBe(400);
    expect(data).toHaveProperty('error', 'Validation failed');
  });

  it('returns 400 for too-short password', async () => {
    const { POST } = await import('@/app/api/auth/register/route');

    const request = createRequest('POST', '/api/auth/register', {
      email: `register-test-shortpwd-${Date.now()}@example.com`,
      name: 'Test User',
      password: 'abc',
    });

    const { status, data } = await callRouteHandler(POST, request);

    expect(status).toBe(400);
    expect(data).toHaveProperty('error', 'Validation failed');
  });

  it('returns 400 for missing name', async () => {
    const { POST } = await import('@/app/api/auth/register/route');

    const request = createRequest('POST', '/api/auth/register', {
      email: `register-test-noname-${Date.now()}@example.com`,
    });

    const { status, data } = await callRouteHandler(POST, request);

    expect(status).toBe(400);
    expect(data).toHaveProperty('error', 'Validation failed');
  });

  it('stores hashed password (not plaintext)', async () => {
    const { POST } = await import('@/app/api/auth/register/route');
    const { users } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');

    const email = `register-test-hash-${Date.now()}@example.com`;
    const plainPassword = 'MySuperSecret123!';

    const { status } = await callRouteHandler(POST, createRequest('POST', '/api/auth/register', {
      email,
      name: 'Hash Test User',
      password: plainPassword,
    }));

    expect(status).toBe(201);

    const [user] = await db.select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.email, email));

    expect(user.passwordHash).toBeDefined();
    expect(user.passwordHash).not.toBe(plainPassword);
    expect(user.passwordHash).toMatch(/^\$2[ab]\$\d+\$/); // bcrypt format
  });

  it('sets accountStatus to pending_verification', async () => {
    const { POST } = await import('@/app/api/auth/register/route');
    const { users } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');

    const email = `register-test-status-${Date.now()}@example.com`;

    await callRouteHandler(POST, createRequest('POST', '/api/auth/register', {
      email,
      name: 'Status Test User',
      password: 'SecurePassword123!',
    }));

    const [user] = await db.select({ accountStatus: users.accountStatus })
      .from(users)
      .where(eq(users.email, email));

    expect(user.accountStatus).toBe('pending_verification');
  });
});
