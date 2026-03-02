import { describe, it, expect, afterAll, vi } from 'vitest';
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

describe('GET /api/auth/verify-email', () => {
  const db = getTestDb();

  afterAll(async () => {
    await db.execute(`DELETE FROM users WHERE email LIKE 'verify-test-%@example.com'`);
    await db.execute(`DELETE FROM verification_tokens WHERE identifier LIKE 'verify-test-%@example.com'`);
  });

  async function createPendingUser(email: string, source: string = 'direct') {
    const { users } = await import('@/db/schema');
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('TestPassword123!', 1);

    const [user] = await db
      .insert(users)
      .values({
        email,
        name: 'Verify Test User',
        passwordHash: hash,
        accountStatus: 'pending_verification',
        registrationSource: source,
        emailVerified: false,
        isActive: false,
        phone: '',
      })
      .returning();

    return user;
  }

  it('verifies email and sets pending_approval for direct registration', async () => {
    const email = `verify-test-direct-${Date.now()}@example.com`;
    await createPendingUser(email, 'direct');

    const { createVerificationToken } = await import('@/lib/token-service');
    const token = await createVerificationToken(email, 'email_verification', 24 * 60 * 60 * 1000);

    const { GET } = await import('@/app/api/auth/verify-email/route');
    const request = new Request(`http://localhost:3002/api/auth/verify-email?token=${token}`);
    const response = await GET(request);

    // Should redirect
    expect(response.status).toBe(307);
    const location = response.headers.get('location') ?? '';
    expect(location).toContain('status=pending');

    // Check DB state
    const { users } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    expect(user.emailVerified).toBe(true);
    expect(user.emailVerifiedAt).not.toBeNull();
    expect(user.accountStatus).toBe('pending_approval');
  });

  it('auto-approves whitelist registration', async () => {
    const email = `verify-test-wl-${Date.now()}@example.com`;
    await createPendingUser(email, 'whitelist');

    const { createVerificationToken } = await import('@/lib/token-service');
    const token = await createVerificationToken(email, 'email_verification', 24 * 60 * 60 * 1000);

    const { GET } = await import('@/app/api/auth/verify-email/route');
    const request = new Request(`http://localhost:3002/api/auth/verify-email?token=${token}`);
    const response = await GET(request);

    expect(response.status).toBe(307);
    const location = response.headers.get('location') ?? '';
    expect(location).toContain('status=approved');

    const { users } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    expect(user.accountStatus).toBe('approved');
    expect(user.approvedAt).not.toBeNull();
  });

  it('auto-approves QR code registration', async () => {
    const email = `verify-test-qr-${Date.now()}@example.com`;
    await createPendingUser(email, 'qr_code');

    const { createVerificationToken } = await import('@/lib/token-service');
    const token = await createVerificationToken(email, 'email_verification', 24 * 60 * 60 * 1000);

    const { GET } = await import('@/app/api/auth/verify-email/route');
    const request = new Request(`http://localhost:3002/api/auth/verify-email?token=${token}`);
    const response = await GET(request);

    const location = response.headers.get('location') ?? '';
    expect(location).toContain('status=approved');
  });

  it('redirects to invalid for bad token', async () => {
    const { GET } = await import('@/app/api/auth/verify-email/route');
    const request = new Request('http://localhost:3002/api/auth/verify-email?token=invalid-token');
    const response = await GET(request);

    expect(response.status).toBe(307);
    const location = response.headers.get('location') ?? '';
    expect(location).toContain('status=invalid');
  });

  it('redirects to invalid when no token provided', async () => {
    const { GET } = await import('@/app/api/auth/verify-email/route');
    const request = new Request('http://localhost:3002/api/auth/verify-email');
    const response = await GET(request);

    expect(response.status).toBe(307);
    const location = response.headers.get('location') ?? '';
    expect(location).toContain('status=invalid');
  });

  it('redirects to already-verified for already verified user', async () => {
    const email = `verify-test-already-${Date.now()}@example.com`;
    const { users } = await import('@/db/schema');
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('TestPassword123!', 1);

    await db.insert(users).values({
      email,
      name: 'Already Verified',
      passwordHash: hash,
      accountStatus: 'approved',
      emailVerified: true,
      emailVerifiedAt: new Date(),
      isActive: true,
      phone: '',
    });

    const { createVerificationToken } = await import('@/lib/token-service');
    const token = await createVerificationToken(email, 'email_verification', 24 * 60 * 60 * 1000);

    const { GET } = await import('@/app/api/auth/verify-email/route');
    const request = new Request(`http://localhost:3002/api/auth/verify-email?token=${token}`);
    const response = await GET(request);

    const location = response.headers.get('location') ?? '';
    expect(location).toContain('status=already-verified');
  });
});
