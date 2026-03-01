'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { apiUrl } from '@/app/lib/utils';
import { useLocale } from '@/app/lib/LocaleContext';
import { useCurrency } from '@/app/lib/CurrencyContext';
import Breadcrumbs from '@/app/components/Breadcrumbs';

interface UserBid {
  lotId: string;
  lotTitle: string;
  lotArtist: string;
  lotNumber: number;
  lotStatus: string;
  auctionSlug: string;
  auctionTitle: string;
  auctionStatus: string;
  bidAmount: number;
  bidCreatedAt: string;
  isWinning: boolean;
  imageUrl: string | null;
}

export default function MyBidsPage() {
  const { locale, t } = useLocale();
  const { formatPrice } = useCurrency();

  const [bids, setBids] = useState<UserBid[]>([]);
  const [loading, setLoading] = useState(true);
  const [notAuthenticated, setNotAuthenticated] = useState(false);

  useEffect(() => {
    async function fetchBids() {
      try {
        const res = await fetch(apiUrl('/api/user/bids'));
        if (res.status === 401) {
          setNotAuthenticated(true);
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        setBids(data.bids ?? []);
      } catch {
        // Network error — leave empty
      } finally {
        setLoading(false);
      }
    }
    fetchBids();
  }, []);

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

      {loading ? (
        <div className="mt-12 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
        </div>
      ) : notAuthenticated || bids.length === 0 ? (
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
          {bids.map((bid) => (
            <div
              key={bid.lotId}
              className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm"
            >
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-beige">
                {bid.imageUrl ? (
                  <Image
                    src={bid.imageUrl}
                    alt={bid.lotTitle}
                    width={160}
                    height={160}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-taupe">
                    {t.lot} #{bid.lotNumber}
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <Link
                  href={`/${locale}/auctions/${bid.auctionSlug}/${bid.lotId}`}
                  className="font-serif text-base font-bold text-dark-brown hover:text-gold"
                >
                  {bid.lotTitle}
                </Link>
                <p className="mt-0.5 text-sm text-taupe">{bid.lotArtist}</p>
                <p className="mt-1 text-sm text-taupe">
                  {t.yourBid}: {formatPrice(bid.bidAmount)}
                </p>
              </div>

              <div className="shrink-0 text-right">
                {bid.isWinning ? (
                  <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                    {t.myBidsWinning}
                  </span>
                ) : (
                  <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700">
                    {t.myBidsOutbid}
                  </span>
                )}
                {!bid.isWinning && (
                  <Link
                    href={`/${locale}/auctions/${bid.auctionSlug}/${bid.lotId}`}
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
