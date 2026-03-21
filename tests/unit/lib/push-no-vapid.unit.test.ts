/**
 * Tests for lib/push.ts when VAPID keys are NOT configured.
 * Covers lines 17 and 39-40 (ensureConfigured early return + sendPushToUser skip).
 * Must be in a separate file because VAPID env vars are set at module load time.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted setup: ensure VAPID env vars are ABSENT ─────────────────────────

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
  // Explicitly clear any VAPID env vars so the module loads without them
  delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  delete process.env.VAPID_EMAIL;

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

import { sendPushToUser, getVapidPublicKey } from '@/lib/push';

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('lib/push — VAPID not configured', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbSelectResult.length = 0;
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

  describe('getVapidPublicKey without env vars', () => {
    it('returns empty string when NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set', () => {
      const key = getVapidPublicKey();
      expect(key).toBe('');
    });
  });

  describe('sendPushToUser without VAPID configuration', () => {
    it('skips push delivery and does NOT call setVapidDetails when keys are absent', async () => {
      // Add a subscription so it would otherwise attempt sending
      mockDbSelectResult.push({
        id: 'sub-1',
        userId: 'user-1',
        endpoint: 'https://push.example.com/1',
        p256dh: 'p256dh',
        auth: 'auth',
        userAgent: null,
        createdAt: new Date(),
      });

      await sendPushToUser('user-1', { title: 'Test', body: 'Body' });

      // ensureConfigured returns early without calling setVapidDetails
      expect(mockSetVapidDetails).not.toHaveBeenCalled();
      // sendPushToUser returns early before querying DB
      expect(mockSendNotification).not.toHaveBeenCalled();
    });

    it('returns without throwing when VAPID keys are missing', async () => {
      await expect(
        sendPushToUser('user-1', { title: 'Test', body: 'Body' }),
      ).resolves.toBeUndefined();
    });

    it('does not query push subscriptions when not configured', async () => {
      await sendPushToUser('user-1', { title: 'Test', body: 'Body' });

      // DB should not be queried since we bail out early
      expect(mockSelect).not.toHaveBeenCalled();
    });
  });
});
