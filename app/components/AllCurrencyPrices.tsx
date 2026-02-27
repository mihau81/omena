'use client';

import { useState } from 'react';
import { useCurrency, CURRENCIES, type CurrencyCode } from '../lib/CurrencyContext';
import { useLocale } from '../lib/LocaleContext';

interface AllCurrencyPricesProps {
  amountPLN: number;
  highlight?: CurrencyCode;
}

export default function AllCurrencyPrices({ amountPLN, highlight }: AllCurrencyPricesProps) {
  const [open, setOpen] = useState(false);
  const { currency, formatPriceForCurrency } = useCurrency();
  const { t } = useLocale();
  const active = highlight ?? currency;

  const others = CURRENCIES.filter((c) => c.code !== active);

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs text-taupe transition-colors hover:text-dark-brown"
      >
        {t.priceInCurrencies}
        <svg
          className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <div className="mt-1.5 space-y-0.5 rounded-lg bg-beige/50 px-3 py-2 text-sm">
            {others.map((c) => (
              <p key={c.code} className="text-taupe">
                {formatPriceForCurrency(amountPLN, c.code)}
              </p>
            ))}
            <p className="mt-1 text-[10px] text-taupe/70">{t.currencyDisclaimer}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
