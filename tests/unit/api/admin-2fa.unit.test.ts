/**
 * Unit tests for /api/admin/2fa/setup (POST) and /api/admin/2fa/enable (POST)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mock auth ──────────────────────────────────────────────────────────────

const mockRequireAdmin = vi.fn();

vi.mock('@/lib/auth-utils', () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
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

// ─── Mock TOTP ──────────────────────────────────────────────────────────────

const mockGenerateTOTPSecret = vi.fn();
const mockGenerateQRCodeDataURL = vi.fn();
const mockVerifyTOTP = vi.fn();
const mockEncryptSecret = vi.fn();
const mockGenerateRecoveryCodes = vi.fn();

vi.mock('@/lib/totp', () => ({
  generateTOTPSecret: (...args: unknown[]) => mockGenerateTOTPSecret(...args),
  generateQRCodeDataURL: (...args: unknown[]) => mockGenerateQRCodeDataURL(...args),
  verifyTOTP: (...args: unknown[]) => mockVerifyTOTP(...args),
  encryptSecret: (...args: unknown[]) => mockEncryptSecret(...args),
  generateRecoveryCodes: (...args: unknown[]) => mockGenerateRecoveryCodes(...args),
}));

// ─── Mock DB ────────────────────────────────────────────────────────────────

const mockUpdate = vi.fn();
const mockSet = vi.fn();
const mockWhere = vi.fn();

const chainedDb = {
  update: mockUpdate,
  set: mockSet,
  where: mockWhere,
};

mockUpdate.mockReturnValue(chainedDb);
mockSet.mockReturnValue(chainedDb);
mockWhere.mockResolvedValue(undefined);

vi.mock('@/db/connection', () => ({ db: chainedDb }));

vi.mock('@/db/schema', () => ({
  admins: { id: 'id', totpSecret: 'totpSecret', totpEnabled: 'totpEnabled' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ _eq: args })),
}));

// ─── Import ─────────────────────────────────────────────────────────────────

const { AuthError } = await import('@/lib/auth-utils');

// ─── Helpers ────────────────────────────────────────────────────────────────

function makePostRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/admin/2fa/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ─── Tests: 2FA Setup ───────────────────────────────────────────────────────

describe('POST /api/admin/2fa/setup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockReturnValue(chainedDb);
    mockSet.mockReturnValue(chainedDb);
    mockWhere.mockResolvedValue(undefined);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { POST } = await import('@/app/api/admin/2fa/setup/route');
    const res = await POST(makePostRequest({}));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns secret and QR code on success', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1', email: 'admin@test.com' });
    mockGenerateTOTPSecret.mockReturnValue({ secret: 'ABCD1234', uri: 'otpauth://totp/...' });
    mockGenerateQRCodeDataURL.mockResolvedValue('data:image/png;base64,...');

    const { POST } = await import('@/app/api/admin/2fa/setup/route');
    const res = await POST(makePostRequest({}));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.secret).toBe('ABCD1234');
    expect(body.qrCodeDataURL).toBe('data:image/png;base64,...');
    expect(body.message).toBeDefined();
    expect(mockGenerateTOTPSecret).toHaveBeenCalledWith('admin@test.com');
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1', email: 'admin@test.com' });
    mockGenerateTOTPSecret.mockImplementation(() => { throw new Error('TOTP error'); });

    const { POST } = await import('@/app/api/admin/2fa/setup/route');
    const res = await POST(makePostRequest({}));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toContain('Failed');
  });
});

// ─── Tests: 2FA Enable ──────────────────────────────────────────────────────

describe('POST /api/admin/2fa/enable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockReturnValue(chainedDb);
    mockSet.mockReturnValue(chainedDb);
    mockWhere.mockResolvedValue(undefined);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { POST } = await import('@/app/api/admin/2fa/enable/route');
    const res = await POST(makePostRequest({ secret: 'ABC', token: '123456' }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 400 when secret is missing', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });

    const { POST } = await import('@/app/api/admin/2fa/enable/route');
    const res = await POST(makePostRequest({ token: '123456' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('secret');
  });

  it('returns 400 when token is invalid format (not 6 digits)', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });

    const { POST } = await import('@/app/api/admin/2fa/enable/route');
    const res = await POST(makePostRequest({ secret: 'ABCDEF', token: 'abc' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('6 digits');
  });

  it('returns 400 when token is missing', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });

    const { POST } = await import('@/app/api/admin/2fa/enable/route');
    const res = await POST(makePostRequest({ secret: 'ABCDEF' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('TOTP');
  });

  it('returns 401 when TOTP code is invalid', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockVerifyTOTP.mockReturnValue(false);

    const { POST } = await import('@/app/api/admin/2fa/enable/route');
    const res = await POST(makePostRequest({ secret: 'ABCDEF', token: '123456' }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toContain('Invalid TOTP');
  });

  it('enables 2FA successfully with valid token', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockVerifyTOTP.mockReturnValue(true);
    mockEncryptSecret.mockReturnValue('encrypted-secret');
    mockGenerateRecoveryCodes.mockReturnValue(['CODE1', 'CODE2', 'CODE3']);

    const { POST } = await import('@/app/api/admin/2fa/enable/route');
    const res = await POST(makePostRequest({ secret: 'ABCDEF', token: '123456' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.message).toContain('2FA enabled');
    expect(body.recoveryCodes).toEqual(['CODE1', 'CODE2', 'CODE3']);
    expect(mockEncryptSecret).toHaveBeenCalledWith('ABCDEF');
    expect(mockSet).toHaveBeenCalledWith({
      totpSecret: 'encrypted-secret',
      totpEnabled: true,
    });
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockVerifyTOTP.mockReturnValue(true);
    mockEncryptSecret.mockImplementation(() => { throw new Error('Encryption failed'); });

    const { POST } = await import('@/app/api/admin/2fa/enable/route');
    const res = await POST(makePostRequest({ secret: 'ABCDEF', token: '123456' }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toContain('Failed');
  });
});
