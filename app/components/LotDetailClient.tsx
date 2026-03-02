'use client';

import type { Lot } from '../lib/types';
import LotMediaGallery from './LotMediaGallery';
import LotInfo from './LotInfo';
import BidPanel from './BidPanel';
import BidToast from './BidToast';
import LotTimerBanner from './LotTimerBanner';

interface LotDetailClientProps {
  lot: Lot;
  auctionStatus: 'upcoming' | 'live' | 'ended';
  auctionSlug: string;
  premiumLabel?: string;
}

export default function LotDetailClient({
  lot,
  auctionStatus,
  auctionSlug,
  premiumLabel,
}: LotDetailClientProps) {
  return (
    <>
      {/* Full-width gallery at the top */}
      <LotMediaGallery media={lot.images} title={lot.title} />

      {/* Timer banner — only shown when lot is live and has a closingAt */}
      {auctionStatus === 'live' && lot.auctionId && (
        <div className="mt-6">
          <LotTimerBanner
            lotId={lot.id}
            auctionId={lot.auctionId}
            initialClosingAt={lot.closingAt ?? null}
          />
        </div>
      )}

      {/* 2/3 info + 1/3 bid panel below */}
      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <LotInfo lot={lot} />
        </div>
        <div className="lg:col-span-4">
          <BidPanel
            lot={lot}
            auctionStatus={auctionStatus}
            auctionSlug={auctionSlug}
            premiumLabel={premiumLabel}
          />
        </div>
      </div>

      <BidToast />
    </>
  );
}
