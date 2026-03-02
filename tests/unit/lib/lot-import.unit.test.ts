import { describe, it, expect, vi } from 'vitest';

// Mock DB dependencies so parseLotCSV (the pure function) can be imported
vi.mock('@/db/connection', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue([{ id: 'lot-1' }]),
    returning: vi.fn().mockResolvedValue([{ id: 'lot-1' }]),
  },
}));

vi.mock('@/db/schema', () => ({
  lots: {},
}));

vi.mock('@/lib/audit', () => ({
  logCreate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  isNull: vi.fn(),
  and: vi.fn(),
  max: vi.fn(),
}));

import { parseLotCSV } from '@/lib/lot-import';

const VALID_CSV = `lot_number,title,artist,description,medium,dimensions,year,estimate_min,estimate_max,reserve_price,starting_bid
1,Sunset Painting,Jan Nowak,Beautiful oil painting,Oil on canvas,50x70 cm,2020,5000,8000,,
2,Abstract Study,Anna Kowalska,Abstract work,Acrylic,40x60 cm,,3000,5000,,`;

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

    it('returns error for invalid year', () => {
      const csv = `lot_number,title,year\n1,My Painting,not-a-year`;
      const result = parseLotCSV(csv);
      expect(result.errors.some(e => e.field === 'year')).toBe(true);
    });

    it('returns error when estimate_min > estimate_max', () => {
      const csv = `lot_number,title,estimate_min,estimate_max\n1,My Painting,10000,5000`;
      const result = parseLotCSV(csv);
      expect(result.errors.some(e => e.field === 'estimate_max')).toBe(true);
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
});
