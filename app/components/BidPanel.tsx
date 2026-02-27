'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Lot } from '../lib/types';
import { useBidding } from '../lib/BiddingContext';
import { useLocale } from '../lib/LocaleContext';
import { useCurrency } from '../lib/CurrencyContext';
import { getNextMinBid, BUYERS_PREMIUM_RATE } from '../lib/bidding';
import { endedAuctionResults } from '../lib/data';
import { showBidToast } from './BidToast';
import AllCurrencyPrices from './AllCurrencyPrices';
import BidHistory from './BidHistory';
import BidConfirmModal from './BidConfirmModal';
import RegistrationModal from './RegistrationModal';

interface BidPanelProps {
  lot: Lot;
  auctionStatus: 'upcoming' | 'live' | 'ended';
  auctionSlug: string;
}

export default function BidPanel({ lot, auctionStatus, auctionSlug }: BidPanelProps) {
  const {
    getHighestBid,
    isUserWinning,
    isUserRegistered,
    isLotWatched,
    toggleWatch,
    placeBid,
    bids,
  } = useBidding();
  const { t } = useLocale();
  const { formatPrice } = useCurrency();

  const highestBid = getHighestBid(lot.id);
  const currentBid = highestBid ?? lot.estimateMin;
  const nextMin = getNextMinBid(currentBid);

  const [bidAmount, setBidAmount] = useState(nextMin);
  const [showRegModal, setShowRegModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const watched = isLotWatched(lot.id);

  // Track previous highest bid to detect outbids
  const prevHighestRef = useRef(highestBid);
  useEffect(() => {
    if (
      prevHighestRef.current !== null &&
      highestBid !== null &&
      highestBid > prevHighestRef.current
    ) {
      const latestBid = bids
        .filter((b) => b.lotId === lot.id)
        .sort((a, b) => b.timestamp - a.timestamp)[0];
      if (latestBid && !latestBid.isUser) {
        showBidToast('outbid', `${t.bidOutbid} ${formatPrice(highestBid)}`);
      }
    }
    prevHighestRef.current = highestBid;
  }, [highestBid, bids, lot.id, t, formatPrice]);

  // Update bid amount when next min changes
  useEffect(() => {
    setBidAmount(nextMin);
  }, [nextMin]);

  const handleBidClick = useCallback(() => {
    if (!isUserRegistered()) {
      setShowRegModal(true);
    } else {
      setShowConfirmModal(true);
    }
  }, [isUserRegistered]);

  const handleConfirmBid = useCallback(() => {
    placeBid(lot.id, auctionSlug, bidAmount);
    setShowConfirmModal(false);
    showBidToast('success', `${t.bidAccepted} ${formatPrice(bidAmount)}`);
  }, [placeBid, lot.id, auctionSlug, bidAmount, t, formatPrice]);

  const handleRegistered = useCallback(() => {
    setShowRegModal(false);
    setShowConfirmModal(true);
  }, []);

  // Ended auction result
  const endResult = endedAuctionResults.find((r) => r.lotId === lot.id);

  return (
    <>
      <div className="rounded-2xl bg-white p-6 shadow-sm sticky top-24">
        {/* UPCOMING */}
        {auctionStatus === 'upcoming' && (
          <>
            <div className="rounded-lg bg-blue-50 px-4 py-3 text-center">
              <p className="text-sm font-medium text-blue-800">
                {t.auctionNotStarted}
              </p>
            </div>

            <div className="mt-4">
              <p className="text-xs uppercase text-taupe">{t.estimate}</p>
              <p className="mt-1 font-serif text-xl text-dark-brown">
                {formatPrice(lot.estimateMin)} &ndash; {formatPrice(lot.estimateMax)}
              </p>
              <div className="mt-2">
                <AllCurrencyPrices amountPLN={lot.estimateMin} />
              </div>
            </div>

            <button
              onClick={() => toggleWatch(lot.id, auctionSlug)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-beige py-2.5 text-sm font-medium text-dark-brown transition-colors hover:bg-beige/50"
            >
              <HeartIcon filled={watched} />
              {watched ? t.unwatchLot : t.watchLot}
            </button>
          </>
        )}

        {/* ENDED */}
        {auctionStatus === 'ended' && (
          <>
            {endResult?.sold ? (
              <div className="rounded-lg bg-green-50 px-4 py-4 text-center">
                <p className="text-xs uppercase tracking-wide text-green-700">
                  {t.sold}
                </p>
                <p className="mt-1 font-serif text-2xl font-bold text-green-800">
                  {formatPrice(endResult.hammerPrice!)}
                </p>
              </div>
            ) : (
              <div className="rounded-lg bg-gray-100 px-4 py-4 text-center">
                <p className="text-sm font-medium text-gray-600">
                  {t.unsold}
                </p>
              </div>
            )}

            {endResult?.sold && endResult.hammerPrice && (
              <div className="mt-3">
                <AllCurrencyPrices amountPLN={endResult.hammerPrice} />
              </div>
            )}

            <BidHistory lotId={lot.id} />
          </>
        )}

        {/* LIVE */}
        {auctionStatus === 'live' && (
          <>
            {/* Current bid */}
            <div>
              <p className="text-xs uppercase text-taupe">{t.currentBid}</p>
              <p className="mt-1 font-serif text-2xl font-bold text-gold">
                {highestBid ? formatPrice(highestBid) : t.noBidsYet}
              </p>
              {isUserWinning(lot.id) && (
                <p className="mt-1 text-xs font-medium text-green-600">
                  {t.myBidsWinning}
                </p>
              )}
              {highestBid && (
                <div className="mt-2">
                  <AllCurrencyPrices amountPLN={highestBid} />
                </div>
              )}
            </div>

            {/* Next min bid */}
            <p className="mt-3 text-sm text-taupe">
              {t.nextMinBid}:{' '}
              <span className="font-medium text-dark-brown">{formatPrice(nextMin)}</span>
            </p>

            {/* Bid input */}
            <div className="mt-4">
              <label htmlFor="bid-amount" className="sr-only">
                {t.bidAmount}
              </label>
              <div className="relative">
                <input
                  id="bid-amount"
                  type="text"
                  inputMode="numeric"
                  value={bidAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\s/g, '');
                    const num = parseInt(raw, 10);
                    if (!isNaN(num)) setBidAmount(num);
                    else if (raw === '') setBidAmount(0);
                  }}
                  className="w-full rounded-lg border border-beige px-4 py-3 pr-16 font-serif text-lg text-dark-brown focus:border-gold focus:ring-2 focus:ring-gold/30 focus:outline-none"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-taupe">
                  PLN
                </span>
              </div>
              {bidAmount < nextMin && (
                <p className="mt-1 text-xs text-red-600">
                  {t.nextMinBid}: {formatPrice(nextMin)}
                </p>
              )}
            </div>

            {/* Place bid button */}
            <button
              onClick={handleBidClick}
              disabled={bidAmount < nextMin}
              className="mt-4 w-full rounded-lg bg-gold py-3 font-medium text-white transition-all hover:bg-gold-dark hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {t.placeBid}
            </button>

            {/* Watch toggle */}
            <button
              onClick={() => toggleWatch(lot.id, auctionSlug)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-beige py-2.5 text-sm font-medium text-dark-brown transition-colors hover:bg-beige/50"
            >
              <HeartIcon filled={watched} />
              {watched ? t.unwatchLot : t.watchLot}
            </button>

            {/* Premium info */}
            <p className="mt-3 text-center text-xs text-taupe">
              {t.buyersPremium}
            </p>

            <BidHistory lotId={lot.id} />
          </>
        )}
      </div>

      <RegistrationModal
        isOpen={showRegModal}
        onClose={() => setShowRegModal(false)}
        onRegistered={handleRegistered}
      />

      <BidConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleConfirmBid}
        amount={bidAmount}
        lotTitle={lot.title}
        lotArtist={lot.artist}
      />
    </>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      className={`h-5 w-5 ${filled ? 'fill-red-500 text-red-500' : 'fill-none text-taupe'}`}
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
      />
    </svg>
  );
}
