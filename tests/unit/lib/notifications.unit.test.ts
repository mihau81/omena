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
  getUnreadNotifications,
  getUserNotifications,
  markAsRead,
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

    it('attempts email delivery for auction_starting with complete metadata', async () => {
      await createNotification(
        'user-1',
        'auction_starting',
        'Auction Starting Soon',
        'The auction starts in 1 hour',
        {
          auctionTitle: 'Spring Auction 2026',
          startDate: '2026-04-01T10:00:00Z',
          auctionUrl: '/auctions/spring-2026',
        },
      );

      await vi.waitFor(() => {
        expect(mockQueueEmail).toHaveBeenCalled();
      });
    });

    it('does NOT send email for auction_starting when metadata is incomplete', async () => {
      await createNotification(
        'user-1',
        'auction_starting',
        'Auction Starting',
        'The auction starts soon',
        { auctionTitle: 'Spring Auction 2026' }, // missing startDate and auctionUrl
      );

      await new Promise((r) => setTimeout(r, 50));
      expect(mockQueueEmail).not.toHaveBeenCalled();
    });

    it('silently swallows email send errors (non-blocking)', async () => {
      mockQueueEmail.mockRejectedValueOnce(new Error('SMTP connection failed'));

      // Should not throw despite email failure
      const id = await createNotification(
        'user-1',
        'outbid',
        'Outbid',
        'Higher bid placed',
        { lotTitle: 'Lot 1', newBidAmount: 20000, lotUrl: '/lots/1' },
      );

      expect(id).toBe('notif-1');

      // Give time for async email attempt
      await new Promise((r) => setTimeout(r, 50));
    });

    it('silently swallows push send errors (non-blocking)', async () => {
      mockEnqueuePush.mockRejectedValueOnce(new Error('Push service down'));

      // Should not throw despite push failure
      const id = await createNotification(
        'user-1',
        'outbid',
        'Outbid',
        'Higher bid placed',
        { lotUrl: '/lots/1' },
      );

      expect(id).toBe('notif-1');

      await new Promise((r) => setTimeout(r, 50));
    });

    it('does NOT send email when user is not found', async () => {
      // db.select returns empty array (user not found)
      (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await createNotification(
        'unknown-user',
        'lot_won',
        'You won',
        'Congrats!',
        { lotTitle: 'Lot X', hammerPrice: 1000, buyersPremium: 200, totalAmount: 1200 },
      );

      await new Promise((r) => setTimeout(r, 50));
      expect(mockQueueEmail).not.toHaveBeenCalled();
    });

    it('uses lotUrl as push url when both lotUrl and auctionUrl present', async () => {
      await createNotification(
        'user-1',
        'outbid',
        'Outbid',
        'Higher bid',
        { lotUrl: '/lots/42', auctionUrl: '/auctions/spring' },
      );

      await vi.waitFor(() => {
        expect(mockEnqueuePush).toHaveBeenCalled();
      });

      expect(mockEnqueuePush).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({ url: '/lots/42' }),
        }),
      );
    });

    it('falls back to auctionUrl when lotUrl is absent', async () => {
      await createNotification(
        'user-1',
        'auction_starting',
        'Starting',
        'Auction starts now',
        { auctionUrl: '/auctions/spring' },
      );

      await vi.waitFor(() => {
        expect(mockEnqueuePush).toHaveBeenCalled();
      });

      expect(mockEnqueuePush).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({ url: '/auctions/spring' }),
        }),
      );
    });

    it('falls back to /account/notifications when no url in metadata', async () => {
      await createNotification(
        'user-1',
        'outbid',
        'Outbid',
        'Higher bid placed',
      );

      await vi.waitFor(() => {
        expect(mockEnqueuePush).toHaveBeenCalled();
      });

      expect(mockEnqueuePush).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({ url: '/account/notifications' }),
        }),
      );
    });
  });

  describe('getUnreadNotifications', () => {
    it('queries notifications for the given userId filtered by isRead=false', async () => {
      const mockOrderBy = vi.fn().mockResolvedValue([
        { id: 'notif-1', type: 'outbid', title: 'Outbid', body: 'Body', metadata: {}, isRead: false, createdAt: new Date() },
      ]);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom });

      const result = await getUnreadNotifications('user-1');

      expect(db.select).toHaveBeenCalled();
      expect(mockFrom).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalled();
      expect(mockOrderBy).toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
    });

    it('returns empty array when user has no unread notifications', async () => {
      const mockOrderBy = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom });

      const result = await getUnreadNotifications('user-no-notifs');

      expect(result).toEqual([]);
    });
  });

  describe('getUserNotifications', () => {
    it('returns paginated notifications for a user with default limit 50', async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom });

      await getUserNotifications('user-1');

      expect(mockLimit).toHaveBeenCalledWith(50);
    });

    it('respects custom limit parameter', async () => {
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      (db.select as ReturnType<typeof vi.fn>).mockReturnValue({ from: mockFrom });

      await getUserNotifications('user-1', 10);

      expect(mockLimit).toHaveBeenCalledWith(10);
    });
  });

  describe('markAsRead', () => {
    it('returns true when notification was found and updated', async () => {
      (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 'notif-1' }]),
          }),
        }),
      });

      const result = await markAsRead('notif-1', 'user-1');
      expect(result).toBe(true);
    });

    it('returns false when notification does not exist or belongs to different user', async () => {
      (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      const result = await markAsRead('notif-missing', 'user-1');
      expect(result).toBe(false);
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
