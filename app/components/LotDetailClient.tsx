'use client';

import type { Lot } from '../lib/types';
import LotMediaGallery from './LotMediaGallery';
import LotInfo from './LotInfo';
import BidPanel from './BidPanel';
import BidToast from './BidToast';

interface LotDetailClientProps {
  lot: Lot;
  auctionStatus: 'upcoming' | 'live' | 'ended';
  auctionSlug: string;
}

export default function LotDetailClient({
  lot,
  auctionStatus,
  auctionSlug,
}: LotDetailClientProps) {
  return (
    <>
      {/* Full-width gallery at the top */}
      <LotMediaGallery media={lot.images} title={lot.title} />

      {/* 2/3 info + 1/3 bid panel below */}
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <LotInfo lot={lot} />
        </div>
        <div className="lg:col-span-4">
          <BidPanel
            lot={lot}
            auctionStatus={auctionStatus}
            auctionSlug={auctionSlug}
          />
        </div>
      </div>

      <BidToast />
    </>
  );
}
