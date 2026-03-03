import webpush from 'web-push';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/db/connection';
import { pushSubscriptions } from '@/db/schema';

// ─── VAPID Configuration ─────────────────────────────────────────────────────

const VAPID_PUBLIC  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY  ?? '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? '';
const VAPID_EMAIL   = process.env.VAPID_EMAIL ?? 'mailto:info@omenaa.pl';

let _configured = false;

function ensureConfigured() {
  if (_configured) return;
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return; // VAPID not configured — push disabled
  }
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
  _configured = true;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  tag?: string;
}

// ─── Send to one user ─────────────────────────────────────────────────────────

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  ensureConfigured();
  if (!_configured) {
    console.log('[push] VAPID not configured — skipping push for user', userId);
    return;
  }

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  if (subs.length === 0) return;

  const body = JSON.stringify(payload);
  const dead: string[] = [];

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
        );
      } catch (err: unknown) {
        // 404/410 = subscription expired/unsubscribed — remove it
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          dead.push(sub.id);
        } else {
          console.warn('[push] Send failed for sub', sub.id, err);
        }
      }
    }),
  );

  // Clean up dead subscriptions in a single query
  if (dead.length > 0) {
    await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, dead)).catch(() => {});
  }
}

// ─── Subscription management ─────────────────────────────────────────────────

export async function saveSubscription(
  userId: string,
  endpoint: string,
  p256dh: string,
  auth: string,
  userAgent?: string,
): Promise<void> {
  // Upsert by endpoint (unique constraint)
  await db
    .insert(pushSubscriptions)
    .values({ userId, endpoint, p256dh, auth, userAgent })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId, p256dh, auth, userAgent },
    });
}

export async function deleteSubscription(endpoint: string): Promise<void> {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC;
}
