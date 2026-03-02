'use client';

import { useCurrency, CURRENCIES, type CurrencyCode } from '../lib/CurrencyContext';

interface CurrencyDisplayProps {
  amountPLN: number;
  className?: string;
}

/**
 * Shows PLN amount as primary with converted amount in parentheses.
 * Example: "5 000 zł (~1 150 €)"
 * If currency is PLN, shows only PLN.
 */
export default function CurrencyDisplay({ amountPLN, className }: CurrencyDisplayProps) {
  const { currency, formatPrice, formatPriceForCurrency } = useCurrency();

  const plnFormatted = formatPriceForCurrency(amountPLN, 'PLN');

  if (currency === 'PLN') {
    return <span className={className}>{plnFormatted}</span>;
  }

  const converted = formatPrice(amountPLN);

  return (
    <span className={className}>
      {plnFormatted}{' '}
      <span className="text-taupe font-normal">(~{converted})</span>
    </span>
  );
}

/**
 * Selector for choosing preferred currency — standalone dropdown.
 */
export function CurrencySelector({ className }: { className?: string }) {
  const { currency, setCurrency } = useCurrency();

  return (
    <select
      value={currency}
      onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
      className={className ?? 'px-2 py-1 text-sm border border-beige rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold'}
      aria-label="Preferred currency"
    >
      {CURRENCIES.map((c) => (
        <option key={c.code} value={c.code}>
          {c.label}
        </option>
      ))}
    </select>
  );
}
