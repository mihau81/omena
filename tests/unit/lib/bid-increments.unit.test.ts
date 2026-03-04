import { describe, it, expect } from 'vitest';
import {
  getBidIncrement,
  getNextMinBid,
  getValidBidOptions,
  isValidBidAmount,
} from '@/app/lib/bidding';

// Increment table (app/lib/bidding.ts):
//   [0, 100], [1000, 100], [2000, 200], [5000, 500],
//   [10000, 1000], [20000, 2000], [50000, 5000],
//   [100000, 10000], [200000, 20000], [500000, 50000], [1000000, 100000]

describe('getBidIncrement', () => {
  describe('returns correct increment per threshold', () => {
    it('returns 100 for bids from 0 up to 1999', () => {
      expect(getBidIncrement(0)).toBe(100);
      expect(getBidIncrement(1)).toBe(100);
      expect(getBidIncrement(500)).toBe(100);
      expect(getBidIncrement(999)).toBe(100);
      expect(getBidIncrement(1000)).toBe(100);
      expect(getBidIncrement(1999)).toBe(100);
    });

    it('returns 200 for bids from 2000 up to 4999', () => {
      expect(getBidIncrement(2000)).toBe(200);
      expect(getBidIncrement(3000)).toBe(200);
      expect(getBidIncrement(4999)).toBe(200);
    });

    it('returns 500 for bids from 5000 up to 9999', () => {
      expect(getBidIncrement(5000)).toBe(500);
      expect(getBidIncrement(7500)).toBe(500);
      expect(getBidIncrement(9999)).toBe(500);
    });

    it('returns 1000 for bids from 10000 up to 19999', () => {
      expect(getBidIncrement(10000)).toBe(1000);
      expect(getBidIncrement(15000)).toBe(1000);
      expect(getBidIncrement(19999)).toBe(1000);
    });

    it('returns 2000 for bids from 20000 up to 49999', () => {
      expect(getBidIncrement(20000)).toBe(2000);
      expect(getBidIncrement(35000)).toBe(2000);
      expect(getBidIncrement(49999)).toBe(2000);
    });

    it('returns 5000 for bids from 50000 up to 99999', () => {
      expect(getBidIncrement(50000)).toBe(5000);
      expect(getBidIncrement(75000)).toBe(5000);
      expect(getBidIncrement(99999)).toBe(5000);
    });

    it('returns 10000 for bids from 100000 up to 199999', () => {
      expect(getBidIncrement(100000)).toBe(10000);
      expect(getBidIncrement(150000)).toBe(10000);
      expect(getBidIncrement(199999)).toBe(10000);
    });

    it('returns 20000 for bids from 200000 up to 499999', () => {
      expect(getBidIncrement(200000)).toBe(20000);
      expect(getBidIncrement(350000)).toBe(20000);
      expect(getBidIncrement(499999)).toBe(20000);
    });

    it('returns 50000 for bids from 500000 up to 999999', () => {
      expect(getBidIncrement(500000)).toBe(50000);
      expect(getBidIncrement(750000)).toBe(50000);
      expect(getBidIncrement(999999)).toBe(50000);
    });

    it('returns 100000 for bids from 1000000 and above', () => {
      expect(getBidIncrement(1000000)).toBe(100000);
      expect(getBidIncrement(2500000)).toBe(100000);
      expect(getBidIncrement(5000000)).toBe(100000);
    });
  });

  describe('exact threshold boundaries', () => {
    it('transitions at 2000 boundary', () => {
      expect(getBidIncrement(1999)).toBe(100);
      expect(getBidIncrement(2000)).toBe(200);
    });

    it('transitions at 5000 boundary', () => {
      expect(getBidIncrement(4999)).toBe(200);
      expect(getBidIncrement(5000)).toBe(500);
    });

    it('transitions at 10000 boundary', () => {
      expect(getBidIncrement(9999)).toBe(500);
      expect(getBidIncrement(10000)).toBe(1000);
    });

    it('transitions at 20000 boundary', () => {
      expect(getBidIncrement(19999)).toBe(1000);
      expect(getBidIncrement(20000)).toBe(2000);
    });

    it('transitions at 50000 boundary', () => {
      expect(getBidIncrement(49999)).toBe(2000);
      expect(getBidIncrement(50000)).toBe(5000);
    });

    it('transitions at 100000 boundary', () => {
      expect(getBidIncrement(99999)).toBe(5000);
      expect(getBidIncrement(100000)).toBe(10000);
    });

    it('transitions at 200000 boundary', () => {
      expect(getBidIncrement(199999)).toBe(10000);
      expect(getBidIncrement(200000)).toBe(20000);
    });

    it('transitions at 500000 boundary', () => {
      expect(getBidIncrement(499999)).toBe(20000);
      expect(getBidIncrement(500000)).toBe(50000);
    });

    it('transitions at 1000000 boundary', () => {
      expect(getBidIncrement(999999)).toBe(50000);
      expect(getBidIncrement(1000000)).toBe(100000);
    });
  });

  describe('edge cases', () => {
    it('returns 100 for zero', () => {
      expect(getBidIncrement(0)).toBe(100);
    });
  });
});

describe('getNextMinBid', () => {
  it('returns currentBid + increment for each tier', () => {
    expect(getNextMinBid(0)).toBe(100);
    expect(getNextMinBid(500)).toBe(600);
    expect(getNextMinBid(2000)).toBe(2200);
    expect(getNextMinBid(5000)).toBe(5500);
    expect(getNextMinBid(10000)).toBe(11000);
    expect(getNextMinBid(20000)).toBe(22000);
    expect(getNextMinBid(50000)).toBe(55000);
    expect(getNextMinBid(100000)).toBe(110000);
    expect(getNextMinBid(200000)).toBe(220000);
    expect(getNextMinBid(500000)).toBe(550000);
    expect(getNextMinBid(1000000)).toBe(1100000);
  });

  it('works at tier boundary values', () => {
    expect(getNextMinBid(1999)).toBe(2099);
    expect(getNextMinBid(2000)).toBe(2200);
  });

  it('handles large values in the highest tier', () => {
    expect(getNextMinBid(1000000)).toBe(1100000);
    expect(getNextMinBid(2500000)).toBe(2600000);
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
    // 0 → 100 → 200 → 300 → 400 (all in tier [0, 100])
    const options = getValidBidOptions(0, 4);
    expect(options).toEqual([100, 200, 300, 400]);
  });

  it('returns consecutive valid bids in the 5000 tier', () => {
    // 5000 increment=500 → 5500 → 6000 → 6500 → 7000
    const options = getValidBidOptions(5000, 4);
    expect(options).toEqual([5500, 6000, 6500, 7000]);
  });

  it('returns consecutive valid bids in the 10000 tier', () => {
    // 10000 increment=1000 → 11000 → 12000 → 13000 → 14000
    const options = getValidBidOptions(10000, 4);
    expect(options).toEqual([11000, 12000, 13000, 14000]);
  });

  it('handles tier transitions within options', () => {
    // 1900 is in [1000,100] tier: 1900+100=2000. 2000 is in [2000,200] tier: 2000+200=2200, etc.
    const options = getValidBidOptions(1900, 3);
    expect(options[0]).toBe(2000);
    expect(options[1]).toBe(2200);
    expect(options[2]).toBe(2400);
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
    expect(isValidBidAmount(0, 100)).toBe(true);
    expect(isValidBidAmount(5000, 5500)).toBe(true);
    expect(isValidBidAmount(100000, 110000)).toBe(true);
  });

  it('returns true when proposed bid exceeds next valid bid', () => {
    expect(isValidBidAmount(0, 200)).toBe(true);
    expect(isValidBidAmount(5000, 6000)).toBe(true);
    expect(isValidBidAmount(100000, 200000)).toBe(true);
  });

  it('returns false when proposed bid is less than next valid bid', () => {
    expect(isValidBidAmount(0, 99)).toBe(false);
    expect(isValidBidAmount(0, 0)).toBe(false);
    expect(isValidBidAmount(5000, 5499)).toBe(false);
    expect(isValidBidAmount(100000, 109999)).toBe(false);
  });

  it('returns false when proposed bid equals current bid', () => {
    expect(isValidBidAmount(1000, 1000)).toBe(false);
    expect(isValidBidAmount(50000, 50000)).toBe(false);
  });

  it('returns false when proposed bid is less than current bid', () => {
    expect(isValidBidAmount(1000, 500)).toBe(false);
  });

  it('validates boundary transitions correctly', () => {
    // At 1999, next valid is 2099
    expect(isValidBidAmount(1999, 2099)).toBe(true);
    expect(isValidBidAmount(1999, 2098)).toBe(false);
  });
});
