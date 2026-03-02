import { describe, it, expect } from 'vitest';
import { createLotSchema, updateLotSchema } from '@/lib/validation/lot';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

const VALID_LOT = {
  auctionId: VALID_UUID,
  lotNumber: 1,
  title: 'Sunset Painting',
};

describe('createLotSchema', () => {
  describe('required fields', () => {
    it('accepts valid lot', () => {
      const result = createLotSchema.safeParse(VALID_LOT);
      expect(result.success).toBe(true);
    });

    it('rejects missing auctionId', () => {
      const { auctionId: _a, ...rest } = VALID_LOT;
      const result = createLotSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('rejects invalid auctionId (not UUID)', () => {
      const result = createLotSchema.safeParse({ ...VALID_LOT, auctionId: 'not-a-uuid' });
      expect(result.success).toBe(false);
    });

    it('rejects missing lotNumber', () => {
      const { lotNumber: _n, ...rest } = VALID_LOT;
      const result = createLotSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('rejects zero lotNumber', () => {
      const result = createLotSchema.safeParse({ ...VALID_LOT, lotNumber: 0 });
      expect(result.success).toBe(false);
    });

    it('rejects negative lotNumber', () => {
      const result = createLotSchema.safeParse({ ...VALID_LOT, lotNumber: -1 });
      expect(result.success).toBe(false);
    });

    it('rejects missing title', () => {
      const { title: _t, ...rest } = VALID_LOT;
      const result = createLotSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('rejects empty title', () => {
      const result = createLotSchema.safeParse({ ...VALID_LOT, title: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('numeric estimates', () => {
    it('accepts estimateMin = 0', () => {
      const result = createLotSchema.safeParse({ ...VALID_LOT, estimateMin: 0 });
      expect(result.success).toBe(true);
    });

    it('rejects negative estimateMin', () => {
      const result = createLotSchema.safeParse({ ...VALID_LOT, estimateMin: -1 });
      expect(result.success).toBe(false);
    });

    it('rejects negative estimateMax', () => {
      const result = createLotSchema.safeParse({ ...VALID_LOT, estimateMax: -1 });
      expect(result.success).toBe(false);
    });

    it('accepts null reservePrice', () => {
      const result = createLotSchema.safeParse({ ...VALID_LOT, reservePrice: null });
      expect(result.success).toBe(true);
    });

    it('accepts positive reservePrice', () => {
      const result = createLotSchema.safeParse({ ...VALID_LOT, reservePrice: 3000 });
      expect(result.success).toBe(true);
    });

    it('accepts null startingBid', () => {
      const result = createLotSchema.safeParse({ ...VALID_LOT, startingBid: null });
      expect(result.success).toBe(true);
    });
  });

  describe('defaults', () => {
    it('defaults artist to empty string', () => {
      const result = createLotSchema.parse(VALID_LOT);
      expect(result.artist).toBe('');
    });

    it('defaults description to empty string', () => {
      const result = createLotSchema.parse(VALID_LOT);
      expect(result.description).toBe('');
    });

    it('defaults estimateMin to 0', () => {
      const result = createLotSchema.parse(VALID_LOT);
      expect(result.estimateMin).toBe(0);
    });

    it('defaults provenance to empty array', () => {
      const result = createLotSchema.parse(VALID_LOT);
      expect(result.provenance).toEqual([]);
    });
  });
});

describe('updateLotSchema', () => {
  it('accepts empty object (all fields optional)', () => {
    const result = updateLotSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts partial update with just title', () => {
    const result = updateLotSchema.safeParse({ title: 'New Title' });
    expect(result.success).toBe(true);
  });

  it('does not include auctionId (omitted)', () => {
    const result = updateLotSchema.safeParse({ auctionId: VALID_UUID });
    // auctionId is omitted from updateLotSchema, so it should be stripped or cause failure
    // zod .omit() with .partial() means auctionId is not in the schema - it will be stripped
    if (result.success) {
      expect((result.data as Record<string, unknown>).auctionId).toBeUndefined();
    }
  });

  it('validates lotNumber as positive integer when provided', () => {
    const result = updateLotSchema.safeParse({ lotNumber: -1 });
    expect(result.success).toBe(false);
  });
});
