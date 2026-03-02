'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { apiUrl } from '@/app/lib/utils';
import { useLocale } from '@/app/lib/LocaleContext';
import { useCurrency } from '@/app/lib/CurrencyContext';

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

type Tab = 'all' | 'winning' | 'outbid';

export default function AccountBidsPage() {
  const { locale } = useLocale();
  const { formatPrice } = useCurrency();
  const [bids, setBids] = useState<UserBid[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('all');

  useEffect(() => {
    fetch(apiUrl('/api/user/bids'))
      .then((res) => (res.ok ? res.json() : { bids: [] }))
      .then((data) => setBids(data.bids ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const winningCount = useMemo(() => bids.filter((b) => b.isWinning).length, [bids]);
  const outbidCount = bids.length - winningCount;

  const filtered =
    tab === 'all'
      ? bids
      : tab === 'winning'
        ? bids.filter((b) => b.isWinning)
        : bids.filter((b) => !b.isWinning);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: bids.length },
    { key: 'winning', label: 'Winning', count: winningCount },
    { key: 'outbid', label: 'Outbid', count: outbidCount },
  ];

  return (
    <div>
      <h1 className="font-serif text-3xl font-bold text-dark-brown md:text-4xl">My Bids</h1>

      {/* Tabs */}
      <div className="mt-6 flex gap-2 border-b border-beige">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.key
                ? 'border-gold text-gold'
                : 'border-transparent text-taupe hover:text-dark-brown'
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-8 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-8 text-center py-12">
          <p className="text-taupe">No bids found.</p>
          <Link href={`/${locale}/auctions`} className="mt-3 inline-block text-sm text-gold hover:underline">
            Browse auctions
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {filtered.map((bid) => (
            <div key={bid.lotId} className="flex items-center gap-4 rounded-xl border border-beige bg-white p-4">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-beige">
                {bid.imageUrl ? (
                  <Image src={bid.imageUrl} alt={bid.lotTitle} width={128} height={128} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-taupe">
                    #{bid.lotNumber}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/${locale}/auctions/${bid.auctionSlug}/${bid.lotId}`}
                  className="font-serif text-sm font-bold text-dark-brown hover:text-gold line-clamp-1"
                >
                  {bid.lotTitle}
                </Link>
                <p className="mt-0.5 text-xs text-taupe">{bid.lotArtist}</p>
                <p className="mt-1 text-sm text-dark-brown">{formatPrice(bid.bidAmount)}</p>
              </div>
              <div className="shrink-0 text-right">
                {bid.isWinning ? (
                  <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                    Winning
                  </span>
                ) : (
                  <>
                    <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700">
                      Outbid
                    </span>
                    <Link
                      href={`/${locale}/auctions/${bid.auctionSlug}/${bid.lotId}`}
                      className="mt-2 block text-xs text-gold hover:underline"
                    >
                      Bid again
                    </Link>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
