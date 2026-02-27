'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CurrencyCode = 'PLN' | 'EUR' | 'USD' | 'GBP' | 'CHF';

export interface CurrencyInfo {
  code: CurrencyCode;
  symbol: string;
  label: string;
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: 'PLN', symbol: 'zł', label: 'PLN (zł)' },
  { code: 'EUR', symbol: '€', label: 'EUR (€)' },
  { code: 'USD', symbol: '$', label: 'USD ($)' },
  { code: 'GBP', symbol: '£', label: 'GBP (£)' },
  { code: 'CHF', symbol: 'CHF', label: 'CHF' },
];

// Fallback rates (1 PLN → X) based on NBP table A, 2026-02-26
const FALLBACK_RATES: Record<CurrencyCode, number> = {
  PLN: 1,
  EUR: 1 / 4.2224,   // ~0.2368
  USD: 1 / 3.5792,   // ~0.2794
  GBP: 1 / 4.8416,   // ~0.2065
  CHF: 1 / 4.6245,   // ~0.2162
};

const STORAGE_KEY = 'omena_currency';
const RATES_STORAGE_KEY = 'omena_nbp_rates';
const RATES_TIMESTAMP_KEY = 'omena_nbp_rates_ts';
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// NBP API fetcher
// ---------------------------------------------------------------------------

interface NbpRate {
  currency: string;
  code: string;
  mid: number;
}

interface NbpTableA {
  table: string;
  no: string;
  effectiveDate: string;
  rates: NbpRate[];
}

async function fetchNbpRates(): Promise<Record<CurrencyCode, number> | null> {
  try {
    const resp = await fetch('https://api.nbp.pl/api/exchangerates/tables/A/?format=json', {
      cache: 'no-store',
    });
    if (!resp.ok) return null;
    const data: NbpTableA[] = await resp.json();
    if (!data || data.length === 0) return null;

    const table = data[0];
    const rates: Record<CurrencyCode, number> = { PLN: 1, EUR: 0, USD: 0, GBP: 0, CHF: 0 };

    for (const rate of table.rates) {
      if (rate.code === 'EUR') rates.EUR = 1 / rate.mid;
      if (rate.code === 'USD') rates.USD = 1 / rate.mid;
      if (rate.code === 'GBP') rates.GBP = 1 / rate.mid;
      if (rate.code === 'CHF') rates.CHF = 1 / rate.mid;
    }

    // Verify we got all rates
    if (rates.EUR === 0 || rates.USD === 0 || rates.GBP === 0 || rates.CHF === 0) {
      return null;
    }

    return rates;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface CurrencyState {
  currency: CurrencyCode;
  setCurrency: (code: CurrencyCode) => void;
  rates: Record<CurrencyCode, number>;
  convertFromPLN: (amountPLN: number) => number;
  formatPrice: (amountPLN: number) => string;
  getCurrencyInfo: () => CurrencyInfo;
  ratesSource: 'nbp' | 'fallback';
}

const CurrencyContext = createContext<CurrencyState | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>('PLN');
  const [rates, setRates] = useState<Record<CurrencyCode, number>>(FALLBACK_RATES);
  const [ratesSource, setRatesSource] = useState<'nbp' | 'fallback'>('fallback');

  // Hydrate currency choice from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && CURRENCIES.some((c) => c.code === saved)) {
      setCurrencyState(saved as CurrencyCode);
    }

    // Hydrate cached rates
    const cachedRates = localStorage.getItem(RATES_STORAGE_KEY);
    const cachedTs = localStorage.getItem(RATES_TIMESTAMP_KEY);
    if (cachedRates && cachedTs) {
      const ts = parseInt(cachedTs, 10);
      if (Date.now() - ts < SIX_HOURS_MS) {
        try {
          const parsed = JSON.parse(cachedRates);
          setRates(parsed);
          setRatesSource('nbp');
        } catch { /* ignore */ }
      }
    }
  }, []);

  // Fetch fresh NBP rates on mount and every 6 hours
  useEffect(() => {
    if (typeof window === 'undefined') return;

    async function refreshRates() {
      // Check if cached rates are still fresh
      const cachedTs = localStorage.getItem(RATES_TIMESTAMP_KEY);
      if (cachedTs) {
        const ts = parseInt(cachedTs, 10);
        if (Date.now() - ts < SIX_HOURS_MS) return; // still fresh
      }

      const freshRates = await fetchNbpRates();
      if (freshRates) {
        setRates(freshRates);
        setRatesSource('nbp');
        localStorage.setItem(RATES_STORAGE_KEY, JSON.stringify(freshRates));
        localStorage.setItem(RATES_TIMESTAMP_KEY, String(Date.now()));
      }
    }

    refreshRates();

    // Refresh every 6 hours
    const interval = setInterval(refreshRates, SIX_HOURS_MS);
    return () => clearInterval(interval);
  }, []);

  const setCurrency = useCallback((code: CurrencyCode) => {
    setCurrencyState(code);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, code);
    }
  }, []);

  const convertFromPLN = useCallback(
    (amountPLN: number): number => {
      if (currency === 'PLN') return amountPLN;
      const rate = rates[currency] || FALLBACK_RATES[currency];
      return Math.round(amountPLN * rate);
    },
    [currency, rates],
  );

  const formatPrice = useCallback(
    (amountPLN: number): string => {
      const converted = convertFromPLN(amountPLN);
      const formatted = converted.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
      const info = CURRENCIES.find((c) => c.code === currency);
      if (currency === 'PLN') return `${formatted} zł`;
      return `${formatted} ${info?.symbol || currency}`;
    },
    [currency, convertFromPLN],
  );

  const getCurrencyInfo = useCallback((): CurrencyInfo => {
    return CURRENCIES.find((c) => c.code === currency) || CURRENCIES[0];
  }, [currency]);

  const value: CurrencyState = {
    currency,
    setCurrency,
    rates,
    convertFromPLN,
    formatPrice,
    getCurrencyInfo,
    ratesSource,
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useCurrency(): CurrencyState {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider');
  return ctx;
}
