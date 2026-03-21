/**
 * Unit tests for db/queries/audit.ts
 * Covers: getAuditLog (all filter combinations), getAuditLogForRecord
 * Target lines: 50 (getAuditLogForRecord), 66 (recordId filter), 69 (action filter),
 *               72 (performedBy filter), 75 (dateFrom filter), 78 (dateTo filter)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mock variables ───────────────────────────────────────────────────

const { mockSelect, mockFrom } = vi.hoisted(() => {
  const mockOffset = vi.fn().mockResolvedValue([]);
  const mockLimit = vi.fn().mockReturnValue({ offset: mockOffset });
  const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit, offset: mockOffset });
  const mockSelectWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
  const mockFrom = vi.fn().mockReturnValue({ where: mockSelectWhere, orderBy: mockOrderBy });
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
  return { mockSelect, mockFrom };
});

vi.mock('../../../db/connection', () => ({
  db: {
    select: mockSelect,
  },
}));

vi.mock('../../../db/schema', () => ({
  auditLog: {
    tableName: 'table_name',
    recordId: 'record_id',
    action: 'action',
    performedBy: 'performed_by',
    createdAt: 'created_at',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: unknown, val: unknown) => ({ op: 'eq', val })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  gte: vi.fn((_col: unknown, val: unknown) => ({ op: 'gte', val })),
  lte: vi.fn((_col: unknown, val: unknown) => ({ op: 'lte', val })),
  desc: vi.fn((col: unknown) => ({ op: 'desc', col })),
  sql: vi.fn((s: unknown) => s),
  count: vi.fn(() => ({ op: 'count' })),
}));

// ─── Import after mocks ──────────────────────────────────────────────────────

import { getAuditLog, getAuditLogForRecord } from '../../../db/queries/audit';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeAuditRow(overrides = {}) {
  return {
    id: 'audit-1',
    tableName: 'lots',
    recordId: 'lot-1',
    action: 'UPDATE',
    oldValues: {},
    newValues: { title: 'New Title' },
    performedBy: 'user-admin',
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * Helper: set up select to handle the Promise.all([rows, count]) in getAuditLog.
 * getAuditLog runs: Promise.all([rows-query, count-query])
 * Both start with db.select(), so we need to differentiate calls.
 */
function setupGetAuditLogMocks(rows: unknown[] = [], total = 0) {
  let callCount = 0;

  mockSelect.mockImplementation(() => {
    callCount++;

    if (callCount % 2 === 1) {
      // Odd calls = rows query: select → from → where → orderBy → limit → offset
      const mockOffset = vi.fn().mockResolvedValue(rows);
      const mockLimit = vi.fn().mockReturnValue({ offset: mockOffset });
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
    } else {
      // Even calls = count query: select → from → where → resolves [{total}]
      const mockCountWhere = vi.fn().mockResolvedValue([{ total }]);
      return { from: vi.fn().mockReturnValue({ where: mockCountWhere }) };
    }
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('db/queries/audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupGetAuditLogMocks();
  });

  // ── getAuditLog ─────────────────────────────────────────────────────────

  describe('getAuditLog', () => {
    it('returns paginated result with default page and limit', async () => {
      setupGetAuditLogMocks([makeAuditRow()], 1);

      const result = await getAuditLog();

      expect(result).toMatchObject({
        page: 1,
        limit: 50,
        total: 1,
        totalPages: 1,
      });
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('uses custom page and limit when provided', async () => {
      let capturedOffset: number | undefined;
      let callCount = 0;

      mockSelect.mockImplementation(() => {
        callCount++;
        if (callCount % 2 === 1) {
          const mockOffset = vi.fn().mockImplementation((o: number) => {
            capturedOffset = o;
            return Promise.resolve([]);
          });
          const mockLimit = vi.fn().mockReturnValue({ offset: mockOffset });
          const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
          const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
          return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
        } else {
          const mockCountWhere = vi.fn().mockResolvedValue([{ total: 0 }]);
          return { from: vi.fn().mockReturnValue({ where: mockCountWhere }) };
        }
      });

      const result = await getAuditLog({ page: 3, limit: 10 });

      expect(result.page).toBe(3);
      expect(result.limit).toBe(10);
      expect(capturedOffset).toBe(20); // (3-1)*10
    });

    it('applies no conditions when no filters given (undefined where)', async () => {
      let capturedWhere: unknown;
      let callCount = 0;

      mockSelect.mockImplementation(() => {
        callCount++;
        if (callCount % 2 === 1) {
          const mockOffset = vi.fn().mockResolvedValue([]);
          const mockLimit = vi.fn().mockReturnValue({ offset: mockOffset });
          const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
          const mockWhere = vi.fn().mockImplementation((w: unknown) => {
            capturedWhere = w;
            return { orderBy: mockOrderBy };
          });
          return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
        } else {
          const mockCountWhere = vi.fn().mockResolvedValue([{ total: 0 }]);
          return { from: vi.fn().mockReturnValue({ where: mockCountWhere }) };
        }
      });

      await getAuditLog({});

      // where() should be called with undefined when no conditions
      expect(capturedWhere).toBeUndefined();
    });

    it('applies tableName filter via eq', async () => {
      const { eq } = await import('drizzle-orm');
      setupGetAuditLogMocks();

      await getAuditLog({ tableName: 'lots' });

      expect(eq).toHaveBeenCalledWith(expect.anything(), 'lots');
    });

    it('applies recordId filter via eq', async () => {
      const { eq } = await import('drizzle-orm');
      setupGetAuditLogMocks();

      await getAuditLog({ recordId: 'lot-42' });

      expect(eq).toHaveBeenCalledWith(expect.anything(), 'lot-42');
    });

    it('applies action filter via eq', async () => {
      const { eq } = await import('drizzle-orm');
      setupGetAuditLogMocks();

      await getAuditLog({ action: 'DELETE' });

      expect(eq).toHaveBeenCalledWith(expect.anything(), 'DELETE');
    });

    it('applies performedBy filter via eq', async () => {
      const { eq } = await import('drizzle-orm');
      setupGetAuditLogMocks();

      await getAuditLog({ performedBy: 'user-admin' });

      expect(eq).toHaveBeenCalledWith(expect.anything(), 'user-admin');
    });

    it('applies dateFrom filter via gte', async () => {
      const { gte } = await import('drizzle-orm');
      const dateFrom = new Date('2026-01-01');
      setupGetAuditLogMocks();

      await getAuditLog({ dateFrom });

      expect(gte).toHaveBeenCalledWith(expect.anything(), dateFrom);
    });

    it('applies dateTo filter via lte', async () => {
      const { lte } = await import('drizzle-orm');
      const dateTo = new Date('2026-12-31');
      setupGetAuditLogMocks();

      await getAuditLog({ dateTo });

      expect(lte).toHaveBeenCalledWith(expect.anything(), dateTo);
    });

    it('applies all filters together and wraps with and()', async () => {
      const { and } = await import('drizzle-orm');
      const dateFrom = new Date('2026-01-01');
      const dateTo = new Date('2026-06-30');
      setupGetAuditLogMocks();

      await getAuditLog({
        tableName: 'lots',
        recordId: 'lot-1',
        action: 'UPDATE',
        performedBy: 'admin',
        dateFrom,
        dateTo,
      });

      // and() should be called with 6 conditions
      expect(and).toHaveBeenCalled();
      const andCalls = (and as ReturnType<typeof vi.fn>).mock.calls;
      // Find the call with 6 args (all 6 filter conditions)
      const sixArgCall = andCalls.find((c) => c.length === 6);
      expect(sixArgCall).toBeDefined();
    });

    it('calculates totalPages correctly', async () => {
      setupGetAuditLogMocks([], 105);

      const result = await getAuditLog({ limit: 10 });

      expect(result.totalPages).toBe(11); // ceil(105/10)
    });

    it('returns zero totalPages for empty result set', async () => {
      setupGetAuditLogMocks([], 0);

      const result = await getAuditLog({ limit: 10 });

      expect(result.totalPages).toBe(0); // ceil(0/10)
    });

    it('handles tableName + dateFrom combination', async () => {
      const { and, eq, gte } = await import('drizzle-orm');
      const dateFrom = new Date('2026-03-01');
      setupGetAuditLogMocks();

      await getAuditLog({ tableName: 'auctions', dateFrom });

      expect(eq).toHaveBeenCalled();
      expect(gte).toHaveBeenCalled();
      expect(and).toHaveBeenCalled();
    });
  });

  // ── getAuditLogForRecord ────────────────────────────────────────────────

  describe('getAuditLogForRecord', () => {
    function setupForRecord(rows: unknown[] = [makeAuditRow()]) {
      const mockOrderBy = vi.fn().mockResolvedValue(rows);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({ where: mockWhere }),
      });
      return { mockOrderBy, mockWhere };
    }

    it('returns audit entries for a specific table+record combination', async () => {
      setupForRecord([makeAuditRow()]);

      const result = await getAuditLogForRecord('lots', 'lot-1');

      expect(mockSelect).toHaveBeenCalled();
      expect(Array.isArray(result)).toBe(true);
    });

    it('applies both tableName and recordId conditions via and+eq', async () => {
      const { and, eq } = await import('drizzle-orm');
      setupForRecord();

      await getAuditLogForRecord('auctions', 'auction-42');

      expect(eq).toHaveBeenCalledWith(expect.anything(), 'auctions');
      expect(eq).toHaveBeenCalledWith(expect.anything(), 'auction-42');
      expect(and).toHaveBeenCalled();
    });

    it('returns empty array when no audit records found', async () => {
      setupForRecord([]);

      const result = await getAuditLogForRecord('lots', 'nonexistent-lot');

      expect(result).toEqual([]);
    });

    it('queries for different table names', async () => {
      const { eq } = await import('drizzle-orm');
      setupForRecord([]);

      await getAuditLogForRecord('users', 'user-1');

      expect(eq).toHaveBeenCalledWith(expect.anything(), 'users');
    });

    it('orders results by createdAt descending', async () => {
      const { desc } = await import('drizzle-orm');
      const { mockOrderBy } = setupForRecord();

      await getAuditLogForRecord('lots', 'lot-1');

      expect(desc).toHaveBeenCalled();
      expect(mockOrderBy).toHaveBeenCalled();
    });

    it('returns multiple audit entries for same record', async () => {
      setupForRecord([
        makeAuditRow({ id: 'audit-1', action: 'UPDATE' }),
        makeAuditRow({ id: 'audit-2', action: 'CREATE' }),
      ]);

      const result = await getAuditLogForRecord('lots', 'lot-1');

      expect(result).toHaveLength(2);
    });
  });
});
