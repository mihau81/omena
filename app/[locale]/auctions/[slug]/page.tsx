import Link from 'next/link';
import { getTranslation } from '@/app/lib/i18n';
import { formatDate, getStatusColor } from '@/app/lib/utils';
import { getAuctionWithLots } from '@/db/queries';
import { mapDBAuctionToFrontend, mapDBLotToFrontend } from '@/lib/mappers';
import LotCardEnhanced from '@/app/components/LotCardEnhanced';
import Breadcrumbs from '@/app/components/Breadcrumbs';
import CountdownTimer from '@/app/components/CountdownTimer';

export const dynamic = 'force-dynamic';

export default async function AuctionDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
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

  const auctionLots = result.lots.map((lotRow) =>
    mapDBLotToFrontend(lotRow, {
      auctionSlug: slug,
      images: [lotRow.primaryImageUrl ?? lotRow.primaryThumbnailUrl ?? '/omena/images/auctions/lot-1.jpg'].filter(Boolean) as string[],
      currentBid: null,
    }),
  );

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
      </div>

      {/* Description */}
      <p className="mt-8 max-w-3xl leading-relaxed text-taupe">
        {auction.description}
      </p>

      {/* Lots */}
      <div className="mt-12">
        <h2 className="font-serif text-2xl font-bold text-dark-brown">
          {t.objects} ({auctionLots.length})
        </h2>

        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {auctionLots.map((lot) => (
            <LotCardEnhanced
              key={lot.id}
              lot={lot}
              auctionSlug={slug}
              auctionStatus={auction.status}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
