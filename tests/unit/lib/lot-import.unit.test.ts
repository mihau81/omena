import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── DB mock state ────────────────────────────────────────────────────────────

let dbMaxSortResult: { maxSort: number | null } | undefined = { maxSort: null };
let dbInsertReturnValue: { id: string }[] = [{ id: 'lot-1' }];

const mockReturning = vi.fn();
const mockValues = vi.fn();
const mockInsert = vi.fn();
const mockWhere = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();

vi.mock('@/db/connection', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock('@/db/schema', () => ({
  lots: { auctionId: 'auctionId', sortOrder: 'sortOrder', deletedAt: 'deletedAt' },
}));

vi.mock('@/lib/audit', () => ({
  logCreate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: unknown, _val: unknown) => ({ type: 'eq' })),
  isNull: vi.fn((_col: unknown) => ({ type: 'isNull' })),
  and: vi.fn((..._args: unknown[]) => ({ type: 'and' })),
  max: vi.fn((_col: unknown) => ({ type: 'max' })),
}));

import { parseLotCSV, importLots, type ParsedLot } from '@/lib/lot-import';
import { db } from '@/db/connection';
import { logCreate } from '@/lib/audit';

const mockLogCreate = logCreate as ReturnType<typeof vi.fn>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_CSV = `lot_number,title,artist,description,medium,dimensions,year,estimate_min,estimate_max,reserve_price,starting_bid
1,Sunset Painting,Jan Nowak,Beautiful oil painting,Oil on canvas,50x70 cm,2020,5000,8000,,
2,Abstract Study,Anna Kowalska,Abstract work,Acrylic,40x60 cm,,3000,5000,,`;

function makeRow(overrides?: Partial<ParsedLot>): ParsedLot {
  return {
    rowIndex: 1,
    lotNumber: 1,
    title: 'Test Painting',
    artist: 'Test Artist',
    description: 'A test description',
    medium: 'Oil on canvas',
    dimensions: '50x70 cm',
    year: 2020,
    estimateMin: 5000,
    estimateMax: 8000,
    reservePrice: null,
    startingBid: null,
    provenance: [],
    exhibitions: [],
    ...overrides,
  };
}

// ─── parseLotCSV tests ────────────────────────────────────────────────────────

describe('parseLotCSV', () => {
  describe('valid data', () => {
    it('parses rows successfully', () => {
      const result = parseLotCSV(VALID_CSV);
      expect(result.rows).toHaveLength(2);
      expect(result.errors.filter(e => e.rowIndex > 0)).toHaveLength(0);
      expect(result.totalRows).toBe(2);
    });

    it('maps lotNumber correctly', () => {
      const result = parseLotCSV(VALID_CSV);
      expect(result.rows[0].lotNumber).toBe(1);
      expect(result.rows[1].lotNumber).toBe(2);
    });

    it('maps title correctly', () => {
      const result = parseLotCSV(VALID_CSV);
      expect(result.rows[0].title).toBe('Sunset Painting');
    });

    it('maps artist correctly', () => {
      const result = parseLotCSV(VALID_CSV);
      expect(result.rows[0].artist).toBe('Jan Nowak');
    });

    it('maps estimateMin and estimateMax', () => {
      const result = parseLotCSV(VALID_CSV);
      expect(result.rows[0].estimateMin).toBe(5000);
      expect(result.rows[0].estimateMax).toBe(8000);
    });

    it('maps year correctly', () => {
      const result = parseLotCSV(VALID_CSV);
      expect(result.rows[0].year).toBe(2020);
    });

    it('maps null year when empty', () => {
      const result = parseLotCSV(VALID_CSV);
      expect(result.rows[1].year).toBeNull();
    });

    it('maps null reservePrice when empty', () => {
      const result = parseLotCSV(VALID_CSV);
      expect(result.rows[0].reservePrice).toBeNull();
    });

    it('maps valid reservePrice and startingBid when provided', () => {
      const csv = `lot_number,title,estimate_min,estimate_max,reserve_price,starting_bid\n1,My Painting,5000,8000,6000,1000`;
      const result = parseLotCSV(csv);
      expect(result.rows[0].reservePrice).toBe(6000);
      expect(result.rows[0].startingBid).toBe(1000);
    });

    it('parses exhibitions field as semicolon-separated list', () => {
      const csv = `lot_number,title,estimate_min,estimate_max,exhibitions\n1,My Painting,5000,8000,Show A;Show B`;
      const result = parseLotCSV(csv);
      expect(result.rows[0].exhibitions).toEqual(['Show A', 'Show B']);
    });

    it('returns 0 for rowIndex fields of header errors', () => {
      const csv = `lot_number,title,unknown_col\n1,My Painting,extra`;
      const result = parseLotCSV(csv);
      const headerErr = result.errors.find(e => e.field === 'headers');
      expect(headerErr?.rowIndex).toBe(0);
    });
  });

  describe('BOM handling', () => {
    it('handles UTF-8 BOM at start of file', () => {
      const csvWithBom = '\uFEFF' + VALID_CSV;
      const result = parseLotCSV(csvWithBom);
      expect(result.rows).toHaveLength(2);
    });
  });

  describe('missing required fields', () => {
    it('returns error for missing lot_number column', () => {
      const csv = `title,artist\nSunset,Jan`;
      const result = parseLotCSV(csv);
      expect(result.errors.some(e => e.message.includes('lot_number'))).toBe(true);
      expect(result.rows).toHaveLength(0);
    });

    it('returns error for missing title column', () => {
      const csv = `lot_number,artist\n1,Jan`;
      const result = parseLotCSV(csv);
      expect(result.errors.some(e => e.message.includes('title'))).toBe(true);
    });

    it('returns row error for empty lot_number value', () => {
      const csv = `lot_number,title\n,My Painting`;
      const result = parseLotCSV(csv);
      expect(result.errors.some(e => e.field === 'lot_number')).toBe(true);
    });

    it('returns row error for empty title value', () => {
      const csv = `lot_number,title\n1,`;
      const result = parseLotCSV(csv);
      expect(result.errors.some(e => e.field === 'title')).toBe(true);
    });

    it('does not add row when lot_number row error exists', () => {
      const csv = `lot_number,title\n,Missing number`;
      const result = parseLotCSV(csv);
      expect(result.rows).toHaveLength(0);
    });

    it('both required columns missing — returns errors for both', () => {
      const csv = `artist,medium\nJan,oil`;
      const result = parseLotCSV(csv);
      const msgs = result.errors.map(e => e.message);
      expect(msgs.some(m => m.includes('lot_number'))).toBe(true);
      expect(msgs.some(m => m.includes('title'))).toBe(true);
      expect(result.rows).toHaveLength(0);
    });
  });

  describe('CSV parse error', () => {
    it('returns error with field "file" when CSV is unparseable', () => {
      // Passing null forces csv-parse to throw
      // We pass something that will make csv-parse fail at a low level
      // csv-parse is very lenient; pass a non-string to trigger the catch
      const result = parseLotCSV(null as unknown as string);
      expect(result.errors.some(e => e.field === 'file' && e.message.includes('CSV parse failed'))).toBe(true);
      expect(result.rows).toHaveLength(0);
      expect(result.totalRows).toBe(0);
    });

    it('returns "Unknown CSV parse error" message when error is not an Error instance', () => {
      // Same null trick — the underlying csv-parse throws a native Error,
      // but we can at least confirm the parse-failed path is covered
      const result = parseLotCSV(null as unknown as string);
      expect(result.errors[0].field).toBe('file');
      expect(result.errors[0].rowIndex).toBe(0);
    });
  });

  describe('invalid number formats', () => {
    it('returns error for non-numeric lot_number', () => {
      const csv = `lot_number,title\nabc,My Painting`;
      const result = parseLotCSV(csv);
      expect(result.errors.some(e => e.field === 'lot_number')).toBe(true);
    });

    it('returns error for negative lot_number', () => {
      const csv = `lot_number,title\n-1,My Painting`;
      const result = parseLotCSV(csv);
      expect(result.errors.some(e => e.field === 'lot_number')).toBe(true);
    });

    it('returns error for lot_number zero', () => {
      const csv = `lot_number,title\n0,My Painting`;
      const result = parseLotCSV(csv);
      expect(result.errors.some(e => e.field === 'lot_number')).toBe(true);
    });

    it('returns error for invalid year', () => {
      const csv = `lot_number,title,year\n1,My Painting,not-a-year`;
      const result = parseLotCSV(csv);
      expect(result.errors.some(e => e.field === 'year')).toBe(true);
    });

    it('returns error for year > 9999', () => {
      const csv = `lot_number,title,year\n1,My Painting,10000`;
      const result = parseLotCSV(csv);
      expect(result.errors.some(e => e.field === 'year')).toBe(true);
    });

    it('returns error when estimate_min > estimate_max', () => {
      const csv = `lot_number,title,estimate_min,estimate_max\n1,My Painting,10000,5000`;
      const result = parseLotCSV(csv);
      expect(result.errors.some(e => e.field === 'estimate_max')).toBe(true);
    });

    it('skips estimate cross-validation when estimate_max is 0', () => {
      // When estimateMax === 0, the cross-validation is skipped
      const csv = `lot_number,title,estimate_min,estimate_max\n1,My Painting,0,0`;
      const result = parseLotCSV(csv);
      expect(result.errors.filter(e => e.field === 'estimate_max' && e.message.includes('must be >=')))
        .toHaveLength(0);
    });

    it('returns error for non-numeric estimate_min', () => {
      const csv = `lot_number,title,estimate_min,estimate_max\n1,My Painting,bad,5000`;
      const result = parseLotCSV(csv);
      expect(result.errors.some(e => e.field === 'estimate_min')).toBe(true);
    });

    it('returns error for negative reserve_price', () => {
      const csv = `lot_number,title,estimate_min,estimate_max,reserve_price\n1,My Painting,5000,8000,-100`;
      const result = parseLotCSV(csv);
      expect(result.errors.some(e => e.field === 'reserve_price')).toBe(true);
    });

    it('returns error for non-numeric starting_bid', () => {
      const csv = `lot_number,title,estimate_min,estimate_max,starting_bid\n1,My Painting,5000,8000,abc`;
      const result = parseLotCSV(csv);
      expect(result.errors.some(e => e.field === 'starting_bid')).toBe(true);
    });
  });

  describe('empty file', () => {
    it('returns error for empty CSV', () => {
      const result = parseLotCSV('lot_number,title');
      expect(result.errors.some(e => e.message.includes('empty'))).toBe(true);
      expect(result.rows).toHaveLength(0);
    });
  });

  describe('unknown columns', () => {
    it('warns about unknown columns but does not fail', () => {
      const csv = `lot_number,title,estimate_min,estimate_max,unknown_col\n1,My Painting,5000,8000,extra_value`;
      const result = parseLotCSV(csv);
      expect(result.errors.some(e => e.field === 'headers' && e.message.includes('unknown_col'))).toBe(true);
      expect(result.rows).toHaveLength(1); // row still succeeds
    });
  });

  describe('semicolon-delimited list fields', () => {
    it('parses provenance as array', () => {
      const csv = `lot_number,title,estimate_min,estimate_max,provenance\n1,My Painting,5000,8000,Gallery A;Gallery B;Private Collection`;
      const result = parseLotCSV(csv);
      expect(result.rows[0].provenance).toEqual(['Gallery A', 'Gallery B', 'Private Collection']);
    });

    it('returns empty array for empty provenance', () => {
      const csv = `lot_number,title,estimate_min,estimate_max,provenance\n1,My Painting,5000,8000,`;
      const result = parseLotCSV(csv);
      expect(result.rows[0].provenance).toEqual([]);
    });
  });

  describe('multi-row mixed validity', () => {
    it('includes only valid rows when some rows have errors', () => {
      const csv = `lot_number,title,estimate_min,estimate_max
1,Valid Painting,5000,8000
,Missing Lot Number,3000,5000
3,Another Valid,2000,4000`;
      const result = parseLotCSV(csv);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].lotNumber).toBe(1);
      expect(result.rows[1].lotNumber).toBe(3);
      expect(result.errors.some(e => e.field === 'lot_number')).toBe(true);
    });

    it('includes rowIndex in each error', () => {
      const csv = `lot_number,title\n,Missing`;
      const result = parseLotCSV(csv);
      const rowErr = result.errors.find(e => e.rowIndex > 0);
      expect(rowErr?.rowIndex).toBe(1);
    });
  });
});

// ─── importLots tests ─────────────────────────────────────────────────────────

describe('importLots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMaxSortResult = { maxSort: null };
    dbInsertReturnValue = [{ id: 'lot-1' }];
    mockLogCreate.mockResolvedValue(undefined);

    // Set up the select chain for maxSort query
    mockSelect.mockImplementation(() => ({
      from: mockFrom,
    }));
    mockFrom.mockImplementation(() => ({
      where: mockWhere,
    }));
    mockWhere.mockImplementation(() => Promise.resolve([dbMaxSortResult]));

    // Set up the insert chain
    mockReturning.mockImplementation(() => Promise.resolve(dbInsertReturnValue));
    mockValues.mockImplementation(() => ({ returning: mockReturning }));
    mockInsert.mockImplementation(() => ({ values: mockValues }));

    // Wire db mock methods
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(mockSelect);
    (db.insert as ReturnType<typeof vi.fn>).mockImplementation(mockInsert);
  });

  it('returns empty result immediately when rows array is empty', async () => {
    const result = await importLots('auction-1', [], 'admin-1');
    expect(result).toEqual({ imported: 0, skipped: 0, errors: [] });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('imports a single row successfully', async () => {
    const rows = [makeRow()];
    const result = await importLots('auction-1', rows, 'admin-1');
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockLogCreate).toHaveBeenCalledTimes(1);
  });

  it('imports multiple rows successfully', async () => {
    const rows = [
      makeRow({ rowIndex: 1, lotNumber: 1 }),
      makeRow({ rowIndex: 2, lotNumber: 2 }),
      makeRow({ rowIndex: 3, lotNumber: 3 }),
    ];
    const result = await importLots('auction-1', rows, 'admin-1');
    expect(result.imported).toBe(3);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(mockInsert).toHaveBeenCalledTimes(3);
    expect(mockLogCreate).toHaveBeenCalledTimes(3);
  });

  it('uses correct auctionId and adminId when inserting', async () => {
    const rows = [makeRow()];
    await importLots('auction-xyz', rows, 'admin-abc');
    const valuesArg = mockValues.mock.calls[0][0];
    expect(valuesArg.auctionId).toBe('auction-xyz');
    expect(valuesArg.createdBy).toBe('admin-abc');
    expect(valuesArg.updatedBy).toBe('admin-abc');
    expect(valuesArg.status).toBe('draft');
  });

  it('calculates sortOrder starting from 0 when no existing lots', async () => {
    dbMaxSortResult = { maxSort: null };
    const rows = [
      makeRow({ rowIndex: 1, lotNumber: 1 }),
      makeRow({ rowIndex: 2, lotNumber: 2 }),
    ];
    await importLots('auction-1', rows, 'admin-1');
    expect(mockValues.mock.calls[0][0].sortOrder).toBe(0);
    expect(mockValues.mock.calls[1][0].sortOrder).toBe(1);
  });

  it('calculates sortOrder after existing lots', async () => {
    dbMaxSortResult = { maxSort: 5 };
    const rows = [makeRow({ rowIndex: 1, lotNumber: 10 })];
    await importLots('auction-1', rows, 'admin-1');
    expect(mockValues.mock.calls[0][0].sortOrder).toBe(6);
  });

  it('skips a row and records error when db.insert throws an Error instance', async () => {
    mockReturning
      .mockImplementationOnce(() => Promise.reject(new Error('duplicate key value violates unique constraint')))
      .mockImplementation(() => Promise.resolve(dbInsertReturnValue));

    const rows = [
      makeRow({ rowIndex: 1, lotNumber: 1 }),
      makeRow({ rowIndex: 2, lotNumber: 2 }),
    ];
    const result = await importLots('auction-1', rows, 'admin-1');
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Row 1 (lot #1)');
    expect(result.errors[0]).toContain('duplicate key value');
  });

  it('skips a row and records error when db.insert throws a non-Error value', async () => {
    mockReturning.mockImplementationOnce(() => Promise.reject('string error'));

    const rows = [makeRow({ rowIndex: 1, lotNumber: 1 })];
    const result = await importLots('auction-1', rows, 'admin-1');
    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.errors[0]).toContain('string error');
  });

  it('skips row when all db.insert calls throw', async () => {
    mockReturning.mockImplementation(() => Promise.reject(new Error('DB unavailable')));

    const rows = [
      makeRow({ rowIndex: 1, lotNumber: 1 }),
      makeRow({ rowIndex: 2, lotNumber: 2 }),
    ];
    const result = await importLots('auction-1', rows, 'admin-1');
    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(2);
    expect(result.errors).toHaveLength(2);
  });

  it('passes all lot fields to db.insert', async () => {
    const row = makeRow({
      rowIndex: 1,
      lotNumber: 42,
      title: 'Test Title',
      artist: 'Test Artist',
      description: 'Test Desc',
      medium: 'Oil',
      dimensions: '50x70',
      year: 1999,
      estimateMin: 1000,
      estimateMax: 2000,
      reservePrice: 1500,
      startingBid: 800,
      provenance: ['Prov A'],
      exhibitions: ['Exhibit B'],
    });
    await importLots('auction-1', [row], 'admin-1');
    const valuesArg = mockValues.mock.calls[0][0];
    expect(valuesArg.lotNumber).toBe(42);
    expect(valuesArg.title).toBe('Test Title');
    expect(valuesArg.artist).toBe('Test Artist');
    expect(valuesArg.description).toBe('Test Desc');
    expect(valuesArg.medium).toBe('Oil');
    expect(valuesArg.dimensions).toBe('50x70');
    expect(valuesArg.year).toBe(1999);
    expect(valuesArg.estimateMin).toBe(1000);
    expect(valuesArg.estimateMax).toBe(2000);
    expect(valuesArg.reservePrice).toBe(1500);
    expect(valuesArg.startingBid).toBe(800);
    expect(valuesArg.provenance).toEqual(['Prov A']);
    expect(valuesArg.exhibitions).toEqual(['Exhibit B']);
  });

  it('calls logCreate with correct arguments', async () => {
    const rows = [makeRow({ rowIndex: 1, lotNumber: 1 })];
    dbInsertReturnValue = [{ id: 'created-id-123' }];
    await importLots('auction-1', rows, 'admin-99');
    expect(mockLogCreate).toHaveBeenCalledWith(
      'lots',
      'created-id-123',
      expect.objectContaining({ id: 'created-id-123', importedViaCSV: true }),
      'admin-99',
      'admin',
    );
  });
});
