/**
 * Unit tests for POST /api/admin/login
 * Coverage target: admin login with password and TOTP
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mock DB ────────────────────────────────────────────────────────────────

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
const mockUpdate = vi.fn();
const mockSet = vi.fn();

const chainedDb = {
  select: mockSelect,
  from: mockFrom,
  where: mockWhere,
  limit: mockLimit,
  update: mockUpdate,
  set: mockSet,
};

function resetChain() {
  mockSelect.mockReturnValue(chainedDb);
  mockFrom.mockReturnValue(chainedDb);
  mockWhere.mockReturnValue(chainedDb); // default: chainable
  mockLimit.mockResolvedValue([]);
  mockUpdate.mockReturnValue(chainedDb);
  mockSet.mockReturnValue(chainedDb);
}

vi.mock('@/db/connection', () => ({ db: chainedDb }));

vi.mock('@/db/schema', () => ({
  admins: {
    id: 'id',
    email: 'email',
    passwordHash: 'passwordHash',
    isActive: 'isActive',
    totpEnabled: 'totpEnabled',
    totpSecret: 'totpSecret',
    lastLoginAt: 'lastLoginAt',
    deletedAt: 'deletedAt',
  },
}));

// ─── Mock bcrypt ────────────────────────────────────────────────────────────

const mockCompare = vi.fn();
vi.mock('bcryptjs', () => ({
  default: { compare: (...args: unknown[]) => mockCompare(...args) },
  compare: (...args: unknown[]) => mockCompare(...args),
}));

// ─── Mock TOTP ──────────────────────────────────────────────────────────────

const mockVerifyTOTP = vi.fn();
const mockDecryptSecret = vi.fn();
vi.mock('@/lib/totp', () => ({
  verifyTOTP: (...args: unknown[]) => mockVerifyTOTP(...args),
  decryptSecret: (...args: unknown[]) => mockDecryptSecret(...args),
}));

// ─── Mock rate limiter ──────────────────────────────────────────────────────

const mockCheck = vi.fn();
vi.mock('@/lib/rate-limiters', () => ({
  authLimiter: { check: (...args: unknown[]) => mockCheck(...args) },
}));

// ─── Mock auth ──────────────────────────────────────────────────────────────

vi.mock('@/lib/auth-utils', () => ({
  requireAdmin: vi.fn(),
  AuthError: class AuthError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 401) {
      super(message);
      this.name = 'AuthError';
      this.statusCode = statusCode;
    }
  },
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: { GET: vi.fn(), POST: vi.fn() },
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const adminUser = {
  id: 'admin-1',
  email: 'admin@test.com',
  passwordHash: '$2a$10$hashedpassword',
  isActive: true,
  totpEnabled: false,
  totpSecret: null,
  lastLoginAt: null,
  deletedAt: null,
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('POST /api/admin/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetChain();
    mockCheck.mockReturnValue({ success: true });
  });

  it('returns 429 when rate limited', async () => {
    mockCheck.mockReturnValue({ success: false });

    const { POST } = await import('@/app/api/admin/login/route');
    const res = await POST(makeRequest({ email: 'admin@test.com', password: 'pass' }));
    const body = await res.json();

    expect(res.status).toBe(429);
    expect(body.error).toContain('Too many login attempts');
  });

  it('returns 400 when input is invalid', async () => {
    const { POST } = await import('@/app/api/admin/login/route');
    const res = await POST(makeRequest({ email: 'not-email', password: '' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid input');
  });

  it('returns 400 when email is missing', async () => {
    const { POST } = await import('@/app/api/admin/login/route');
    const res = await POST(makeRequest({ password: 'pass' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid input');
  });

  it('returns 401 when admin not found', async () => {
    // select().from().where().limit(1) => []
    mockLimit.mockResolvedValueOnce([]);

    const { POST } = await import('@/app/api/admin/login/route');
    const res = await POST(makeRequest({ email: 'admin@test.com', password: 'pass' }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Invalid email or password');
  });

  it('returns 401 when admin is not active', async () => {
    mockLimit.mockResolvedValueOnce([{ ...adminUser, isActive: false }]);

    const { POST } = await import('@/app/api/admin/login/route');
    const res = await POST(makeRequest({ email: 'admin@test.com', password: 'pass' }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Invalid email or password');
  });

  it('returns 401 when password is wrong', async () => {
    mockLimit.mockResolvedValueOnce([adminUser]);
    mockCompare.mockResolvedValue(false);

    const { POST } = await import('@/app/api/admin/login/route');
    const res = await POST(makeRequest({ email: 'admin@test.com', password: 'wrong' }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Invalid email or password');
  });

  it('returns success when login is valid (no TOTP)', async () => {
    mockLimit.mockResolvedValueOnce([adminUser]);
    mockCompare.mockResolvedValue(true);
    // update lastLoginAt: db.update().set().where() — where is terminal
    // where calls:
    //   1st: select admin (chains to .limit) — default returns chainedDb
    //   2nd: update lastLoginAt (terminal)
    mockWhere
      .mockReturnValueOnce(chainedDb)      // 1: select, chains to limit
      .mockResolvedValueOnce(undefined);    // 2: update lastLoginAt

    const { POST } = await import('@/app/api/admin/login/route');
    const res = await POST(makeRequest({ email: 'admin@test.com', password: 'correctpass' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it('returns requiresTOTP when TOTP enabled but code not provided', async () => {
    const totpAdmin = { ...adminUser, totpEnabled: true, totpSecret: 'encrypted-secret' };
    mockLimit.mockResolvedValueOnce([totpAdmin]);
    mockCompare.mockResolvedValue(true);
    // No update happens - returns early at "requiresTOTP"

    const { POST } = await import('@/app/api/admin/login/route');
    const res = await POST(makeRequest({ email: 'admin@test.com', password: 'pass' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.requiresTOTP).toBe(true);
  });

  it('returns 401 when TOTP code is invalid', async () => {
    const totpAdmin = { ...adminUser, totpEnabled: true, totpSecret: 'encrypted-secret' };
    mockLimit.mockResolvedValueOnce([totpAdmin]);
    mockCompare.mockResolvedValue(true);
    mockDecryptSecret.mockReturnValue('decrypted-secret');
    mockVerifyTOTP.mockReturnValue(false);

    const { POST } = await import('@/app/api/admin/login/route');
    const res = await POST(makeRequest({ email: 'admin@test.com', password: 'pass', totpCode: '123456' }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Invalid TOTP code');
  });

  it('returns success when TOTP code is valid', async () => {
    const totpAdmin = { ...adminUser, totpEnabled: true, totpSecret: 'encrypted-secret' };
    mockLimit.mockResolvedValueOnce([totpAdmin]);
    mockCompare.mockResolvedValue(true);
    mockDecryptSecret.mockReturnValue('decrypted-secret');
    mockVerifyTOTP.mockReturnValue(true);
    // where calls:
    //   1st: select admin (chains to .limit)
    //   2nd: update lastLoginAt (terminal)
    mockWhere
      .mockReturnValueOnce(chainedDb)      // 1: select
      .mockResolvedValueOnce(undefined);    // 2: update

    const { POST } = await import('@/app/api/admin/login/route');
    const res = await POST(makeRequest({ email: 'admin@test.com', password: 'pass', totpCode: '123456' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it('returns 500 when TOTP enabled but secret missing', async () => {
    const brokenAdmin = { ...adminUser, totpEnabled: true, totpSecret: null };
    mockLimit.mockResolvedValueOnce([brokenAdmin]);
    mockCompare.mockResolvedValue(true);

    const { POST } = await import('@/app/api/admin/login/route');
    const res = await POST(makeRequest({ email: 'admin@test.com', password: 'pass' }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('TOTP configuration error');
  });

  it('returns 500 on unexpected error', async () => {
    mockCheck.mockImplementation(() => { throw new Error('Unexpected'); });

    const { POST } = await import('@/app/api/admin/login/route');
    const res = await POST(makeRequest({ email: 'admin@test.com', password: 'pass' }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Login failed');
  });
});
