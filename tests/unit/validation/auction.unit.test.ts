import { describe, it, expect } from 'vitest';
import { createAuctionSchema, updateAuctionSchema } from '@/lib/validation/auction';

const VALID_AUCTION = {
  title: 'Spring Auction 2026',
  slug: 'spring-auction-2026',
  startDate: '2026-03-01T10:00:00+00:00',
  endDate: '2026-03-01T14:00:00+00:00',
};

describe('createAuctionSchema', () => {
  describe('required fields', () => {
    it('accepts valid auction', () => {
      const result = createAuctionSchema.safeParse(VALID_AUCTION);
      expect(result.success).toBe(true);
    });

    it('rejects missing title', () => {
      const { title: _title, ...rest } = VALID_AUCTION;
      const result = createAuctionSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('rejects empty title', () => {
      const result = createAuctionSchema.safeParse({ ...VALID_AUCTION, title: '' });
      expect(result.success).toBe(false);
    });

    it('rejects missing slug', () => {
      const { slug: _slug, ...rest } = VALID_AUCTION;
      const result = createAuctionSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('rejects missing startDate', () => {
      const { startDate: _s, ...rest } = VALID_AUCTION;
      const result = createAuctionSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('rejects missing endDate', () => {
      const { endDate: _e, ...rest } = VALID_AUCTION;
      const result = createAuctionSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });
  });

  describe('slug format (kebab-case)', () => {
    it('accepts lowercase alphanumeric slug', () => {
      const result = createAuctionSchema.safeParse({ ...VALID_AUCTION, slug: 'my-auction-2026' });
      expect(result.success).toBe(true);
    });

    it('rejects uppercase letters', () => {
      const result = createAuctionSchema.safeParse({ ...VALID_AUCTION, slug: 'My-Auction' });
      expect(result.success).toBe(false);
    });

    it('rejects spaces', () => {
      const result = createAuctionSchema.safeParse({ ...VALID_AUCTION, slug: 'my auction' });
      expect(result.success).toBe(false);
    });

    it('rejects underscores', () => {
      const result = createAuctionSchema.safeParse({ ...VALID_AUCTION, slug: 'my_auction' });
      expect(result.success).toBe(false);
    });

    it('accepts numbers and hyphens', () => {
      const result = createAuctionSchema.safeParse({ ...VALID_AUCTION, slug: 'auction-123' });
      expect(result.success).toBe(true);
    });
  });

  describe('date validation', () => {
    it('rejects invalid date format', () => {
      const result = createAuctionSchema.safeParse({
        ...VALID_AUCTION,
        startDate: '2026-03-01',
      });
      expect(result.success).toBe(false);
    });

    it('rejects date without offset', () => {
      const result = createAuctionSchema.safeParse({
        ...VALID_AUCTION,
        startDate: '2026-03-01T10:00:00',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('defaults', () => {
    it('defaults description to empty string', () => {
      const result = createAuctionSchema.parse(VALID_AUCTION);
      expect(result.description).toBe('');
    });

    it('defaults category to "mixed"', () => {
      const result = createAuctionSchema.parse(VALID_AUCTION);
      expect(result.category).toBe('mixed');
    });

    it('defaults visibilityLevel to "0"', () => {
      const result = createAuctionSchema.parse(VALID_AUCTION);
      expect(result.visibilityLevel).toBe('0');
    });

    it('defaults buyersPremiumRate to "0.2000"', () => {
      const result = createAuctionSchema.parse(VALID_AUCTION);
      expect(result.buyersPremiumRate).toBe('0.2000');
    });
  });
});

describe('updateAuctionSchema', () => {
  it('accepts empty object (all fields optional)', () => {
    const result = updateAuctionSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts partial update with just title', () => {
    const result = updateAuctionSchema.safeParse({ title: 'New Title' });
    expect(result.success).toBe(true);
  });

  it('validates slug format when provided', () => {
    const result = updateAuctionSchema.safeParse({ slug: 'Invalid Slug' });
    expect(result.success).toBe(false);
  });
});
