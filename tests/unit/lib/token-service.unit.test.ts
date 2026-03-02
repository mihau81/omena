import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module
const mockInsert = vi.fn().mockReturnThis();
const mockValues = vi.fn().mockResolvedValue(undefined);
const mockUpdate = vi.fn().mockReturnThis();
const mockSet = vi.fn().mockReturnThis();
const mockWhere = vi.fn().mockReturnThis();
const mockReturning = vi.fn();

vi.mock('@/db/connection', () => ({
  db: {
    insert: () => ({ values: mockValues }),
    update: () => ({
      set: (data: unknown) => {
        mockSet(data);
        return {
          where: () => ({
            returning: mockReturning,
          }),
        };
      },
    }),
  },
}));

vi.mock('@/db/schema', () => ({
  verificationTokens: {
    identifier: 'identifier',
    token: 'token',
    expiresAt: 'expires_at',
    purpose: 'purpose',
    usedAt: 'used_at',
  },
}));

describe('token-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createVerificationToken', () => {
    it('returns a hex token string', async () => {
      const { createVerificationToken } = await import('@/lib/token-service');

      const token = await createVerificationToken('user@example.com', 'email_verification', 60000);

      expect(typeof token).toBe('string');
      expect(token).toMatch(/^[0-9a-f]{64}$/); // 32 bytes = 64 hex chars
    });

    it('inserts token into database', async () => {
      const { createVerificationToken } = await import('@/lib/token-service');

      await createVerificationToken('user@example.com', 'magic_link', 15 * 60 * 1000);

      expect(mockValues).toHaveBeenCalledOnce();
      const insertedData = mockValues.mock.calls[0][0];
      expect(insertedData).toMatchObject({
        identifier: 'user@example.com',
        purpose: 'magic_link',
      });
      expect(insertedData.token).toMatch(/^[0-9a-f]{64}$/);
      expect(insertedData.expiresAt).toBeInstanceOf(Date);
    });

    it('sets correct expiration time', async () => {
      const { createVerificationToken } = await import('@/lib/token-service');

      const before = Date.now();
      await createVerificationToken('user@example.com', 'password_reset', 60 * 60 * 1000);
      const after = Date.now();

      const insertedData = mockValues.mock.calls[0][0];
      const expiresAt = insertedData.expiresAt.getTime();

      // Should expire approximately 1 hour from now
      expect(expiresAt).toBeGreaterThanOrEqual(before + 60 * 60 * 1000);
      expect(expiresAt).toBeLessThanOrEqual(after + 60 * 60 * 1000);
    });
  });

  describe('consumeToken', () => {
    it('returns identifier when token is valid', async () => {
      mockReturning.mockResolvedValueOnce([
        { identifier: 'user@example.com', expiresAt: new Date(Date.now() + 60000) },
      ]);

      const { consumeToken } = await import('@/lib/token-service');
      const result = await consumeToken('valid-token', 'magic_link');

      expect(result).toEqual({ identifier: 'user@example.com' });
    });

    it('returns null when token not found', async () => {
      mockReturning.mockResolvedValueOnce([]);

      const { consumeToken } = await import('@/lib/token-service');
      const result = await consumeToken('invalid-token', 'magic_link');

      expect(result).toBeNull();
    });

    it('returns null when token is expired', async () => {
      mockReturning.mockResolvedValueOnce([
        { identifier: 'user@example.com', expiresAt: new Date(Date.now() - 60000) },
      ]);

      const { consumeToken } = await import('@/lib/token-service');
      const result = await consumeToken('expired-token', 'email_verification');

      expect(result).toBeNull();
    });
  });

  describe('getBaseUrl', () => {
    it('returns NEXTAUTH_URL when set', async () => {
      const original = process.env.NEXTAUTH_URL;
      process.env.NEXTAUTH_URL = 'https://omena.example.com';

      // Re-import to pick up env change
      const mod = await import('@/lib/token-service');
      const result = mod.getBaseUrl();

      expect(result).toBe('https://omena.example.com');
      process.env.NEXTAUTH_URL = original;
    });

    it('returns default localhost URL when NEXTAUTH_URL not set', async () => {
      const original = process.env.NEXTAUTH_URL;
      delete process.env.NEXTAUTH_URL;

      const mod = await import('@/lib/token-service');
      const result = mod.getBaseUrl();

      expect(result).toBe('http://localhost:3002/omena');
      process.env.NEXTAUTH_URL = original;
    });
  });
});
