import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockBcryptCompare,
  mockBcryptHash,
  mockCheck,
  mockRateLimit,
  mockSelectWhere,
  mockDbUpdate,
} = vi.hoisted(() => {
  const mockBcryptCompare = vi.fn();
  const mockBcryptHash = vi.fn();
  const mockCheck = vi.fn();
  const mockRateLimit = vi.fn(() => ({ check: mockCheck }));
  const mockSelectWhere = vi.fn();
  const mockDbUpdate = vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  });
  return { mockBcryptCompare, mockBcryptHash, mockCheck, mockRateLimit, mockSelectWhere, mockDbUpdate };
});

vi.mock('bcryptjs', () => ({
  default: {
    compare: mockBcryptCompare,
    hash: mockBcryptHash,
  },
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: mockRateLimit,
}));

vi.mock('@/db/connection', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: mockSelectWhere,
      })),
    })),
    update: mockDbUpdate,
  },
}));

vi.mock('@/db/schema', () => ({
  apiKeys: { keyPrefix: 'keyPrefix', isActive: 'isActive', id: 'id' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ col, val })),
  and: vi.fn((...args) => ({ and: args })),
}));

import { ApiKeyError, validateApiKey, generateApiKey } from '@/lib/api-key-auth';

describe('ApiKeyError', () => {
  it('has name ApiKeyError', () => {
    const err = new ApiKeyError('test');
    expect(err.name).toBe('ApiKeyError');
  });

  it('defaults statusCode to 401', () => {
    const err = new ApiKeyError('unauthorized');
    expect(err.statusCode).toBe(401);
  });

  it('accepts custom statusCode', () => {
    const err = new ApiKeyError('rate limit', 429);
    expect(err.statusCode).toBe(429);
  });

  it('extends Error', () => {
    const err = new ApiKeyError('test');
    expect(err).toBeInstanceOf(Error);
  });

  it('sets message correctly', () => {
    const err = new ApiKeyError('bad key');
    expect(err.message).toBe('bad key');
  });
});

describe('validateApiKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheck.mockReturnValue({ success: true, remaining: 99, resetMs: 3600000 });
    mockRateLimit.mockReturnValue({ check: mockCheck });
    mockDbUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
  });

  function makeRequest(authHeader?: string): Request {
    const headers: Record<string, string> = {};
    if (authHeader !== undefined) headers['Authorization'] = authHeader;
    return new Request('http://localhost/api/test', { headers });
  }

  it('throws ApiKeyError when Authorization header is missing', async () => {
    const req = makeRequest();
    await expect(validateApiKey(req)).rejects.toThrow(ApiKeyError);
    await expect(validateApiKey(req)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('throws ApiKeyError when Authorization header does not start with Bearer', async () => {
    const req = makeRequest('Basic abc123');
    await expect(validateApiKey(req)).rejects.toThrow(ApiKeyError);
  });

  it('throws ApiKeyError when raw key is too short (< 8 chars)', async () => {
    const req = makeRequest('Bearer abc');
    await expect(validateApiKey(req)).rejects.toThrow(ApiKeyError);
  });

  it('throws ApiKeyError when no candidates found in DB', async () => {
    mockSelectWhere.mockResolvedValue([]);
    const req = makeRequest('Bearer abcdefghijklmnop');
    await expect(validateApiKey(req)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid API key',
    });
  });

  it('throws ApiKeyError when bcrypt compare fails for all candidates', async () => {
    const candidate = makeCandidateKey();
    mockSelectWhere.mockResolvedValue([candidate]);
    mockBcryptCompare.mockResolvedValue(false);

    const req = makeRequest('Bearer abcdefghijklmnop');
    await expect(validateApiKey(req)).rejects.toMatchObject({
      statusCode: 401,
      message: 'Invalid API key',
    });
  });

  it('throws ApiKeyError when key is expired', async () => {
    const candidate = makeCandidateKey({ expiresAt: new Date(Date.now() - 1000) });
    mockSelectWhere.mockResolvedValue([candidate]);
    mockBcryptCompare.mockResolvedValue(true);

    const req = makeRequest('Bearer abcdefghijklmnop');
    await expect(validateApiKey(req)).rejects.toMatchObject({
      statusCode: 401,
      message: 'API key has expired',
    });
  });

  it('throws ApiKeyError with 429 when rate limit exceeded', async () => {
    const candidate = makeCandidateKey({ expiresAt: new Date(Date.now() + 100000) });
    mockSelectWhere.mockResolvedValue([candidate]);
    mockBcryptCompare.mockResolvedValue(true);
    mockCheck.mockReturnValue({ success: false, remaining: 0, resetMs: 3600000 });

    const req = makeRequest('Bearer abcdefghijklmnop');
    await expect(validateApiKey(req)).rejects.toMatchObject({ statusCode: 429 });
  });

  it('rate limit error message includes maxRequests', async () => {
    const candidate = makeCandidateKey({ rateLimit: 500 });
    mockSelectWhere.mockResolvedValue([candidate]);
    mockBcryptCompare.mockResolvedValue(true);
    mockCheck.mockReturnValue({ success: false, remaining: 0, resetMs: 3600000 });

    const req = makeRequest('Bearer abcdefghijklmnop');
    await expect(validateApiKey(req)).rejects.toMatchObject({
      message: expect.stringContaining('500'),
    });
  });

  it('returns ApiKeyRecord when valid key with no expiry', async () => {
    const candidate = makeCandidateKey({ id: 'key-1', name: 'Test Key', permissions: { read: true } });
    mockSelectWhere.mockResolvedValue([candidate]);
    mockBcryptCompare.mockResolvedValue(true);

    const req = makeRequest('Bearer abcdefghijklmnop');
    const result = await validateApiKey(req);

    expect(result.id).toBe('key-1');
    expect(result.name).toBe('Test Key');
    expect(result.keyPrefix).toBe('abcdefgh');
    expect(result.isActive).toBe(true);
    expect(result.expiresAt).toBeNull();
  });

  it('returns ApiKeyRecord when key has future expiry', async () => {
    const futureDate = new Date(Date.now() + 86400000);
    const candidate = makeCandidateKey({ id: 'key-2', name: 'Valid Key', expiresAt: futureDate });
    mockSelectWhere.mockResolvedValue([candidate]);
    mockBcryptCompare.mockResolvedValue(true);

    const req = makeRequest('Bearer abcdefghijklmnop');
    const result = await validateApiKey(req);

    expect(result.id).toBe('key-2');
    expect(result.expiresAt).toBe(futureDate);
  });

  it('tries multiple candidates and matches the correct one', async () => {
    const candidates = [
      makeCandidateKey({ id: 'key-wrong' }),
      makeCandidateKey({ id: 'key-correct' }),
    ];
    mockSelectWhere.mockResolvedValue(candidates);
    mockBcryptCompare
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    const req = makeRequest('Bearer abcdefghijklmnop');
    const result = await validateApiKey(req);
    expect(result.id).toBe('key-correct');
  });

  it('trims whitespace from Bearer token', async () => {
    const candidate = makeCandidateKey({ id: 'key-1' });
    mockSelectWhere.mockResolvedValue([candidate]);
    mockBcryptCompare.mockResolvedValue(true);

    const req = makeRequest('Bearer   abcdefghijklmnop   ');
    const result = await validateApiKey(req);
    expect(result.id).toBe('key-1');
  });

  it('returns all required ApiKeyRecord fields', async () => {
    const lastUsedAt = new Date();
    const createdAt = new Date('2024-01-01');
    const candidate = makeCandidateKey({ lastUsedAt, createdAt });
    mockSelectWhere.mockResolvedValue([candidate]);
    mockBcryptCompare.mockResolvedValue(true);

    const req = makeRequest('Bearer abcdefghijklmnop');
    const result = await validateApiKey(req);

    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('name');
    expect(result).toHaveProperty('keyPrefix');
    expect(result).toHaveProperty('permissions');
    expect(result).toHaveProperty('rateLimit');
    expect(result).toHaveProperty('isActive');
    expect(result).toHaveProperty('lastUsedAt');
    expect(result).toHaveProperty('createdAt');
    expect(result).toHaveProperty('expiresAt');
  });
});

function makeCandidateKey(overrides: Partial<{
  id: string;
  keyHash: string;
  keyPrefix: string;
  name: string;
  permissions: unknown;
  rateLimit: number;
  isActive: boolean;
  lastUsedAt: Date | null;
  createdAt: Date;
  expiresAt: Date | null;
}> = {}) {
  return {
    id: 'key-1',
    keyHash: '$2b$12$hash',
    keyPrefix: 'abcdefgh',
    name: 'Test Key',
    permissions: {},
    rateLimit: 1000,
    isActive: true,
    lastUsedAt: null,
    createdAt: new Date(),
    expiresAt: null,
    ...overrides,
  };
}

describe('generateApiKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns plainKey, keyHash, and keyPrefix', async () => {
    mockBcryptHash.mockResolvedValue('$2b$mockhash');
    const result = await generateApiKey();
    expect(result).toHaveProperty('plainKey');
    expect(result).toHaveProperty('keyHash');
    expect(result).toHaveProperty('keyPrefix');
  });

  it('keyPrefix is first 8 chars of plainKey', async () => {
    mockBcryptHash.mockResolvedValue('$2b$mockhash');
    const result = await generateApiKey();
    expect(result.keyPrefix).toBe(result.plainKey.slice(0, 8));
    expect(result.keyPrefix).toHaveLength(8);
  });

  it('plainKey is a non-empty base64url string', async () => {
    mockBcryptHash.mockResolvedValue('$2b$mockhash');
    const result = await generateApiKey();
    expect(result.plainKey).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(result.plainKey.length).toBeGreaterThan(8);
  });

  it('returns the hash from bcrypt.hash', async () => {
    mockBcryptHash.mockResolvedValue('$2b$specificmockhash');
    const result = await generateApiKey();
    expect(result.keyHash).toBe('$2b$specificmockhash');
  });

  it('generates unique keys on each call', async () => {
    mockBcryptHash.mockResolvedValue('$2b$hash');
    const result1 = await generateApiKey();
    const result2 = await generateApiKey();
    expect(result1.plainKey).not.toBe(result2.plainKey);
  });

  it('calls bcrypt.hash with salt rounds 12', async () => {
    mockBcryptHash.mockResolvedValue('$2b$hash');
    await generateApiKey();
    expect(mockBcryptHash).toHaveBeenCalledWith(expect.any(String), 12);
  });
});
