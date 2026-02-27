import Link from 'next/link';
import { SUPPORTED_LOCALES, getTranslation } from '@/app/lib/i18n';
import { lots } from '@/app/lib/data';
import { getLotById, getAuctionBySlug } from '@/app/lib/utils';
import LotDetailClient from '@/app/components/LotDetailClient';
import Breadcrumbs from '@/app/components/Breadcrumbs';

export function generateStaticParams() {
  const params: { locale: string; slug: string; lotId: string }[] = [];
  for (const locale of SUPPORTED_LOCALES) {
    for (const lot of lots) {
      params.push({ locale, slug: lot.auctionSlug, lotId: lot.id });
    }
  }
  return params;
}

export default async function LotDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string; lotId: string }>;
}) {
  const { locale, slug, lotId } = await params;
  const t = getTranslation(locale);
  const auction = getAuctionBySlug(slug);
  const lot = getLotById(slug, lotId);

  if (!lot || !auction) {
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
