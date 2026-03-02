import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslation } from '@/app/lib/i18n';
import { getAuctionBySlug, getLotById } from '@/db/queries';
import { getTiersForAuction } from '@/db/queries/premium';
import { mapDBAuctionToFrontend, mapDBLotToFrontend } from '@/lib/mappers';
import { formatRate } from '@/lib/premium';
import LotDetailClient from '@/app/components/LotDetailClient';
import Breadcrumbs from '@/app/components/Breadcrumbs';
import ShareButtons from '@/app/components/ShareButtons';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string; lotId: string }>;
}): Promise<Metadata> {
  const { slug, lotId } = await params;
  const [auctionRow, lotRow] = await Promise.all([
    getAuctionBySlug(slug, 0),
    getLotById(lotId, 0, 'en'),
  ]);

  if (!lotRow || !auctionRow) return {};

  const artistSuffix = lotRow.artist ? ` by ${lotRow.artist}` : '';
  const title = `${lotRow.title}${artistSuffix}`;

  const estimatePart =
    lotRow.estimateMin && lotRow.estimateMax
      ? `Estimate: ${lotRow.estimateMin.toLocaleString()}–${lotRow.estimateMax.toLocaleString()} PLN. `
      : '';
  const description = `${estimatePart}${auctionRow.title}`;

  const primaryImage = (lotRow.media ?? []).find((m: { isPrimary: boolean }) => m.isPrimary);
  const imageUrl = primaryImage?.url ?? (lotRow.media ?? [])[0]?.url;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: imageUrl ? [{ url: imageUrl }] : undefined,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}

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

  // Build images array from the lot's main media (not condition photos)
  const mediaItems = lotRow.media ?? [];
  const mainMedia = mediaItems.filter((m: { mediaType: string }) => m.mediaType !== 'condition');
  const conditionMedia = mediaItems.filter((m: { mediaType: string }) => m.mediaType === 'condition');
  const images = mainMedia.length > 0
    ? mainMedia.map((m: { url: string }) => m.url)
    : ['/omena/images/auctions/lot-1.jpg'];

  const lot = mapDBLotToFrontend(lotRow, {
    auctionSlug: slug,
    images,
    currentBid: lotRow.highestBid ?? null,
    conditionPhotos: conditionMedia.map((m: {
      id: string; url: string; thumbnailUrl: string | null;
      mediumUrl: string | null; originalFilename: string | null;
    }) => ({
      id: m.id,
      url: m.url,
      thumbnailUrl: m.thumbnailUrl,
      mediumUrl: m.mediumUrl,
      originalFilename: m.originalFilename,
    })),
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

      <div className="mt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Link
          href={`/${locale}/auctions/${auction.slug}`}
          className="text-gold transition-colors hover:text-gold-dark"
        >
          &larr; {t.backToAuction}
        </Link>
        <ShareButtons
          url={`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/${locale}/auctions/${slug}/${lotId}`}
          title={`${lot.title}${lot.artist ? ` by ${lot.artist}` : ''}`}
        />
      </div>
    </section>
  );
}
