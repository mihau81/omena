/**
 * Unit tests for POST /api/admin/2fa/verify
 * Coverage target: TOTP verification flow
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

const mockDecryptSecret = vi.fn();
const mockVerifyTOTP = vi.fn();

vi.mock('@/lib/totp', () => ({
  decryptSecret: (...args: unknown[]) => mockDecryptSecret(...args),
  verifyTOTP: (...args: unknown[]) => mockVerifyTOTP(...args),
}));

// ─── Mock DB ────────────────────────────────────────────────────────────────

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();

const chainedDb = {
  select: mockSelect,
  from: mockFrom,
  where: mockWhere,
  limit: mockLimit,
};

mockSelect.mockReturnValue(chainedDb);
mockFrom.mockReturnValue(chainedDb);
mockWhere.mockReturnValue(chainedDb);
mockLimit.mockResolvedValue([]);

vi.mock('@/db/connection', () => ({ db: chainedDb }));

vi.mock('@/db/schema', () => ({
  admins: { id: 'id', totpSecret: 'totpSecret', totpEnabled: 'totpEnabled' },
}));

// ─── Import ─────────────────────────────────────────────────────────────────

const { AuthError } = await import('@/lib/auth-utils');

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/admin/2fa/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/admin/2fa/verify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue(chainedDb);
    mockFrom.mockReturnValue(chainedDb);
    mockWhere.mockReturnValue(chainedDb);
    mockLimit.mockResolvedValue([]);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { POST } = await import('@/app/api/admin/2fa/verify/route');
    const res = await POST(makeRequest({ token: '123456' }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 400 when token is missing', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });

    const { POST } = await import('@/app/api/admin/2fa/verify/route');
    const res = await POST(makeRequest({}));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('Invalid TOTP format');
  });

  it('returns 400 when token is not 6 digits', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });

    const { POST } = await import('@/app/api/admin/2fa/verify/route');
    const res = await POST(makeRequest({ token: '12345' })); // only 5 digits
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('Invalid TOTP format');
  });

  it('returns 400 when token contains non-digits', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });

    const { POST } = await import('@/app/api/admin/2fa/verify/route');
    const res = await POST(makeRequest({ token: '12a456' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('Invalid TOTP format');
  });

  it('returns 400 when admin has no TOTP enabled', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    // Admin exists but TOTP not enabled
    mockLimit.mockResolvedValueOnce([{ id: 'admin-1', totpSecret: null, totpEnabled: false }]);

    const { POST } = await import('@/app/api/admin/2fa/verify/route');
    const res = await POST(makeRequest({ token: '123456' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('TOTP is not enabled');
  });

  it('returns 400 when admin has no TOTP secret', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([{ id: 'admin-1', totpSecret: null, totpEnabled: true }]);

    const { POST } = await import('@/app/api/admin/2fa/verify/route');
    const res = await POST(makeRequest({ token: '123456' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('TOTP is not enabled');
  });

  it('returns 400 when admin not found in DB', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([]); // admin not found

    const { POST } = await import('@/app/api/admin/2fa/verify/route');
    const res = await POST(makeRequest({ token: '123456' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('TOTP is not enabled');
  });

  it('returns 401 when TOTP code is invalid', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([{
      id: 'admin-1',
      totpSecret: 'encrypted-secret',
      totpEnabled: true,
    }]);
    mockDecryptSecret.mockReturnValue('decrypted-secret');
    mockVerifyTOTP.mockReturnValue(false);

    const { POST } = await import('@/app/api/admin/2fa/verify/route');
    const res = await POST(makeRequest({ token: '999999' }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Invalid TOTP code.');
  });

  it('returns 200 when TOTP code is valid', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });
    mockLimit.mockResolvedValueOnce([{
      id: 'admin-1',
      totpSecret: 'encrypted-secret',
      totpEnabled: true,
    }]);
    mockDecryptSecret.mockReturnValue('decrypted-secret');
    mockVerifyTOTP.mockReturnValue(true);

    const { POST } = await import('@/app/api/admin/2fa/verify/route');
    const res = await POST(makeRequest({ token: '123456' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.message).toBe('TOTP verified successfully.');
    expect(mockDecryptSecret).toHaveBeenCalledWith('encrypted-secret');
    expect(mockVerifyTOTP).toHaveBeenCalledWith('decrypted-secret', '123456');
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Unexpected'));

    const { POST } = await import('@/app/api/admin/2fa/verify/route');
    const res = await POST(makeRequest({ token: '123456' }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Failed to verify TOTP code.');
  });
});
