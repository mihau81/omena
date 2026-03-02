import { describe, it, expect } from 'vitest';
import {
  getBidIncrement,
  getNextMinBid,
  generatePaddleNumber,
  shouldBotCounterBid,
  getBotResponseDelay,
  calculatePremium,
  calculateTotal,
  BUYERS_PREMIUM_RATE,
  SOFT_CLOSE_WINDOW_MS,
  SOFT_CLOSE_EXTENSION_MS,
} from '@/app/lib/bidding';

describe('getBidIncrement', () => {
  it('returns 100 for bids below 1000', () => {
    expect(getBidIncrement(0)).toBe(100);
    expect(getBidIncrement(500)).toBe(100);
    expect(getBidIncrement(999)).toBe(100);
  });

  it('returns 100 at threshold 1000', () => {
    expect(getBidIncrement(1000)).toBe(100);
  });

  it('returns 200 at threshold 2000', () => {
    expect(getBidIncrement(2000)).toBe(200);
    expect(getBidIncrement(3000)).toBe(200);
  });

  it('returns 500 at threshold 5000', () => {
    expect(getBidIncrement(5000)).toBe(500);
    expect(getBidIncrement(7500)).toBe(500);
  });

  it('returns 1000 at threshold 10000', () => {
    expect(getBidIncrement(10000)).toBe(1000);
    expect(getBidIncrement(15000)).toBe(1000);
  });

  it('returns 2000 at threshold 20000', () => {
    expect(getBidIncrement(20000)).toBe(2000);
  });

  it('returns 5000 at threshold 50000', () => {
    expect(getBidIncrement(50000)).toBe(5000);
  });

  it('returns 10000 at threshold 100000', () => {
    expect(getBidIncrement(100000)).toBe(10000);
  });

  it('returns 20000 at threshold 200000', () => {
    expect(getBidIncrement(200000)).toBe(20000);
  });

  it('returns 50000 at threshold 500000', () => {
    expect(getBidIncrement(500000)).toBe(50000);
  });

  it('returns 100000 at threshold 1000000', () => {
    expect(getBidIncrement(1000000)).toBe(100000);
    expect(getBidIncrement(2000000)).toBe(100000);
  });
});

describe('getNextMinBid', () => {
  it('adds correct increment at 0', () => {
    expect(getNextMinBid(0)).toBe(100);
  });

  it('adds correct increment at 1000', () => {
    expect(getNextMinBid(1000)).toBe(1100);
  });

  it('adds correct increment at 5000', () => {
    expect(getNextMinBid(5000)).toBe(5500);
  });

  it('adds correct increment at 100000', () => {
    expect(getNextMinBid(100000)).toBe(110000);
  });

  it('adds correct increment at 1000000', () => {
    expect(getNextMinBid(1000000)).toBe(1100000);
  });
});

describe('generatePaddleNumber', () => {
  it('returns a number between 100 and 999 inclusive', () => {
    for (let i = 0; i < 50; i++) {
      const paddle = generatePaddleNumber();
      expect(paddle).toBeGreaterThanOrEqual(100);
      expect(paddle).toBeLessThanOrEqual(999);
      expect(Number.isInteger(paddle)).toBe(true);
    }
  });
});

describe('shouldBotCounterBid', () => {
  it('returns a boolean', () => {
    const result = shouldBotCounterBid();
    expect(typeof result).toBe('boolean');
  });

  it('returns true approximately 40% of the time (statistical)', () => {
    let trueCount = 0;
    const trials = 1000;
    for (let i = 0; i < trials; i++) {
      if (shouldBotCounterBid()) trueCount++;
    }
    // With 1000 trials, expect roughly 400 ± 60 (3σ)
    expect(trueCount).toBeGreaterThan(300);
    expect(trueCount).toBeLessThan(500);
  });
});

describe('getBotResponseDelay', () => {
  it('returns a delay between 2000 and 6000 ms', () => {
    for (let i = 0; i < 50; i++) {
      const delay = getBotResponseDelay();
      expect(delay).toBeGreaterThanOrEqual(2000);
      expect(delay).toBeLessThan(6000);
    }
  });
});

describe('calculatePremium (bidding)', () => {
  it('calculates 20% premium', () => {
    expect(calculatePremium(10000)).toBe(2000);
  });

  it('calculates premium of 0 for 0 amount', () => {
    expect(calculatePremium(0)).toBe(0);
  });

  it('rounds to nearest integer', () => {
    const result = calculatePremium(3);
    expect(Number.isInteger(result)).toBe(true);
  });

  it('uses BUYERS_PREMIUM_RATE constant', () => {
    expect(calculatePremium(100)).toBe(Math.round(100 * BUYERS_PREMIUM_RATE));
  });
});

describe('calculateTotal', () => {
  it('returns hammer + premium', () => {
    expect(calculateTotal(10000)).toBe(12000);
  });

  it('returns 0 for 0 amount', () => {
    expect(calculateTotal(0)).toBe(0);
  });
});

describe('constants', () => {
  it('BUYERS_PREMIUM_RATE is 0.20', () => {
    expect(BUYERS_PREMIUM_RATE).toBe(0.20);
  });

  it('SOFT_CLOSE_WINDOW_MS is 2 minutes', () => {
    expect(SOFT_CLOSE_WINDOW_MS).toBe(2 * 60 * 1000);
  });

  it('SOFT_CLOSE_EXTENSION_MS is 2 minutes', () => {
    expect(SOFT_CLOSE_EXTENSION_MS).toBe(2 * 60 * 1000);
  });
});
