/**
 * API Key authentication for third-party integrations (Invaluable, Artnet, Barnebys)
 *
 * Keys are passed as: Authorization: Bearer <key>
 * The key is formatted as: <prefix>.<secret>
 * Lookup is done by prefix (first 8 chars), then bcrypt comparison of the full key.
 */

import bcrypt from 'bcryptjs';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db/connection';
import { apiKeys } from '@/db/schema';
import { rateLimit } from '@/lib/rate-limit';

export class ApiKeyError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401,
  ) {
    super(message);
    this.name = 'ApiKeyError';
  }
}

export interface ApiKeyRecord {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: unknown;
  rateLimit: number;
  isActive: boolean;
  lastUsedAt: Date | null;
  createdAt: Date;
  expiresAt: Date | null;
}

// Per-key rate limiter registry (keyed by API key id, 1-hour windows)
const apiKeyLimiters = new Map<string, ReturnType<typeof rateLimit>>();

function getOrCreateLimiter(keyId: string, maxRequests: number) {
  if (!apiKeyLimiters.has(keyId)) {
    apiKeyLimiters.set(keyId, rateLimit({ maxRequests, windowMs: 60 * 60 * 1000 }));
  }
  return apiKeyLimiters.get(keyId)!;
}

/**
 * Validates the API key from the Authorization header.
 * Returns the API key record if valid, throws ApiKeyError otherwise.
 */
export async function validateApiKey(request: Request): Promise<ApiKeyRecord> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ApiKeyError('Missing or invalid Authorization header. Use: Authorization: Bearer <key>', 401);
  }

  const rawKey = authHeader.slice(7).trim();
  if (!rawKey || rawKey.length < 8) {
    throw new ApiKeyError('Invalid API key format', 401);
  }

  // Extract prefix (first 8 characters)
  const prefix = rawKey.slice(0, 8);

  // Look up candidate keys by prefix
  const candidates = await db
    .select()
    .from(apiKeys)
    .where(
      and(
        eq(apiKeys.keyPrefix, prefix),
        eq(apiKeys.isActive, true),
      ),
    );

  if (candidates.length === 0) {
    throw new ApiKeyError('Invalid API key', 401);
  }

  // Bcrypt-compare the raw key against each candidate's hash
  let matchedKey: typeof candidates[0] | null = null;
  for (const candidate of candidates) {
    const match = await bcrypt.compare(rawKey, candidate.keyHash);
    if (match) {
      matchedKey = candidate;
      break;
    }
  }

  if (!matchedKey) {
    throw new ApiKeyError('Invalid API key', 401);
  }

  // Check expiry
  if (matchedKey.expiresAt && matchedKey.expiresAt < new Date()) {
    throw new ApiKeyError('API key has expired', 401);
  }

  // Check rate limit
  const limiter = getOrCreateLimiter(matchedKey.id, matchedKey.rateLimit);
  const rateLimitResult = limiter.check(matchedKey.id);
  if (!rateLimitResult.success) {
    throw new ApiKeyError('Rate limit exceeded. Maximum requests per hour: ' + matchedKey.rateLimit, 429);
  }

  // Fire-and-forget: update lastUsedAt
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, matchedKey.id))
    .catch(() => {/* non-critical */});

  return {
    id: matchedKey.id,
    name: matchedKey.name,
    keyPrefix: matchedKey.keyPrefix,
    permissions: matchedKey.permissions,
    rateLimit: matchedKey.rateLimit,
    isActive: matchedKey.isActive,
    lastUsedAt: matchedKey.lastUsedAt,
    createdAt: matchedKey.createdAt,
    expiresAt: matchedKey.expiresAt,
  };
}

/**
 * Generates a new API key. Returns the plain-text key (shown only once) and its bcrypt hash + prefix.
 */
export async function generateApiKey(): Promise<{ plainKey: string; keyHash: string; keyPrefix: string }> {
  // Generate a 32-byte random key, base64url-encoded
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  const plainKey = Buffer.from(randomBytes).toString('base64url');

  const keyPrefix = plainKey.slice(0, 8);
  const keyHash = await bcrypt.hash(plainKey, 12);

  return { plainKey, keyHash, keyPrefix };
}
