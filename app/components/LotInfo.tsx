'use client';

import Image from 'next/image';
import type { Lot } from '../lib/types';
import { useLocale } from '../lib/LocaleContext';
import { useCurrency } from '../lib/CurrencyContext';
import CurrencyDisplay from './CurrencyDisplay';

interface LotInfoProps {
  lot: Lot;
}

const CONDITION_GRADE_COLORS: Record<string, string> = {
  mint: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  excellent: 'bg-green-100 text-green-800 border-green-300',
  very_good: 'bg-lime-100 text-lime-800 border-lime-300',
  good: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  fair: 'bg-orange-100 text-orange-800 border-orange-300',
  poor: 'bg-red-100 text-red-800 border-red-300',
};

function getConditionGradeLabel(
  grade: string,
  t: Record<string, string>,
): string {
  const map: Record<string, string> = {
    mint: t.conditionGradeMint,
    excellent: t.conditionGradeExcellent,
    very_good: t.conditionGradeVeryGood,
    good: t.conditionGradeGood,
    fair: t.conditionGradeFair,
    poor: t.conditionGradePoor,
  };
  return map[grade] ?? grade;
}

export default function LotInfo({ lot }: LotInfoProps) {
  const { t } = useLocale();
  const { formatPrice } = useCurrency();

  return (
    <div>
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
          <CurrencyDisplay amountPLN={lot.estimateMin} /> &ndash; <CurrencyDisplay amountPLN={lot.estimateMax} />
        </p>
      </div>

      {/* Current bid */}
      {lot.currentBid && (
        <div className="mt-4">
          <p className="text-xs uppercase text-taupe">{t.currentBid}</p>
          <p className="mt-1 font-serif text-xl font-bold text-gold">
            <CurrencyDisplay amountPLN={lot.currentBid} />
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
          <h2 className="font-serif font-bold text-dark-brown">{t.provenance}</h2>
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

      {/* Condition Report */}
      {(lot.conditionGrade || lot.conditionNotes || (lot.conditionPhotos && lot.conditionPhotos.length > 0)) && (
        <div className="mt-6">
          <div className="my-6 h-px bg-beige" />
          <h2 className="font-serif font-bold text-dark-brown">{t.conditionReport}</h2>

          {lot.conditionGrade && (
            <div className="mt-3 flex items-center gap-3">
              <span className="text-sm text-taupe">{t.conditionGrade}:</span>
              <span
                className={`inline-block rounded border px-2.5 py-0.5 text-xs font-semibold ${CONDITION_GRADE_COLORS[lot.conditionGrade] ?? 'bg-gray-100 text-gray-800 border-gray-300'}`}
              >
                {getConditionGradeLabel(lot.conditionGrade, t)}
              </span>
            </div>
          )}

          {lot.conditionNotes && (
            <p className="mt-3 text-sm leading-relaxed text-taupe whitespace-pre-line">
              {lot.conditionNotes}
            </p>
          )}

          {lot.conditionPhotos && lot.conditionPhotos.length > 0 && (
            <div className="mt-4">
              <p className="text-xs uppercase tracking-wide text-taupe mb-2">
                {t.conditionPhotos}
              </p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {lot.conditionPhotos.map((photo) => (
                  <a
                    key={photo.id}
                    href={photo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block aspect-square overflow-hidden rounded-lg border border-beige hover:border-gold transition-colors"
                  >
                    <Image
                      src={photo.thumbnailUrl ?? photo.mediumUrl ?? photo.url}
                      alt={photo.originalFilename ?? t.conditionPhotos}
                      width={200}
                      height={200}
                      className="h-full w-full object-cover"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Currency disclaimer */}
      <p className="mt-6 text-xs text-taupe">{t.currencyDisclaimer}</p>
    </div>
  );
}
