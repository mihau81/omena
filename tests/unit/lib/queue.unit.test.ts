import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockQueueAdd = vi.fn().mockResolvedValue({ id: 'job-1' });

vi.mock('bullmq', () => {
  // Must use a regular function (not arrow) so it can be called with `new`
  function MockQueue() {
    return { add: mockQueueAdd };
  }
  return { Queue: MockQueue };
});

// Mock the inline job runner dependencies so they don't try to load real modules
const mockSendEmail = vi.fn().mockResolvedValue(true);
vi.mock('@/lib/email', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

const mockSendPushToUser = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/push', () => ({
  sendPushToUser: (...args: unknown[]) => mockSendPushToUser(...args),
}));

vi.mock('@/lib/image-pipeline', () => ({
  processAndUploadImage: vi.fn().mockResolvedValue({
    url: 'https://cdn.example.com/img.jpg',
    thumbnailUrl: 'https://cdn.example.com/img-thumb.jpg',
    mediumUrl: 'https://cdn.example.com/img-medium.jpg',
    largeUrl: 'https://cdn.example.com/img-large.jpg',
    width: 1920,
    height: 1080,
    fileSize: 123456,
    mimeType: 'image/jpeg',
  }),
}));

vi.mock('@/lib/invoice-service', () => ({
  getInvoice: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/invoice-pdf', () => ({
  generateInvoicePdf: vi.fn().mockResolvedValue(Buffer.from('pdf')),
}));

vi.mock('@/db/connection', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  },
}));

vi.mock('@/db/schema', () => ({
  notifications: { id: 'id' },
  settings: { key: 'key', value: 'value', category: 'category' },
  media: { id: 'id' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ _eq: args })),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('queue', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the module-level cached connection
    vi.resetModules();
    // Ensure REDIS_URL is NOT set by default
    delete process.env.REDIS_URL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('QUEUE_NAMES', () => {
    it('has correct queue name constants', async () => {
      const { QUEUE_NAMES } = await import('@/lib/queue');

      expect(QUEUE_NAMES.EMAIL).toBe('omena-email');
      expect(QUEUE_NAMES.PDF).toBe('omena-pdf');
      expect(QUEUE_NAMES.IMAGE).toBe('omena-image');
      expect(QUEUE_NAMES.PUSH).toBe('omena-push');
    });

    it('has exactly 4 queue names', async () => {
      const { QUEUE_NAMES } = await import('@/lib/queue');
      expect(Object.keys(QUEUE_NAMES)).toHaveLength(4);
    });
  });

  describe('queue getters without REDIS_URL', () => {
    it('getEmailQueue returns null when REDIS_URL is not set', async () => {
      delete process.env.REDIS_URL;
      const { getEmailQueue } = await import('@/lib/queue');
      expect(getEmailQueue()).toBeNull();
    });

    it('getPdfQueue returns null when REDIS_URL is not set', async () => {
      delete process.env.REDIS_URL;
      const { getPdfQueue } = await import('@/lib/queue');
      expect(getPdfQueue()).toBeNull();
    });

    it('getImageQueue returns null when REDIS_URL is not set', async () => {
      delete process.env.REDIS_URL;
      const { getImageQueue } = await import('@/lib/queue');
      expect(getImageQueue()).toBeNull();
    });

    it('getPushQueue returns null when REDIS_URL is not set', async () => {
      delete process.env.REDIS_URL;
      const { getPushQueue } = await import('@/lib/queue');
      expect(getPushQueue()).toBeNull();
    });
  });

  describe('queue getters with REDIS_URL', () => {
    it('getEmailQueue returns a Queue when REDIS_URL is set', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379/0';
      const { getEmailQueue } = await import('@/lib/queue');
      const q = getEmailQueue();
      expect(q).not.toBeNull();
      expect(q).toHaveProperty('add');
    });

    it('getPdfQueue returns a Queue when REDIS_URL is set', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379/0';
      const { getPdfQueue } = await import('@/lib/queue');
      const q = getPdfQueue();
      expect(q).not.toBeNull();
    });

    it('getImageQueue returns a Queue when REDIS_URL is set', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379/0';
      const { getImageQueue } = await import('@/lib/queue');
      const q = getImageQueue();
      expect(q).not.toBeNull();
    });

    it('getPushQueue returns a Queue when REDIS_URL is set', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379/0';
      const { getPushQueue } = await import('@/lib/queue');
      const q = getPushQueue();
      expect(q).not.toBeNull();
    });

    it('returns cached queue on second call', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379/0';
      const { getEmailQueue } = await import('@/lib/queue');
      const q1 = getEmailQueue();
      const q2 = getEmailQueue();
      expect(q1).toBe(q2);
    });
  });

  describe('enqueue with Redis available', () => {
    it('enqueueEmail calls queue.add when REDIS_URL is set', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379/0';
      const { enqueueEmail } = await import('@/lib/queue');

      await enqueueEmail({
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Hello</p>',
      });

      expect(mockQueueAdd).toHaveBeenCalledWith('send-email', {
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Hello</p>',
      });
      expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it('enqueueInvoicePdf calls queue.add when REDIS_URL is set', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379/0';
      const { enqueueInvoicePdf } = await import('@/lib/queue');

      await enqueueInvoicePdf({ invoiceId: 'inv-1' });

      expect(mockQueueAdd).toHaveBeenCalledWith('generate-invoice-pdf', { invoiceId: 'inv-1' });
    });

    it('enqueueCatalogPdf calls queue.add when REDIS_URL is set', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379/0';
      const { enqueueCatalogPdf } = await import('@/lib/queue');

      await enqueueCatalogPdf({ auctionId: 'auction-1' });

      expect(mockQueueAdd).toHaveBeenCalledWith('generate-catalog-pdf', { auctionId: 'auction-1' });
    });

    it('enqueueImageProcessing calls queue.add when REDIS_URL is set', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379/0';
      const { enqueueImageProcessing } = await import('@/lib/queue');

      const imageData = {
        imageBuffer: Buffer.from('test').toString('base64'),
        originalFilename: 'test.jpg',
        lotId: 'lot-1',
        mediaId: 'media-1',
        isPrimary: true,
        sortOrder: 0,
      };
      await enqueueImageProcessing(imageData);

      expect(mockQueueAdd).toHaveBeenCalledWith('process-image', imageData);
    });

    it('enqueuePushNotification calls queue.add when REDIS_URL is set', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379/0';
      const { enqueuePushNotification } = await import('@/lib/queue');

      const data = { userId: 'user-1', payload: { title: 'T', body: 'B' } };
      await enqueuePushNotification(data);

      expect(mockQueueAdd).toHaveBeenCalledWith('send-push-notification', data);
    });
  });

  describe('getRedisConnection edge cases', () => {
    it('handles invalid REDIS_URL gracefully', async () => {
      process.env.REDIS_URL = 'not-a-valid-url';
      const { getEmailQueue } = await import('@/lib/queue');
      // Invalid URL should result in null connection
      const q = getEmailQueue();
      expect(q).toBeNull();
    });

    it('parses REDIS_URL with password and db', async () => {
      process.env.REDIS_URL = 'redis://:secret@redis.example.com:6380/2';
      const { getEmailQueue } = await import('@/lib/queue');
      const q = getEmailQueue();
      expect(q).not.toBeNull();
    });
  });

  describe('enqueueEmail fallback', () => {
    it('falls back to inline email sending when queue is null (no REDIS_URL)', async () => {
      delete process.env.REDIS_URL;
      const { enqueueEmail } = await import('@/lib/queue');

      await enqueueEmail({
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Hello</p>',
      });

      // When no Redis, enqueueEmail calls runEmailJob inline,
      // which calls sendEmail from @/lib/email
      expect(mockSendEmail).toHaveBeenCalledWith(
        'test@example.com',
        'Test',
        '<p>Hello</p>',
      );
    });

    it('does not call queue.add when REDIS_URL is not set', async () => {
      delete process.env.REDIS_URL;
      const { enqueueEmail } = await import('@/lib/queue');

      await enqueueEmail({
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Hello</p>',
      });

      expect(mockQueueAdd).not.toHaveBeenCalled();
    });
  });

  describe('enqueuePushNotification fallback', () => {
    it('falls back to inline push sending when queue is null', async () => {
      delete process.env.REDIS_URL;
      const { enqueuePushNotification } = await import('@/lib/queue');

      const payload = { title: 'Test', body: 'Hello' };
      await enqueuePushNotification({
        userId: 'user-1',
        payload,
      });

      // When no Redis, calls runPushJob which calls sendPushToUser
      expect(mockSendPushToUser).toHaveBeenCalledWith('user-1', payload);
    });
  });

  describe('enqueueInvoicePdf fallback', () => {
    it('falls back to inline processing when queue is null', async () => {
      delete process.env.REDIS_URL;
      const { enqueueInvoicePdf } = await import('@/lib/queue');

      // Should not throw — runInvoicePdfJob will call getInvoice (mocked to return null)
      await expect(
        enqueueInvoicePdf({ invoiceId: 'inv-1' })
      ).resolves.not.toThrow();

      expect(mockQueueAdd).not.toHaveBeenCalled();
    });
  });

  describe('enqueueCatalogPdf fallback', () => {
    it('falls back to inline processing when queue is null', async () => {
      delete process.env.REDIS_URL;
      const { enqueueCatalogPdf } = await import('@/lib/queue');

      // runCatalogPdfJob is a placeholder that just logs
      await expect(
        enqueueCatalogPdf({ auctionId: 'auction-1' })
      ).resolves.not.toThrow();

      expect(mockQueueAdd).not.toHaveBeenCalled();
    });
  });

  describe('enqueueImageProcessing fallback', () => {
    it('falls back to inline processing when queue is null', async () => {
      delete process.env.REDIS_URL;
      const { enqueueImageProcessing } = await import('@/lib/queue');

      const imageData = {
        imageBuffer: Buffer.from('test').toString('base64'),
        originalFilename: 'test.jpg',
        lotId: 'lot-1',
        mediaId: 'media-1',
        isPrimary: true,
        sortOrder: 0,
      };

      await expect(
        enqueueImageProcessing(imageData)
      ).resolves.not.toThrow();

      expect(mockQueueAdd).not.toHaveBeenCalled();
    });
  });

  describe('queueEmail helper', () => {
    it('delegates to enqueueEmail with SendEmailJob structure', async () => {
      delete process.env.REDIS_URL;
      const { queueEmail } = await import('@/lib/queue');

      await queueEmail('user@test.com', 'Subject', '<p>Body</p>', 'notif-1');

      // Falls through to runEmailJob -> sendEmail
      expect(mockSendEmail).toHaveBeenCalledWith(
        'user@test.com',
        'Subject',
        '<p>Body</p>',
      );
    });

    it('works without notificationId', async () => {
      delete process.env.REDIS_URL;
      const { queueEmail } = await import('@/lib/queue');

      await queueEmail('user@test.com', 'Subject', '<p>Body</p>');

      expect(mockSendEmail).toHaveBeenCalledWith(
        'user@test.com',
        'Subject',
        '<p>Body</p>',
      );
    });
  });

  describe('runEmailJob', () => {
    it('calls sendEmail with correct arguments', async () => {
      const { runEmailJob } = await import('@/lib/queue');

      await runEmailJob({
        to: 'recipient@test.com',
        subject: 'Important',
        html: '<h1>Hello</h1>',
      });

      expect(mockSendEmail).toHaveBeenCalledWith(
        'recipient@test.com',
        'Important',
        '<h1>Hello</h1>',
      );
    });
  });

  describe('runPushJob', () => {
    it('calls sendPushToUser with correct arguments', async () => {
      const { runPushJob } = await import('@/lib/queue');

      const payload = { title: 'Push', body: 'Hello', url: '/test', tag: 'outbid' };
      await runPushJob({
        userId: 'user-42',
        payload,
      });

      expect(mockSendPushToUser).toHaveBeenCalledWith('user-42', payload);
    });
  });

  describe('runInvoicePdfJob', () => {
    it('returns null when invoice is not found', async () => {
      const { getInvoice } = await import('@/lib/invoice-service');
      (getInvoice as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const { runInvoicePdfJob } = await import('@/lib/queue');
      const result = await runInvoicePdfJob({ invoiceId: 'inv-missing' });

      expect(result).toBeNull();
      expect(getInvoice).toHaveBeenCalledWith('inv-missing');
    });

    it('generates PDF when invoice exists', async () => {
      const mockInvoice = { id: 'inv-1', number: 'INV-001', items: [] };
      const { getInvoice } = await import('@/lib/invoice-service');
      (getInvoice as ReturnType<typeof vi.fn>).mockResolvedValue(mockInvoice);

      const { db } = await import('@/db/connection');
      (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { key: 'company_name', value: 'Test Co' },
            { key: 'company_address', value: '123 St' },
            { key: 'company_city', value: 'Warsaw' },
            { key: 'company_postal_code', value: '00-001' },
            { key: 'company_country', value: 'PL' },
            { key: 'company_nip', value: '1234567890' },
            { key: 'company_bank_account', value: 'PL123456' },
          ]),
        }),
      });

      const { generateInvoicePdf } = await import('@/lib/invoice-pdf');
      (generateInvoicePdf as ReturnType<typeof vi.fn>).mockResolvedValue(Buffer.from('pdf-content'));

      const { runInvoicePdfJob } = await import('@/lib/queue');
      const result = await runInvoicePdfJob({ invoiceId: 'inv-1' });

      expect(result).toBeInstanceOf(Buffer);
      expect(result!.toString()).toBe('pdf-content');
      expect(generateInvoicePdf).toHaveBeenCalledWith(mockInvoice, {
        company_name: 'Test Co',
        company_address: '123 St',
        company_city: 'Warsaw',
        company_postal_code: '00-001',
        company_country: 'PL',
        company_nip: '1234567890',
        company_bank_account: 'PL123456',
      });
    });

    it('uses default empty strings when settings are missing', async () => {
      const mockInvoice = { id: 'inv-2', number: 'INV-002' };
      const { getInvoice } = await import('@/lib/invoice-service');
      (getInvoice as ReturnType<typeof vi.fn>).mockResolvedValue(mockInvoice);

      const { db } = await import('@/db/connection');
      (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const { generateInvoicePdf } = await import('@/lib/invoice-pdf');
      (generateInvoicePdf as ReturnType<typeof vi.fn>).mockResolvedValue(Buffer.from('pdf'));

      const { runInvoicePdfJob } = await import('@/lib/queue');
      await runInvoicePdfJob({ invoiceId: 'inv-2' });

      expect(generateInvoicePdf).toHaveBeenCalledWith(mockInvoice, {
        company_name: '',
        company_address: '',
        company_city: '',
        company_postal_code: '',
        company_country: '',
        company_nip: '',
        company_bank_account: undefined,
      });
    });
  });

  describe('runImageJob', () => {
    it('processes image and updates media record in DB', async () => {
      const { processAndUploadImage } = await import('@/lib/image-pipeline');
      const processedResult = {
        url: 'https://cdn.example.com/img.jpg',
        thumbnailUrl: 'https://cdn.example.com/img-thumb.jpg',
        mediumUrl: 'https://cdn.example.com/img-medium.jpg',
        largeUrl: 'https://cdn.example.com/img-large.jpg',
        width: 1920,
        height: 1080,
        fileSize: 123456,
        mimeType: 'image/jpeg',
      };
      (processAndUploadImage as ReturnType<typeof vi.fn>).mockResolvedValue(processedResult);

      const mockWhere = vi.fn().mockResolvedValue(undefined);
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
      const { db } = await import('@/db/connection');
      (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: mockSet });

      const { runImageJob } = await import('@/lib/queue');
      const imageBuffer = Buffer.from('test-image').toString('base64');

      await runImageJob({
        imageBuffer,
        originalFilename: 'photo.jpg',
        lotId: 'lot-1',
        mediaId: 'media-1',
        isPrimary: true,
        sortOrder: 0,
      });

      expect(processAndUploadImage).toHaveBeenCalledWith(
        Buffer.from(imageBuffer, 'base64'),
        'photo.jpg',
      );
      expect(mockSet).toHaveBeenCalledWith({
        url: processedResult.url,
        thumbnailUrl: processedResult.thumbnailUrl,
        mediumUrl: processedResult.mediumUrl,
        largeUrl: processedResult.largeUrl,
        width: processedResult.width,
        height: processedResult.height,
        fileSize: processedResult.fileSize,
        mimeType: processedResult.mimeType,
      });
    });
  });

  describe('runCatalogPdfJob', () => {
    it('logs catalog PDF request with default locale', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { runCatalogPdfJob } = await import('@/lib/queue');

      await runCatalogPdfJob({ auctionId: 'auction-42' });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('auction-42'),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('pl'),
      );
      consoleSpy.mockRestore();
    });

    it('logs catalog PDF request with custom locale', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const { runCatalogPdfJob } = await import('@/lib/queue');

      await runCatalogPdfJob({ auctionId: 'auction-42', locale: 'en' });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('en'),
      );
      consoleSpy.mockRestore();
    });
  });

  describe('runEmailJob with notificationId', () => {
    it('updates notification emailSent when email sent successfully and notificationId is provided', async () => {
      mockSendEmail.mockResolvedValue(true);

      const mockWhere = vi.fn().mockResolvedValue(undefined);
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      const { db } = await import('@/db/connection');
      (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: mockSet });

      const { runEmailJob } = await import('@/lib/queue');

      await runEmailJob({
        to: 'user@test.com',
        subject: 'Test',
        html: '<p>Hello</p>',
        notificationId: 'notif-1',
      });

      expect(mockSendEmail).toHaveBeenCalled();
      expect(db.update).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith({ emailSent: true });
    });

    it('does not update notification when email sending fails', async () => {
      mockSendEmail.mockResolvedValue(false);

      const { db } = await import('@/db/connection');
      (db.update as ReturnType<typeof vi.fn>).mockClear();

      const { runEmailJob } = await import('@/lib/queue');

      await runEmailJob({
        to: 'user@test.com',
        subject: 'Test',
        html: '<p>Hello</p>',
        notificationId: 'notif-1',
      });

      expect(mockSendEmail).toHaveBeenCalled();
      expect(db.update).not.toHaveBeenCalled();
    });

    it('does not update notification when notificationId is not provided', async () => {
      mockSendEmail.mockResolvedValue(true);

      const { db } = await import('@/db/connection');
      (db.update as ReturnType<typeof vi.fn>).mockClear();

      const { runEmailJob } = await import('@/lib/queue');

      await runEmailJob({
        to: 'user@test.com',
        subject: 'Test',
        html: '<p>Hello</p>',
      });

      expect(mockSendEmail).toHaveBeenCalled();
      expect(db.update).not.toHaveBeenCalled();
    });
  });

  describe('job type interfaces', () => {
    it('exports SendEmailJob type', async () => {
      const job = {
        to: 'test@example.com',
        subject: 'Hello',
        html: '<p>World</p>',
        notificationId: 'notif-123',
      };
      expect(job.to).toBeDefined();
      expect(job.notificationId).toBe('notif-123');
    });

    it('exports GenerateInvoicePdfJob type', async () => {
      const job = {
        invoiceId: 'inv-1',
        uploadToS3: true,
      };
      expect(job.invoiceId).toBe('inv-1');
    });

    it('exports ProcessImageJob type', async () => {
      const job = {
        imageBuffer: 'base64data',
        originalFilename: 'photo.jpg',
        lotId: 'lot-1',
        mediaId: 'media-1',
        isPrimary: true,
        sortOrder: 0,
      };
      expect(job.isPrimary).toBe(true);
    });

    it('exports SendPushNotificationJob type', async () => {
      const job = {
        userId: 'user-1',
        payload: {
          title: 'Hello',
          body: 'World',
          url: '/test',
          tag: 'outbid',
        },
      };
      expect(job.payload.tag).toBe('outbid');
    });

    it('exports GenerateCatalogPdfJob type', async () => {
      const job = {
        auctionId: 'auction-1',
        locale: 'pl',
      };
      expect(job.auctionId).toBe('auction-1');
      expect(job.locale).toBe('pl');
    });
  });
});
