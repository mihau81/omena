import crypto from 'crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/connection';
import { verificationTokens } from '@/db/schema';

type TokenPurpose = 'email_verification' | 'magic_link' | 'password_reset';

/**
 * Create a verification token and insert it into the database.
 * Returns the raw hex token string.
 */
export async function createVerificationToken(
  identifier: string,
  purpose: TokenPurpose,
  durationMs: number,
): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  await db.insert(verificationTokens).values({
    identifier,
    token,
    expiresAt: new Date(Date.now() + durationMs),
    purpose,
  });
  return token;
}

/**
 * Atomically consume a verification token.
 * Returns the identifier (email) if the token is valid and not expired, or null.
 */
export async function consumeToken(
  token: string,
  purpose: TokenPurpose,
): Promise<{ identifier: string } | null> {
  const consumed = await db
    .update(verificationTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(verificationTokens.token, token),
        eq(verificationTokens.purpose, purpose),
        isNull(verificationTokens.usedAt),
      ),
    )
    .returning({
      identifier: verificationTokens.identifier,
      expiresAt: verificationTokens.expiresAt,
    });

  if (consumed.length === 0) return null;
  if (consumed[0].expiresAt < new Date()) return null;
  return { identifier: consumed[0].identifier };
}

/**
 * Get the base URL for constructing auth links.
 */
export function getBaseUrl(): string {
  return process.env.NEXTAUTH_URL || 'http://localhost:3002/omena';
}
