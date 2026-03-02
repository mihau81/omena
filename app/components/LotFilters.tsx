'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useLocale } from '../lib/LocaleContext';

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

export default function LotFilters() {
  const { t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [categories, setCategories] = useState<string[]>(() =>
    searchParams.get('categories')?.split(',').filter(Boolean) ?? []
  );
  const [estimateMin, setEstimateMin] = useState(searchParams.get('estimateMin') ?? '');
  const [estimateMax, setEstimateMax] = useState(searchParams.get('estimateMax') ?? '');
  const [artist, setArtist] = useState(searchParams.get('artist') ?? '');
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') ?? 'lot_number');
  const [artistSuggestions, setArtistSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const artistRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Close suggestions on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (artistRef.current && !artistRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const fetchArtistSuggestions = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) {
      setArtistSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/lots/artists?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setArtistSuggestions(data.artists ?? []);
          setShowSuggestions(true);
        }
      } catch {
        // ignore
      }
    }, 250);
  }, []);

  function toggleCategory(value: string) {
    setCategories((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]
    );
  }

  function applyFilters() {
    const params = new URLSearchParams();
    if (categories.length > 0) params.set('categories', categories.join(','));
    if (estimateMin) params.set('estimateMin', estimateMin);
    if (estimateMax) params.set('estimateMax', estimateMax);
    if (artist) params.set('artist', artist);
    if (sortBy && sortBy !== 'lot_number') params.set('sortBy', sortBy);
    const qs = params.toString();
    router.push(`${pathname}${qs ? `?${qs}` : ''}`);
  }

  function clearFilters() {
    setCategories([]);
    setEstimateMin('');
    setEstimateMax('');
    setArtist('');
    setSortBy('lot_number');
    router.push(pathname);
  }

  const hasFilters = categories.length > 0 || estimateMin || estimateMax || artist || sortBy !== 'lot_number';

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

      {/* Price range */}
      <div>
        <p className="mb-2 text-xs font-medium text-taupe uppercase tracking-wide">{t.filterPriceRange}</p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={estimateMin}
            onChange={(e) => setEstimateMin(e.target.value)}
            placeholder={t.filterPriceMin}
            className="w-full rounded-lg border border-beige px-3 py-2 text-sm focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30"
          />
          <span className="text-taupe">–</span>
          <input
            type="number"
            value={estimateMax}
            onChange={(e) => setEstimateMax(e.target.value)}
            placeholder={t.filterPriceMax}
            className="w-full rounded-lg border border-beige px-3 py-2 text-sm focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30"
          />
        </div>
      </div>

      {/* Artist search with autocomplete */}
      <div ref={artistRef} className="relative">
        <p className="mb-2 text-xs font-medium text-taupe uppercase tracking-wide">{t.filterArtist}</p>
        <input
          type="text"
          value={artist}
          onChange={(e) => {
            setArtist(e.target.value);
            fetchArtistSuggestions(e.target.value);
          }}
          onFocus={() => artist.length >= 2 && setShowSuggestions(true)}
          placeholder={t.filterArtistPlaceholder}
          className="w-full rounded-lg border border-beige px-3 py-2 text-sm focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30"
        />
        {showSuggestions && artistSuggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-lg border border-beige bg-white shadow-lg">
            {artistSuggestions.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  setArtist(name);
                  setShowSuggestions(false);
                }}
                className="block w-full px-3 py-2 text-left text-sm text-dark-brown hover:bg-beige/50 transition-colors"
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Sort */}
      <div>
        <p className="mb-2 text-xs font-medium text-taupe uppercase tracking-wide">{t.filterSortBy}</p>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="w-full rounded-lg border border-beige px-3 py-2 text-sm focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30"
        >
          <option value="lot_number">{t.filterSortLotNumber}</option>
          <option value="estimate_asc">{t.filterSortEstimateAsc}</option>
          <option value="estimate_desc">{t.filterSortEstimateDesc}</option>
        </select>
      </div>

      {/* Apply button */}
      <button
        onClick={applyFilters}
        className="w-full rounded-lg bg-gold px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gold/90"
      >
        {t.filterApply}
      </button>
    </div>
  );
}
