import { describe, it, expect, vi, beforeEach } from 'vitest';

// Set VAPID env vars BEFORE module loads (vi.hoisted runs before imports)
const {
  mockSendNotification,
  mockSetVapidDetails,
  mockSelect,
  mockFrom,
  mockWhere,
  mockDelete,
  mockDeleteWhere,
  mockInsert,
  mockValues,
  mockOnConflictDoUpdate,
  mockDbSelectResult,
} = vi.hoisted(() => {
  // Set env vars so the push module picks them up at load time
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'BNtest-public-key-for-vapid-testing-purposes-1234567890';
  process.env.VAPID_PRIVATE_KEY = 'test-private-key-for-vapid-1234567890abcdef';
  process.env.VAPID_EMAIL = 'mailto:test@omenaa.pl';

  const result: Array<{
    id: string;
    userId: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    userAgent: string | null;
    createdAt: Date;
  }> = [];

  const deleteWhere = vi.fn().mockResolvedValue(undefined);
  const where = vi.fn().mockImplementation(() => Promise.resolve(result));
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });
  const del = vi.fn().mockReturnValue({ where: deleteWhere });
  const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
  const insert = vi.fn().mockReturnValue({ values });

  return {
    mockSendNotification: vi.fn().mockResolvedValue({ statusCode: 201 }),
    mockSetVapidDetails: vi.fn(),
    mockSelect: select,
    mockFrom: from,
    mockWhere: where,
    mockDelete: del,
    mockDeleteWhere: deleteWhere,
    mockInsert: insert,
    mockValues: values,
    mockOnConflictDoUpdate: onConflictDoUpdate,
    mockDbSelectResult: result,
  };
});

vi.mock('web-push', () => ({
  default: {
    setVapidDetails: mockSetVapidDetails,
    sendNotification: mockSendNotification,
  },
  setVapidDetails: mockSetVapidDetails,
  sendNotification: mockSendNotification,
}));

vi.mock('@/db/connection', () => ({
  db: {
    select: mockSelect,
    delete: mockDelete,
    insert: mockInsert,
  },
}));

vi.mock('@/db/schema', () => ({
  pushSubscriptions: {
    id: 'id',
    userId: 'user_id',
    endpoint: 'endpoint',
    p256dh: 'p256dh',
    auth: 'auth',
    userAgent: 'user_agent',
    createdAt: 'created_at',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: unknown, val: unknown) => ({ type: 'eq', value: val })),
  inArray: vi.fn((_col: unknown, vals: unknown) => ({ type: 'inArray', values: vals })),
}));

// ─── Import after mocks ──────────────────────────────────────────────────────

import {
  sendPushToUser,
  saveSubscription,
  deleteSubscription,
  getVapidPublicKey,
} from '@/lib/push';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSub(overrides?: Record<string, unknown>) {
  return {
    id: 'sub-1',
    userId: 'user-1',
    endpoint: 'https://push.example.com/sub1',
    p256dh: 'p256dh-key-1',
    auth: 'auth-secret-1',
    userAgent: 'Mozilla/5.0',
    createdAt: new Date(),
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('lib/push', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbSelectResult.length = 0;
    // Re-wire the chainable mocks (clearAllMocks resets return values)
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockImplementation(() => Promise.resolve(mockDbSelectResult));
    mockDelete.mockReturnValue({ where: mockDeleteWhere });
    mockDeleteWhere.mockResolvedValue(undefined);
    mockInsert.mockReturnValue({ values: mockValues });
    mockValues.mockReturnValue({ onConflictDoUpdate: mockOnConflictDoUpdate });
    mockOnConflictDoUpdate.mockResolvedValue(undefined);
    mockSendNotification.mockResolvedValue({ statusCode: 201 });
  });

  // ── getVapidPublicKey ──────────────────────────────────────────────────

  describe('getVapidPublicKey', () => {
    it('returns the VAPID public key from environment', () => {
      const key = getVapidPublicKey();
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);
    });

    it('returns the key set via NEXT_PUBLIC_VAPID_PUBLIC_KEY', () => {
      const key = getVapidPublicKey();
      expect(key).toBe('BNtest-public-key-for-vapid-testing-purposes-1234567890');
    });
  });

  // ── sendPushToUser ─────────────────────────────────────────────────────

  describe('sendPushToUser', () => {
    it('calls setVapidDetails on first invocation', async () => {
      mockDbSelectResult.push(makeSub());

      await sendPushToUser('user-1', { title: 'Test', body: 'Body' });

      expect(mockSetVapidDetails).toHaveBeenCalledWith(
        'mailto:test@omenaa.pl',
        'BNtest-public-key-for-vapid-testing-purposes-1234567890',
        'test-private-key-for-vapid-1234567890abcdef',
      );
    });

    it('returns early when user has no subscriptions', async () => {
      mockDbSelectResult.length = 0;

      await sendPushToUser('user-no-subs', { title: 'Test', body: 'Body' });

      expect(mockSendNotification).not.toHaveBeenCalled();
    });

    it('queries push subscriptions for the specified user', async () => {
      mockDbSelectResult.length = 0;

      await sendPushToUser('user-query', { title: 'Test', body: 'Body' });

      expect(mockSelect).toHaveBeenCalled();
      expect(mockFrom).toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalled();
    });

    it('sends notification to each user subscription', async () => {
      const sub1 = makeSub({ id: 'sub-1', endpoint: 'https://push.example.com/1' });
      const sub2 = makeSub({ id: 'sub-2', endpoint: 'https://push.example.com/2' });
      mockDbSelectResult.push(sub1, sub2);

      await sendPushToUser('user-1', { title: 'Outbid', body: 'You have been outbid' });

      expect(mockSendNotification).toHaveBeenCalledTimes(2);
    });

    it('sends correct push subscription object to web-push', async () => {
      const sub = makeSub({
        endpoint: 'https://push.example.com/test',
        p256dh: 'test-p256dh',
        auth: 'test-auth',
      });
      mockDbSelectResult.push(sub);

      await sendPushToUser('user-1', { title: 'Hello', body: 'World' });

      expect(mockSendNotification).toHaveBeenCalledWith(
        {
          endpoint: 'https://push.example.com/test',
          keys: { p256dh: 'test-p256dh', auth: 'test-auth' },
        },
        expect.any(String),
      );
    });

    it('serializes payload as JSON string', async () => {
      const sub = makeSub();
      mockDbSelectResult.push(sub);
      const payload = { title: 'Test Title', body: 'Test Body', url: '/some/path' };

      await sendPushToUser('user-1', payload);

      const sentBody = mockSendNotification.mock.calls[0][1];
      const parsed = JSON.parse(sentBody);
      expect(parsed.title).toBe('Test Title');
      expect(parsed.body).toBe('Test Body');
      expect(parsed.url).toBe('/some/path');
    });

    it('handles payload with all optional fields', async () => {
      const sub = makeSub();
      mockDbSelectResult.push(sub);

      const payload = {
        title: 'Auction ending',
        body: 'Lot #42 closing in 5 minutes',
        url: '/en/auctions/1/lots/42',
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        tag: 'auction-ending-42',
      };

      await sendPushToUser('user-1', payload);

      const sentBody = JSON.parse(mockSendNotification.mock.calls[0][1]);
      expect(sentBody.icon).toBe('/icon-192.png');
      expect(sentBody.badge).toBe('/badge-72.png');
      expect(sentBody.tag).toBe('auction-ending-42');
    });

    it('cleans up expired subscriptions with 410 status', async () => {
      const sub = makeSub({ id: 'dead-sub' });
      mockDbSelectResult.push(sub);

      mockSendNotification.mockRejectedValueOnce({ statusCode: 410 });

      await sendPushToUser('user-1', { title: 'Test', body: 'Body' });

      // Should delete the dead subscription
      expect(mockDelete).toHaveBeenCalled();
      expect(mockDeleteWhere).toHaveBeenCalled();
    });

    it('cleans up subscriptions with 404 status', async () => {
      const sub = makeSub({ id: 'not-found-sub' });
      mockDbSelectResult.push(sub);

      mockSendNotification.mockRejectedValueOnce({ statusCode: 404 });

      await sendPushToUser('user-1', { title: 'Test', body: 'Body' });

      expect(mockDelete).toHaveBeenCalled();
    });

    it('does not delete subscriptions for non-404/410 errors', async () => {
      const sub = makeSub({ id: 'temp-error-sub' });
      mockDbSelectResult.push(sub);

      mockSendNotification.mockRejectedValueOnce({ statusCode: 500 });

      await sendPushToUser('user-1', { title: 'Test', body: 'Body' });

      // 500 is not a dead subscription, should NOT call delete
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it('does not throw when sendNotification rejects with unknown error', async () => {
      const sub = makeSub();
      mockDbSelectResult.push(sub);

      mockSendNotification.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        sendPushToUser('user-1', { title: 'Test', body: 'Body' }),
      ).resolves.toBeUndefined();
    });

    it('handles multiple subscriptions with mixed results', async () => {
      const sub1 = makeSub({ id: 'sub-ok', endpoint: 'https://push.example.com/1' });
      const sub2 = makeSub({ id: 'sub-dead', endpoint: 'https://push.example.com/2' });
      const sub3 = makeSub({ id: 'sub-err', endpoint: 'https://push.example.com/3' });
      mockDbSelectResult.push(sub1, sub2, sub3);

      mockSendNotification
        .mockResolvedValueOnce({ statusCode: 201 })  // sub1: success
        .mockRejectedValueOnce({ statusCode: 410 })  // sub2: expired
        .mockRejectedValueOnce(new Error('timeout')); // sub3: transient error

      await sendPushToUser('user-1', { title: 'Test', body: 'Body' });

      expect(mockSendNotification).toHaveBeenCalledTimes(3);
      // Only sub2 (410) should be cleaned up
      expect(mockDelete).toHaveBeenCalled();
    });
  });

  // ── saveSubscription ───────────────────────────────────────────────────

  describe('saveSubscription', () => {
    it('inserts a new subscription into the database', async () => {
      await saveSubscription(
        'user-1',
        'https://push.example.com/sub1',
        'p256dh-key',
        'auth-secret',
        'Mozilla/5.0',
      );

      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith({
        userId: 'user-1',
        endpoint: 'https://push.example.com/sub1',
        p256dh: 'p256dh-key',
        auth: 'auth-secret',
        userAgent: 'Mozilla/5.0',
      });
    });

    it('uses upsert on conflict by endpoint', async () => {
      await saveSubscription(
        'user-1',
        'https://push.example.com/sub1',
        'p256dh-key-new',
        'auth-secret-new',
      );

      expect(mockOnConflictDoUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.anything(),
          set: expect.objectContaining({
            userId: 'user-1',
            p256dh: 'p256dh-key-new',
            auth: 'auth-secret-new',
          }),
        }),
      );
    });

    it('handles undefined userAgent', async () => {
      await saveSubscription(
        'user-1',
        'https://push.example.com/sub1',
        'p256dh',
        'auth',
      );

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          userAgent: undefined,
        }),
      );
    });

    it('passes the correct values for upsert set clause', async () => {
      await saveSubscription(
        'user-2',
        'https://push.example.com/sub2',
        'key-2',
        'secret-2',
        'Safari/605',
      );

      expect(mockOnConflictDoUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          set: expect.objectContaining({
            userId: 'user-2',
            p256dh: 'key-2',
            auth: 'secret-2',
            userAgent: 'Safari/605',
          }),
        }),
      );
    });

    it('handles different endpoint formats', async () => {
      await saveSubscription(
        'user-1',
        'https://fcm.googleapis.com/fcm/send/abc123',
        'p256dh',
        'auth',
        'Chrome/120',
      );

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
        }),
      );
    });
  });

  // ── deleteSubscription ─────────────────────────────────────────────────

  describe('deleteSubscription', () => {
    it('deletes subscription by endpoint', async () => {
      await deleteSubscription('https://push.example.com/sub1');

      expect(mockDelete).toHaveBeenCalled();
      expect(mockDeleteWhere).toHaveBeenCalled();
    });

    it('handles different endpoint URLs', async () => {
      await deleteSubscription('https://fcm.googleapis.com/fcm/send/abc123');

      expect(mockDelete).toHaveBeenCalled();
      expect(mockDeleteWhere).toHaveBeenCalled();
    });

    it('does not throw when deleting non-existent subscription', async () => {
      mockDeleteWhere.mockResolvedValueOnce(undefined);

      await expect(
        deleteSubscription('https://push.example.com/nonexistent'),
      ).resolves.toBeUndefined();
    });

    it('calls delete exactly once per invocation', async () => {
      await deleteSubscription('https://push.example.com/sub1');

      expect(mockDelete).toHaveBeenCalledTimes(1);
      expect(mockDeleteWhere).toHaveBeenCalledTimes(1);
    });
  });
});
