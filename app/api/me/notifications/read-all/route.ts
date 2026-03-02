import { NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db/connection';
import { notifications } from '@/db/schema';
import { requireApprovedUser, AuthError } from '@/lib/auth-utils';

// ─── POST /api/me/notifications/read-all ────────────────────────────────────

export async function POST() {
  try {
    const user = await requireApprovedUser();

    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, user.id), eq(notifications.isRead, false)));

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('[notifications] read-all error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
