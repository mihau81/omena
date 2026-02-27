'use client';

import { useCurrency, CURRENCIES, type CurrencyCode } from '../lib/CurrencyContext';

interface AllCurrencyPricesProps {
  amountPLN: number;
  highlight?: CurrencyCode;
}

export default function AllCurrencyPrices({ amountPLN, highlight }: AllCurrencyPricesProps) {
  const { currency, formatPriceForCurrency } = useCurrency();
  const active = highlight ?? currency;

  return (
    <div className="space-y-0.5 text-sm">
      {CURRENCIES.map((c) => {
        const isActive = c.code === active;
        return (
          <p
            key={c.code}
            className={
              isActive
                ? 'font-bold text-gold'
                : 'text-taupe'
            }
          >
            {formatPriceForCurrency(amountPLN, c.code)}
          </p>
        );
      })}
    </div>
  );
}
