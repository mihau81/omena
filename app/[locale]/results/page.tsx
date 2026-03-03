import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Suspense } from 'react';
import { getTranslation } from '@/app/lib/i18n';
import { getSoldLots, getAuctionsForResults } from '@/db/queries';
import type { LotCategory } from '@/db/queries';
import Breadcrumbs from '@/app/components/Breadcrumbs';
import ResultsFilters from '@/app/components/ResultsFilters';

export const dynamic = 'force-dynamic';

const LOT_CATEGORIES = ['malarstwo', 'rzezba', 'grafika', 'fotografia', 'rzemiosto', 'design', 'bizuteria', 'inne'] as const;
const PAGE_SIZE = 24;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = getTranslation(locale);
  return {
    title: t.resultsTitle,
    description: t.resultsSubtitle,
    openGraph: {
      title: t.resultsTitle,
      description: t.resultsSubtitle,
    },
  };
}

function formatPLN(amount: number) {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 }).format(amount);
}

export default async function ResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const t = getTranslation(locale);

  // Parse filters from URL
  const artistQuery = typeof sp.artist === 'string' ? sp.artist : '';
  const categoriesParam = typeof sp.categories === 'string' ? sp.categories : '';
  const categories = categoriesParam
    ? categoriesParam.split(',').filter((c): c is LotCategory => (LOT_CATEGORIES as readonly string[]).includes(c))
    : [];
  const priceMin = typeof sp.priceMin === 'string' ? (parseInt(sp.priceMin) || undefined) : undefined;
  const priceMax = typeof sp.priceMax === 'string' ? (parseInt(sp.priceMax) || undefined) : undefined;
  const auctionId = typeof sp.auctionId === 'string' ? sp.auctionId : undefined;
  const dateFrom = typeof sp.dateFrom === 'string' && sp.dateFrom ? new Date(sp.dateFrom) : undefined;
  const dateTo = typeof sp.dateTo === 'string' && sp.dateTo ? new Date(sp.dateTo) : undefined;
  const page = typeof sp.page === 'string' ? (parseInt(sp.page) || 1) : 1;

  const [{ lots, pagination }, auctions] = await Promise.all([
    getSoldLots({
      artistQuery: artistQuery || undefined,
      categories: categories.length > 0 ? categories : undefined,
      priceMin,
      priceMax,
      auctionId,
      dateFrom,
      dateTo,
      page,
      limit: PAGE_SIZE,
    }),
    getAuctionsForResults(),
  ]);

  function buildPageUrl(newPage: number) {
    const params = new URLSearchParams();
    if (artistQuery) params.set('artist', artistQuery);
    if (categoriesParam) params.set('categories', categoriesParam);
    if (priceMin) params.set('priceMin', String(priceMin));
    if (priceMax) params.set('priceMax', String(priceMax));
    if (auctionId) params.set('auctionId', auctionId);
    if (sp.dateFrom) params.set('dateFrom', sp.dateFrom as string);
    if (sp.dateTo) params.set('dateTo', sp.dateTo as string);
    params.set('page', String(newPage));
    return `/${locale}/results?${params.toString()}`;
  }

  return (
    <section className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-12">
      <Breadcrumbs
        items={[
          { label: t.navHome, href: `/${locale}` },
          { label: t.resultsTitle },
        ]}
      />

      <div className="mt-6">
        <h1 className="font-serif text-3xl font-bold text-dark-brown md:text-4xl">
          {t.resultsTitle}
        </h1>
        <p className="mt-2 text-taupe">{t.resultsSubtitle}</p>
      </div>

      <div className="mt-8 flex gap-8 items-start">
        {/* Sidebar filters */}
        <aside className="hidden lg:block w-72 shrink-0 sticky top-24">
          <Suspense>
            <ResultsFilters auctions={auctions} locale={locale} />
          </Suspense>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Mobile filters */}
          <div className="mb-6 lg:hidden">
            <Suspense>
              <ResultsFilters auctions={auctions} locale={locale} />
            </Suspense>
          </div>

          {/* Results count */}
          <p className="mb-4 text-sm text-taupe">
            {Number(pagination.total)} {t.objects}
          </p>

          {lots.length === 0 ? (
            <div className="flex h-64 items-center justify-center rounded-xl border border-beige">
              <p className="text-taupe">{t.resultsNoResults}</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {lots.map((lot) => (
                  <ResultCard
                    key={lot.id}
                    lot={lot}
                    locale={locale}
                    soldForLabel={t.resultsSoldFor}
                    estimateLabel={t.estimate}
                    lotLabel={t.lot}
                  />
                ))}
              </div>

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="mt-10 flex items-center justify-center gap-2">
                  {page > 1 && (
                    <Link
                      href={buildPageUrl(page - 1)}
                      className="rounded-lg border border-beige px-4 py-2 text-sm text-dark-brown transition-colors hover:border-gold hover:text-gold"
                    >
                      &larr; Poprzednia
                    </Link>
                  )}
                  <span className="text-sm text-taupe">
                    {page} / {pagination.pages}
                  </span>
                  {page < pagination.pages && (
                    <Link
                      href={buildPageUrl(page + 1)}
                      className="rounded-lg border border-beige px-4 py-2 text-sm text-dark-brown transition-colors hover:border-gold hover:text-gold"
                    >
                      Następna &rarr;
                    </Link>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function ResultCard({
  lot,
  locale,
  soldForLabel,
  estimateLabel,
  lotLabel,
}: {
  lot: {
    id: string;
    lotNumber: number;
    title: string;
    artist: string;
    estimateMin: number;
    estimateMax: number;
    hammerPrice: number | null;
    auctionSlug: string;
    auctionTitle: string;
    auctionEndDate: Date;
    primaryImageUrl: string | null;
    primaryThumbnailUrl: string | null;
  };
  locale: string;
  soldForLabel: string;
  estimateLabel: string;
  lotLabel: string;
}) {
  const imageUrl = lot.primaryImageUrl ?? lot.primaryThumbnailUrl ?? '/images/auctions/lot-1.jpg';
  const saleDate = new Date(lot.auctionEndDate).toLocaleDateString(locale === 'pl' ? 'pl-PL' : 'en-GB', {
    year: 'numeric',
    month: 'short',
  });

  return (
    <Link
      href={`/${locale}/auctions/${lot.auctionSlug}/${lot.id}`}
      className="group block overflow-hidden rounded-xl border border-beige bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden rounded-t-xl bg-beige">
        <Image
          src={imageUrl}
          alt={`${lot.title} — ${lot.artist}`}
          width={600}
          height={600}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <span className="absolute left-3 top-3 rounded bg-dark-brown/80 px-2 py-1 text-xs font-medium text-white">
          {lotLabel} {lot.lotNumber}
        </span>
        {lot.hammerPrice && (
          <span className="absolute right-3 top-3 rounded bg-green-600 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white shadow">
            {soldForLabel}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="line-clamp-1 font-serif text-base font-bold text-dark-brown">
          {lot.title}
        </h3>
        <p className="mt-1 text-sm text-gold">{lot.artist}</p>

        {lot.hammerPrice && (
          <p className="mt-2 text-lg font-bold text-green-700">
            {formatPLN(lot.hammerPrice)}
          </p>
        )}

        <p className="mt-1 text-xs text-taupe">
          {estimateLabel}: {formatPLN(lot.estimateMin)} – {formatPLN(lot.estimateMax)}
        </p>

        <div className="mt-3 flex items-center justify-between text-xs text-taupe">
          <span className="truncate max-w-[70%]">{lot.auctionTitle}</span>
          <span className="shrink-0">{saleDate}</span>
        </div>
      </div>
    </Link>
  );
}
