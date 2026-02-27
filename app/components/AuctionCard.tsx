'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { Auction } from '../lib/types';
import { formatDate, getStatusColor } from '../lib/utils';
import { useLocale } from '../lib/LocaleContext';

interface AuctionCardProps {
  auction: Auction;
}

function getTranslatedStatus(
  status: Auction['status'],
  t: { statusUpcoming: string; statusLive: string; statusEnded: string },
): string {
  switch (status) {
    case 'upcoming':
      return t.statusUpcoming;
    case 'live':
      return t.statusLive;
    case 'ended':
      return t.statusEnded;
  }
}

function getTranslatedCategory(
  category: Auction['category'],
  t: {
    categoryPainting: string;
    categorySculpture: string;
    categoryPhotography: string;
    categoryMixed: string;
  },
): string {
  switch (category) {
    case 'malarstwo':
      return t.categoryPainting;
    case 'rzezba':
      return t.categorySculpture;
    case 'fotografia':
      return t.categoryPhotography;
    case 'mixed':
      return t.categoryMixed;
  }
}

export default function AuctionCard({ auction }: AuctionCardProps) {
  const { locale, t } = useLocale();

  return (
    <Link
      href={`/${locale}/auctions/${auction.slug}`}
      className="group block overflow-hidden rounded-xl shadow-sm transition-shadow duration-300 hover:shadow-md"
    >
      <div
        className="relative aspect-[4/3] overflow-hidden rounded-t-xl bg-beige"
        role="img"
        aria-label={auction.title}
      >
        <Image
          src={auction.coverImage}
          alt={auction.title}
          width={800}
          height={600}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        <span
          className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(auction.status)}`}
        >
          {getTranslatedStatus(auction.status, t)}
        </span>

        <span className="absolute right-3 top-3 rounded-full bg-white/80 px-2 py-1 text-xs text-taupe backdrop-blur-sm">
          {getTranslatedCategory(auction.category, t)}
        </span>
      </div>

      <div className="rounded-b-xl bg-white p-5">
        <h3 className="line-clamp-2 font-serif text-lg font-bold text-dark-brown">
          {auction.title}
        </h3>
        <p className="mt-1 text-sm text-taupe">{formatDate(auction.date)}</p>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm text-taupe">
            {auction.totalLots} {t.objects}
          </span>
          <span className="truncate text-sm text-taupe">
            {auction.location}
          </span>
        </div>
      </div>
    </Link>
  );
}
