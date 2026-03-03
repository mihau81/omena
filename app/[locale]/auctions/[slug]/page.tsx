import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { getTranslation } from '@/app/lib/i18n';
import { formatDate, getStatusColor } from '@/app/lib/utils';
import { getAuctionWithLots } from '@/db/queries';
import { mapDBAuctionToFrontend, mapDBLotToFrontend } from '@/lib/mappers';
import LotCardEnhanced from '@/app/components/LotCardEnhanced';
import Breadcrumbs from '@/app/components/Breadcrumbs';
import CountdownTimer from '@/app/components/CountdownTimer';
import LivestreamPlayer from '@/app/components/LivestreamPlayer';
import LotFilters from '@/app/components/LotFilters';

export const dynamic = 'force-dynamic';

const LOT_CATEGORIES = ['malarstwo', 'rzezba', 'grafika', 'fotografia', 'rzemiosto', 'design', 'bizuteria', 'inne'] as const;
type LotCategory = typeof LOT_CATEGORIES[number];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await getAuctionWithLots(slug, 0);
  if (!result) return {};

  const description = result.description
    ? result.description.slice(0, 160)
    : undefined;

  const images = result.coverImageUrl
    ? [{ url: result.coverImageUrl }]
    : undefined;

  return {
    title: result.title,
    description,
    openGraph: {
      title: result.title,
      description,
      images,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: result.title,
      description,
      images: result.coverImageUrl ? [result.coverImageUrl] : undefined,
    },
  };
}

export default async function AuctionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, slug } = await params;
  const sp = await searchParams;
  const t = getTranslation(locale);
  const result = await getAuctionWithLots(slug, 0);

  if (!result) {
    return (
      <section className="mx-auto max-w-7xl px-5 py-16 text-center md:px-8">
        <h1 className="font-serif text-3xl font-bold text-dark-brown">
          {t.auctionNotFound}
        </h1>
        <Link href={`/${locale}/auctions`} className="mt-4 inline-block text-gold">
          {t.backToAuctions}
        </Link>
      </section>
    );
  }

  const auction = mapDBAuctionToFrontend(result, {
    lotCount: result.lotCount,
    coverImageUrl: result.coverImageUrl ?? undefined,
  });

  // Parse URL filters
  const categoriesParam = typeof sp.categories === 'string' ? sp.categories : '';
  const activeCategories = categoriesParam
    ? categoriesParam.split(',').filter((c): c is LotCategory => (LOT_CATEGORIES as readonly string[]).includes(c))
    : [];
  const estimateMin = typeof sp.estimateMin === 'string' ? (parseInt(sp.estimateMin) || null) : null;
  const estimateMax = typeof sp.estimateMax === 'string' ? (parseInt(sp.estimateMax) || null) : null;
  const artistFilter = typeof sp.artist === 'string' ? sp.artist.toLowerCase() : '';
  const sortBy = typeof sp.sortBy === 'string' ? sp.sortBy : 'lot_number';

  // Map lots
  let auctionLots = result.lots.map((lotRow) =>
    mapDBLotToFrontend(lotRow, {
      auctionSlug: slug,
      images: [lotRow.primaryImageUrl ?? lotRow.primaryThumbnailUrl ?? '/omenaa/images/auctions/lot-1.jpg'].filter(Boolean) as string[],
      currentBid: null,
    }),
  );

  // Apply filters (server-side, no re-fetch needed since full list already loaded)
  if (activeCategories.length > 0) {
    const categoryMap = new Map(result.lots.map((l) => [l.id, (l as typeof l & { category?: string }).category]));
    auctionLots = auctionLots.filter((lot) => {
      const cat = categoryMap.get(lot.id);
      return cat && activeCategories.includes(cat as LotCategory);
    });
  }
  if (estimateMin != null) {
    auctionLots = auctionLots.filter((lot) => lot.estimateMin >= estimateMin);
  }
  if (estimateMax != null) {
    auctionLots = auctionLots.filter((lot) => lot.estimateMax <= estimateMax);
  }
  if (artistFilter) {
    auctionLots = auctionLots.filter((lot) => lot.artist.toLowerCase().includes(artistFilter));
  }
  if (sortBy === 'estimate_asc') {
    auctionLots = [...auctionLots].sort((a, b) => a.estimateMin - b.estimateMin);
  } else if (sortBy === 'estimate_desc') {
    auctionLots = [...auctionLots].sort((a, b) => b.estimateMin - a.estimateMin);
  }

  const hasActiveFilters = activeCategories.length > 0 || estimateMin != null || estimateMax != null || artistFilter || sortBy !== 'lot_number';
  const totalLots = result.lots.length;

  const statusLabel =
    auction.status === 'upcoming'
      ? t.statusUpcoming
      : auction.status === 'live'
        ? t.statusLive
        : t.statusEnded;

  return (
    <section className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-12">
      <Breadcrumbs
        items={[
          { label: t.navHome, href: `/${locale}` },
          { label: t.auctionsTitle, href: `/${locale}/auctions` },
          { label: auction.title },
        ]}
      />

      {/* Auction hero */}
      <div className="mt-6 rounded-2xl bg-beige p-6 md:p-10">
        <span
          className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(auction.status)}`}
        >
          {statusLabel}
        </span>

        <h1 className="mt-4 font-serif text-3xl font-bold text-dark-brown md:text-4xl">
          {auction.title}
        </h1>

        <p className="mt-2 text-taupe">{t.curator}: {auction.curator}</p>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-taupe">
          <span>{formatDate(auction.date)}</span>
          <span>&middot;</span>
          <span>{auction.location}</span>
        </div>

        {(auction.status === 'upcoming' || auction.status === 'live') && (
          <div className="mt-6">
            <CountdownTimer
              targetDate={
                auction.status === 'live' ? auction.endDate : auction.date
              }
            />
          </div>
        )}

        {result.catalogPdfUrl && (
          <div className="mt-4">
            <a
              href={result.catalogPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-gold/40 bg-white px-4 py-2 text-sm font-medium text-gold hover:bg-gold/5 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Pobierz katalog aukcji (PDF)
            </a>
          </div>
        )}
      </div>

      {/* Livestream */}
      {result.livestreamUrl && (
        <div className="mt-8">
          <LivestreamPlayer url={result.livestreamUrl} auctionStatus={auction.status} />
        </div>
      )}

      {/* Description */}
      <p className="mt-8 max-w-3xl leading-relaxed text-taupe">
        {auction.description}
      </p>

      {/* Lots with filters */}
      <div className="mt-12">
        <h2 className="font-serif text-2xl font-bold text-dark-brown">
          {t.objects} ({auctionLots.length}{hasActiveFilters ? ` / ${totalLots}` : ''})
        </h2>

        <div className="mt-6 flex gap-8 items-start">
          {/* Sidebar filters */}
          <aside className="hidden lg:block w-64 shrink-0 sticky top-24">
            <Suspense>
              <LotFilters />
            </Suspense>
          </aside>

          {/* Lot grid */}
          <div className="flex-1 min-w-0">
            {/* Mobile filters */}
            <div className="mb-6 lg:hidden">
              <Suspense>
                <LotFilters />
              </Suspense>
            </div>

            {auctionLots.length === 0 ? (
              <div className="flex h-48 items-center justify-center rounded-xl border border-beige text-taupe">
                {t.notFound}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {auctionLots.map((lot) => (
                  <LotCardEnhanced
                    key={lot.id}
                    lot={lot}
                    auctionSlug={slug}
                    auctionStatus={auction.status}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
