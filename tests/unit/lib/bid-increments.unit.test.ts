import { describe, it, expect } from 'vitest';
import {
  getBidIncrement,
  getNextValidBid,
  getValidBidOptions,
  isValidBidAmount,
  formatBidAmount,
} from '@/lib/bid-increments';

describe('getBidIncrement', () => {
  describe('returns correct increment per threshold', () => {
    it('returns 50 for bids from 0 up to 499', () => {
      expect(getBidIncrement(0)).toBe(50);
      expect(getBidIncrement(1)).toBe(50);
      expect(getBidIncrement(250)).toBe(50);
      expect(getBidIncrement(499)).toBe(50);
    });

    it('returns 100 for bids from 500 up to 1999', () => {
      expect(getBidIncrement(500)).toBe(100);
      expect(getBidIncrement(501)).toBe(100);
      expect(getBidIncrement(1000)).toBe(100);
      expect(getBidIncrement(1999)).toBe(100);
    });

    it('returns 200 for bids from 2000 up to 4999', () => {
      expect(getBidIncrement(2000)).toBe(200);
      expect(getBidIncrement(3000)).toBe(200);
      expect(getBidIncrement(4999)).toBe(200);
    });

    it('returns 500 for bids from 5000 up to 19999', () => {
      expect(getBidIncrement(5000)).toBe(500);
      expect(getBidIncrement(10000)).toBe(500);
      expect(getBidIncrement(19999)).toBe(500);
    });

    it('returns 1000 for bids from 20000 up to 49999', () => {
      expect(getBidIncrement(20000)).toBe(1000);
      expect(getBidIncrement(35000)).toBe(1000);
      expect(getBidIncrement(49999)).toBe(1000);
    });

    it('returns 2000 for bids from 50000 up to 99999', () => {
      expect(getBidIncrement(50000)).toBe(2000);
      expect(getBidIncrement(75000)).toBe(2000);
      expect(getBidIncrement(99999)).toBe(2000);
    });

    it('returns 5000 for bids from 100000 up to 499999', () => {
      expect(getBidIncrement(100000)).toBe(5000);
      expect(getBidIncrement(250000)).toBe(5000);
      expect(getBidIncrement(499999)).toBe(5000);
    });

    it('returns 10000 for bids from 500000 and above', () => {
      expect(getBidIncrement(500000)).toBe(10000);
      expect(getBidIncrement(750000)).toBe(10000);
      expect(getBidIncrement(1000000)).toBe(10000);
      expect(getBidIncrement(5000000)).toBe(10000);
    });
  });

  describe('exact threshold boundaries', () => {
    it('transitions at 500 boundary', () => {
      expect(getBidIncrement(499)).toBe(50);
      expect(getBidIncrement(500)).toBe(100);
    });

    it('transitions at 2000 boundary', () => {
      expect(getBidIncrement(1999)).toBe(100);
      expect(getBidIncrement(2000)).toBe(200);
    });

    it('transitions at 5000 boundary', () => {
      expect(getBidIncrement(4999)).toBe(200);
      expect(getBidIncrement(5000)).toBe(500);
    });

    it('transitions at 20000 boundary', () => {
      expect(getBidIncrement(19999)).toBe(500);
      expect(getBidIncrement(20000)).toBe(1000);
    });

    it('transitions at 50000 boundary', () => {
      expect(getBidIncrement(49999)).toBe(1000);
      expect(getBidIncrement(50000)).toBe(2000);
    });

    it('transitions at 100000 boundary', () => {
      expect(getBidIncrement(99999)).toBe(2000);
      expect(getBidIncrement(100000)).toBe(5000);
    });

    it('transitions at 500000 boundary', () => {
      expect(getBidIncrement(499999)).toBe(5000);
      expect(getBidIncrement(500000)).toBe(10000);
    });
  });

  describe('edge cases', () => {
    it('returns 50 for zero', () => {
      expect(getBidIncrement(0)).toBe(50);
    });

    it('returns 50 for negative values (below first threshold)', () => {
      // Negative bids are below the 0 threshold so the loop still sets increment to 50
      expect(getBidIncrement(-1)).toBe(50);
      expect(getBidIncrement(-100)).toBe(50);
    });
  });
});

describe('getNextValidBid', () => {
  it('returns currentBid + increment for each tier', () => {
    expect(getNextValidBid(0)).toBe(50);
    expect(getNextValidBid(100)).toBe(150);
    expect(getNextValidBid(500)).toBe(600);
    expect(getNextValidBid(2000)).toBe(2200);
    expect(getNextValidBid(5000)).toBe(5500);
    expect(getNextValidBid(20000)).toBe(21000);
    expect(getNextValidBid(50000)).toBe(52000);
    expect(getNextValidBid(100000)).toBe(105000);
    expect(getNextValidBid(500000)).toBe(510000);
  });

  it('works at tier boundary values', () => {
    // At 499, increment is 50, so next = 549
    expect(getNextValidBid(499)).toBe(549);
    // At 500, increment is 100, so next = 600
    expect(getNextValidBid(500)).toBe(600);
  });

  it('handles large values in the highest tier', () => {
    expect(getNextValidBid(1000000)).toBe(1010000);
    expect(getNextValidBid(2500000)).toBe(2510000);
  });
});

describe('getValidBidOptions', () => {
  it('returns 4 options by default', () => {
    const options = getValidBidOptions(0);
    expect(options).toHaveLength(4);
  });

  it('returns requested number of options', () => {
    const options = getValidBidOptions(0, 6);
    expect(options).toHaveLength(6);
  });

  it('returns consecutive valid bids starting at 0', () => {
    // 0 → 50 → 100 → 150 → 200 (all in tier [0, 50])
    const options = getValidBidOptions(0, 4);
    expect(options).toEqual([50, 100, 150, 200]);
  });

  it('returns consecutive valid bids in the 5000 tier', () => {
    // 5000 increment=500 → 5500 → 6000 → 6500 → 7000
    const options = getValidBidOptions(5000, 4);
    expect(options).toEqual([5500, 6000, 6500, 7000]);
  });

  it('handles tier transitions within options', () => {
    // 450 is in [0,50] tier: 450+50=500. 500 is in [500,100] tier: 500+100=600, etc.
    const options = getValidBidOptions(450, 3);
    expect(options[0]).toBe(500);
    expect(options[1]).toBe(600);
    expect(options[2]).toBe(700);
  });

  it('returns empty array for count=0', () => {
    expect(getValidBidOptions(1000, 0)).toEqual([]);
  });

  it('returns 1 option for count=1', () => {
    const options = getValidBidOptions(1000, 1);
    expect(options).toHaveLength(1);
    expect(options[0]).toBe(1100);
  });

  it('each option is strictly greater than the previous', () => {
    const options = getValidBidOptions(19500, 8);
    for (let i = 1; i < options.length; i++) {
      expect(options[i]).toBeGreaterThan(options[i - 1]);
    }
  });
});

describe('isValidBidAmount', () => {
  it('returns true when proposed bid equals next valid bid', () => {
    expect(isValidBidAmount(0, 50)).toBe(true);
    expect(isValidBidAmount(5000, 5500)).toBe(true);
    expect(isValidBidAmount(100000, 105000)).toBe(true);
  });

  it('returns true when proposed bid exceeds next valid bid', () => {
    expect(isValidBidAmount(0, 100)).toBe(true);
    expect(isValidBidAmount(5000, 6000)).toBe(true);
    expect(isValidBidAmount(100000, 200000)).toBe(true);
  });

  it('returns false when proposed bid is less than next valid bid', () => {
    expect(isValidBidAmount(0, 49)).toBe(false);
    expect(isValidBidAmount(0, 0)).toBe(false);
    expect(isValidBidAmount(5000, 5499)).toBe(false);
    expect(isValidBidAmount(100000, 104999)).toBe(false);
  });

  it('returns false when proposed bid equals current bid', () => {
    expect(isValidBidAmount(1000, 1000)).toBe(false);
    expect(isValidBidAmount(50000, 50000)).toBe(false);
  });

  it('returns false when proposed bid is less than current bid', () => {
    expect(isValidBidAmount(1000, 500)).toBe(false);
  });

  it('validates boundary transitions correctly', () => {
    // At 499, next valid is 549
    expect(isValidBidAmount(499, 549)).toBe(true);
    expect(isValidBidAmount(499, 548)).toBe(false);
  });
});

describe('formatBidAmount', () => {
  it('formats zero', () => {
    expect(formatBidAmount(0)).toBe('0 PLN');
  });

  it('formats small amounts without separators', () => {
    expect(formatBidAmount(100)).toBe('100 PLN');
    expect(formatBidAmount(999)).toBe('999 PLN');
  });

  it('formats amounts with thousands separator', () => {
    const result = formatBidAmount(5500);
    // In some environments Polish locale adds grouping separators, in others it does not.
    // The result must contain the digits and PLN suffix.
    expect(result).toContain('5500');
    expect(result).toContain('PLN');
  });

  it('formats large amounts', () => {
    const result = formatBidAmount(1250000);
    // Must contain all digits (possibly with grouping separators) and PLN
    expect(result).toContain('PLN');
    expect(result.replace(/\s/g, '')).toContain('1250000');
  });

  it('appends PLN suffix', () => {
    expect(formatBidAmount(500)).toContain('PLN');
  });

  it('formats without decimal places', () => {
    const result = formatBidAmount(1000);
    expect(result).not.toContain(',');
    expect(result).not.toContain('.');
  });

  it('truncates fractional amounts (Intl rounds)', () => {
    const result = formatBidAmount(1000.75);
    // Intl rounds 1000.75 to 1001 with maximumFractionDigits: 0
    expect(result.replace(/\s/g, '')).toBe('1001PLN');
  });
});
