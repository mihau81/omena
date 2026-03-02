import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/db/connection';
import { notifications, users } from '@/db/schema';
import { queueEmail, enqueuePushNotification } from '@/lib/queue';
import {
  outbidNotification,
  auctionStarting,
  registrationApproved,
  registrationRejected,
  lotWon,
} from '@/lib/email-templates';

// ─── Types ───────────────────────────────────────────────────────────────────

export type NotificationType =
  | 'outbid'
  | 'auction_starting'
  | 'auction_ending'
  | 'lot_won'
  | 'registration_approved'
  | 'registration_rejected';

export interface NotificationMetadata {
  lotId?: string;
  auctionId?: string;
  bidId?: string;
  lotTitle?: string;
  lotUrl?: string;
  auctionTitle?: string;
  auctionUrl?: string;
  hammerPrice?: number;
  buyersPremium?: number;
  totalAmount?: number;
  newBidAmount?: number;
  startDate?: string;   // ISO string
  paddleNumber?: number;
  rejectionReason?: string;
}

// ─── Core: Create Notification ────────────────────────────────────────────────

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  metadata?: NotificationMetadata,
): Promise<string> {
  // 1. Insert into notifications table
  const [inserted] = await db
    .insert(notifications)
    .values({
      userId,
      type,
      title,
      body,
      metadata: metadata ?? {},
      isRead: false,
      emailSent: false,
    })
    .returning({ id: notifications.id });

  // 2. Attempt email delivery (non-blocking, best-effort)
  sendEmailForNotification(inserted.id, userId, type, title, metadata).catch(
    (err) => console.error(`[notifications] Email send failed for ${inserted.id}:`, err),
  );

  // 3. Attempt push notification (non-blocking, best-effort)
  sendPushForNotification(userId, type, title, body, metadata).catch(
    (err) => console.warn(`[notifications] Push send failed for ${inserted.id}:`, err),
  );

  return inserted.id;
}

// ─── Push Delivery ────────────────────────────────────────────────────────────

async function sendPushForNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  metadata?: NotificationMetadata,
): Promise<void> {
  // Only send push for time-sensitive notification types
  const pushTypes: NotificationType[] = [
    'outbid',
    'lot_won',
    'auction_starting',
    'registration_approved',
  ];
  if (!pushTypes.includes(type)) return;

  const url = metadata?.lotUrl ?? metadata?.auctionUrl ?? '/account/notifications';

  await enqueuePushNotification({
    userId,
    payload: { title, body, url, tag: type },
  });
}

// ─── Email Delivery ───────────────────────────────────────────────────────────

async function sendEmailForNotification(
  notificationId: string,
  userId: string,
  type: NotificationType,
  title: string,
  metadata?: NotificationMetadata,
): Promise<void> {
  // Fetch user email + name
  const [user] = await db
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return;

  let html: string | null = null;

  switch (type) {
    case 'outbid':
      if (metadata?.lotTitle && metadata?.newBidAmount && metadata?.lotUrl) {
        html = outbidNotification(user.name, metadata.lotTitle, metadata.newBidAmount, metadata.lotUrl);
      }
      break;

    case 'auction_starting':
      if (metadata?.auctionTitle && metadata?.startDate && metadata?.auctionUrl) {
        html = auctionStarting(user.name, metadata.auctionTitle, new Date(metadata.startDate), metadata.auctionUrl);
      }
      break;

    case 'registration_approved':
      if (metadata?.auctionTitle && metadata?.paddleNumber != null) {
        html = registrationApproved(user.name, metadata.auctionTitle, metadata.paddleNumber);
      }
      break;

    case 'registration_rejected':
      if (metadata?.auctionTitle) {
        html = registrationRejected(user.name, metadata.auctionTitle, metadata.rejectionReason);
      }
      break;

    case 'lot_won':
      if (
        metadata?.lotTitle &&
        metadata?.hammerPrice != null &&
        metadata?.buyersPremium != null &&
        metadata?.totalAmount != null
      ) {
        html = lotWon(user.name, metadata.lotTitle, metadata.hammerPrice, metadata.buyersPremium, metadata.totalAmount);
      }
      break;

    default:
      // No template for this type
      break;
  }

  if (!html) return;

  // Enqueue email — worker marks notification.emailSent = true on success
  await queueEmail(user.email, title, html, notificationId);
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getUnreadNotifications(userId: string) {
  return db
    .select({
      id: notifications.id,
      type: notifications.type,
      title: notifications.title,
      body: notifications.body,
      metadata: notifications.metadata,
      isRead: notifications.isRead,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
    .orderBy(desc(notifications.createdAt));
}

export async function getUserNotifications(userId: string, limit = 50) {
  return db
    .select({
      id: notifications.id,
      type: notifications.type,
      title: notifications.title,
      body: notifications.body,
      metadata: notifications.metadata,
      isRead: notifications.isRead,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function markAsRead(notificationId: string, userId: string): Promise<boolean> {
  const result = await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
    .returning({ id: notifications.id });

  return result.length > 0;
}
