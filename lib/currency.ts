export const SUPPORTED_CURRENCIES = ['PLN', 'EUR', 'USD', 'GBP'] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

interface RateCache {
  rates: Record<string, number>;
  fetchedAt: number;
}

// In-memory cache: 24 hours
const CACHE_TTL = 24 * 60 * 60 * 1000;
let rateCache: RateCache | null = null;

export async function fetchNBPRates(): Promise<Record<string, number>> {
  const now = Date.now();
  if (rateCache && now - rateCache.fetchedAt < CACHE_TTL) {
    return rateCache.rates;
  }

  try {
    const res = await fetch(
      'https://api.nbp.pl/api/exchangerates/tables/A/?format=json',
      { next: { revalidate: 3600 } },
    );

    if (!res.ok) throw new Error(`NBP API error: ${res.status}`);

    const data = await res.json();
    const rates: Record<string, number> = { PLN: 1 };

    for (const rate of data[0]?.rates ?? []) {
      rates[rate.code] = rate.mid;
    }

    rateCache = { rates, fetchedAt: now };
    return rates;
  } catch {
    // Return cached data if available, even if stale
    if (rateCache) return rateCache.rates;
    // Fallback rates
    return { PLN: 1, EUR: 0.23, USD: 0.25, GBP: 0.2 };
  }
}

export function convertFromPLN(amountPLN: number, currency: Currency, rates: Record<string, number>): number {
  if (currency === 'PLN') return amountPLN;
  const rate = rates[currency];
  if (!rate) return amountPLN;
  return amountPLN * rate;
}

export function formatCurrency(amount: number, currency: Currency): string {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'PLN' ? 0 : 2,
  }).format(amount);
}
