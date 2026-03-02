'use client';

import { useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { getTranslation } from '@/app/lib/i18n';

const LOT_CATEGORIES = [
  { value: 'malarstwo', labelKey: 'catMalarstwo' },
  { value: 'rzezba', labelKey: 'catRzezba' },
  { value: 'grafika', labelKey: 'catGrafika' },
  { value: 'fotografia', labelKey: 'catFotografia' },
  { value: 'rzemiosto', labelKey: 'catRzemiosto' },
  { value: 'design', labelKey: 'catDesign' },
  { value: 'bizuteria', labelKey: 'catBizuteria' },
  { value: 'inne', labelKey: 'catInne' },
] as const;

interface Auction {
  id: string;
  slug: string;
  title: string;
  endDate: Date;
}

interface ResultsFiltersProps {
  auctions: Auction[];
  locale: string;
}

export default function ResultsFilters({ auctions, locale }: ResultsFiltersProps) {
  const t = getTranslation(locale);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [artist, setArtist] = useState(searchParams.get('artist') ?? '');
  const [categories, setCategories] = useState<string[]>(() =>
    searchParams.get('categories')?.split(',').filter(Boolean) ?? []
  );
  const [priceMin, setPriceMin] = useState(searchParams.get('priceMin') ?? '');
  const [priceMax, setPriceMax] = useState(searchParams.get('priceMax') ?? '');
  const [auctionId, setAuctionId] = useState(searchParams.get('auctionId') ?? '');
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') ?? '');
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') ?? '');

  function toggleCategory(value: string) {
    setCategories((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]
    );
  }

  function applyFilters() {
    const params = new URLSearchParams();
    if (artist) params.set('artist', artist);
    if (categories.length > 0) params.set('categories', categories.join(','));
    if (priceMin) params.set('priceMin', priceMin);
    if (priceMax) params.set('priceMax', priceMax);
    if (auctionId) params.set('auctionId', auctionId);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    params.set('page', '1');
    const qs = params.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ''}`);
  }

  function clearFilters() {
    setArtist('');
    setCategories([]);
    setPriceMin('');
    setPriceMax('');
    setAuctionId('');
    setDateFrom('');
    setDateTo('');
    router.push(pathname);
  }

  const hasFilters = artist || categories.length > 0 || priceMin || priceMax || auctionId || dateFrom || dateTo;

  const inputClass = 'w-full rounded-lg border border-beige px-3 py-2 text-sm focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30';

  return (
    <div className="rounded-xl border border-beige bg-white p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-base font-semibold text-dark-brown">{t.filtersTitle}</h3>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-taupe underline hover:text-gold transition-colors"
          >
            {t.filterClearAll}
          </button>
        )}
      </div>

      {/* Artist search */}
      <div>
        <p className="mb-2 text-xs font-medium text-taupe uppercase tracking-wide">{t.filterArtist}</p>
        <input
          type="text"
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          placeholder={t.filterArtistPlaceholder}
          className={inputClass}
        />
      </div>

      {/* Category chips */}
      <div>
        <p className="mb-2 text-xs font-medium text-taupe uppercase tracking-wide">{t.filterCategory}</p>
        <div className="flex flex-wrap gap-2">
          {LOT_CATEGORIES.map((cat) => {
            const active = categories.includes(cat.value);
            return (
              <button
                key={cat.value}
                type="button"
                onClick={() => toggleCategory(cat.value)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors duration-200 ${
                  active
                    ? 'border-gold bg-gold text-white'
                    : 'border-beige bg-white text-taupe hover:border-gold hover:text-gold'
                }`}
              >
                {t[cat.labelKey as keyof typeof t]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Hammer price range */}
      <div>
        <p className="mb-2 text-xs font-medium text-taupe uppercase tracking-wide">{t.filterPriceRange}</p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value)}
            placeholder={t.filterPriceMin}
            className={inputClass}
          />
          <span className="text-taupe">–</span>
          <input
            type="number"
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value)}
            placeholder={t.filterPriceMax}
            className={inputClass}
          />
        </div>
      </div>

      {/* Auction selector */}
      <div>
        <p className="mb-2 text-xs font-medium text-taupe uppercase tracking-wide">{t.resultsFilterAuction}</p>
        <select
          value={auctionId}
          onChange={(e) => setAuctionId(e.target.value)}
          className={inputClass}
        >
          <option value="">{t.resultsAllAuctions}</option>
          {auctions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title}
            </option>
          ))}
        </select>
      </div>

      {/* Date range */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="mb-1 text-xs font-medium text-taupe">{t.resultsDateFrom}</p>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-taupe">{t.resultsDateTo}</p>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {/* Apply */}
      <button
        onClick={applyFilters}
        className="w-full rounded-lg bg-gold px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gold/90"
      >
        {t.filterApply}
      </button>
    </div>
  );
}
