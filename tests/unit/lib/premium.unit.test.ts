import { describe, it, expect } from 'vitest';
import {
  calculatePremium,
  calculateFlatPremium,
  formatRate,
  STANDARD_TIERS,
  type PremiumTier,
} from '@/lib/premium';

describe('calculatePremium', () => {
  describe('empty tiers', () => {
    it('returns zero premium and empty breakdown for empty tiers', () => {
      const result = calculatePremium(100000, []);
      expect(result.premium).toBe(0);
      expect(result.breakdown).toEqual([]);
    });
  });

  describe('STANDARD_TIERS (0-100k @ 25%, 100k-500k @ 20%, 500k+ @ 12%)', () => {
    it('applies only tier 1 for hammer price within first tier', () => {
      const result = calculatePremium(50000, STANDARD_TIERS);
      expect(result.premium).toBe(12500); // 50000 * 0.25
      expect(result.breakdown).toHaveLength(1);
      expect(result.breakdown[0].rate).toBe(0.25);
    });

    it('applies tier 1 fully + tier 2 partially', () => {
      const result = calculatePremium(200000, STANDARD_TIERS);
      // Tier1: 100000 * 0.25 = 25000
      // Tier2: 100000 * 0.20 = 20000
      // Total: 45000
      expect(result.premium).toBe(45000);
      expect(result.breakdown).toHaveLength(2);
    });

    it('applies all three tiers for 600k hammer price', () => {
      const result = calculatePremium(600000, STANDARD_TIERS);
      // Tier1: 100000 * 0.25 = 25000
      // Tier2: 400000 * 0.20 = 80000
      // Tier3: 100000 * 0.12 = 12000
      // Total: 117000
      expect(result.premium).toBe(117000);
      expect(result.breakdown).toHaveLength(3);
    });

    it('at exactly tier 1 boundary (100 000)', () => {
      const result = calculatePremium(100000, STANDARD_TIERS);
      // Tier1: 100000 * 0.25 = 25000
      expect(result.premium).toBe(25000);
    });

    it('at exactly tier 2 boundary (500 000)', () => {
      const result = calculatePremium(500000, STANDARD_TIERS);
      // Tier1: 100000 * 0.25 = 25000
      // Tier2: 400000 * 0.20 = 80000
      expect(result.premium).toBe(105000);
    });

    it('breakdown items have correct range labels', () => {
      const result = calculatePremium(600000, STANDARD_TIERS);
      expect(result.breakdown[0].range).toContain('PLN');
      expect(result.breakdown[2].range).toContain('+');
    });
  });

  describe('custom tiers', () => {
    it('handles single tier with null maxAmount (unlimited)', () => {
      const tiers: PremiumTier[] = [{ minAmount: 0, maxAmount: null, rate: 0.1 }];
      const result = calculatePremium(50000, tiers);
      expect(result.premium).toBe(5000);
      expect(result.breakdown).toHaveLength(1);
    });

    it('handles string rate', () => {
      const tiers: PremiumTier[] = [{ minAmount: 0, maxAmount: null, rate: '0.2500' }];
      const result = calculatePremium(100000, tiers);
      expect(result.premium).toBe(25000);
    });

    it('handles hammer price of 0', () => {
      const result = calculatePremium(0, STANDARD_TIERS);
      expect(result.premium).toBe(0);
    });

    it('sorts tiers by minAmount defensively', () => {
      const unorderedTiers: PremiumTier[] = [
        { minAmount: 100000, maxAmount: 500000, rate: 0.20 },
        { minAmount: 0, maxAmount: 100000, rate: 0.25 },
        { minAmount: 500000, maxAmount: null, rate: 0.12 },
      ];
      const result = calculatePremium(600000, unorderedTiers);
      expect(result.premium).toBe(117000);
    });

    it('rounds premium to integer', () => {
      const tiers: PremiumTier[] = [{ minAmount: 0, maxAmount: null, rate: 0.15 }];
      const result = calculatePremium(1, tiers);
      // 1 * 0.15 = 0.15 → Math.round → 0
      expect(Number.isInteger(result.premium)).toBe(true);
    });
  });
});

describe('calculateFlatPremium', () => {
  it('calculates flat premium at 20%', () => {
    const result = calculateFlatPremium(100000, 0.2);
    expect(result.premium).toBe(20000);
    expect(result.breakdown).toHaveLength(1);
    expect(result.breakdown[0].range).toBe('Flat rate');
    expect(result.breakdown[0].rate).toBe(0.2);
  });

  it('calculates flat premium at 25%', () => {
    const result = calculateFlatPremium(50000, 0.25);
    expect(result.premium).toBe(12500);
  });

  it('returns zero premium for zero hammer price', () => {
    const result = calculateFlatPremium(0, 0.2);
    expect(result.premium).toBe(0);
  });

  it('rounds to nearest integer', () => {
    const result = calculateFlatPremium(3, 0.33);
    expect(Number.isInteger(result.premium)).toBe(true);
  });
});

describe('formatRate', () => {
  it('formats 0.25 as "25%"', () => {
    expect(formatRate(0.25)).toBe('25%');
  });

  it('formats 0.20 as "20%"', () => {
    expect(formatRate(0.2)).toBe('20%');
  });

  it('formats 0.12 as "12%"', () => {
    expect(formatRate(0.12)).toBe('12%');
  });

  it('formats 0 as "0%"', () => {
    expect(formatRate(0)).toBe('0%');
  });

  it('formats 1 as "100%"', () => {
    expect(formatRate(1)).toBe('100%');
  });
});
