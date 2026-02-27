'use client';

import type { Lot } from '../lib/types';
import LotDetail from './LotDetail';
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left column — lot details */}
        <div className="lg:col-span-7">
          <LotDetail lot={lot} />
        </div>

        {/* Right column — bid panel (sticky) */}
        <div className="lg:col-span-5">
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
