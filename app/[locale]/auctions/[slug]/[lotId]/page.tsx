import Link from 'next/link';
import { getTranslation } from '@/app/lib/i18n';
import { getAuctionBySlug, getLotById } from '@/db/queries';
import { getTiersForAuction } from '@/db/queries/premium';
import { mapDBAuctionToFrontend, mapDBLotToFrontend } from '@/lib/mappers';
import { formatRate } from '@/lib/premium';
import LotDetailClient from '@/app/components/LotDetailClient';
import Breadcrumbs from '@/app/components/Breadcrumbs';

export const dynamic = 'force-dynamic';

export default async function LotDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string; lotId: string }>;
}) {
  const { locale, slug, lotId } = await params;
  const t = getTranslation(locale);

  const auctionRow = await getAuctionBySlug(slug, 0);
  const lotRow = await getLotById(lotId, 0, locale);

  if (!lotRow || !auctionRow) {
    return (
      <section className="mx-auto max-w-7xl px-5 py-16 text-center md:px-8">
        <h1 className="font-serif text-3xl font-bold text-dark-brown">
          {t.lotNotFound}
        </h1>
        <Link href={`/${locale}/auctions`} className="mt-4 inline-block text-gold">
          {t.backToAuctions}
        </Link>
      </section>
    );
  }

  const auction = mapDBAuctionToFrontend(auctionRow, {
    lotCount: auctionRow.lotCount,
    coverImageUrl: auctionRow.coverImageUrl ?? undefined,
  });

  // Build images array from the lot's media
  const mediaItems = lotRow.media ?? [];
  const images = mediaItems.length > 0
    ? mediaItems.map((m) => m.url)
    : ['/omena/images/auctions/lot-1.jpg'];

  const lot = mapDBLotToFrontend(lotRow, {
    auctionSlug: slug,
    images,
    currentBid: lotRow.highestBid ?? null,
  });

  // Build premium label — show tiered rates if configured, otherwise flat rate
  const tiers = await getTiersForAuction(auctionRow.id);
  let premiumLabel: string;
  if (tiers.length > 0) {
    // e.g. "25% / 20% / 12%"
    premiumLabel = tiers
      .map((tier) => formatRate(parseFloat(String(tier.rate))))
      .join(' / ');
  } else {
    const flatRate = auctionRow.buyersPremiumRate
      ? parseFloat(String(auctionRow.buyersPremiumRate))
      : 0.20;
    premiumLabel = formatRate(flatRate);
  }

  return (
    <section className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-12">
      <Breadcrumbs
        items={[
          { label: t.navHome, href: `/${locale}` },
          { label: t.auctionsTitle, href: `/${locale}/auctions` },
          { label: auction.title, href: `/${locale}/auctions/${auction.slug}` },
          { label: `${t.lot} ${lot.lotNumber}` },
        ]}
      />

      <div className="mt-6">
        <LotDetailClient
          lot={lot}
          auctionStatus={auction.status}
          auctionSlug={slug}
          premiumLabel={premiumLabel}
        />
      </div>

      <div className="mt-12">
        <Link
          href={`/${locale}/auctions/${auction.slug}`}
          className="text-gold transition-colors hover:text-gold-dark"
        >
          &larr; {t.backToAuction}
        </Link>
      </div>
    </section>
  );
}
