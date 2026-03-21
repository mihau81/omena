/**
 * Unit tests for db/queries/consignors.ts
 * Covers: isActive filter (line 53), getConsignorLots (lines 125-145),
 *         listActiveConsignors (line 220), and supplemental paths.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoisted mock variables ───────────────────────────────────────────────────

const { mockSelect, mockUpdate, mockInsert } = vi.hoisted(() => {
  const mockSelect = vi.fn();
  const mockUpdate = vi.fn();
  const mockInsert = vi.fn();
  return { mockSelect, mockUpdate, mockInsert };
});

vi.mock('../../../db/connection', () => ({
  db: {
    select: mockSelect,
    update: mockUpdate,
    insert: mockInsert,
  },
}));

vi.mock('../../../db/schema', () => ({
  consignors: {
    id: 'id',
    name: 'name',
    email: 'email',
    phone: 'phone',
    companyName: 'company_name',
    taxId: 'tax_id',
    commissionRate: 'commission_rate',
    isActive: 'is_active',
    createdAt: 'created_at',
    deletedAt: 'deleted_at',
    updatedAt: 'updated_at',
    address: 'address',
    city: 'city',
    postalCode: 'postal_code',
    country: 'country',
    notes: 'notes',
  },
  lots: {
    id: 'id',
    consignorId: 'consignor_id',
    deletedAt: 'deleted_at',
    status: 'status',
    lotNumber: 'lot_number',
    title: 'title',
    artist: 'artist',
    estimateMin: 'estimate_min',
    estimateMax: 'estimate_max',
    hammerPrice: 'hammer_price',
    auctionId: 'auction_id',
    createdAt: 'created_at',
  },
  auctions: {
    id: 'id',
    title: 'title',
    slug: 'slug',
  },
}));

vi.mock('../../../db/helpers', () => ({
  notDeleted: vi.fn((table: unknown) => ({ op: 'isNull', table })),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: unknown, val: unknown) => ({ op: 'eq', val })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  or: vi.fn((...args: unknown[]) => ({ op: 'or', args })),
  ilike: vi.fn((_col: unknown, pat: unknown) => ({ op: 'ilike', pat })),
  desc: vi.fn((col: unknown) => ({ op: 'desc', col })),
  count: vi.fn(() => ({ op: 'count' })),
  isNull: vi.fn((col: unknown) => ({ op: 'isNull', col })),
  isNotNull: vi.fn((col: unknown) => ({ op: 'isNotNull', col })),
}));

// ─── Import after mocks ──────────────────────────────────────────────────────

import {
  getConsignors,
  getConsignorById,
  getConsignorLots,
  createConsignor,
  updateConsignor,
  deleteConsignor,
  listActiveConsignors,
} from '../../../db/queries/consignors';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeConsignorRow(overrides = {}) {
  return {
    id: 'consignor-1',
    name: 'Jan Kowalski',
    email: 'jan@example.com',
    phone: '+48123456789',
    companyName: 'Sztuka Sp. z o.o.',
    taxId: '1234567890',
    commissionRate: '0.1000',
    isActive: true,
    createdAt: new Date(),
    deletedAt: null,
    updatedAt: new Date(),
    address: 'ul. Główna 1',
    city: 'Poznań',
    postalCode: '61-001',
    country: 'Poland',
    notes: '',
    ...overrides,
  };
}

function makeLotRow(overrides = {}) {
  return {
    lotId: 'lot-1',
    lotNumber: 1,
    title: 'Obraz olejny',
    artist: 'Jan Matejko',
    status: 'active',
    estimateMin: '10000',
    estimateMax: '20000',
    hammerPrice: null,
    auctionId: 'auction-1',
    auctionTitle: 'Wiosenna Aukcja 2026',
    auctionSlug: 'wiosenna-2026',
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * Set up mocks for getConsignors which uses Promise.all([rowsQuery, countQuery]).
 * Both start with db.select(), alternating between rows and count queries.
 */
function setupGetConsignorsMocks(rows: unknown[] = [], total = 0) {
  let callCount = 0;

  mockSelect.mockImplementation(() => {
    callCount++;

    if (callCount % 2 === 1) {
      // Rows query: select → from → leftJoin → where → groupBy → orderBy → limit → offset
      const mockOffset = vi.fn().mockResolvedValue(rows);
      const mockLimit = vi.fn().mockReturnValue({ offset: mockOffset });
      const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockGroupBy = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockWhere = vi.fn().mockReturnValue({ groupBy: mockGroupBy });
      const mockLeftJoin = vi.fn().mockReturnValue({ where: mockWhere });
      return { from: vi.fn().mockReturnValue({ leftJoin: mockLeftJoin }) };
    } else {
      // Count query: select → from → where → resolves [{total}]
      const mockCountWhere = vi.fn().mockResolvedValue([{ total }]);
      return { from: vi.fn().mockReturnValue({ where: mockCountWhere }) };
    }
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('db/queries/consignors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupGetConsignorsMocks();
  });

  // ── getConsignors ───────────────────────────────────────────────────────

  describe('getConsignors', () => {
    it('returns paginated result with defaults (page=1, limit=20)', async () => {
      setupGetConsignorsMocks([makeConsignorRow()], 1);

      const result = await getConsignors();

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.total).toBe(1);
    });

    it('applies isActive=true filter via eq', async () => {
      const { eq } = await import('drizzle-orm');
      setupGetConsignorsMocks();

      await getConsignors({ isActive: true });

      expect(eq).toHaveBeenCalledWith(expect.anything(), true);
    });

    it('applies isActive=false filter via eq', async () => {
      const { eq } = await import('drizzle-orm');
      setupGetConsignorsMocks();

      await getConsignors({ isActive: false });

      expect(eq).toHaveBeenCalledWith(expect.anything(), false);
    });

    it('does NOT apply isActive filter when isActive is undefined', async () => {
      const { eq } = await import('drizzle-orm');
      setupGetConsignorsMocks();

      // Clear tracked calls for eq so we can check if isActive-related eq was called
      vi.clearAllMocks();
      setupGetConsignorsMocks();

      await getConsignors({ isActive: undefined });

      // eq should NOT have been called with a boolean (no isActive filter)
      const eqBoolCalls = (eq as ReturnType<typeof vi.fn>).mock.calls.filter(
        (c) => typeof c[1] === 'boolean',
      );
      expect(eqBoolCalls).toHaveLength(0);
    });

    it('applies search filter using ilike on multiple columns', async () => {
      const { ilike, or } = await import('drizzle-orm');
      setupGetConsignorsMocks();

      await getConsignors({ search: 'Kowalski' });

      expect(ilike).toHaveBeenCalled();
      expect(or).toHaveBeenCalled();
      // Pattern should be wrapped with %
      const ilikeCalls = (ilike as ReturnType<typeof vi.fn>).mock.calls;
      const patterns = ilikeCalls.map((c) => c[1]);
      expect(patterns).toContain('%Kowalski%');
    });

    it('applies both search and isActive filters together', async () => {
      const { ilike, eq } = await import('drizzle-orm');
      setupGetConsignorsMocks();

      await getConsignors({ search: 'Sztuka', isActive: true });

      expect(ilike).toHaveBeenCalled();
      expect(eq).toHaveBeenCalledWith(expect.anything(), true);
    });

    it('uses custom page and limit', async () => {
      setupGetConsignorsMocks([], 100);

      const result = await getConsignors({ page: 2, limit: 10 });

      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(10); // ceil(100/10)
    });

    it('calculates totalPages correctly', async () => {
      setupGetConsignorsMocks([], 45);

      const result = await getConsignors({ limit: 20 });

      expect(result.totalPages).toBe(3); // ceil(45/20)
    });
  });

  // ── getConsignorById ────────────────────────────────────────────────────

  describe('getConsignorById', () => {
    it('returns null when consignor not found', async () => {
      let callCount = 0;
      mockSelect.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          const mockLimit = vi.fn().mockResolvedValue([]);
          const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
          return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
        }
        return { from: vi.fn() };
      });

      const result = await getConsignorById('nonexistent');

      expect(result).toBeNull();
    });

    it('returns consignor with lotCount and soldLotCount when found', async () => {
      const consignorRow = makeConsignorRow();
      let callCount = 0;

      mockSelect.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // consignor row
          const mockLimit = vi.fn().mockResolvedValue([consignorRow]);
          const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
          return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
        } else if (callCount === 2) {
          // lotCount query
          const mockWhere = vi.fn().mockResolvedValue([{ total: 5 }]);
          return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
        } else {
          // soldLotCount query
          const mockWhere = vi.fn().mockResolvedValue([{ total: 2 }]);
          return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
        }
      });

      const result = await getConsignorById('consignor-1');

      expect(result).not.toBeNull();
      expect(result!.lotCount).toBe(5);
      expect(result!.soldLotCount).toBe(2);
      expect(result!.name).toBe('Jan Kowalski');
    });

    it('runs three separate select queries when consignor is found', async () => {
      let callCount = 0;
      mockSelect.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          const mockLimit = vi.fn().mockResolvedValue([makeConsignorRow()]);
          const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
          return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
        } else {
          const mockWhere = vi.fn().mockResolvedValue([{ total: 0 }]);
          return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
        }
      });

      await getConsignorById('consignor-1');

      // 1 for the consignor, 1 for lotCount, 1 for soldLotCount
      expect(mockSelect).toHaveBeenCalledTimes(3);
    });
  });

  // ── getConsignorLots ────────────────────────────────────────────────────

  describe('getConsignorLots', () => {
    function setupLotsMocks(rows: unknown[] = []) {
      const mockOrderBy = vi.fn().mockResolvedValue(rows);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({ innerJoin: mockInnerJoin }),
      });
      return { mockOrderBy, mockWhere, mockInnerJoin };
    }

    it('returns lots for a given consignor with auction info', async () => {
      const lots = [makeLotRow(), makeLotRow({ lotId: 'lot-2', lotNumber: 2 })];
      setupLotsMocks(lots);

      const result = await getConsignorLots('consignor-1');

      expect(result).toHaveLength(2);
    });

    it('returns empty array when consignor has no lots', async () => {
      setupLotsMocks([]);

      const result = await getConsignorLots('consignor-no-lots');

      expect(result).toEqual([]);
    });

    it('uses innerJoin with auctions table', async () => {
      const { mockInnerJoin } = setupLotsMocks([]);

      await getConsignorLots('consignor-1');

      expect(mockInnerJoin).toHaveBeenCalled();
    });

    it('filters by consignorId using eq', async () => {
      const { eq } = await import('drizzle-orm');
      setupLotsMocks([]);

      await getConsignorLots('consignor-42');

      expect(eq).toHaveBeenCalledWith(expect.anything(), 'consignor-42');
    });

    it('returns lot data with expected shape', async () => {
      const lotRow = makeLotRow({ status: 'sold', hammerPrice: '15000' });
      setupLotsMocks([lotRow]);

      const result = await getConsignorLots('consignor-1');

      expect(result[0]).toMatchObject({
        lotId: 'lot-1',
        status: 'sold',
        auctionTitle: 'Wiosenna Aukcja 2026',
      });
    });

    it('orders results by createdAt descending', async () => {
      const { desc } = await import('drizzle-orm');
      const { mockOrderBy } = setupLotsMocks([]);

      await getConsignorLots('consignor-1');

      expect(desc).toHaveBeenCalled();
      expect(mockOrderBy).toHaveBeenCalled();
    });
  });

  // ── createConsignor ─────────────────────────────────────────────────────

  describe('createConsignor', () => {
    beforeEach(() => {
      const mockReturning = vi.fn().mockResolvedValue([]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      mockInsert.mockReturnValue({ values: mockValues });
    });

    it('inserts consignor with all provided fields', async () => {
      const created = makeConsignorRow();
      const mockReturning = vi.fn().mockResolvedValue([created]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      mockInsert.mockReturnValue({ values: mockValues });

      const result = await createConsignor({
        name: 'Jan Kowalski',
        email: 'jan@example.com',
        phone: '+48123456789',
        companyName: 'Sztuka Sp. z o.o.',
        taxId: '1234567890',
        commissionRate: '0.1500',
        country: 'Poland',
        isActive: true,
      });

      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalled();
      expect(result).toMatchObject({ name: 'Jan Kowalski' });
    });

    it('uses defaults for optional fields not provided', async () => {
      const created = makeConsignorRow({ email: null });
      const mockReturning = vi.fn().mockResolvedValue([created]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      mockInsert.mockReturnValue({ values: mockValues });

      await createConsignor({ name: 'Basic Consignor' });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Basic Consignor',
          email: null,
          phone: '',
          country: 'Poland',
          commissionRate: '0.1000',
          isActive: true,
        }),
      );
    });
  });

  // ── updateConsignor ─────────────────────────────────────────────────────

  describe('updateConsignor', () => {
    function setupUpdateMock(returnRow: unknown) {
      const mockReturning = vi.fn().mockResolvedValue([returnRow]);
      const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
      mockUpdate.mockReturnValue({ set: mockSet });
      return { mockSet, mockReturning, mockUpdateWhere };
    }

    it('builds update values only for provided fields', async () => {
      const updated = makeConsignorRow({ name: 'Updated Name' });
      const { mockSet } = setupUpdateMock(updated);

      const result = await updateConsignor('consignor-1', { name: 'Updated Name' });

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Updated Name' }),
      );
      expect(result).toMatchObject({ name: 'Updated Name' });
    });

    it('includes updatedAt in every update', async () => {
      const { mockSet } = setupUpdateMock(makeConsignorRow());

      await updateConsignor('consignor-1', { phone: '+48000000000' });

      const setArgs = (mockSet as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(setArgs).toHaveProperty('updatedAt');
      expect(setArgs.updatedAt).toBeInstanceOf(Date);
    });

    it('updates isActive field', async () => {
      const { mockSet } = setupUpdateMock(makeConsignorRow({ isActive: false }));

      await updateConsignor('consignor-1', { isActive: false });

      const setArgs = (mockSet as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(setArgs.isActive).toBe(false);
    });

    it('does not include fields not in the update data', async () => {
      const { mockSet } = setupUpdateMock(makeConsignorRow());

      await updateConsignor('consignor-1', { name: 'New Name' });

      const setArgs = (mockSet as ReturnType<typeof vi.fn>).mock.calls[0][0];
      // email was not provided, should not be in update
      expect(setArgs).not.toHaveProperty('email');
    });
  });

  // ── deleteConsignor ─────────────────────────────────────────────────────

  describe('deleteConsignor', () => {
    it('soft-deletes by setting deletedAt and isActive=false', async () => {
      const softDeleted = makeConsignorRow({ isActive: false, deletedAt: new Date() });
      const mockReturning = vi.fn().mockResolvedValue([softDeleted]);
      const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
      mockUpdate.mockReturnValue({ set: mockSet });

      const result = await deleteConsignor('consignor-1');

      const setArgs = (mockSet as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(setArgs).toHaveProperty('deletedAt');
      expect(setArgs.isActive).toBe(false);
      expect(result).toMatchObject({ isActive: false });
    });
  });

  // ── listActiveConsignors ────────────────────────────────────────────────

  describe('listActiveConsignors', () => {
    function setupListActiveMocks(rows: unknown[] = []) {
      const mockOrderBy = vi.fn().mockResolvedValue(rows);
      const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({ where: mockWhere }),
      });
      return { mockOrderBy, mockWhere };
    }

    it('returns list of active non-deleted consignors', async () => {
      const activeConsignors = [
        { id: 'c-1', name: 'Jan Kowalski', companyName: 'Sztuka Sp. z o.o.' },
        { id: 'c-2', name: 'Maria Nowak', companyName: '' },
      ];
      setupListActiveMocks(activeConsignors);

      const result = await listActiveConsignors();

      expect(mockSelect).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ name: 'Jan Kowalski' });
    });

    it('returns empty array when no active consignors exist', async () => {
      setupListActiveMocks([]);

      const result = await listActiveConsignors();

      expect(result).toEqual([]);
    });

    it('applies notDeleted and isActive=true conditions', async () => {
      const { eq, and } = await import('drizzle-orm');
      const { notDeleted } = await import('../../../db/helpers');
      setupListActiveMocks([]);

      await listActiveConsignors();

      expect(notDeleted).toHaveBeenCalled();
      expect(eq).toHaveBeenCalledWith(expect.anything(), true);
      expect(and).toHaveBeenCalled();
    });

    it('orders results by name', async () => {
      const { mockOrderBy } = setupListActiveMocks([]);

      await listActiveConsignors();

      expect(mockOrderBy).toHaveBeenCalled();
    });

    it('returns only id, name and companyName fields', async () => {
      const rows = [{ id: 'c-1', name: 'Anna', companyName: 'Art Gallery' }];
      setupListActiveMocks(rows);

      const result = await listActiveConsignors();

      // The select should project only those 3 fields
      expect(mockSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.anything(),
          name: expect.anything(),
          companyName: expect.anything(),
        }),
      );
    });
  });
});
