import { NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth-utils';
import { getUserNotifications } from '@/lib/notifications';

// ─── GET /api/me/notifications ───────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const user = await requireAuth();

    if (user.userType !== 'user') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 100);

    const items = await getUserNotifications(user.id, limit);

    return NextResponse.json({
      notifications: items,
      unreadCount: items.filter((n) => !n.isRead).length,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('[notifications] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
