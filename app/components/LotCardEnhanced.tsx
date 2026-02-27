'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { Lot } from '../lib/types';
import { endedAuctionResults } from '../lib/data';
import { useBidding } from '../lib/BiddingContext';
import { useLocale } from '../lib/LocaleContext';
import { useCurrency } from '../lib/CurrencyContext';

interface LotCardEnhancedProps {
  lot: Lot;
  auctionSlug: string;
  auctionStatus: 'upcoming' | 'live' | 'ended';
}

export default function LotCardEnhanced({
  lot,
  auctionSlug,
  auctionStatus,
}: LotCardEnhancedProps) {
  const { getHighestBid } = useBidding();
  const { locale, t } = useLocale();
  const { formatPrice } = useCurrency();

  const endResult = endedAuctionResults.find((r) => r.lotId === lot.id);
  const liveBid = auctionStatus === 'live' ? getHighestBid(lot.id) : null;

  return (
    <Link
      href={`/${locale}/auctions/${auctionSlug}/${lot.id}`}
      className="group relative block overflow-hidden rounded-xl shadow-sm transition-shadow duration-300 hover:shadow-md"
    >
      {/* Image area */}
      <div
        className="relative aspect-square overflow-hidden rounded-t-xl bg-beige"
        role="img"
        aria-label={`${lot.title} — ${lot.artist}`}
      >
        <Image
          src={lot.images[0]}
          alt={`${lot.title} — ${lot.artist}`}
          width={800}
          height={800}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        <span className="absolute left-3 top-3 rounded bg-dark-brown/80 px-2 py-1 text-xs font-medium text-white">
          {t.lot} {lot.lotNumber}
        </span>

        {auctionStatus === 'ended' && endResult?.sold && (
          <span className="absolute right-3 top-3 rounded bg-green-600 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white shadow">
            {t.sold}
          </span>
        )}
        {auctionStatus === 'ended' && endResult && !endResult.sold && (
          <span className="absolute right-3 top-3 rounded bg-gray-500 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white shadow">
            {t.unsold}
          </span>
        )}
      </div>

      {/* Content area */}
      <div className="rounded-b-xl bg-white p-4">
        <h3 className="line-clamp-1 font-serif text-base font-bold text-dark-brown">
          {lot.title}
        </h3>
        <p className="mt-1 text-sm text-gold">{lot.artist}</p>
        <p className="mt-0.5 text-xs text-taupe">{lot.year}</p>
        <p className="mt-2 text-sm text-taupe">
          {t.estimate}: {formatPrice(lot.estimateMin)} &ndash;{' '}
          {formatPrice(lot.estimateMax)}
        </p>

        {auctionStatus === 'ended' && endResult?.sold && endResult.hammerPrice && (
          <p className="mt-1 text-sm font-medium text-green-700">
            {t.hammerPrice}: {formatPrice(endResult.hammerPrice)}
          </p>
        )}

        {auctionStatus === 'live' && (
          <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-gold">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
            </span>
            {t.currentBid}:{' '}
            {liveBid
              ? formatPrice(liveBid)
              : lot.currentBid
                ? formatPrice(lot.currentBid)
                : '—'}
          </p>
        )}

        {auctionStatus === 'upcoming' && lot.currentBid && (
          <p className="mt-1 text-sm font-medium text-gold">
            {t.currentBid}: {formatPrice(lot.currentBid)}
          </p>
        )}
      </div>
    </Link>
  );
}
