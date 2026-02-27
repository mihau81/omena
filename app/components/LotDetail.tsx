'use client';

import type { Lot } from '../lib/types';
import { useLocale } from '../lib/LocaleContext';
import { useCurrency } from '../lib/CurrencyContext';
import LotGallery from './LotGallery';

interface LotDetailProps {
  lot: Lot;
}

export default function LotDetail({ lot }: LotDetailProps) {
  const { t } = useLocale();
  const { formatPrice } = useCurrency();

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-12 md:gap-10">
      {/* Gallery — left column */}
      <div className="md:col-span-7">
        <LotGallery images={lot.images} title={lot.title} />
      </div>

      {/* Info — right column */}
      <div className="md:col-span-5">
        <p className="text-xs uppercase tracking-wide text-taupe">
          {t.lot} {lot.lotNumber}
        </p>

        <h1 className="mt-2 font-serif text-2xl font-bold text-dark-brown md:text-3xl">
          {lot.title}
        </h1>

        <p className="mt-2 text-lg text-gold">{lot.artist}</p>

        <p className="mt-1 text-sm text-taupe">
          {lot.year} &middot; {lot.medium} &middot; {lot.dimensions}
        </p>

        <div className="my-6 h-px bg-beige" />

        {/* Estimate */}
        <div>
          <p className="text-xs uppercase text-taupe">{t.estimate}</p>
          <p className="mt-1 font-serif text-xl text-dark-brown">
            {formatPrice(lot.estimateMin)} &ndash;{' '}
            {formatPrice(lot.estimateMax)}
          </p>
        </div>

        {/* Current bid */}
        {lot.currentBid && (
          <div className="mt-4">
            <p className="text-xs uppercase text-taupe">{t.currentBid}</p>
            <p className="mt-1 font-serif text-xl font-bold text-gold">
              {formatPrice(lot.currentBid)}
            </p>
          </div>
        )}

        <div className="my-6 h-px bg-beige" />

        {/* Description */}
        <p className="leading-relaxed text-taupe">{lot.description}</p>

        <div className="my-6 h-px bg-beige" />

        {/* Provenance */}
        {lot.provenance.length > 0 && (
          <div>
            <h2 className="font-serif font-bold text-dark-brown">
              {t.provenance}
            </h2>
            <ul className="mt-2 space-y-1">
              {lot.provenance.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-taupe">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Exhibitions */}
        {lot.exhibited.length > 0 && (
          <div className="mt-6">
            <h2 className="font-serif font-bold text-dark-brown">{t.exhibitions}</h2>
            <ul className="mt-2 space-y-1">
              {lot.exhibited.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-taupe">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Currency disclaimer */}
        <p className="mt-6 text-xs text-taupe">{t.currencyDisclaimer}</p>
      </div>
    </div>
  );
}
