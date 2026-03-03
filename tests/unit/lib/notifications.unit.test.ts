import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/db/connection', () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'notif-1' }]),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'notif-1' }]),
        }),
      }),
    }),
  },
}));

vi.mock('@/db/schema', () => ({
  notifications: {
    id: 'id',
    userId: 'userId',
    type: 'type',
    title: 'title',
    body: 'body',
    metadata: 'metadata',
    isRead: 'isRead',
    emailSent: 'emailSent',
    createdAt: 'createdAt',
  },
  users: {
    id: 'id',
    email: 'email',
    name: 'name',
  },
}));

const mockQueueEmail = vi.fn().mockResolvedValue(undefined);
const mockEnqueuePush = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/queue', () => ({
  queueEmail: (...args: unknown[]) => mockQueueEmail(...args),
  enqueuePushNotification: (...args: unknown[]) => mockEnqueuePush(...args),
}));

vi.mock('@/lib/email-templates', () => ({
  outbidNotification: vi.fn().mockReturnValue('<html>outbid</html>'),
  auctionStarting: vi.fn().mockReturnValue('<html>starting</html>'),
  registrationApproved: vi.fn().mockReturnValue('<html>approved</html>'),
  registrationRejected: vi.fn().mockReturnValue('<html>rejected</html>'),
  lotWon: vi.fn().mockReturnValue('<html>won</html>'),
}));

// drizzle-orm operators used in notifications.ts
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ _eq: args })),
  and: vi.fn((...args: unknown[]) => ({ _and: args })),
  desc: vi.fn((col: unknown) => ({ _desc: col })),
}));

import {
  createNotification,
  type NotificationType,
  type NotificationMetadata,
} from '@/lib/notifications';
import { db } from '@/db/connection';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock chains to default for each test
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'notif-1' }]),
      }),
    });

    // db.select mock returns a user for email sending
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            { email: 'user@example.com', name: 'Test User' },
          ]),
        }),
      }),
    });
  });

  describe('createNotification', () => {
    it('inserts notification and returns id', async () => {
      const id = await createNotification(
        'user-1',
        'outbid',
        'You have been outbid',
        'Someone placed a higher bid on Lot 1',
        { lotId: 'lot-1', lotTitle: 'Lot 1' },
      );

      expect(id).toBe('notif-1');
      expect(db.insert).toHaveBeenCalled();
    });

    it('works without metadata argument', async () => {
      const id = await createNotification(
        'user-1',
        'auction_ending',
        'Auction ending soon',
        'The auction is ending in 10 minutes',
      );

      expect(id).toBe('notif-1');
    });

    it('sends push for outbid notification', async () => {
      await createNotification(
        'user-1',
        'outbid',
        'Outbid',
        'You have been outbid on Lot 1',
        { lotId: 'lot-1', lotUrl: '/lots/lot-1' },
      );

      // Wait for async push delivery (non-blocking)
      await vi.waitFor(() => {
        expect(mockEnqueuePush).toHaveBeenCalled();
      });

      expect(mockEnqueuePush).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          payload: expect.objectContaining({
            title: 'Outbid',
            body: 'You have been outbid on Lot 1',
            tag: 'outbid',
          }),
        }),
      );
    });

    it('sends push for lot_won notification', async () => {
      await createNotification(
        'user-1',
        'lot_won',
        'You won!',
        'Congratulations!',
        { lotId: 'lot-1', lotUrl: '/lots/lot-1' },
      );

      await vi.waitFor(() => {
        expect(mockEnqueuePush).toHaveBeenCalled();
      });

      expect(mockEnqueuePush).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          payload: expect.objectContaining({ tag: 'lot_won' }),
        }),
      );
    });

    it('sends push for auction_starting notification', async () => {
      await createNotification(
        'user-1',
        'auction_starting',
        'Auction starting',
        'The auction is starting now',
        { auctionUrl: '/auctions/a-1' },
      );

      await vi.waitFor(() => {
        expect(mockEnqueuePush).toHaveBeenCalled();
      });

      expect(mockEnqueuePush).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({ tag: 'auction_starting' }),
        }),
      );
    });

    it('sends push for registration_approved notification', async () => {
      await createNotification(
        'user-1',
        'registration_approved',
        'Registration approved',
        'Your registration has been approved',
        { auctionTitle: 'Auction 1', paddleNumber: 42 },
      );

      await vi.waitFor(() => {
        expect(mockEnqueuePush).toHaveBeenCalled();
      });

      expect(mockEnqueuePush).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({ tag: 'registration_approved' }),
        }),
      );
    });

    it('does NOT send push for auction_ending notification', async () => {
      await createNotification(
        'user-1',
        'auction_ending',
        'Auction ending',
        'The auction is ending soon',
      );

      // Give a tick for the async push attempt
      await new Promise((r) => setTimeout(r, 50));

      expect(mockEnqueuePush).not.toHaveBeenCalled();
    });

    it('does NOT send push for registration_rejected notification', async () => {
      await createNotification(
        'user-1',
        'registration_rejected',
        'Registration rejected',
        'Your registration has been rejected',
        { auctionTitle: 'Auction 1', rejectionReason: 'Incomplete documents' },
      );

      // Give a tick for the async push attempt
      await new Promise((r) => setTimeout(r, 50));

      expect(mockEnqueuePush).not.toHaveBeenCalled();
    });

    it('attempts email delivery for outbid notification with complete metadata', async () => {
      await createNotification(
        'user-1',
        'outbid',
        'You have been outbid',
        'Someone placed a higher bid',
        {
          lotTitle: 'Lot 1',
          newBidAmount: 15000,
          lotUrl: '/lots/lot-1',
        },
      );

      // Email is sent asynchronously; wait for it
      await vi.waitFor(() => {
        expect(mockQueueEmail).toHaveBeenCalled();
      });
    });

    it('attempts email delivery for lot_won with complete metadata', async () => {
      await createNotification(
        'user-1',
        'lot_won',
        'You won Lot 1',
        'Congratulations!',
        {
          lotTitle: 'Lot 1',
          hammerPrice: 50000,
          buyersPremium: 10000,
          totalAmount: 60000,
        },
      );

      await vi.waitFor(() => {
        expect(mockQueueEmail).toHaveBeenCalled();
      });
    });
  });

  describe('NotificationType values', () => {
    it('includes all expected types', () => {
      const validTypes: NotificationType[] = [
        'outbid',
        'auction_starting',
        'auction_ending',
        'lot_won',
        'registration_approved',
        'registration_rejected',
      ];

      // Verify each can be used as a valid NotificationType (compile-time check backed by runtime)
      for (const t of validTypes) {
        expect(typeof t).toBe('string');
      }
      expect(validTypes).toHaveLength(6);
    });
  });

  describe('NotificationMetadata type', () => {
    it('supports all optional fields', () => {
      const meta: NotificationMetadata = {
        lotId: 'lot-1',
        auctionId: 'auction-1',
        bidId: 'bid-1',
        lotTitle: 'Lot Title',
        lotUrl: '/lots/lot-1',
        auctionTitle: 'Auction Title',
        auctionUrl: '/auctions/auction-1',
        hammerPrice: 50000,
        buyersPremium: 10000,
        totalAmount: 60000,
        newBidAmount: 15000,
        startDate: '2026-01-01T00:00:00Z',
        paddleNumber: 42,
        rejectionReason: 'Invalid ID',
      };

      expect(meta.lotId).toBe('lot-1');
      expect(meta.hammerPrice).toBe(50000);
      expect(meta.paddleNumber).toBe(42);
    });
  });
});
