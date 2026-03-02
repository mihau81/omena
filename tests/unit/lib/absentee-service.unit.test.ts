import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mock objects (accessible inside vi.mock factories) ───────────────

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
}));

const mockPool = vi.hoisted(() => ({
  connect: vi.fn(),
}));

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    eq: vi.fn((...args) => ({ type: 'eq', args })),
    and: vi.fn((...args) => ({ type: 'and', args })),
    desc: vi.fn((col) => ({ type: 'desc', col })),
    isNull: vi.fn((col) => ({ type: 'isNull', col })),
  };
});

vi.mock('@/db/connection', () => ({
  db: mockDb,
  pool: mockPool,
}));

vi.mock('@/db/schema', () => ({
  absenteeBids: {
    id: 'absenteeBids.id',
    lotId: 'absenteeBids.lotId',
    userId: 'absenteeBids.userId',
    maxAmount: 'absenteeBids.maxAmount',
    isActive: 'absenteeBids.isActive',
  },
  bids: { id: 'bids.id' },
  bidRegistrations: {
    id: 'bidRegistrations.id',
    userId: 'bidRegistrations.userId',
    auctionId: 'bidRegistrations.auctionId',
    isApproved: 'bidRegistrations.isApproved',
  },
  bidRetractions: {},
  lots: {
    id: 'lots.id',
    auctionId: 'lots.auctionId',
    status: 'lots.status',
    startingBid: 'lots.startingBid',
    deletedAt: 'lots.deletedAt',
  },
  auctions: { id: 'auctions.id', status: 'auctions.status' },
  users: {},
}));

vi.mock('@/app/lib/bidding', () => ({
  getNextMinBid: vi.fn((amount: number) => amount + 100),
}));

vi.mock('@/lib/audit', () => ({
  logCreate: vi.fn().mockResolvedValue(undefined),
  logUpdate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/bid-events', () => ({
  emitBid: vi.fn(),
}));

// ─── Fluent chain builder ─────────────────────────────────────────────────────

function makeChain(finalResult: unknown) {
  const chain: Record<string, unknown> = {};
  const methods = ['select', 'from', 'innerJoin', 'where', 'limit', 'update', 'set', 'insert', 'values', 'returning'];
  for (const m of methods) {
    chain[m] = vi.fn(() => chain);
  }
  // Thenable — resolves to finalResult when awaited
  (chain as any).then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(finalResult).then(resolve, reject);
  return chain;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setupDbSelect(...results: unknown[][]) {
  let callIdx = 0;
  mockDb.select.mockImplementation(() => {
    const result = results[callIdx] ?? [];
    callIdx++;
    return makeChain(result);
  });
}

function setupDbUpdate() {
  mockDb.update.mockImplementation(() => makeChain(undefined));
}

function setupDbInsert(result: unknown[]) {
  mockDb.insert.mockImplementation(() => makeChain(result));
}

// ─── Imports (after mocks) ───────────────────────────────────────────────────

import {
  placeAbsenteeBid,
  getUserAbsenteeBid,
  cancelAbsenteeBid,
  processAbsenteeBids,
  AbsenteeError,
} from '@/lib/absentee-service';

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AbsenteeError', () => {
  it('creates error with correct properties', () => {
    const err = new AbsenteeError('msg', 'NOT_FOUND', 404);
    expect(err.message).toBe('msg');
    expect(err.code).toBe('NOT_FOUND');
    expect(err.statusCode).toBe(404);
    expect(err.name).toBe('AbsenteeError');
  });

  it('is instanceof Error and AbsenteeError', () => {
    const err = new AbsenteeError('msg', 'AUCTION_NOT_LIVE', 400);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AbsenteeError);
  });

  it('supports all defined error codes', () => {
    const codes = [
      'NOT_AUTHENTICATED',
      'NOT_REGISTERED',
      'AUCTION_NOT_LIVE',
      'LOT_NOT_ACTIVE',
      'AMOUNT_TOO_LOW',
      'NOT_FOUND',
    ] as const;
    for (const code of codes) {
      const err = new AbsenteeError('test', code, 400);
      expect(err.code).toBe(code);
    }
  });
});

describe('placeAbsenteeBid', () => {
  const LOT_ID = 'lot-1';
  const USER_ID = 'user-1';
  const AUCTION_ID = 'auction-1';

  const validLotRow = {
    lotId: LOT_ID,
    lotStatus: 'published',
    auctionStatus: 'preview',
    startingBid: 1000,
    auctionId: AUCTION_ID,
  };

  const approvedRegistration = { id: 'reg-1', isApproved: true };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws LOT_NOT_ACTIVE (404) when lot is not found', async () => {
    setupDbSelect([]);

    await expect(placeAbsenteeBid(LOT_ID, USER_ID, 5000)).rejects.toMatchObject({
      code: 'LOT_NOT_ACTIVE',
      statusCode: 404,
    });
  });

  it('throws AUCTION_NOT_LIVE when auction status is draft', async () => {
    setupDbSelect([{ ...validLotRow, auctionStatus: 'draft' }]);

    await expect(placeAbsenteeBid(LOT_ID, USER_ID, 5000)).rejects.toMatchObject({
      code: 'AUCTION_NOT_LIVE',
      statusCode: 400,
    });
  });

  it('throws AUCTION_NOT_LIVE when auction status is completed', async () => {
    setupDbSelect([{ ...validLotRow, auctionStatus: 'completed' }]);

    await expect(placeAbsenteeBid(LOT_ID, USER_ID, 5000)).rejects.toMatchObject({
      code: 'AUCTION_NOT_LIVE',
    });
  });

  it('throws AUCTION_NOT_LIVE when auction status is closed', async () => {
    setupDbSelect([{ ...validLotRow, auctionStatus: 'closed' }]);

    await expect(placeAbsenteeBid(LOT_ID, USER_ID, 5000)).rejects.toMatchObject({
      code: 'AUCTION_NOT_LIVE',
    });
  });

  it('allows preview auction status', async () => {
    setupDbSelect(
      [{ ...validLotRow, auctionStatus: 'preview' }],
      [approvedRegistration],
      [],
    );
    setupDbInsert([{ id: 'new-bid-id' }]);

    const result = await placeAbsenteeBid(LOT_ID, USER_ID, 5000);
    expect(result.id).toBe('new-bid-id');
    expect(result.lotId).toBe(LOT_ID);
    expect(result.userId).toBe(USER_ID);
    expect(result.maxAmount).toBe(5000);
  });

  it('allows live auction status', async () => {
    setupDbSelect(
      [{ ...validLotRow, auctionStatus: 'live' }],
      [approvedRegistration],
      [],
    );
    setupDbInsert([{ id: 'live-bid-id' }]);

    const result = await placeAbsenteeBid(LOT_ID, USER_ID, 5000);
    expect(result.id).toBe('live-bid-id');
  });

  it('throws LOT_NOT_ACTIVE when lot status is sold', async () => {
    setupDbSelect([{ ...validLotRow, lotStatus: 'sold' }]);

    await expect(placeAbsenteeBid(LOT_ID, USER_ID, 5000)).rejects.toMatchObject({
      code: 'LOT_NOT_ACTIVE',
      statusCode: 400,
    });
  });

  it('throws LOT_NOT_ACTIVE when lot status is draft', async () => {
    setupDbSelect([{ ...validLotRow, lotStatus: 'draft' }]);

    await expect(placeAbsenteeBid(LOT_ID, USER_ID, 5000)).rejects.toMatchObject({
      code: 'LOT_NOT_ACTIVE',
    });
  });

  it('allows active lot status', async () => {
    setupDbSelect(
      [{ ...validLotRow, lotStatus: 'active', auctionStatus: 'live' }],
      [approvedRegistration],
      [],
    );
    setupDbInsert([{ id: 'bid-id' }]);

    const result = await placeAbsenteeBid(LOT_ID, USER_ID, 5000);
    expect(result).toBeTruthy();
  });

  it('throws NOT_REGISTERED (403) when user has no registration', async () => {
    setupDbSelect(
      [validLotRow],
      [],
    );

    await expect(placeAbsenteeBid(LOT_ID, USER_ID, 5000)).rejects.toMatchObject({
      code: 'NOT_REGISTERED',
      statusCode: 403,
    });
  });

  it('throws NOT_REGISTERED when registration is not approved', async () => {
    setupDbSelect(
      [validLotRow],
      [{ id: 'reg-1', isApproved: false }],
    );

    await expect(placeAbsenteeBid(LOT_ID, USER_ID, 5000)).rejects.toMatchObject({
      code: 'NOT_REGISTERED',
      statusCode: 403,
    });
  });

  it('throws AMOUNT_TOO_LOW when maxAmount is below startingBid', async () => {
    setupDbSelect(
      [{ ...validLotRow, startingBid: 1000 }],
      [approvedRegistration],
    );

    await expect(placeAbsenteeBid(LOT_ID, USER_ID, 500)).rejects.toMatchObject({
      code: 'AMOUNT_TOO_LOW',
      statusCode: 400,
    });
  });

  it('includes the minimum amount in AMOUNT_TOO_LOW message', async () => {
    setupDbSelect(
      [{ ...validLotRow, startingBid: 1000 }],
      [approvedRegistration],
    );

    await expect(placeAbsenteeBid(LOT_ID, USER_ID, 500)).rejects.toThrow(/1000/);
  });

  it('falls back to getNextMinBid(0) when startingBid is null, rejects if below', async () => {
    // getNextMinBid(0) returns 100 per mock
    setupDbSelect(
      [{ ...validLotRow, startingBid: null }],
      [approvedRegistration],
    );

    await expect(placeAbsenteeBid(LOT_ID, USER_ID, 50)).rejects.toMatchObject({
      code: 'AMOUNT_TOO_LOW',
    });
  });

  it('accepts amount exactly equal to startingBid', async () => {
    setupDbSelect(
      [{ ...validLotRow, startingBid: 1000 }],
      [approvedRegistration],
      [],
    );
    setupDbInsert([{ id: 'exact-bid-id' }]);

    const result = await placeAbsenteeBid(LOT_ID, USER_ID, 1000);
    expect(result.maxAmount).toBe(1000);
  });

  it('inserts new bid when none exists and returns correct shape', async () => {
    setupDbSelect(
      [validLotRow],
      [approvedRegistration],
      [],
    );
    setupDbInsert([{ id: 'inserted-id' }]);

    const result = await placeAbsenteeBid(LOT_ID, USER_ID, 2000);

    expect(result).toEqual({ id: 'inserted-id', lotId: LOT_ID, userId: USER_ID, maxAmount: 2000 });
    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('updates existing bid and returns same id with new maxAmount', async () => {
    const existingBid = { id: 'existing-bid-id', maxAmount: 3000 };

    setupDbSelect(
      [validLotRow],
      [approvedRegistration],
      [existingBid],
    );
    setupDbUpdate();

    const result = await placeAbsenteeBid(LOT_ID, USER_ID, 5000);

    expect(result).toEqual({ id: 'existing-bid-id', lotId: LOT_ID, userId: USER_ID, maxAmount: 5000 });
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('calls logCreate when inserting a new bid', async () => {
    const { logCreate } = await import('@/lib/audit');

    setupDbSelect(
      [validLotRow],
      [approvedRegistration],
      [],
    );
    setupDbInsert([{ id: 'new-id' }]);

    await placeAbsenteeBid(LOT_ID, USER_ID, 2000);

    expect(logCreate).toHaveBeenCalledWith(
      'absentee_bids',
      'new-id',
      expect.objectContaining({ lotId: LOT_ID, userId: USER_ID, maxAmount: 2000 }),
      USER_ID,
      'user',
    );
  });

  it('calls logUpdate when updating existing bid', async () => {
    const { logUpdate } = await import('@/lib/audit');

    setupDbSelect(
      [validLotRow],
      [approvedRegistration],
      [{ id: 'existing-id', maxAmount: 1500 }],
    );
    setupDbUpdate();

    await placeAbsenteeBid(LOT_ID, USER_ID, 3000);

    expect(logUpdate).toHaveBeenCalledWith(
      'absentee_bids',
      'existing-id',
      expect.objectContaining({ maxAmount: 1500 }),
      expect.objectContaining({ maxAmount: 3000 }),
      USER_ID,
      'user',
    );
  });
});

describe('getUserAbsenteeBid', () => {
  const LOT_ID = 'lot-1';
  const USER_ID = 'user-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns { hasAbsenteeBid: true } when active bid exists', async () => {
    setupDbSelect([{ id: 'bid-1' }]);

    const result = await getUserAbsenteeBid(LOT_ID, USER_ID);
    expect(result).toEqual({ hasAbsenteeBid: true });
  });

  it('returns { hasAbsenteeBid: false } when no active bid exists', async () => {
    setupDbSelect([]);

    const result = await getUserAbsenteeBid(LOT_ID, USER_ID);
    expect(result).toEqual({ hasAbsenteeBid: false });
  });
});

describe('cancelAbsenteeBid', () => {
  const LOT_ID = 'lot-1';
  const USER_ID = 'user-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws NOT_FOUND (404) when no active bid exists', async () => {
    setupDbSelect([]);

    await expect(cancelAbsenteeBid(LOT_ID, USER_ID)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
    });
  });

  it('resolves to undefined (void) when bid is cancelled', async () => {
    setupDbSelect([{ id: 'bid-1' }]);
    setupDbUpdate();

    await expect(cancelAbsenteeBid(LOT_ID, USER_ID)).resolves.toBeUndefined();
  });

  it('calls db.update to set isActive: false', async () => {
    setupDbSelect([{ id: 'bid-1' }]);
    setupDbUpdate();

    await cancelAbsenteeBid(LOT_ID, USER_ID);

    expect(mockDb.update).toHaveBeenCalled();
    expect(mockDb.update).toHaveBeenCalledTimes(1);
  });

  it('does not call db.update when bid not found', async () => {
    setupDbSelect([]);

    try {
      await cancelAbsenteeBid(LOT_ID, USER_ID);
    } catch {
      // expected AbsenteeError
    }
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('calls logUpdate with correct before/after state', async () => {
    const { logUpdate } = await import('@/lib/audit');
    setupDbSelect([{ id: 'bid-1' }]);
    setupDbUpdate();

    await cancelAbsenteeBid(LOT_ID, USER_ID);

    expect(logUpdate).toHaveBeenCalledWith(
      'absentee_bids',
      'bid-1',
      { isActive: true },
      { isActive: false },
      USER_ID,
      'user',
    );
  });
});

describe('processAbsenteeBids', () => {
  const LOT_ID = 'lot-1';
  const AUCTION_ID = 'auction-1';

  let mockClient: {
    query: ReturnType<typeof vi.fn>;
    release: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };

    mockPool.connect.mockResolvedValue(mockClient);
  });

  it('rolls back and returns when there is no current highest bid', async () => {
    mockClient.query
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce(undefined) // pg_advisory_xact_lock
      .mockResolvedValueOnce({ rows: [] }); // no highest bid

    await processAbsenteeBids(LOT_ID, 1000, null, AUCTION_ID);

    const rollbackCalls = mockClient.query.mock.calls.filter(
      (c: unknown[]) => c[0] === 'ROLLBACK',
    );
    expect(rollbackCalls.length).toBeGreaterThan(0);
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('rolls back and returns when there is no eligible absentee bid', async () => {
    mockClient.query
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce(undefined) // lock
      .mockResolvedValueOnce({ rows: [{ amount: 1000, user_id: 'bidder-1' }] }) // highest bid
      .mockResolvedValueOnce({ rows: [] }); // no eligible absentee bid

    await processAbsenteeBids(LOT_ID, 1000, 'bidder-1', AUCTION_ID);

    const rollbackCalls = mockClient.query.mock.calls.filter(
      (c: unknown[]) => c[0] === 'ROLLBACK',
    );
    expect(rollbackCalls.length).toBeGreaterThan(0);
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('commits and emits bid when eligible absentee bid exists', async () => {
    const { emitBid } = await import('@/lib/bid-events');
    const absenteeRow = {
      id: 'ab-bid-1',
      user_id: 'absentee-user',
      max_amount: 9999,
      registration_id: 'reg-1',
      paddle_number: 42,
    };

    mockClient.query
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce(undefined) // lock
      .mockResolvedValueOnce({ rows: [{ amount: 1000, user_id: 'current-user' }] })
      .mockResolvedValueOnce({ rows: [absenteeRow] })
      .mockResolvedValueOnce(undefined) // UPDATE is_winning=false
      .mockResolvedValueOnce({ // INSERT new bid
        rows: [{
          id: 'sys-bid-1',
          lot_id: LOT_ID,
          user_id: 'absentee-user',
          amount: 1100,
          bid_type: 'system',
          is_winning: true,
          created_at: new Date(),
        }],
      });

    await processAbsenteeBids(LOT_ID, 1000, 'current-user', AUCTION_ID);

    const commitCalls = mockClient.query.mock.calls.filter((c: unknown[]) => c[0] === 'COMMIT');
    expect(commitCalls.length).toBe(1);

    expect(emitBid).toHaveBeenCalledWith(AUCTION_ID, expect.objectContaining({
      lotId: LOT_ID,
      auctionId: AUCTION_ID,
      isWinning: true,
      amount: 1100,
    }));
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('deactivates absentee bid when autoBid equals maxAmount', async () => {
    const absenteeRow = {
      id: 'ab-bid-1',
      user_id: 'absentee-user',
      max_amount: 1100, // exactly nextMin(1000) = 1100
      registration_id: 'reg-1',
      paddle_number: 42,
    };

    mockClient.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ rows: [{ amount: 1000, user_id: 'current-user' }] })
      .mockResolvedValueOnce({ rows: [absenteeRow] })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        rows: [{
          id: 'sys-bid',
          lot_id: LOT_ID,
          user_id: 'absentee-user',
          amount: 1100,
          bid_type: 'system',
          is_winning: true,
          created_at: new Date(),
        }],
      });

    setupDbUpdate();

    await processAbsenteeBids(LOT_ID, 1000, 'current-user', AUCTION_ID);

    // db.update (drizzle) should be called to deactivate the absentee bid
    expect(mockDb.update).toHaveBeenCalled();
  });

  it('does not deactivate absentee bid when autoBid is below maxAmount', async () => {
    const absenteeRow = {
      id: 'ab-bid-1',
      user_id: 'absentee-user',
      max_amount: 9999, // autoBid (1100) < maxAmount (9999)
      registration_id: 'reg-1',
      paddle_number: 42,
    };

    mockClient.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ rows: [{ amount: 1000, user_id: 'current-user' }] })
      .mockResolvedValueOnce({ rows: [absenteeRow] })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        rows: [{
          id: 'sys-bid',
          lot_id: LOT_ID,
          user_id: 'absentee-user',
          amount: 1100,
          bid_type: 'system',
          is_winning: true,
          created_at: new Date(),
        }],
      });

    await processAbsenteeBids(LOT_ID, 1000, 'current-user', AUCTION_ID);

    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('caps autoBid at absentee maxAmount when maxAmount < nextMin', async () => {
    // nextMin(1000) = 1100, but maxAmount = 1050, so autoBid = min(1100, 1050) = 1050
    const absenteeRow = {
      id: 'ab-bid-1',
      user_id: 'absentee-user',
      max_amount: 1050,
      registration_id: 'reg-1',
      paddle_number: 42,
    };

    const capturedInsertAmounts: number[] = [];
    mockClient.query.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (typeof sql === 'string' && sql.includes('BEGIN')) return undefined;
      if (typeof sql === 'string' && sql.includes('pg_advisory')) return undefined;
      if (typeof sql === 'string' && sql.includes('ORDER BY b.amount DESC')) {
        return { rows: [{ amount: 1000, user_id: 'current-user' }] };
      }
      if (typeof sql === 'string' && sql.includes('ab.max_amount')) {
        return { rows: [absenteeRow] };
      }
      if (typeof sql === 'string' && sql.includes('is_winning = false')) return undefined;
      if (typeof sql === 'string' && sql.includes('INSERT INTO bids')) {
        capturedInsertAmounts.push((params as number[])[3]);
        return { rows: [{ id: 'sys-bid', lot_id: LOT_ID, user_id: 'absentee-user', amount: 1050, bid_type: 'system', is_winning: true, created_at: new Date() }] };
      }
      if (typeof sql === 'string' && sql.includes('COMMIT')) return undefined;
      return undefined;
    });

    setupDbUpdate();

    await processAbsenteeBids(LOT_ID, 1000, 'current-user', AUCTION_ID);

    // autoBidAmount should be 1050 (capped), and since 1050 >= 1050, bid is deactivated
    expect(mockDb.update).toHaveBeenCalled();
  });

  it('swallows errors and does not throw', async () => {
    mockClient.query
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockRejectedValueOnce(new Error('DB failure')); // lock query fails

    await expect(
      processAbsenteeBids(LOT_ID, 1000, null, AUCTION_ID),
    ).resolves.toBeUndefined();
  });

  it('rolls back on error', async () => {
    mockClient.query
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('timeout'));

    await processAbsenteeBids(LOT_ID, 1000, null, AUCTION_ID);

    const rollbackCalls = mockClient.query.mock.calls.filter(
      (c: unknown[]) => c[0] === 'ROLLBACK',
    );
    expect(rollbackCalls.length).toBeGreaterThan(0);
  });

  it('always releases client even after error', async () => {
    mockClient.query
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('bad error'));

    await processAbsenteeBids(LOT_ID, 1000, null, AUCTION_ID);

    expect(mockClient.release).toHaveBeenCalled();
  });

  it('uses pg_advisory_xact_lock with lotId as key', async () => {
    mockClient.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined) // lock
      .mockResolvedValueOnce({ rows: [] }); // no highest bid

    await processAbsenteeBids(LOT_ID, 1000, null, AUCTION_ID);

    const lockCall = mockClient.query.mock.calls.find(
      (c: unknown[]) =>
        typeof c[0] === 'string' && c[0].includes('pg_advisory_xact_lock'),
    );
    expect(lockCall).toBeTruthy();
    expect(lockCall![1]).toEqual([LOT_ID]);
  });

  it('calls logCreate for system bid with correct actor', async () => {
    const { logCreate } = await import('@/lib/audit');

    const absenteeRow = {
      id: 'ab-bid-1',
      user_id: 'absentee-user',
      max_amount: 9999,
      registration_id: 'reg-1',
      paddle_number: 42,
    };

    mockClient.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ rows: [{ amount: 1000, user_id: 'current-user' }] })
      .mockResolvedValueOnce({ rows: [absenteeRow] })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        rows: [{
          id: 'sys-bid',
          lot_id: LOT_ID,
          user_id: 'absentee-user',
          amount: 1100,
          bid_type: 'system',
          is_winning: true,
          created_at: new Date(),
        }],
      });

    await processAbsenteeBids(LOT_ID, 1000, 'current-user', AUCTION_ID);

    expect(logCreate).toHaveBeenCalledWith(
      'bids',
      'sys-bid',
      expect.objectContaining({ bidType: 'system', isWinning: true }),
      'system',
      'system',
    );
  });

  it('emits bid with correct nextMinBid derived from autoBid amount', async () => {
    const { emitBid } = await import('@/lib/bid-events');
    const { getNextMinBid } = await import('@/app/lib/bidding');

    const absenteeRow = {
      id: 'ab-bid-1',
      user_id: 'absentee-user',
      max_amount: 9999,
      registration_id: 'reg-1',
      paddle_number: 42,
    };

    mockClient.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ rows: [{ amount: 1000, user_id: 'current-user' }] })
      .mockResolvedValueOnce({ rows: [absenteeRow] })
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        rows: [{
          id: 'sys-bid',
          lot_id: LOT_ID,
          user_id: 'absentee-user',
          amount: 1100,
          bid_type: 'system',
          is_winning: true,
          created_at: new Date(),
        }],
      });

    await processAbsenteeBids(LOT_ID, 1000, 'current-user', AUCTION_ID);

    expect(emitBid).toHaveBeenCalledWith(AUCTION_ID, expect.objectContaining({
      nextMinBid: getNextMinBid(1100),
    }));
  });
});
