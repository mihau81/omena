import { Queue, type ConnectionOptions } from 'bullmq';

// ─── Redis connection for BullMQ ─────────────────────────────────────────────
// BullMQ needs a separate ioredis connection (not the pub/sub ones from redis.ts)
// Returns null when Redis is not configured — queues disabled gracefully

let _redisConn: ConnectionOptions | null | undefined;

function getRedisConnection(): ConnectionOptions | null {
  if (_redisConn !== undefined) return _redisConn;

  const url = process.env.REDIS_URL;
  if (!url) {
    _redisConn = null;
    return null;
  }

  try {
    const parsed = new URL(url);
    _redisConn = {
      host: parsed.hostname || 'localhost',
      port: parsed.port ? parseInt(parsed.port, 10) : 6379,
      password: parsed.password || undefined,
      db: parsed.pathname ? parseInt(parsed.pathname.slice(1), 10) || 0 : 0,
      maxRetriesPerRequest: null, // Required by BullMQ
    };
    return _redisConn;
  } catch {
    _redisConn = null;
    return null;
  }
}

// ─── Job type definitions ─────────────────────────────────────────────────────

export interface SendEmailJob {
  to: string;
  subject: string;
  html: string;
  notificationId?: string;  // If set, mark notification.emailSent = true on success
}

export interface GenerateInvoicePdfJob {
  invoiceId: string;
  uploadToS3?: boolean;  // If true, upload PDF to S3 and store URL
}

export interface GenerateCatalogPdfJob {
  auctionId: string;
  locale?: string;
}

export interface ProcessImageJob {
  imageBuffer: string;       // base64-encoded image buffer
  originalFilename: string;
  lotId: string;
  mediaId: string;           // The media row to update with processed URLs
  isPrimary: boolean;
  sortOrder: number;
}

export interface SendPushNotificationJob {
  userId: string;
  payload: {
    title: string;
    body: string;
    url?: string;
    icon?: string;
    badge?: string;
    tag?: string;
  };
}

// Union of all job data types
export type JobData =
  | { type: 'send-email'; data: SendEmailJob }
  | { type: 'generate-invoice-pdf'; data: GenerateInvoicePdfJob }
  | { type: 'generate-catalog-pdf'; data: GenerateCatalogPdfJob }
  | { type: 'process-image'; data: ProcessImageJob }
  | { type: 'send-push-notification'; data: SendPushNotificationJob };

// ─── Queue names ─────────────────────────────────────────────────────────────

export const QUEUE_NAMES = {
  EMAIL: 'omena:email',
  PDF: 'omena:pdf',
  IMAGE: 'omena:image',
  PUSH: 'omena:push',
} as const;

// ─── Queue singletons ─────────────────────────────────────────────────────────

let emailQueue: Queue | null = null;
let pdfQueue: Queue | null = null;
let imageQueue: Queue | null = null;
let pushQueue: Queue | null = null;

function makeQueue(name: string, conn: ConnectionOptions): Queue {
  return new Queue(name, {
    connection: conn,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 200 },
    },
  });
}

export function getEmailQueue(): Queue | null {
  const conn = getRedisConnection();
  if (!conn) return null;
  if (!emailQueue) emailQueue = makeQueue(QUEUE_NAMES.EMAIL, conn);
  return emailQueue;
}

export function getPdfQueue(): Queue | null {
  const conn = getRedisConnection();
  if (!conn) return null;
  if (!pdfQueue) pdfQueue = makeQueue(QUEUE_NAMES.PDF, conn);
  return pdfQueue;
}

export function getImageQueue(): Queue | null {
  const conn = getRedisConnection();
  if (!conn) return null;
  if (!imageQueue) imageQueue = makeQueue(QUEUE_NAMES.IMAGE, conn);
  return imageQueue;
}

export function getPushQueue(): Queue | null {
  const conn = getRedisConnection();
  if (!conn) return null;
  if (!pushQueue) pushQueue = makeQueue(QUEUE_NAMES.PUSH, conn);
  return pushQueue;
}

// ─── Enqueue helpers ─────────────────────────────────────────────────────────
// These are the primary API callers use. When Redis is not available, falls
// back to executing the job inline (synchronously in the same request).

export async function enqueueEmail(data: SendEmailJob): Promise<void> {
  const q = getEmailQueue();
  if (q) {
    await q.add('send-email', data);
  } else {
    // Inline fallback
    await runEmailJob(data);
  }
}

export async function enqueueInvoicePdf(data: GenerateInvoicePdfJob): Promise<void> {
  const q = getPdfQueue();
  if (q) {
    await q.add('generate-invoice-pdf', data);
  } else {
    await runInvoicePdfJob(data);
  }
}

export async function enqueueCatalogPdf(data: GenerateCatalogPdfJob): Promise<void> {
  const q = getPdfQueue();
  if (q) {
    await q.add('generate-catalog-pdf', data);
  } else {
    await runCatalogPdfJob(data);
  }
}

export async function enqueueImageProcessing(data: ProcessImageJob): Promise<void> {
  const q = getImageQueue();
  if (q) {
    await q.add('process-image', data);
  } else {
    await runImageJob(data);
  }
}

export async function enqueuePushNotification(data: SendPushNotificationJob): Promise<void> {
  const q = getPushQueue();
  if (q) {
    await q.add('send-push-notification', data);
  } else {
    await runPushJob(data);
  }
}

// ─── Job processors ──────────────────────────────────────────────────────────
// Extracted so they can be called inline (fallback) or from workers.

export async function runEmailJob(data: SendEmailJob): Promise<void> {
  const { sendEmail } = await import('./email');
  const sent = await sendEmail(data.to, data.subject, data.html);

  if (sent && data.notificationId) {
    const { eq } = await import('drizzle-orm');
    const { db } = await import('../db/connection');
    const { notifications } = await import('../db/schema');
    await db
      .update(notifications)
      .set({ emailSent: true })
      .where(eq(notifications.id, data.notificationId));
  }
}

export async function runInvoicePdfJob(data: GenerateInvoicePdfJob): Promise<Buffer | null> {
  const { getInvoice } = await import('./invoice-service');
  const { generateInvoicePdf } = await import('./invoice-pdf');
  const { db } = await import('../db/connection');
  const { settings } = await import('../db/schema');
  const { eq } = await import('drizzle-orm');

  const invoice = await getInvoice(data.invoiceId);
  if (!invoice) {
    console.warn('[queue] Invoice not found:', data.invoiceId);
    return null;
  }

  // Load company settings
  const settingsRows = await db
    .select({ key: settings.key, value: settings.value })
    .from(settings)
    .where(eq(settings.category, 'company'));

  const settingsMap = Object.fromEntries(settingsRows.map((r) => [r.key, r.value]));

  const companySettings = {
    company_name: settingsMap['company_name'] ?? '',
    company_address: settingsMap['company_address'] ?? '',
    company_city: settingsMap['company_city'] ?? '',
    company_postal_code: settingsMap['company_postal_code'] ?? '',
    company_country: settingsMap['company_country'] ?? '',
    company_nip: settingsMap['company_nip'] ?? '',
    company_bank_account: settingsMap['company_bank_account'],
  };

  const pdfBuffer = await generateInvoicePdf(invoice, companySettings);
  console.log(`[queue] Generated invoice PDF for ${data.invoiceId} (${pdfBuffer.length} bytes)`);
  return pdfBuffer;
}

export async function runCatalogPdfJob(data: GenerateCatalogPdfJob): Promise<void> {
  // Catalog PDF generation is handled by the dedicated catalog service
  // This is a placeholder that logs the request — actual implementation
  // lives in lib/catalog-pdf.ts when that feature is built
  console.log(`[queue] Catalog PDF requested for auction ${data.auctionId} (locale: ${data.locale ?? 'pl'})`);
}

export async function runImageJob(data: ProcessImageJob): Promise<void> {
  const { processAndUploadImage } = await import('./image-pipeline');
  const { db } = await import('../db/connection');
  const { media } = await import('../db/schema');
  const { eq } = await import('drizzle-orm');

  const buffer = Buffer.from(data.imageBuffer, 'base64');
  const processed = await processAndUploadImage(buffer, data.originalFilename);

  await db
    .update(media)
    .set({
      url: processed.url,
      thumbnailUrl: processed.thumbnailUrl,
      mediumUrl: processed.mediumUrl,
      largeUrl: processed.largeUrl,
      width: processed.width,
      height: processed.height,
      fileSize: processed.fileSize,
      mimeType: processed.mimeType,
    })
    .where(eq(media.id, data.mediaId));

  console.log(`[queue] Processed image for lot ${data.lotId}, media ${data.mediaId}`);
}

export async function runPushJob(data: SendPushNotificationJob): Promise<void> {
  const { sendPushToUser } = await import('./push');
  await sendPushToUser(data.userId, data.payload);
}

// ─── queueEmail: always-deferred email ───────────────────────────────────────
// Use this for non-urgent emails (outbid, won, notifications).
// Use sendEmail() directly for time-sensitive emails (magic links, password resets)
// where the user is waiting for the response.

export async function queueEmail(
  to: string,
  subject: string,
  html: string,
  notificationId?: string,
): Promise<void> {
  await enqueueEmail({ to, subject, html, notificationId });
}
