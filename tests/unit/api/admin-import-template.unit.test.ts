/**
 * Unit tests for /api/admin/lots/import-template (GET)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

// ─── Import ─────────────────────────────────────────────────────────────────

const { AuthError } = await import('@/lib/auth-utils');

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/admin/lots/import-template', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Authentication required', 401));

    const { GET } = await import('@/app/api/admin/lots/import-template/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 403 when admin lacks lots:read permission', async () => {
    mockRequireAdmin.mockRejectedValue(new AuthError('Missing permission: lots:read', 403));

    const { GET } = await import('@/app/api/admin/lots/import-template/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toContain('Missing permission');
  });

  it('returns CSV file with correct headers', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });

    const { GET } = await import('@/app/api/admin/lots/import-template/route');
    const res = await GET();

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    expect(res.headers.get('Content-Disposition')).toContain('lot-import-template.csv');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('CSV content has correct column headers', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });

    const { GET } = await import('@/app/api/admin/lots/import-template/route');
    const res = await GET();
    const text = await res.text();

    expect(text).toContain('lot_number');
    expect(text).toContain('title');
    expect(text).toContain('artist');
    expect(text).toContain('estimate_min');
    expect(text).toContain('estimate_max');
  });

  it('CSV content has example data rows', async () => {
    mockRequireAdmin.mockResolvedValue({ id: 'admin-1' });

    const { GET } = await import('@/app/api/admin/lots/import-template/route');
    const res = await GET();
    const text = await res.text();

    expect(text).toContain('Obraz Olejny');
    expect(text).toContain('Jan Kowalski');
    expect(text).toContain('Rzeźba Marmurowa');
  });

  it('returns 500 on unexpected error', async () => {
    mockRequireAdmin.mockRejectedValue(new Error('Crash'));

    const { GET } = await import('@/app/api/admin/lots/import-template/route');
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Internal server error');
  });
});
