/**
 * Admin API Key Management
 *
 * GET  /api/admin/api-keys  — List all API keys (hashes not returned)
 * POST /api/admin/api-keys  — Create a new API key (returns plain-text key ONCE)
 */

import { NextRequest, NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { db } from '@/db/connection';
import { apiKeys } from '@/db/schema';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { generateApiKey } from '@/lib/api-key-auth';
import { logCreate } from '@/lib/audit';

// ─── GET: List all API keys ──────────────────────────────────────────────────

export async function GET() {
  try {
    await requireAdmin('settings:manage');

    const rows = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        permissions: apiKeys.permissions,
        rateLimit: apiKeys.rateLimit,
        isActive: apiKeys.isActive,
        lastUsedAt: apiKeys.lastUsedAt,
        createdAt: apiKeys.createdAt,
        expiresAt: apiKeys.expiresAt,
        // NOTE: keyHash is intentionally excluded
      })
      .from(apiKeys)
      .orderBy(desc(apiKeys.createdAt));

    return NextResponse.json({ apiKeys: rows, total: rows.length });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('GET /api/admin/api-keys error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST: Create a new API key ──────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin('settings:manage');

    const body = await request.json();
    const { name, rateLimit: rateLimitPerHour, permissions, expiresAt } = body as {
      name?: string;
      rateLimit?: number;
      permissions?: string[];
      expiresAt?: string | null;
    };

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (name.trim().length > 100) {
      return NextResponse.json({ error: 'Name must be 100 characters or less' }, { status: 400 });
    }

    const resolvedRateLimit = rateLimitPerHour ?? 1000;
    if (typeof resolvedRateLimit !== 'number' || resolvedRateLimit < 1 || resolvedRateLimit > 100000) {
      return NextResponse.json(
        { error: 'rateLimit must be a number between 1 and 100000' },
        { status: 400 },
      );
    }

    const resolvedPermissions = permissions ?? ['lots:read', 'auctions:read'];
    if (!Array.isArray(resolvedPermissions)) {
      return NextResponse.json({ error: 'permissions must be an array' }, { status: 400 });
    }

    let expiresAtDate: Date | null = null;
    if (expiresAt) {
      expiresAtDate = new Date(expiresAt);
      if (isNaN(expiresAtDate.getTime())) {
        return NextResponse.json({ error: 'Invalid expiresAt date' }, { status: 400 });
      }
      if (expiresAtDate <= new Date()) {
        return NextResponse.json({ error: 'expiresAt must be in the future' }, { status: 400 });
      }
    }

    const { plainKey, keyHash, keyPrefix } = await generateApiKey();

    const [created] = await db
      .insert(apiKeys)
      .values({
        name: name.trim(),
        keyHash,
        keyPrefix,
        permissions: resolvedPermissions,
        rateLimit: resolvedRateLimit,
        isActive: true,
        expiresAt: expiresAtDate,
      })
      .returning();

    await logCreate('api_keys', created.id, {
      name: created.name,
      keyPrefix: created.keyPrefix,
      rateLimit: created.rateLimit,
      permissions: created.permissions,
    }, admin.id, 'admin');

    // Return the plain key ONLY on creation — it cannot be recovered later
    return NextResponse.json(
      {
        apiKey: {
          id: created.id,
          name: created.name,
          keyPrefix: created.keyPrefix,
          permissions: created.permissions,
          rateLimit: created.rateLimit,
          isActive: created.isActive,
          createdAt: created.createdAt,
          expiresAt: created.expiresAt,
          lastUsedAt: created.lastUsedAt,
        },
        // WARNING: This plain key is shown ONCE and cannot be retrieved again
        plainKey,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('POST /api/admin/api-keys error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
