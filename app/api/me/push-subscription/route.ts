import { NextResponse } from 'next/server';
import { requireAuth, AuthError } from '@/lib/auth-utils';
import { saveSubscription, deleteSubscription, getVapidPublicKey } from '@/lib/push';
import { db } from '@/db/connection';
import { pushSubscriptions } from '@/db/schema';
import { eq } from 'drizzle-orm';

// ─── GET: Return VAPID public key + subscription status ─────────────────────

export async function GET() {
  try {
    const user = await requireAuth();
    if (user.userType !== 'user') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const subs = await db
      .select({ id: pushSubscriptions.id })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, user.id));

    return NextResponse.json({
      vapidPublicKey: getVapidPublicKey(),
      isSubscribed: subs.length > 0,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST: Save a new push subscription ─────────────────────────────────────

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    if (user.userType !== 'user') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { endpoint, keys } = body as {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    };

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: 'Invalid subscription object' }, { status: 400 });
    }

    const userAgent = request.headers.get('user-agent') ?? undefined;
    await saveSubscription(user.id, endpoint, keys.p256dh, keys.auth, userAgent);

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('[push-subscription] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE: Remove a push subscription ─────────────────────────────────────

export async function DELETE(request: Request) {
  try {
    const user = await requireAuth();
    if (user.userType !== 'user') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { endpoint } = body as { endpoint: string };

    if (!endpoint) {
      return NextResponse.json({ error: 'endpoint required' }, { status: 400 });
    }

    await deleteSubscription(endpoint);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('[push-subscription] DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
