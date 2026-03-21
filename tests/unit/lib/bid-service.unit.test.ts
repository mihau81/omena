/**
 * Unit tests for lib/bid-service.ts
 * Covers: placeBid, getBidHistory, getWinningBid, isUserWinning
 * Target: 84% → 95%+ branch/line coverage
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock pool ───────────────────────────────────────────────────────────────

const mockClientQuery = vi.fn();
const mockClientRelease = vi.fn();

vi.mock('@/db/connection', () => ({
  db: {
    select: (...args: unknown[]) => mockDbSelect(...args),
  },
  pool: {
    connect: () =>
      Promise.resolve({
        query: (...args: unknown[]) => mockClientQuery(...args),
        release: (...args: unknown[]) => mockClientRelease(...args),
      }),
  },
}));

// ─── Mock DB (drizzle) ───────────────────────────────────────────────────────

// We use a factory approach so each test can control exactly which queries return what
let dbSelectQueue: Array<unknown[]> = [];

function mockDbSelect() {
  // Return a chainable object that resolves from the queue
  const self = {
    from: () => self,
    where: () => self,
    innerJoin: () => self,
    leftJoin: () => self,
    orderBy: () => self,
    limit: () => {
      const result = dbSelectQueue.shift() ?? [];
      return Promise.resolve(result);
    },
  };
  return self;
}

vi.mock('@/db/schema', () => ({
  bids: {
    id: 'id', lotId: 'lotId', userId: 'userId', amount: 'amount',
    bidType: 'bidType', paddleNumber: 'paddleNumber', isWinning: 'isWinning',
    createdAt: 'createdAt',
  },
  bidRetractions: { id: 'id', bidId: 'bidId' },
  lots: {
    id: 'id', title: 'title', auctionId: 'auctionId', status: 'status',
    startingBid: 'startingBid', closingAt: 'closingAt', deletedAt: 'deletedAt',
  },
  auctions: { id: 'id', slug: 'slug', status: 'status' },
  users: { id: 'id', isActive: 'isActive', deletedAt: 'deletedAt' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ _eq: args })),
  and: vi.fn((...args: unknown[]) => ({ _and: args })),
  desc: vi.fn((col: unknown) => ({ _desc: col })),
  isNull: vi.fn((col: unknown) => ({ _isNull: col })),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ _sql: strings, values })),
}));

// ─── Mock dependencies ───────────────────────────────────────────────────────

const mockGetNextMinBid = vi.fn((amount: number) => amount + 100);
const mockIsValidBidAmount = vi.fn(() => true);

vi.mock('@/app/lib/bidding', () => ({
  getNextMinBid: (...args: unknown[]) => mockGetNextMinBid(...args as [number]),
  isValidBidAmount: (...args: unknown[]) => mockIsValidBidAmount(...args as [number, number]),
}));

vi.mock('@/lib/audit', () => ({
  logCreate: vi.fn().mockResolvedValue(undefined),
  logUpdate: vi.fn().mockResolvedValue(undefined),
  logDelete: vi.fn().mockResolvedValue(undefined),
}));

const mockEmitBid = vi.fn();
vi.mock('@/lib/bid-events', () => ({
  emitBid: (...args: unknown[]) => mockEmitBid(...args),
}));

const mockExtendLotTimer = vi.fn().mockResolvedValue(null);
vi.mock('@/lib/lot-timer', () => ({
  extendLotTimer: (...args: unknown[]) => mockExtendLotTimer(...args),
}));

const mockProcessAbsenteeBids = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/absentee-service', () => ({
  processAbsenteeBids: (...args: unknown[]) => mockProcessAbsenteeBids(...args),
}));

const mockCreateNotification = vi.fn().mockResolvedValue('notif-1');
vi.mock('@/lib/notifications', () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}));

vi.mock('@/lib/token-service', () => ({
  getBaseUrl: vi.fn(() => 'http://localhost:3002/omenaa'),
}));

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ACTIVE_USER = { id: 'user-1', isActive: true };
const INACTIVE_USER = { id: 'user-2', isActive: false };

const LIVE_LOT = {
  lotId: 'lot-1',
  lotTitle: 'Test Artwork',
  lotStatus: 'active',
  auctionId: 'auction-1',
  auctionSlug: 'test-auction',
  auctionStatus: 'live',
  startingBid: 1000,
  closingAt: null as Date | null,
};

function makeBidRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bid-new',
    lot_id: 'lot-1',
    user_id: 'user-1',
    amount: 1000,
    bid_type: 'online',
    is_winning: true,
    created_at: new Date('2026-01-01T10:00:00Z'),
    ...overrides,
  };
}

// ─── Setup helpers ───────────────────────────────────────────────────────────

/**
 * Sets up the db select queue for a placeBid call:
 *   1st .limit() → user lookup result
 *   2nd .limit() → lot + auction lookup result (via innerJoin)
 *   3rd .limit() → current highest bid lookup (via leftJoin + orderBy)
 *
 * The pool client mock (mockClientQuery) must also be configured by the caller.
 */
function setupDbQueue(
  userResult: unknown[],
  lotResult: unknown[],
  highestBidResult: unknown[],
) {
  dbSelectQueue = [userResult, lotResult, highestBidResult];
}

function setupSuccessfulClientQueries(insertedBid = makeBidRow()) {
  mockClientQuery
    .mockResolvedValueOnce(undefined)                     // BEGIN
    .mockResolvedValueOnce(undefined)                     // advisory lock
    .mockResolvedValueOnce({ rows: [insertedBid] })       // INSERT ... RETURNING
    .mockResolvedValueOnce(undefined);                    // COMMIT
}

function setupSuccessfulClientQueriesWithUpdate(insertedBid = makeBidRow()) {
  mockClientQuery
    .mockResolvedValueOnce(undefined)                     // BEGIN
    .mockResolvedValueOnce(undefined)                     // advisory lock
    .mockResolvedValueOnce(undefined)                     // UPDATE bids SET is_winning = false
    .mockResolvedValueOnce({ rows: [insertedBid] })       // INSERT ... RETURNING
    .mockResolvedValueOnce(undefined);                    // COMMIT
}

// ─── Tests: placeBid ─────────────────────────────────────────────────────────

describe('placeBid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbSelectQueue = [];
    mockGetNextMinBid.mockImplementation((amount: number) => amount + 100);
    mockIsValidBidAmount.mockReturnValue(true);
  });

  it('returns bid result on successful first bid (no prior bids)', async () => {
    setupDbQueue([ACTIVE_USER], [LIVE_LOT], []);
    setupSuccessfulClientQueries();

    const { placeBid } = await import('@/lib/bid-service');
    const result = await placeBid('lot-1', 'user-1', 1000);

    expect(result.bid.id).toBe('bid-new');
    expect(result.bid.amount).toBe(1000);
    expect(result.bid.isWinning).toBe(true);
    expect(result.nextMinBid).toBe(1100);
    expect(mockClientRelease).toHaveBeenCalled();
  });

  it('throws NOT_AUTHENTICATED when user is not found', async () => {
    setupDbQueue([], [], []);
    mockClientQuery
      .mockResolvedValueOnce(undefined)   // BEGIN
      .mockResolvedValueOnce(undefined)   // advisory lock
      .mockResolvedValueOnce(undefined);  // ROLLBACK

    const { placeBid, BidError } = await import('@/lib/bid-service');

    let caught: unknown;
    try {
      await placeBid('lot-1', 'unknown-user', 1000);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(BidError);
    expect((caught as InstanceType<typeof BidError>).code).toBe('NOT_AUTHENTICATED');
    expect((caught as InstanceType<typeof BidError>).statusCode).toBe(401);
    expect(mockClientRelease).toHaveBeenCalled();
  });

  it('throws USER_INACTIVE when user account is not active', async () => {
    setupDbQueue([INACTIVE_USER], [], []);
    mockClientQuery
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined); // ROLLBACK

    const { placeBid, BidError } = await import('@/lib/bid-service');

    let caught: unknown;
    try {
      await placeBid('lot-1', 'user-2', 1000);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(BidError);
    expect((caught as InstanceType<typeof BidError>).code).toBe('USER_INACTIVE');
    expect((caught as InstanceType<typeof BidError>).statusCode).toBe(403);
  });

  it('throws LOT_NOT_ACTIVE (lot not found) when lot query returns empty', async () => {
    setupDbQueue([ACTIVE_USER], [], []);
    mockClientQuery
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined); // ROLLBACK

    const { placeBid, BidError } = await import('@/lib/bid-service');

    let caught: unknown;
    try {
      await placeBid('lot-not-found', 'user-1', 1000);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(BidError);
    const err = caught as InstanceType<typeof BidError>;
    expect(err.code).toBe('LOT_NOT_ACTIVE');
    expect(err.statusCode).toBe(400);
    expect(err.message).toContain('Lot not found');
  });

  it('throws AUCTION_NOT_LIVE when auction status is not live', async () => {
    const draftLot = { ...LIVE_LOT, auctionStatus: 'draft' };
    setupDbQueue([ACTIVE_USER], [draftLot], []);
    mockClientQuery
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined); // ROLLBACK

    const { placeBid, BidError } = await import('@/lib/bid-service');

    let caught: unknown;
    try {
      await placeBid('lot-1', 'user-1', 1000);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(BidError);
    const err = caught as InstanceType<typeof BidError>;
    expect(err.code).toBe('AUCTION_NOT_LIVE');
    expect(err.statusCode).toBe(400);
  });

  it('throws LOT_NOT_ACTIVE when lot status is not active', async () => {
    const closedLot = { ...LIVE_LOT, lotStatus: 'closed' };
    setupDbQueue([ACTIVE_USER], [closedLot], []);
    mockClientQuery
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined); // ROLLBACK

    const { placeBid, BidError } = await import('@/lib/bid-service');

    let caught: unknown;
    try {
      await placeBid('lot-1', 'user-1', 1000);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(BidError);
    const err = caught as InstanceType<typeof BidError>;
    expect(err.code).toBe('LOT_NOT_ACTIVE');
    expect(err.message).toContain('not active for bidding');
  });

  it('throws ALREADY_WINNING when user already has the highest bid', async () => {
    const currentHighest = { amount: 1000, userId: 'user-1', id: 'bid-old' };
    setupDbQueue([ACTIVE_USER], [LIVE_LOT], [currentHighest]);
    mockClientQuery
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined); // ROLLBACK

    const { placeBid, BidError } = await import('@/lib/bid-service');

    let caught: unknown;
    try {
      await placeBid('lot-1', 'user-1', 1200);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(BidError);
    const err = caught as InstanceType<typeof BidError>;
    expect(err.code).toBe('ALREADY_WINNING');
    expect(err.statusCode).toBe(409);
  });

  it('throws BID_TOO_LOW when amount is below starting bid (no prior bids)', async () => {
    // startingBid=1000, amount=500, getNextMinBid(0)=100
    // minBid = Math.max(startingBid, getNextMinBid(0)) → via code: startingBid ?? getNextMinBid(0)
    // Since startingBid=1000, minBid=1000, amount=500 < 1000 → BID_TOO_LOW
    const lotWithHighStarting = { ...LIVE_LOT, startingBid: 1000 };
    setupDbQueue([ACTIVE_USER], [lotWithHighStarting], []);
    mockClientQuery
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined); // ROLLBACK

    const { placeBid, BidError } = await import('@/lib/bid-service');

    let caught: unknown;
    try {
      await placeBid('lot-1', 'user-1', 500);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(BidError);
    const err = caught as InstanceType<typeof BidError>;
    expect(err.code).toBe('BID_TOO_LOW');
    expect(err.statusCode).toBe(400);
    expect(err.message).toContain('1000');
  });

  it('throws BID_TOO_LOW (increment violation) when isValidBidAmount returns false — covers lines 158-165', async () => {
    // currentHighestAmount=1000, amount=1050 (>= minBid=1100? no, but we want to test the branch)
    // Actually: amount=1100 >= minBid=1100, but isValidBidAmount returns false
    const currentHighest = { amount: 1000, userId: 'user-2', id: 'bid-old' };
    mockGetNextMinBid.mockReturnValue(1100); // minBid = 1100
    mockIsValidBidAmount.mockReturnValue(false); // increment rule violated

    setupDbQueue([ACTIVE_USER], [LIVE_LOT], [currentHighest]);
    mockClientQuery
      .mockResolvedValueOnce(undefined)  // BEGIN
      .mockResolvedValueOnce(undefined)  // advisory lock
      .mockResolvedValueOnce(undefined); // ROLLBACK

    const { placeBid, BidError } = await import('@/lib/bid-service');

    let caught: unknown;
    try {
      await placeBid('lot-1', 'user-1', 1100);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(BidError);
    const err = caught as InstanceType<typeof BidError>;
    expect(err.code).toBe('BID_TOO_LOW');
    expect(err.message).toContain('minimum increment applies');
    expect(err.statusCode).toBe(400);
  });

  it('extends lot timer when closingAt is within 30 seconds — covers lines 217-221', async () => {
    const closingAt = new Date(Date.now() + 15000); // 15s in the future
    const lotWithTimer = { ...LIVE_LOT, closingAt };

    setupDbQueue([ACTIVE_USER], [lotWithTimer], []);
    setupSuccessfulClientQueries();

    const { placeBid } = await import('@/lib/bid-service');
    await placeBid('lot-1', 'user-1', 1000);

    await new Promise((r) => setTimeout(r, 0));
    expect(mockExtendLotTimer).toHaveBeenCalledWith('lot-1', 30);
  });

  it('does NOT extend timer when closingAt is more than 30 seconds away', async () => {
    const closingAt = new Date(Date.now() + 120000); // 2 min away
    const lotWithTimer = { ...LIVE_LOT, closingAt };

    setupDbQueue([ACTIVE_USER], [lotWithTimer], []);
    setupSuccessfulClientQueries();

    const { placeBid } = await import('@/lib/bid-service');
    await placeBid('lot-1', 'user-1', 1000);

    await new Promise((r) => setTimeout(r, 0));
    expect(mockExtendLotTimer).not.toHaveBeenCalled();
  });

  it('does NOT extend timer when closingAt is null', async () => {
    // LIVE_LOT has closingAt: null
    setupDbQueue([ACTIVE_USER], [LIVE_LOT], []);
    setupSuccessfulClientQueries();

    const { placeBid } = await import('@/lib/bid-service');
    await placeBid('lot-1', 'user-1', 1000);

    await new Promise((r) => setTimeout(r, 0));
    expect(mockExtendLotTimer).not.toHaveBeenCalled();
  });

  it('does NOT extend timer when closingAt is in the past (secondsRemaining <= 0)', async () => {
    const closingAt = new Date(Date.now() - 5000); // 5s in the past
    const lotExpired = { ...LIVE_LOT, closingAt };

    setupDbQueue([ACTIVE_USER], [lotExpired], []);
    setupSuccessfulClientQueries();

    const { placeBid } = await import('@/lib/bid-service');
    await placeBid('lot-1', 'user-1', 1000);

    await new Promise((r) => setTimeout(r, 0));
    expect(mockExtendLotTimer).not.toHaveBeenCalled();
  });

  it('sends outbid notification when a previous winner exists — covers lines 228-243', async () => {
    const previousWinner = { amount: 1000, userId: 'user-2', id: 'bid-old' };
    setupDbQueue([ACTIVE_USER], [LIVE_LOT], [previousWinner]);
    setupSuccessfulClientQueriesWithUpdate(makeBidRow({ amount: 1100, user_id: 'user-1' }));

    const { placeBid } = await import('@/lib/bid-service');
    await placeBid('lot-1', 'user-1', 1100);

    await new Promise((r) => setTimeout(r, 0));
    expect(mockCreateNotification).toHaveBeenCalledWith(
      'user-2',
      'outbid',
      'Przebito Twoje najwyższe podbicie',
      expect.stringContaining('przelicytował'),
      expect.objectContaining({ lotId: 'lot-1' }),
    );
  });

  it('updates is_winning on previous bid when outbidding', async () => {
    const previousWinner = { amount: 1000, userId: 'user-2', id: 'bid-old' };
    setupDbQueue([ACTIVE_USER], [LIVE_LOT], [previousWinner]);
    setupSuccessfulClientQueriesWithUpdate(makeBidRow({ amount: 1100 }));

    const { placeBid } = await import('@/lib/bid-service');
    const result = await placeBid('lot-1', 'user-1', 1100);

    // The UPDATE query is the 3rd pool client call (index 2): BEGIN=0, advisory lock=1, UPDATE=2
    const updateCall = mockClientQuery.mock.calls[2];
    expect(updateCall[0]).toContain('UPDATE bids SET is_winning = false');
    expect(result.bid.isWinning).toBe(true);
  });

  it('passes ipAddress and userAgent through to the INSERT query', async () => {
    setupDbQueue([ACTIVE_USER], [LIVE_LOT], []);
    setupSuccessfulClientQueries();

    const { placeBid } = await import('@/lib/bid-service');
    await placeBid('lot-1', 'user-1', 1000, '10.0.0.1', 'Mozilla/5.0');

    const insertCall = mockClientQuery.mock.calls.find((c) =>
      typeof c[0] === 'string' && c[0].includes('INSERT INTO bids'),
    );
    expect(insertCall).toBeDefined();
    expect(insertCall![1]).toContain('10.0.0.1');
    expect(insertCall![1]).toContain('Mozilla/5.0');
  });

  it('uses null for ipAddress and userAgent when omitted', async () => {
    setupDbQueue([ACTIVE_USER], [LIVE_LOT], []);
    setupSuccessfulClientQueries();

    const { placeBid } = await import('@/lib/bid-service');
    await placeBid('lot-1', 'user-1', 1000);

    const insertCall = mockClientQuery.mock.calls.find((c) =>
      typeof c[0] === 'string' && c[0].includes('INSERT INTO bids'),
    );
    expect(insertCall).toBeDefined();
    const params = insertCall![1] as unknown[];
    // ipAddress is param index 5 (0-based), userAgent is index 6
    expect(params[5]).toBeNull();
    expect(params[6]).toBeNull();
  });

  it('emits bid event after successful placement', async () => {
    setupDbQueue([ACTIVE_USER], [LIVE_LOT], []);
    setupSuccessfulClientQueries();

    const { placeBid } = await import('@/lib/bid-service');
    await placeBid('lot-1', 'user-1', 1000);

    expect(mockEmitBid).toHaveBeenCalledWith(
      'auction-1',
      expect.objectContaining({
        lotId: 'lot-1',
        amount: 1000,
        isWinning: true,
      }),
    );
  });

  it('rolls back and re-throws on unexpected error', async () => {
    setupDbQueue([ACTIVE_USER], [LIVE_LOT], []);
    mockClientQuery
      .mockResolvedValueOnce(undefined)          // BEGIN
      .mockResolvedValueOnce(undefined)          // advisory lock
      .mockRejectedValueOnce(new Error('DB connection lost'))  // INSERT fails
      .mockResolvedValueOnce(undefined);         // ROLLBACK

    const { placeBid } = await import('@/lib/bid-service');

    await expect(placeBid('lot-1', 'user-1', 1000)).rejects.toThrow('DB connection lost');
    expect(mockClientRelease).toHaveBeenCalled();
  });

  it('uses startingBid as minBid when there are no prior bids and startingBid is set', async () => {
    const lotWithStartingBid = { ...LIVE_LOT, startingBid: 500 };
    // No prior bids → currentHighestAmount=0, minBid = startingBid (500)
    // amount=500 >= minBid=500 → success
    setupDbQueue([ACTIVE_USER], [lotWithStartingBid], []);
    setupSuccessfulClientQueries(makeBidRow({ amount: 500 }));

    const { placeBid } = await import('@/lib/bid-service');
    const result = await placeBid('lot-1', 'user-1', 500);
    expect(result.bid.amount).toBe(500);
  });

  it('uses getNextMinBid(0) as minBid when startingBid is null and no prior bids — covers line 161 fallback branch', async () => {
    // startingBid=null → minBid = getNextMinBid(0) = 100
    // amount=100 >= 100 → success
    mockGetNextMinBid.mockReturnValue(100);
    const lotWithoutStartingBid = { ...LIVE_LOT, startingBid: null };
    setupDbQueue([ACTIVE_USER], [lotWithoutStartingBid], []);
    setupSuccessfulClientQueries(makeBidRow({ amount: 100 }));

    const { placeBid } = await import('@/lib/bid-service');
    const result = await placeBid('lot-1', 'user-1', 100);
    expect(result.bid.amount).toBe(100);
    // Verify getNextMinBid was called with 0 (the fallback path)
    expect(mockGetNextMinBid).toHaveBeenCalledWith(0);
  });

  it('processes absentee bids after successful placement', async () => {
    setupDbQueue([ACTIVE_USER], [LIVE_LOT], []);
    setupSuccessfulClientQueries();

    const { placeBid } = await import('@/lib/bid-service');
    await placeBid('lot-1', 'user-1', 1000);

    await new Promise((r) => setTimeout(r, 0));
    expect(mockProcessAbsenteeBids).toHaveBeenCalledWith('lot-1', 1000, 'user-1', 'auction-1');
  });
});

// ─── Tests: getBidHistory ─────────────────────────────────────────────────────

describe('getBidHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbSelectQueue = [];
  });

  it('returns empty array when no bids exist for lot', async () => {
    // getBidHistory chains .orderBy() as its terminal call (no .limit()), so the
    // default mockDbSelect (which returns `self` from orderBy) won't resolve to a
    // Promise. Patch db.select directly for this test to make orderBy return one.
    const mockOrderByResult: unknown[] = [];

    const { getBidHistory } = await import('@/lib/bid-service');

    // Override the db mock temporarily to return from orderBy
    const { db } = await import('@/db/connection');
    (db as { select: typeof mockDbSelect }).select = () => {
      const chain = {
        from: () => chain,
        where: () => chain,
        leftJoin: () => chain,
        orderBy: () => Promise.resolve(mockOrderByResult),
        limit: () => Promise.resolve(dbSelectQueue.shift() ?? []),
        innerJoin: () => chain,
      };
      return chain;
    };

    const result = await getBidHistory('lot-no-bids');
    expect(result).toEqual([]);
  });

  it('returns bid history ordered by amount descending', async () => {
    const bids = [
      { id: 'bid-2', amount: 2000, bidType: 'online', paddleNumber: null, isWinning: true, createdAt: new Date(), isRetracted: false },
      { id: 'bid-1', amount: 1000, bidType: 'online', paddleNumber: null, isWinning: false, createdAt: new Date(), isRetracted: false },
    ];

    const { db } = await import('@/db/connection');
    (db as { select: typeof mockDbSelect }).select = () => {
      const chain = {
        from: () => chain,
        where: () => chain,
        leftJoin: () => chain,
        orderBy: () => Promise.resolve(bids),
        limit: () => Promise.resolve(dbSelectQueue.shift() ?? []),
        innerJoin: () => chain,
      };
      return chain;
    };

    const { getBidHistory } = await import('@/lib/bid-service');
    const result = await getBidHistory('lot-1');

    expect(result).toHaveLength(2);
    expect(result[0].amount).toBe(2000);
    expect(result[1].amount).toBe(1000);
  });

  it('returns bids with isRetracted flag', async () => {
    const bids = [
      { id: 'bid-1', amount: 1000, bidType: 'online', paddleNumber: null, isWinning: false, createdAt: new Date(), isRetracted: true },
    ];

    const { db } = await import('@/db/connection');
    (db as { select: typeof mockDbSelect }).select = () => {
      const chain = {
        from: () => chain,
        where: () => chain,
        leftJoin: () => chain,
        orderBy: () => Promise.resolve(bids),
        limit: () => Promise.resolve(dbSelectQueue.shift() ?? []),
        innerJoin: () => chain,
      };
      return chain;
    };

    const { getBidHistory } = await import('@/lib/bid-service');
    const result = await getBidHistory('lot-1');

    expect(result[0].isRetracted).toBe(true);
  });

  it('includes both retracted and non-retracted bids', async () => {
    const bids = [
      { id: 'bid-2', amount: 2000, bidType: 'online', paddleNumber: null, isWinning: true, createdAt: new Date(), isRetracted: false },
      { id: 'bid-1', amount: 1000, bidType: 'online', paddleNumber: null, isWinning: false, createdAt: new Date(), isRetracted: true },
    ];

    const { db } = await import('@/db/connection');
    (db as { select: typeof mockDbSelect }).select = () => {
      const chain = {
        from: () => chain,
        where: () => chain,
        leftJoin: () => chain,
        orderBy: () => Promise.resolve(bids),
        limit: () => Promise.resolve(dbSelectQueue.shift() ?? []),
        innerJoin: () => chain,
      };
      return chain;
    };

    const { getBidHistory } = await import('@/lib/bid-service');
    const result = await getBidHistory('lot-1');

    expect(result).toHaveLength(2);
    const retracted = result.filter((b) => b.isRetracted);
    expect(retracted).toHaveLength(1);
  });
});

// ─── Tests: getWinningBid ─────────────────────────────────────────────────────

describe('getWinningBid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbSelectQueue = [];
  });

  it('returns null when no winning bid exists', async () => {
    dbSelectQueue = [[]]; // limit() returns empty

    const { db } = await import('@/db/connection');
    (db as { select: typeof mockDbSelect }).select = mockDbSelect;

    const { getWinningBid } = await import('@/lib/bid-service');
    const result = await getWinningBid('lot-no-bids');
    expect(result).toBeNull();
  });

  it('returns the winning bid when one exists', async () => {
    const winningBid = { id: 'bid-1', userId: 'user-2', amount: 2000, createdAt: new Date() };
    dbSelectQueue = [[winningBid]];

    const { db } = await import('@/db/connection');
    (db as { select: typeof mockDbSelect }).select = mockDbSelect;

    const { getWinningBid } = await import('@/lib/bid-service');
    const result = await getWinningBid('lot-1');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('bid-1');
    expect(result!.userId).toBe('user-2');
    expect(result!.amount).toBe(2000);
  });
});

// ─── Tests: isUserWinning ─────────────────────────────────────────────────────

describe('isUserWinning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbSelectQueue = [];
  });

  it('returns true when the user has the winning bid', async () => {
    dbSelectQueue = [[{ id: 'bid-1', userId: 'user-1', amount: 2000, createdAt: new Date() }]];

    const { db } = await import('@/db/connection');
    (db as { select: typeof mockDbSelect }).select = mockDbSelect;

    const { isUserWinning } = await import('@/lib/bid-service');
    const result = await isUserWinning('lot-1', 'user-1');
    expect(result).toBe(true);
  });

  it('returns false when a different user is winning', async () => {
    dbSelectQueue = [[{ id: 'bid-1', userId: 'user-2', amount: 2000, createdAt: new Date() }]];

    const { db } = await import('@/db/connection');
    (db as { select: typeof mockDbSelect }).select = mockDbSelect;

    const { isUserWinning } = await import('@/lib/bid-service');
    const result = await isUserWinning('lot-1', 'user-1');
    expect(result).toBe(false);
  });

  it('returns false when no winning bid exists', async () => {
    dbSelectQueue = [[]];

    const { db } = await import('@/db/connection');
    (db as { select: typeof mockDbSelect }).select = mockDbSelect;

    const { isUserWinning } = await import('@/lib/bid-service');
    const result = await isUserWinning('lot-1', 'user-1');
    expect(result).toBe(false);
  });
});

// ─── Tests: BidError ─────────────────────────────────────────────────────────

describe('BidError', () => {
  it('has correct name, message, code, and statusCode', async () => {
    const { BidError } = await import('@/lib/bid-service');
    const err = new BidError('Test error', 'BID_TOO_LOW', 400);

    expect(err.name).toBe('BidError');
    expect(err.message).toBe('Test error');
    expect(err.code).toBe('BID_TOO_LOW');
    expect(err.statusCode).toBe(400);
    expect(err).toBeInstanceOf(Error);
  });

  it('is an instanceof Error', async () => {
    const { BidError } = await import('@/lib/bid-service');
    const err = new BidError('msg', 'NOT_AUTHENTICATED', 401);
    expect(err instanceof Error).toBe(true);
  });

  it('supports all error codes', async () => {
    const { BidError } = await import('@/lib/bid-service');
    const codes: Array<ConstructorParameters<typeof BidError>[1]> = [
      'NOT_AUTHENTICATED',
      'AUCTION_NOT_LIVE',
      'LOT_NOT_ACTIVE',
      'BID_TOO_LOW',
      'ALREADY_WINNING',
      'USER_INACTIVE',
      'RATE_LIMITED',
    ];

    for (const code of codes) {
      const err = new BidError('msg', code, 400);
      expect(err.code).toBe(code);
    }
  });
});
