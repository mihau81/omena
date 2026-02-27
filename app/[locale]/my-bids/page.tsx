'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useLocale } from '@/app/lib/LocaleContext';
import { useBidding } from '@/app/lib/BiddingContext';
import { useCurrency } from '@/app/lib/CurrencyContext';
import { auctions, lots } from '@/app/lib/data';

function getAuctionBySlug(slug: string) {
  return auctions.find((a) => a.slug === slug);
}

function getLotById(auctionSlug: string, lotId: string) {
  return lots.find((l) => l.auctionSlug === auctionSlug && l.id === lotId);
}
import Breadcrumbs from '@/app/components/Breadcrumbs';

export default function MyBidsPage() {
  const { locale, t } = useLocale();
  const { getUserBids, isUserWinning } = useBidding();
  const { formatPrice } = useCurrency();

  const userBids = getUserBids();

  // Group bids by lot, take highest per lot
  const seenLots = new Set<string>();
  const lotBids = userBids
    .sort((a, b) => b.amount - a.amount)
    .filter((b) => {
      if (seenLots.has(b.lotId)) return false;
      seenLots.add(b.lotId);
      return true;
    })
    .map((bid) => {
      const lot = getLotById(bid.auctionSlug, bid.lotId);
      const auction = getAuctionBySlug(bid.auctionSlug);
      return { bid, lot, auction, winning: isUserWinning(bid.lotId) };
    })
    .filter((x) => x.lot && x.auction);

  return (
    <section className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-12">
      <Breadcrumbs
        items={[
          { label: t.navHome, href: `/${locale}` },
          { label: t.myBidsTitle },
        ]}
      />

      <h1 className="mt-6 font-serif text-4xl font-bold text-dark-brown md:text-5xl">
        {t.myBidsTitle}
      </h1>

      {lotBids.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-taupe">{t.myBidsEmpty}</p>
          <Link
            href={`/${locale}/auctions`}
            className="mt-4 inline-block text-gold underline-offset-4 hover:underline"
          >
            {t.viewAllAuctions}
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {lotBids.map(({ bid, lot, auction, winning }) => (
            <div
              key={bid.lotId}
              className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm"
            >
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-beige">
                <Image
                  src={lot!.images[0]}
                  alt={lot!.title}
                  width={160}
                  height={160}
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="min-w-0 flex-1">
                <Link
                  href={`/${locale}/auctions/${auction!.slug}/${bid.lotId}`}
                  className="font-serif text-base font-bold text-dark-brown hover:text-gold"
                >
                  {lot!.title}
                </Link>
                <p className="mt-0.5 text-sm text-taupe">{lot!.artist}</p>
                <p className="mt-1 text-sm text-taupe">
                  {t.yourBid}: {formatPrice(bid.amount)}
                </p>
              </div>

              <div className="shrink-0 text-right">
                {winning ? (
                  <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                    {t.myBidsWinning}
                  </span>
                ) : (
                  <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700">
                    {t.myBidsOutbid}
                  </span>
                )}
                {!winning && (
                  <Link
                    href={`/${locale}/auctions/${auction!.slug}/${bid.lotId}`}
                    className="mt-2 block text-xs text-gold hover:underline"
                  >
                    {t.myBidsBidAgain}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
