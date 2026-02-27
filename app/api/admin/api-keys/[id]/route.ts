/**
 * Admin API Key Management — Single Key
 *
 * PATCH  /api/admin/api-keys/:id  — Enable/disable or update key properties
 * DELETE /api/admin/api-keys/:id  — Permanently delete an API key
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/connection';
import { apiKeys } from '@/db/schema';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { logUpdate, logDelete } from '@/lib/audit';

type RouteParams = { params: Promise<{ id: string }> };

// ─── PATCH: Update API key (enable/disable, rename, change rate limit) ───────

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireAdmin('settings:manage');
    const { id } = await params;

    const body = await request.json();
    const { isActive, name, rateLimit: rateLimitPerHour, expiresAt } = body as {
      isActive?: boolean;
      name?: string;
      rateLimit?: number;
      expiresAt?: string | null;
    };

    // Find existing key
    const [existing] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') {
        return NextResponse.json({ error: 'isActive must be a boolean' }, { status: 400 });
      }
      updateData.isActive = isActive;
    }

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json({ error: 'Name must be a non-empty string' }, { status: 400 });
      }
      if (name.trim().length > 100) {
        return NextResponse.json({ error: 'Name must be 100 characters or less' }, { status: 400 });
      }
      updateData.name = name.trim();
    }

    if (rateLimitPerHour !== undefined) {
      if (typeof rateLimitPerHour !== 'number' || rateLimitPerHour < 1 || rateLimitPerHour > 100000) {
        return NextResponse.json(
          { error: 'rateLimit must be a number between 1 and 100000' },
          { status: 400 },
        );
      }
      updateData.rateLimit = rateLimitPerHour;
    }

    if (expiresAt !== undefined) {
      if (expiresAt === null) {
        updateData.expiresAt = null;
      } else {
        const date = new Date(expiresAt);
        if (isNaN(date.getTime())) {
          return NextResponse.json({ error: 'Invalid expiresAt date' }, { status: 400 });
        }
        updateData.expiresAt = date;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const [updated] = await db
      .update(apiKeys)
      .set(updateData)
      .where(eq(apiKeys.id, id))
      .returning();

    // Build audit diff
    const oldData: Record<string, unknown> = {};
    const newData: Record<string, unknown> = {};
    for (const key of Object.keys(updateData)) {
      oldData[key] = (existing as Record<string, unknown>)[key];
      newData[key] = updateData[key];
    }
    await logUpdate('api_keys', id, oldData, newData, admin.id, 'admin');

    return NextResponse.json({
      apiKey: {
        id: updated.id,
        name: updated.name,
        keyPrefix: updated.keyPrefix,
        permissions: updated.permissions,
        rateLimit: updated.rateLimit,
        isActive: updated.isActive,
        lastUsedAt: updated.lastUsedAt,
        createdAt: updated.createdAt,
        expiresAt: updated.expiresAt,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('PATCH /api/admin/api-keys/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE: Permanently delete an API key ───────────────────────────────────

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireAdmin('settings:manage');
    const { id } = await params;

    const [existing] = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    await db.delete(apiKeys).where(eq(apiKeys.id, id));

    await logDelete('api_keys', id, {
      name: existing.name,
      keyPrefix: existing.keyPrefix,
    }, admin.id, 'admin');

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('DELETE /api/admin/api-keys/[id] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
