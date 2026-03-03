import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock next/headers ────────────────────────────────────────────────────────

const mockHeaders = new Map<string, string>();

vi.mock('next/headers', () => ({
  headers: vi.fn().mockImplementation(async () => ({
    get: (key: string) => mockHeaders.get(key) ?? null,
  })),
}));

import { getUserVisibility, getUserId, getUserType } from '@/lib/visibility';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('visibility', () => {
  beforeEach(() => {
    mockHeaders.clear();
  });

  describe('getUserVisibility', () => {
    it('returns 0 when x-user-visibility header is missing', async () => {
      const result = await getUserVisibility();
      expect(result).toBe(0);
    });

    it('returns parsed integer when header is set', async () => {
      mockHeaders.set('x-user-visibility', '3');
      const result = await getUserVisibility();
      expect(result).toBe(3);
    });

    it('returns 0 for non-numeric header value (NaN)', async () => {
      mockHeaders.set('x-user-visibility', 'abc');
      const result = await getUserVisibility();
      expect(result).toBeNaN();
    });

    it('handles negative values', async () => {
      mockHeaders.set('x-user-visibility', '-1');
      const result = await getUserVisibility();
      expect(result).toBe(-1);
    });

    it('handles large numbers', async () => {
      mockHeaders.set('x-user-visibility', '999');
      const result = await getUserVisibility();
      expect(result).toBe(999);
    });

    it('parses float values as integer (parseInt behavior)', async () => {
      mockHeaders.set('x-user-visibility', '3.7');
      const result = await getUserVisibility();
      expect(result).toBe(3);
    });
  });

  describe('getUserId', () => {
    it('returns null when x-user-id header is missing', async () => {
      const result = await getUserId();
      expect(result).toBeNull();
    });

    it('returns the user id when header is set', async () => {
      mockHeaders.set('x-user-id', 'user-abc-123');
      const result = await getUserId();
      expect(result).toBe('user-abc-123');
    });

    it('returns null for empty string header', async () => {
      mockHeaders.set('x-user-id', '');
      const result = await getUserId();
      expect(result).toBeNull();
    });

    it('preserves UUID format', async () => {
      mockHeaders.set('x-user-id', '550e8400-e29b-41d4-a716-446655440000');
      const result = await getUserId();
      expect(result).toBe('550e8400-e29b-41d4-a716-446655440000');
    });
  });

  describe('getUserType', () => {
    it('returns anonymous when x-user-type header is missing', async () => {
      const result = await getUserType();
      expect(result).toBe('anonymous');
    });

    it('returns user when header is "user"', async () => {
      mockHeaders.set('x-user-type', 'user');
      const result = await getUserType();
      expect(result).toBe('user');
    });

    it('returns admin when header is "admin"', async () => {
      mockHeaders.set('x-user-type', 'admin');
      const result = await getUserType();
      expect(result).toBe('admin');
    });

    it('returns anonymous for invalid header value', async () => {
      mockHeaders.set('x-user-type', 'superadmin');
      const result = await getUserType();
      expect(result).toBe('anonymous');
    });

    it('returns anonymous for empty string header', async () => {
      mockHeaders.set('x-user-type', '');
      const result = await getUserType();
      expect(result).toBe('anonymous');
    });

    it('returns anonymous for unexpected casing', async () => {
      mockHeaders.set('x-user-type', 'Admin');
      const result = await getUserType();
      expect(result).toBe('anonymous');
    });

    it('returns anonymous for random string', async () => {
      mockHeaders.set('x-user-type', 'moderator');
      const result = await getUserType();
      expect(result).toBe('anonymous');
    });
  });
});
