'use client';

import { useState } from 'react';
import type { Auction } from '@/app/lib/types';
import { useLocale } from '@/app/lib/LocaleContext';
import AuctionCard from '@/app/components/AuctionCard';
import Breadcrumbs from '@/app/components/Breadcrumbs';

interface AuctionsClientProps {
  auctions: Auction[];
}

export default function AuctionsClient({ auctions }: AuctionsClientProps) {
  const { locale, t } = useLocale();
  const [activeStatus, setActiveStatus] = useState<string>('all');

  const statusFilters = [
    { key: 'all', label: t.auctionsAll },
    { key: 'live', label: t.auctionsFilterLive },
    { key: 'upcoming', label: t.auctionsFilterUpcoming },
    { key: 'ended', label: t.auctionsFilterEnded },
  ];

  const filtered = auctions.filter((a: Auction) => {
    if (activeStatus === 'all') return true;
    return a.status === activeStatus;
  });

  return (
    <section className="mx-auto max-w-7xl px-5 py-8 md:px-8 md:py-12">
      <Breadcrumbs
        items={[
          { label: t.navHome, href: `/${locale}` },
          { label: t.auctionsTitle },
        ]}
      />

      <h1 className="mt-6 font-serif text-4xl font-bold text-dark-brown md:text-5xl">
        {t.auctionsTitle}
      </h1>

      <div className="mt-8">
        <div className="-mx-5 flex gap-2 overflow-x-auto px-5">
          {statusFilters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setActiveStatus(filter.key)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm transition-colors duration-200 ${
                activeStatus === filter.key
                  ? 'border-gold bg-gold text-white'
                  : 'border-beige-dark bg-white text-taupe hover:border-gold'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((auction) => (
            <AuctionCard key={auction.id} auction={auction} />
          ))}
        </div>
      ) : (
        <p className="mt-12 text-center text-taupe">
          {t.notFound}
        </p>
      )}
    </section>
  );
}
