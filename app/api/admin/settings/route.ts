import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireAdmin, AuthError } from '@/lib/auth-utils';
import { db } from '@/db/connection';
import { settings } from '@/db/schema';
import { logUpdate } from '@/lib/audit';

// ─── GET: Return all settings grouped by category ───────────────────────────

export async function GET() {
  try {
    await requireAdmin('settings:manage');

    const rows = await db
      .select()
      .from(settings)
      .orderBy(settings.category, settings.key);

    // Group by category
    const grouped: Record<string, typeof rows> = {};
    for (const row of rows) {
      if (!grouped[row.category]) grouped[row.category] = [];
      grouped[row.category].push(row);
    }

    return NextResponse.json({ settings: grouped });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('GET settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PATCH: Update settings by key-value pairs ──────────────────────────────

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdmin('settings:manage');

    const body = await request.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const updates = body as Record<string, string>;
    const updatedKeys: string[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (typeof value !== 'string') continue;

      // Fetch current value for audit log
      const [existing] = await db
        .select({ id: settings.id, value: settings.value })
        .from(settings)
        .where(eq(settings.key, key))
        .limit(1);

      if (!existing) continue;

      await db
        .update(settings)
        .set({ value, updatedAt: new Date(), updatedBy: admin.id })
        .where(eq(settings.key, key));

      await logUpdate(
        'settings',
        existing.id,
        { key, value: existing.value },
        { key, value },
        admin.id,
        'admin',
      );

      updatedKeys.push(key);
    }

    return NextResponse.json({ updated: updatedKeys });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('PATCH settings error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
