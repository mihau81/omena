'use client';

import { useState } from 'react';
import { useBidding } from '../lib/BiddingContext';
import { useLocale } from '../lib/LocaleContext';
import { useCurrency } from '../lib/CurrencyContext';
import { formatTimestamp } from '../lib/utils';

interface BidHistoryProps {
  lotId: string;
}

export default function BidHistory({ lotId }: BidHistoryProps) {
  const { getBidsForLot } = useBidding();
  const { t } = useLocale();
  const { formatPrice } = useCurrency();
  const [isOpen, setIsOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const bids = getBidsForLot(lotId);
  const VISIBLE_LIMIT = 10;
  const visibleBids = showAll ? bids : bids.slice(0, VISIBLE_LIMIT);

  return (
    <div className="mt-4">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between text-sm font-medium text-dark-brown hover:text-gold transition-colors"
      >
        <span>{t.bidHistory} ({bids.length})</span>
        <svg
          className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="mt-3 space-y-2">
          {bids.length === 0 ? (
            <p className="text-sm text-taupe">{t.noBidsYet}</p>
          ) : (
            <>
              {visibleBids.map((bid) => (
                <div
                  key={bid.id}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                    bid.isUser
                      ? 'bg-gold/10 border border-gold/20'
                      : 'bg-cream'
                  }`}
                >
                  <div>
                    <span
                      className={`font-medium ${
                        bid.isUser ? 'text-gold' : 'text-dark-brown'
                      }`}
                    >
                      {bid.bidderLabel}
                    </span>
                    {bid.isUser && (
                      <span className="ml-2 text-xs text-gold">(Ty)</span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="font-medium text-dark-brown">
                      {formatPrice(bid.amount)}
                    </span>
                    <span className="ml-2 text-xs text-taupe">
                      {formatTimestamp(bid.timestamp)}
                    </span>
                  </div>
                </div>
              ))}
              {!showAll && bids.length > VISIBLE_LIMIT && (
                <button
                  onClick={() => setShowAll(true)}
                  className="w-full text-center text-sm text-gold hover:text-gold-dark transition-colors"
                >
                  Pokaż więcej ({bids.length - VISIBLE_LIMIT})
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
