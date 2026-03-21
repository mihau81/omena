'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Lot } from '../lib/types';
import { useBidding } from '../lib/BiddingContext';
import { useLocale } from '../lib/LocaleContext';
import { useCurrency } from '../lib/CurrencyContext';
import { useSession } from 'next-auth/react';
import { getNextMinBid, getBidIncrement, getValidBidOptions } from '../lib/bidding';
import { showBidToast } from './BidToast';
import AllCurrencyPrices from './AllCurrencyPrices';
import BidHistory from './BidHistory';
import BidConfirmModal from './BidConfirmModal';
import LoginModal from './LoginModal';
import MaxBidPanel from './MaxBidPanel';
import Spinner from './Spinner';

interface BidPanelProps {
  lot: Lot;
  auctionStatus: 'upcoming' | 'live' | 'ended';
  auctionSlug: string;
  /** Display string for buyer's premium, e.g. "25% / 20% / 12%" or "20%" */
  premiumLabel?: string;
}

export default function BidPanel({ lot, auctionStatus, auctionSlug, premiumLabel }: BidPanelProps) {
  const {
    getHighestBid,
    isUserWinning,
    isLotWatched,
    toggleWatch,
    placeBid,
    currentHighestBid,
  } = useBidding();
  const { t } = useLocale();
  const { formatPrice } = useCurrency();
  const { data: session } = useSession();

  const highestBid = getHighestBid(lot.id);
  const currentBid = highestBid ?? lot.estimateMin;
  const nextMin = getNextMinBid(currentBid);

  // Quick-bid tag selection: null means "Custom amount" mode
  const [selectedTag, setSelectedTag] = useState<number | null>(nextMin);
  const [customAmount, setCustomAmount] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [bidLoading, setBidLoading] = useState(false);
  const watched = isLotWatched(lot.id);

  // Compute quick-bid options
  const bidOptions = getValidBidOptions(currentBid, 4);
  const increment = getBidIncrement(currentBid);

  // The effective bid amount to submit
  const bidAmount = showCustomInput
    ? (parseInt(customAmount.replace(/\s/g, ''), 10) || 0)
    : (selectedTag ?? nextMin);

  // Track previous highest bid to detect outbids
  const prevHighestRef = useRef(highestBid);
  const lastUserBidRef = useRef<number | null>(null);
  useEffect(() => {
    if (
      prevHighestRef.current !== null &&
      highestBid !== null &&
      highestBid > prevHighestRef.current &&
      highestBid !== lastUserBidRef.current // Not our own bid
    ) {
      showBidToast('outbid', `${t.bidOutbid} ${formatPrice(highestBid)}`);
    }
    prevHighestRef.current = highestBid;
  }, [highestBid, t, formatPrice]);

  // When the next minimum bid changes (new bid via SSE), reset selection to first quick tag
  useEffect(() => {
    setSelectedTag(nextMin);
    setShowCustomInput(false);
    setCustomAmount('');
  }, [nextMin]);

  const handleTagClick = (amount: number) => {
    setSelectedTag(amount);
    setShowCustomInput(false);
    setCustomAmount('');
  };

  const handleCustomToggle = () => {
    setShowCustomInput(true);
    setSelectedTag(null);
    setCustomAmount(String(nextMin));
  };

  const handleBidClick = useCallback(() => {
    if (!session?.user) {
      setShowLoginModal(true);
    } else {
      setShowConfirmModal(true);
    }
  }, [session]);

  const handleConfirmBid = useCallback(async () => {
    setShowConfirmModal(false);
    setBidLoading(true);
    try {
      lastUserBidRef.current = bidAmount;
      const result = await placeBid(lot.id, auctionSlug, bidAmount);
      // Update ref with actual amount from server (in case server adjusted)
      lastUserBidRef.current = result.bid.amount;
      showBidToast('success', `${t.bidAccepted} ${formatPrice(bidAmount)}`);
    } catch (error) {
      lastUserBidRef.current = null;
      const msg = error instanceof Error ? error.message : 'Bid failed';
      showBidToast('outbid', msg);
    } finally {
      setBidLoading(false);
    }
  }, [placeBid, lot.id, auctionSlug, bidAmount, t, formatPrice]);

  const handleAuthenticated = useCallback(() => {
    setShowLoginModal(false);
    setShowConfirmModal(true);
  }, []);

  const isValidBid = bidAmount >= nextMin;

  return (
    <>
      <div className="rounded-2xl bg-white p-6 shadow-sm sticky top-24">
        {/* UPCOMING */}
        {auctionStatus === 'upcoming' && (
          <>
            <div className="rounded-lg bg-blue-50 px-4 py-3 text-center">
              <p className="text-base font-medium text-blue-800">
                {t.auctionNotStarted}
              </p>
            </div>

            <div className="mt-4">
              <p className="text-sm uppercase text-taupe">{t.estimate}</p>
              <p className="mt-1 font-serif text-2xl text-dark-brown">
                {formatPrice(lot.estimateMin)} &ndash; {formatPrice(lot.estimateMax)}
              </p>
              <div className="mt-2">
                <AllCurrencyPrices amountPLN={lot.estimateMin} />
              </div>
            </div>

            <button
              onClick={() => session?.user ? toggleWatch(lot.id) : setShowLoginModal(true)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-beige py-2.5 text-base font-medium text-dark-brown transition-colors hover:bg-beige/50"
            >
              <HeartIcon filled={watched} />
              {watched ? t.unwatchLot : t.watchLot}
            </button>
          </>
        )}

        {/* ENDED */}
        {auctionStatus === 'ended' && (
          <>
            {lot.status === 'sold' && lot.currentBid ? (
              <div className="rounded-lg bg-green-50 px-4 py-4 text-center">
                <p className="text-sm uppercase tracking-wide text-green-700">
                  {t.sold}
                </p>
                <p className="mt-1 font-serif text-2xl font-bold text-green-800">
                  {formatPrice(lot.currentBid)}
                </p>
              </div>
            ) : (
              <div className="rounded-lg bg-gray-100 px-4 py-4 text-center">
                <p className="text-base font-medium text-gray-600">
                  {t.unsold}
                </p>
              </div>
            )}

            {lot.status === 'sold' && lot.currentBid && (
              <div className="mt-3">
                <AllCurrencyPrices amountPLN={lot.currentBid} />
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
              <p className="text-sm uppercase text-taupe">{t.currentBid}</p>
              <p className="mt-1 font-serif text-3xl font-bold text-gold">
                {highestBid ? formatPrice(highestBid) : t.noBidsYet}
              </p>
              {isUserWinning(lot.id) && (
                <p className="mt-1 text-sm font-medium text-green-600">
                  {t.myBidsWinning}
                </p>
              )}
              {highestBid && (
                <div className="mt-2">
                  <AllCurrencyPrices amountPLN={highestBid} />
                </div>
              )}
            </div>

            {/* Increment hint */}
            <p className="mt-3 text-xs text-taupe">
              {t.bidIncrementHint}:{' '}
              <span className="font-medium text-dark-brown">{formatPrice(increment)}</span>
            </p>

            {/* Quick-bid tag buttons */}
            <div className="mt-4 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {bidOptions.map((amount) => {
                  const isSelected = !showCustomInput && selectedTag === amount;
                  return (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => handleTagClick(amount)}
                      className={`rounded-full border px-3 py-2.5 text-sm font-semibold transition-all
                        ${isSelected
                          ? 'border-gold bg-gold text-white shadow-sm'
                          : 'border-gold/50 bg-white text-dark-brown hover:border-gold hover:bg-gold/5'
                        }`}
                    >
                      {formatPrice(amount)}
                    </button>
                  );
                })}
              </div>

              {/* Custom amount toggle */}
              <button
                type="button"
                onClick={handleCustomToggle}
                className={`w-full rounded-full border px-3 py-2.5 text-sm font-medium transition-all
                  ${showCustomInput
                    ? 'border-dark-brown bg-dark-brown/5 text-dark-brown'
                    : 'border-beige bg-white text-taupe hover:border-dark-brown/40 hover:text-dark-brown'
                  }`}
              >
                {t.customAmount}
              </button>

              {/* Custom amount input */}
              {showCustomInput && (
                <div className="relative mt-1">
                  <input
                    id="bid-amount"
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    value={customAmount}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\s/g, '');
                      const num = parseInt(raw, 10);
                      if (!isNaN(num)) setCustomAmount(String(num));
                      else if (raw === '') setCustomAmount('');
                    }}
                    placeholder={String(nextMin)}
                    className="w-full rounded-lg border border-beige px-4 py-3 pr-14 font-serif text-lg text-dark-brown focus:border-gold focus:ring-2 focus:ring-gold/30 focus:outline-none"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-taupe">
                    PLN
                  </span>
                </div>
              )}

              {/* Validation message for custom input */}
              {showCustomInput && customAmount && bidAmount < nextMin && (
                <p className="text-xs text-red-600">
                  {t.nextMinBid}: {formatPrice(nextMin)}
                </p>
              )}
            </div>

            {/* Place bid button */}
            <button
              onClick={handleBidClick}
              disabled={!isValidBid || bidLoading}
              className="mt-4 w-full rounded-lg bg-gold py-3.5 text-lg font-medium text-white transition-all hover:bg-gold-dark hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {bidLoading ? (
                <span className="inline-flex items-center gap-2">
                  <Spinner className="h-5 w-5" />
                  {t.placeBid}…
                </span>
              ) : (
                <>
                  {t.placeBid} — {isValidBid ? formatPrice(bidAmount) : '…'}
                </>
              )}
            </button>

            {/* Watch toggle */}
            <button
              onClick={() => session?.user ? toggleWatch(lot.id) : setShowLoginModal(true)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-beige py-2.5 text-base font-medium text-dark-brown transition-colors hover:bg-beige/50"
            >
              <HeartIcon filled={watched} />
              {watched ? t.unwatchLot : t.watchLot}
            </button>

            {/* Set Maximum Bid (absentee/proxy) */}
            <MaxBidPanel lotId={lot.id} nextMin={nextMin} />

            {/* Premium info */}
            <p className="mt-3 text-center text-sm text-taupe">
              {t.buyersPremium}
              {premiumLabel && (
                <span className="ml-1 font-medium text-dark-brown">{premiumLabel}</span>
              )}
            </p>

            <BidHistory lotId={lot.id} />
          </>
        )}
      </div>

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onAuthenticated={handleAuthenticated}
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
