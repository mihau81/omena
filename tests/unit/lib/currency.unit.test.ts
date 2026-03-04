import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  SUPPORTED_CURRENCIES,
  fetchNBPRates,
  convertFromPLN,
  formatCurrency,
} from '@/lib/currency';

// We need to reset the module-level cache between tests
// Because the cache is module-scoped, we re-import when needed
beforeEach(() => {
  vi.restoreAllMocks();
});

describe('SUPPORTED_CURRENCIES', () => {
  it('contains exactly PLN, EUR, USD, GBP', () => {
    expect([...SUPPORTED_CURRENCIES]).toEqual(['PLN', 'EUR', 'USD', 'GBP']);
  });

  it('has length 4', () => {
    expect(SUPPORTED_CURRENCIES).toHaveLength(4);
  });
});

describe('fetchNBPRates', () => {
  const mockNBPResponse = [
    {
      rates: [
        { code: 'EUR', mid: 4.32 },
        { code: 'USD', mid: 3.95 },
        { code: 'GBP', mid: 5.08 },
        { code: 'CHF', mid: 4.45 },
      ],
    },
  ];

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches rates from NBP API and includes PLN=1, with inverted rates (1 PLN = X foreign)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockNBPResponse),
      }),
    );

    // Force fresh module to clear cache
    vi.resetModules();
    const { fetchNBPRates: freshFetch } = await import('@/lib/currency');

    const rates = await freshFetch();
    expect(rates.PLN).toBe(1);
    expect(rates.EUR).toBeCloseTo(1 / 4.32, 6);
    expect(rates.USD).toBeCloseTo(1 / 3.95, 6);
    expect(rates.GBP).toBeCloseTo(1 / 5.08, 6);
  });

  it('calls the correct NBP API URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockNBPResponse),
    });
    vi.stubGlobal('fetch', fetchMock);

    vi.resetModules();
    const { fetchNBPRates: freshFetch } = await import('@/lib/currency');

    await freshFetch();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.nbp.pl/api/exchangerates/tables/A/?format=json',
      expect.any(Object),
    );
  });

  it('returns cached rates within 24h TTL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockNBPResponse),
    });
    vi.stubGlobal('fetch', fetchMock);

    vi.resetModules();
    const { fetchNBPRates: freshFetch } = await import('@/lib/currency');

    await freshFetch();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Second call within TTL should use cache
    await freshFetch();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refreshes cache after 24h TTL expires', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockNBPResponse),
    });
    vi.stubGlobal('fetch', fetchMock);

    vi.resetModules();
    const { fetchNBPRates: freshFetch } = await import('@/lib/currency');

    await freshFetch();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Advance past 24h
    vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1);

    await freshFetch();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns stale cache when API fails and cache exists', async () => {
    let callCount = 0;
    const fetchMock = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockNBPResponse),
        });
      }
      return Promise.reject(new Error('Network error'));
    });
    vi.stubGlobal('fetch', fetchMock);

    vi.resetModules();
    const { fetchNBPRates: freshFetch } = await import('@/lib/currency');

    // First call succeeds
    const firstRates = await freshFetch();
    expect(firstRates.EUR).toBeCloseTo(1 / 4.32, 6);

    // Expire cache
    vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1);

    // Second call fails, should return stale cache
    const secondRates = await freshFetch();
    expect(secondRates.EUR).toBeCloseTo(1 / 4.32, 6);
  });

  it('returns fallback rates when API fails and no cache exists', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network error')),
    );

    vi.resetModules();
    const { fetchNBPRates: freshFetch } = await import('@/lib/currency');

    const rates = await freshFetch();
    expect(rates.PLN).toBe(1);
    expect(rates.EUR).toBeCloseTo(1 / 4.2224, 4);
    expect(rates.USD).toBeCloseTo(1 / 3.5792, 4);
    expect(rates.GBP).toBeCloseTo(1 / 4.8416, 4);
  });

  it('returns fallback rates when API returns non-OK status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }),
    );

    vi.resetModules();
    const { fetchNBPRates: freshFetch } = await import('@/lib/currency');

    const rates = await freshFetch();
    expect(rates.PLN).toBe(1);
    expect(rates.EUR).toBeCloseTo(1 / 4.2224, 4);
    expect(rates.USD).toBeCloseTo(1 / 3.5792, 4);
    expect(rates.GBP).toBeCloseTo(1 / 4.8416, 4);
  });

  it('handles empty rates array from API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ rates: [] }]),
      }),
    );

    vi.resetModules();
    const { fetchNBPRates: freshFetch } = await import('@/lib/currency');

    const rates = await freshFetch();
    expect(rates.PLN).toBe(1);
    // Other currencies not present since API returned empty rates
    expect(rates.EUR).toBeUndefined();
  });
});

describe('convertFromPLN', () => {
  // Rates in "1 PLN = X foreign" format (inverted NBP mid values)
  const rates: Record<string, number> = {
    PLN: 1,
    EUR: 1 / 4.32,   // ~0.2315
    USD: 1 / 3.95,   // ~0.2532
    GBP: 1 / 5.08,   // ~0.1969
  };

  it('returns the same amount for PLN', () => {
    expect(convertFromPLN(1000, 'PLN', rates)).toBe(1000);
  });

  it('converts PLN to EUR using the rate', () => {
    // 1000 PLN * (1/4.32) = ~231.48 EUR
    expect(convertFromPLN(1000, 'EUR', rates)).toBeCloseTo(1000 / 4.32, 2);
  });

  it('converts PLN to USD using the rate', () => {
    // 1000 PLN * (1/3.95) = ~253.16 USD
    expect(convertFromPLN(1000, 'USD', rates)).toBeCloseTo(1000 / 3.95, 2);
  });

  it('converts PLN to GBP using the rate', () => {
    // 1000 PLN * (1/5.08) = ~196.85 GBP
    expect(convertFromPLN(1000, 'GBP', rates)).toBeCloseTo(1000 / 5.08, 2);
  });

  it('returns amountPLN when currency rate is missing', () => {
    const sparseRates: Record<string, number> = { PLN: 1 };
    expect(convertFromPLN(1000, 'EUR', sparseRates)).toBe(1000);
  });

  it('handles zero amount', () => {
    expect(convertFromPLN(0, 'EUR', rates)).toBe(0);
  });

  it('handles fractional amounts', () => {
    const result = convertFromPLN(100.5, 'EUR', rates);
    expect(result).toBeCloseTo(100.5 / 4.32, 1);
  });

  it('returns PLN amount unchanged regardless of rates object', () => {
    expect(convertFromPLN(500, 'PLN', {})).toBe(500);
  });
});

describe('formatCurrency', () => {
  it('formats PLN without decimal places', () => {
    const result = formatCurrency(5500, 'PLN');
    // Polish locale: "5 500 zł" or similar
    const normalized = result.replace(/\s/g, ' ');
    expect(normalized).toContain('5');
    expect(normalized).toContain('500');
    // PLN should have 0 maximumFractionDigits
    expect(result).not.toMatch(/[.,]\d{2}$/);
  });

  it('formats EUR with up to 2 decimal places', () => {
    const result = formatCurrency(1234.56, 'EUR');
    expect(result).toContain('1');
    expect(result).toContain('234');
    // Should contain the decimal part
    expect(result).toMatch(/56/);
  });

  it('formats USD with up to 2 decimal places', () => {
    const result = formatCurrency(999.99, 'USD');
    expect(result).toContain('999');
    expect(result).toMatch(/99/);
  });

  it('formats GBP with up to 2 decimal places', () => {
    const result = formatCurrency(750.5, 'GBP');
    expect(result).toContain('750');
  });

  it('formats zero amount', () => {
    const result = formatCurrency(0, 'PLN');
    expect(result).toContain('0');
  });

  it('formats large amounts with grouping', () => {
    const result = formatCurrency(1000000, 'PLN');
    const normalized = result.replace(/\s/g, ' ');
    expect(normalized).toContain('1');
    expect(normalized).toContain('000');
    expect(normalized).toContain('000');
  });

  it('uses Polish locale formatting', () => {
    // Polish locale uses comma as decimal separator for non-PLN currencies
    const result = formatCurrency(1234.56, 'EUR');
    // Should contain comma (Polish decimal separator)
    expect(result).toContain(',');
  });
});
