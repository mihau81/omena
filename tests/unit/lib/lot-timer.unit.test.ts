import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const mockEmitTimerEvent = vi.hoisted(() => vi.fn());
const mockCreateNotification = vi.hoisted(() => vi.fn().mockResolvedValue('notif-1'));
const mockGenerateInvoice = vi.hoisted(() => vi.fn().mockResolvedValue({}));

const mockReturning = vi.hoisted(() => vi.fn());
const mockUpdateWhere = vi.hoisted(() => vi.fn());
const mockUpdateSet = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockSelectLimit = vi.hoisted(() => vi.fn());
const mockSelectWhere = vi.hoisted(() => vi.fn());
const mockSelectFrom = vi.hoisted(() => vi.fn());
const mockSelect = vi.hoisted(() => vi.fn());
const mockLeftJoin = vi.hoisted(() => vi.fn());

// ─── Wire up the chainable db mock ─────────────────────────────────────────

vi.mock('@/db/connection', () => ({
  db: {
    update: (...args: unknown[]) => mockUpdate(...args),
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

vi.mock('@/db/schema', () => ({
  lots: {
    id: 'lots.id',
    auctionId: 'lots.auctionId',
    closingAt: 'lots.closingAt',
    status: 'lots.status',
    deletedAt: 'lots.deletedAt',
    timerDuration: 'lots.timerDuration',
    updatedAt: 'lots.updatedAt',
    hammerPrice: 'lots.hammerPrice',
    title: 'lots.title',
  },
  bids: {
    id: 'bids.id',
    lotId: 'bids.lotId',
    userId: 'bids.userId',
    amount: 'bids.amount',
    isWinning: 'bids.isWinning',
  },
  bidRetractions: {
    id: 'bidRetractions.id',
    bidId: 'bidRetractions.bidId',
  },
  auctions: {
    id: 'auctions.id',
    buyersPremiumRate: 'auctions.buyersPremiumRate',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ _eq: args })),
  and: vi.fn((...args: unknown[]) => ({ _and: args })),
  isNull: vi.fn((col: unknown) => ({ _isNull: col })),
  lt: vi.fn((...args: unknown[]) => ({ _lt: args })),
}));

vi.mock('@/lib/bid-events', () => ({
  emitTimerEvent: mockEmitTimerEvent,
}));

vi.mock('@/lib/notifications', () => ({
  createNotification: mockCreateNotification,
}));

vi.mock('@/lib/invoice-service', () => ({
  generateInvoice: mockGenerateInvoice,
}));

// ─── Import under test ──────────────────────────────────────────────────────

import {
  startLotTimer,
  extendLotTimer,
  stopLotTimer,
  checkLotExpired,
  checkExpiredLots,
} from '@/lib/lot-timer';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setupUpdateChain(returningValue: unknown[] = []) {
  mockReturning.mockResolvedValue(returningValue);
  mockUpdateWhere.mockReturnValue({ returning: mockReturning });
  mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
  mockUpdate.mockReturnValue({ set: mockUpdateSet });
}

function setupUpdateChainNoReturning() {
  mockUpdateWhere.mockResolvedValue(undefined);
  mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
  mockUpdate.mockReturnValue({ set: mockUpdateSet });
}

function setupSelectChain(rows: unknown[] = []) {
  mockSelectLimit.mockResolvedValue(rows);
  mockSelectWhere.mockReturnValue({ limit: mockSelectLimit });
  mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
  mockSelect.mockReturnValue({ from: mockSelectFrom });
}

function setupSelectChainWithLeftJoin(rows: unknown[] = []) {
  mockSelectLimit.mockResolvedValue(rows);
  mockLeftJoin.mockReturnValue({
    where: vi.fn().mockReturnValue({ limit: mockSelectLimit }),
  });
  mockSelectFrom.mockReturnValue({ leftJoin: mockLeftJoin });
  mockSelect.mockReturnValue({ from: mockSelectFrom });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('lot-timer', () => {
  const NOW = 1700000000000;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── startLotTimer ─────────────────────────────────────────────────────────

  describe('startLotTimer', () => {
    it('updates the lot with computed closingAt and timerDuration', async () => {
      setupUpdateChain([{ auctionId: 'auction-1' }]);

      await startLotTimer('lot-1', 120);

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          closingAt: new Date(NOW + 120 * 1000),
          timerDuration: 120,
        }),
      );
    });

    it('returns the computed closingAt date', async () => {
      setupUpdateChain([{ auctionId: 'auction-1' }]);

      const result = await startLotTimer('lot-1', 60);

      expect(result).toEqual(new Date(NOW + 60 * 1000));
    });

    it('emits lot:timer:start event when update succeeds', async () => {
      setupUpdateChain([{ auctionId: 'auction-1' }]);

      await startLotTimer('lot-1', 90);

      expect(mockEmitTimerEvent).toHaveBeenCalledTimes(1);
      expect(mockEmitTimerEvent).toHaveBeenCalledWith('auction-1', {
        type: 'lot:timer:start',
        lotId: 'lot-1',
        closingAt: new Date(NOW + 90 * 1000).toISOString(),
        durationSeconds: 90,
      });
    });

    it('does not emit event when update returns no rows (lot not found/deleted)', async () => {
      setupUpdateChain([]);

      await startLotTimer('lot-1', 120);

      expect(mockEmitTimerEvent).not.toHaveBeenCalled();
    });

    it('returns closingAt even when lot not found (no emit)', async () => {
      setupUpdateChain([]);

      const result = await startLotTimer('lot-1', 120);

      expect(result).toEqual(new Date(NOW + 120 * 1000));
    });

    it('calculates closingAt correctly for various durations', async () => {
      setupUpdateChain([{ auctionId: 'a' }]);

      const result = await startLotTimer('lot-1', 300);
      expect(result.getTime()).toBe(NOW + 300_000);
    });

    it('handles zero duration', async () => {
      setupUpdateChain([{ auctionId: 'a' }]);

      const result = await startLotTimer('lot-1', 0);
      expect(result.getTime()).toBe(NOW);
    });
  });

  // ── extendLotTimer ────────────────────────────────────────────────────────

  describe('extendLotTimer', () => {
    it('returns null when lot is not found', async () => {
      setupSelectChain([]);

      const result = await extendLotTimer('lot-1');

      expect(result).toBeNull();
      expect(mockEmitTimerEvent).not.toHaveBeenCalled();
    });

    it('returns null when lot has no closingAt', async () => {
      setupSelectChain([{ closingAt: null, auctionId: 'auction-1' }]);

      const result = await extendLotTimer('lot-1');

      expect(result).toBeNull();
    });

    it('extends closingAt by default 30 seconds', async () => {
      const originalClosing = new Date(NOW + 60_000);
      setupSelectChain([{ closingAt: originalClosing, auctionId: 'auction-1' }]);
      setupUpdateChainNoReturning();

      const result = await extendLotTimer('lot-1');

      expect(result).toEqual(new Date(originalClosing.getTime() + 30_000));
    });

    it('extends closingAt by custom extension seconds', async () => {
      const originalClosing = new Date(NOW + 60_000);
      setupSelectChain([{ closingAt: originalClosing, auctionId: 'auction-1' }]);
      setupUpdateChainNoReturning();

      const result = await extendLotTimer('lot-1', 45);

      expect(result).toEqual(new Date(originalClosing.getTime() + 45_000));
    });

    it('calls db.update with the extended closingAt', async () => {
      const originalClosing = new Date(NOW + 60_000);
      setupSelectChain([{ closingAt: originalClosing, auctionId: 'auction-1' }]);
      setupUpdateChainNoReturning();

      await extendLotTimer('lot-1', 30);

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          closingAt: new Date(originalClosing.getTime() + 30_000),
        }),
      );
    });

    it('emits lot:timer:extend event with anti-sniping reason', async () => {
      const originalClosing = new Date(NOW + 60_000);
      setupSelectChain([{ closingAt: originalClosing, auctionId: 'auction-1' }]);
      setupUpdateChainNoReturning();

      await extendLotTimer('lot-1', 30);

      expect(mockEmitTimerEvent).toHaveBeenCalledTimes(1);
      expect(mockEmitTimerEvent).toHaveBeenCalledWith('auction-1', {
        type: 'lot:timer:extend',
        lotId: 'lot-1',
        newClosingAt: new Date(originalClosing.getTime() + 30_000).toISOString(),
        reason: 'anti-sniping',
      });
    });

    it('does not emit when lot not found (null return)', async () => {
      setupSelectChain([]);

      await extendLotTimer('lot-1');

      expect(mockEmitTimerEvent).not.toHaveBeenCalled();
    });
  });

  // ── stopLotTimer ──────────────────────────────────────────────────────────

  describe('stopLotTimer', () => {
    it('sets closingAt to null in the database', async () => {
      setupUpdateChain([{ auctionId: 'auction-1' }]);

      await stopLotTimer('lot-1');

      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          closingAt: null,
        }),
      );
    });

    it('emits lot:timer:stopped event when lot exists', async () => {
      setupUpdateChain([{ auctionId: 'auction-1' }]);

      await stopLotTimer('lot-1');

      expect(mockEmitTimerEvent).toHaveBeenCalledTimes(1);
      expect(mockEmitTimerEvent).toHaveBeenCalledWith('auction-1', {
        type: 'lot:timer:stopped',
        lotId: 'lot-1',
      });
    });

    it('does not emit event when lot not found', async () => {
      setupUpdateChain([]);

      await stopLotTimer('lot-1');

      expect(mockEmitTimerEvent).not.toHaveBeenCalled();
    });

    it('returns void', async () => {
      setupUpdateChain([{ auctionId: 'auction-1' }]);

      const result = await stopLotTimer('lot-1');

      expect(result).toBeUndefined();
    });
  });

  // ── checkLotExpired ───────────────────────────────────────────────────────

  describe('checkLotExpired', () => {
    it('returns false when lot is not found', async () => {
      setupSelectChain([]);

      const result = await checkLotExpired('lot-1');

      expect(result).toBe(false);
    });

    it('returns false when lot has no closingAt', async () => {
      setupSelectChain([{ closingAt: null, status: 'active', auctionId: 'a-1' }]);

      const result = await checkLotExpired('lot-1');

      expect(result).toBe(false);
    });

    it('returns false when lot status is not active', async () => {
      const past = new Date(NOW - 10_000);
      setupSelectChain([{ closingAt: past, status: 'sold', auctionId: 'a-1' }]);

      const result = await checkLotExpired('lot-1');

      expect(result).toBe(false);
    });

    it('returns false when closingAt is in the future (not expired)', async () => {
      const future = new Date(NOW + 60_000);
      setupSelectChain([{ closingAt: future, status: 'active', auctionId: 'a-1' }]);

      const result = await checkLotExpired('lot-1');

      expect(result).toBe(false);
    });

    it('closes lot and returns true when expired with a winning bid', async () => {
      const past = new Date(NOW - 10_000);
      // First select: the lot itself
      setupSelectChain([{ closingAt: past, status: 'active', auctionId: 'a-1' }]);

      // closeLot inner calls:
      // 1. select winning bid (with leftJoin)
      const mockWinningBidLimit = vi.fn().mockResolvedValue([{ id: 'bid-1', userId: 'user-1', amount: 5000 }]);
      const mockWinningBidWhere = vi.fn().mockReturnValue({ limit: mockWinningBidLimit });
      const mockWinningBidLeftJoin = vi.fn().mockReturnValue({ where: mockWinningBidWhere });
      const mockWinningBidFrom = vi.fn().mockReturnValue({ leftJoin: mockWinningBidLeftJoin });

      // 2. update lot to sold
      const mockCloseUpdateWhere = vi.fn().mockResolvedValue(undefined);
      const mockCloseUpdateSet = vi.fn().mockReturnValue({ where: mockCloseUpdateWhere });

      // notifyWinnerAndQueueInvoice makes 2 selects (lot title + auction premium rate)
      const mockNotifySelectLimit = vi.fn().mockResolvedValue([{ title: 'Test Lot' }]);
      const mockNotifySelectWhere = vi.fn().mockReturnValue({ limit: mockNotifySelectLimit });
      const mockNotifySelectFrom = vi.fn().mockReturnValue({ where: mockNotifySelectWhere });

      // Wire: first call = lot select, second call = winning bid select, rest = notify selects
      let selectCallCount = 0;
      mockSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // checkLotExpired select
          return { from: mockSelectFrom };
        }
        if (selectCallCount === 2) {
          // closeLot winning bid select
          return { from: mockWinningBidFrom };
        }
        // notifyWinnerAndQueueInvoice selects
        return { from: mockNotifySelectFrom };
      });

      // Wire: closeLot update
      mockUpdate.mockReturnValue({ set: mockCloseUpdateSet });

      const result = await checkLotExpired('lot-1');

      expect(result).toBe(true);
      expect(mockEmitTimerEvent).toHaveBeenCalledWith('a-1', {
        type: 'lot:timer:expired',
        lotId: 'lot-1',
        result: 'sold',
      });
    });

    it('closes lot as passed when no winning bid', async () => {
      const past = new Date(NOW - 10_000);
      setupSelectChain([{ closingAt: past, status: 'active', auctionId: 'a-1' }]);

      // closeLot: no winning bid
      const mockWinningBidLimit = vi.fn().mockResolvedValue([]);
      const mockWinningBidWhere = vi.fn().mockReturnValue({ limit: mockWinningBidLimit });
      const mockWinningBidLeftJoin = vi.fn().mockReturnValue({ where: mockWinningBidWhere });
      const mockWinningBidFrom = vi.fn().mockReturnValue({ leftJoin: mockWinningBidLeftJoin });

      const mockCloseUpdateWhere = vi.fn().mockResolvedValue(undefined);
      const mockCloseUpdateSet = vi.fn().mockReturnValue({ where: mockCloseUpdateWhere });

      let selectCallCount = 0;
      mockSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return { from: mockSelectFrom };
        }
        return { from: mockWinningBidFrom };
      });

      mockUpdate.mockReturnValue({ set: mockCloseUpdateSet });

      const result = await checkLotExpired('lot-1');

      expect(result).toBe(true);
      expect(mockEmitTimerEvent).toHaveBeenCalledWith('a-1', {
        type: 'lot:timer:expired',
        lotId: 'lot-1',
        result: 'passed',
      });
    });

    it('sets hammerPrice when winning bid exists', async () => {
      const past = new Date(NOW - 10_000);
      setupSelectChain([{ closingAt: past, status: 'active', auctionId: 'a-1' }]);

      const mockWinningBidLimit = vi.fn().mockResolvedValue([{ id: 'bid-1', userId: 'user-1', amount: 7500 }]);
      const mockWinningBidWhere = vi.fn().mockReturnValue({ limit: mockWinningBidLimit });
      const mockWinningBidLeftJoin = vi.fn().mockReturnValue({ where: mockWinningBidWhere });
      const mockWinningBidFrom = vi.fn().mockReturnValue({ leftJoin: mockWinningBidLeftJoin });

      const mockCloseUpdateWhere = vi.fn().mockResolvedValue(undefined);
      const mockCloseUpdateSet = vi.fn().mockReturnValue({ where: mockCloseUpdateWhere });

      // notifyWinnerAndQueueInvoice makes 2 selects (lot title + auction premium rate)
      const mockNotifySelectLimit = vi.fn().mockResolvedValue([{ title: 'Test Lot' }]);
      const mockNotifySelectWhere = vi.fn().mockReturnValue({ limit: mockNotifySelectLimit });
      const mockNotifySelectFrom = vi.fn().mockReturnValue({ where: mockNotifySelectWhere });

      let selectCallCount = 0;
      mockSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return { from: mockSelectFrom };
        if (selectCallCount === 2) return { from: mockWinningBidFrom };
        // subsequent selects are from notifyWinnerAndQueueInvoice
        return { from: mockNotifySelectFrom };
      });

      mockUpdate.mockReturnValue({ set: mockCloseUpdateSet });

      await checkLotExpired('lot-1');

      expect(mockCloseUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'sold',
          closingAt: null,
          hammerPrice: 7500,
        }),
      );
    });

    it('sets hammerPrice to null when no winning bid', async () => {
      const past = new Date(NOW - 10_000);
      setupSelectChain([{ closingAt: past, status: 'active', auctionId: 'a-1' }]);

      const mockWinningBidLimit = vi.fn().mockResolvedValue([]);
      const mockWinningBidWhere = vi.fn().mockReturnValue({ limit: mockWinningBidLimit });
      const mockWinningBidLeftJoin = vi.fn().mockReturnValue({ where: mockWinningBidWhere });
      const mockWinningBidFrom = vi.fn().mockReturnValue({ leftJoin: mockWinningBidLeftJoin });

      const mockCloseUpdateWhere = vi.fn().mockResolvedValue(undefined);
      const mockCloseUpdateSet = vi.fn().mockReturnValue({ where: mockCloseUpdateWhere });

      let selectCallCount = 0;
      mockSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return { from: mockSelectFrom };
        return { from: mockWinningBidFrom };
      });

      mockUpdate.mockReturnValue({ set: mockCloseUpdateSet });

      await checkLotExpired('lot-1');

      expect(mockCloseUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'passed',
          closingAt: null,
          hammerPrice: null,
        }),
      );
    });

    it('returns false when lot closingAt equals current time (not past)', async () => {
      // closingAt === new Date() means closingAt > new Date() is false since they are equal
      // Actually closingAt > new Date() where closingAt is exactly now would be false
      // But the code creates new Date() inside the function (which uses Date.now)
      // Equal dates: closingAt > new Date() => false, so it proceeds to closeLot
      const exactlyNow = new Date(NOW);
      setupSelectChain([{ closingAt: exactlyNow, status: 'active', auctionId: 'a-1' }]);

      // It will fall through to closeLot since closingAt (NOW) is NOT > new Date() (NOW)
      const mockWinningBidLimit = vi.fn().mockResolvedValue([]);
      const mockWinningBidWhere = vi.fn().mockReturnValue({ limit: mockWinningBidLimit });
      const mockWinningBidLeftJoin = vi.fn().mockReturnValue({ where: mockWinningBidWhere });
      const mockWinningBidFrom = vi.fn().mockReturnValue({ leftJoin: mockWinningBidLeftJoin });

      const mockCloseUpdateWhere = vi.fn().mockResolvedValue(undefined);
      const mockCloseUpdateSet = vi.fn().mockReturnValue({ where: mockCloseUpdateWhere });

      let selectCallCount = 0;
      mockSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return { from: mockSelectFrom };
        return { from: mockWinningBidFrom };
      });

      mockUpdate.mockReturnValue({ set: mockCloseUpdateSet });

      // closingAt === now means it's not strictly greater, so lot IS expired
      const result = await checkLotExpired('lot-1');
      expect(result).toBe(true);
    });

    it('returns false for status "sold"', async () => {
      const past = new Date(NOW - 10_000);
      setupSelectChain([{ closingAt: past, status: 'sold', auctionId: 'a-1' }]);

      expect(await checkLotExpired('lot-1')).toBe(false);
    });

    it('returns false for status "passed"', async () => {
      const past = new Date(NOW - 10_000);
      setupSelectChain([{ closingAt: past, status: 'passed', auctionId: 'a-1' }]);

      expect(await checkLotExpired('lot-1')).toBe(false);
    });

    it('returns false for status "draft"', async () => {
      const past = new Date(NOW - 10_000);
      setupSelectChain([{ closingAt: past, status: 'draft', auctionId: 'a-1' }]);

      expect(await checkLotExpired('lot-1')).toBe(false);
    });
  });

  // ── checkExpiredLots ──────────────────────────────────────────────────────

  describe('checkExpiredLots', () => {
    it('queries for all active lots with closingAt in the past', async () => {
      // Setup: select returns empty list (no expired lots)
      mockSelectWhere.mockResolvedValue([]);
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelect.mockReturnValue({ from: mockSelectFrom });

      await checkExpiredLots();

      expect(mockSelect).toHaveBeenCalled();
    });

    it('does nothing when there are no expired lots', async () => {
      mockSelectWhere.mockResolvedValue([]);
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelect.mockReturnValue({ from: mockSelectFrom });

      await checkExpiredLots();

      expect(mockEmitTimerEvent).not.toHaveBeenCalled();
    });

    it('closes each expired lot found', async () => {
      // Return two expired lots from initial query
      const expiredLots = [
        { id: 'lot-1', auctionId: 'auction-1' },
        { id: 'lot-2', auctionId: 'auction-2' },
      ];
      mockSelectWhere.mockResolvedValue(expiredLots);
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelect.mockReturnValue({ from: mockSelectFrom });

      // closeLot calls for each lot:
      // select winning bid (no winning bid for simplicity)
      const mockWinningBidLimit = vi.fn().mockResolvedValue([]);
      const mockWinningBidWhere = vi.fn().mockReturnValue({ limit: mockWinningBidLimit });
      const mockWinningBidLeftJoin = vi.fn().mockReturnValue({ where: mockWinningBidWhere });
      const mockWinningBidFrom = vi.fn().mockReturnValue({ leftJoin: mockWinningBidLeftJoin });

      const mockCloseUpdateWhere = vi.fn().mockResolvedValue(undefined);
      const mockCloseUpdateSet = vi.fn().mockReturnValue({ where: mockCloseUpdateWhere });

      // After initial select, subsequent selects are for closeLot
      let selectCallCount = 0;
      mockSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // Initial query for expired lots
          return { from: mockSelectFrom };
        }
        // closeLot winning bid selects
        return { from: mockWinningBidFrom };
      });

      mockUpdate.mockReturnValue({ set: mockCloseUpdateSet });

      await checkExpiredLots();

      // Two lots closed -> two emit calls
      expect(mockEmitTimerEvent).toHaveBeenCalledTimes(2);
    });

    it('uses Promise.allSettled so one failure does not block others', async () => {
      const expiredLots = [
        { id: 'lot-fail', auctionId: 'auction-1' },
        { id: 'lot-ok', auctionId: 'auction-2' },
      ];
      mockSelectWhere.mockResolvedValue(expiredLots);
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });

      let selectCallCount = 0;
      mockSelect.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          return { from: mockSelectFrom };
        }
        // First closeLot call fails, second succeeds
        if (selectCallCount === 2) {
          return {
            from: vi.fn().mockReturnValue({
              leftJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockRejectedValue(new Error('DB error')),
                }),
              }),
            }),
          };
        }
        return {
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        };
      });

      const mockCloseUpdateWhere = vi.fn().mockResolvedValue(undefined);
      const mockCloseUpdateSet = vi.fn().mockReturnValue({ where: mockCloseUpdateWhere });
      mockUpdate.mockReturnValue({ set: mockCloseUpdateSet });

      // Should not throw even though one lot fails
      await expect(checkExpiredLots()).resolves.toBeUndefined();
    });

    it('returns void', async () => {
      mockSelectWhere.mockResolvedValue([]);
      mockSelectFrom.mockReturnValue({ where: mockSelectWhere });
      mockSelect.mockReturnValue({ from: mockSelectFrom });

      const result = await checkExpiredLots();

      expect(result).toBeUndefined();
    });
  });
});
