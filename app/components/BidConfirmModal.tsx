'use client';

import { useEffect } from 'react';
import { useLocale } from '../lib/LocaleContext';
import { useCurrency } from '../lib/CurrencyContext';
import { calculatePremium, calculateTotal, BUYERS_PREMIUM_RATE } from '../lib/bidding';

interface BidConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  amount: number;
  lotTitle: string;
  lotArtist: string;
}

export default function BidConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  amount,
  lotTitle,
  lotArtist,
}: BidConfirmModalProps) {
  const { t } = useLocale();
  const { formatPrice } = useCurrency();

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const premium = calculatePremium(amount);
  const total = calculateTotal(amount);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-dark-brown/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label={t.confirmBid}
      >
        <h2 className="font-serif text-xl font-bold text-dark-brown">
          {t.confirmBid}
        </h2>

        <div className="mt-4 rounded-lg bg-cream p-4">
          <p className="font-serif font-bold text-dark-brown">{lotTitle}</p>
          <p className="text-sm text-gold">{lotArtist}</p>
        </div>

        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-taupe">{t.yourBid}</span>
            <span className="font-serif text-lg font-bold text-dark-brown">
              {formatPrice(amount)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-taupe">
              {t.buyersPremium}
            </span>
            <span className="text-sm text-taupe">{formatPrice(premium)}</span>
          </div>

          <div className="h-px bg-beige" />

          <div className="flex items-center justify-between">
            <span className="font-medium text-dark-brown">{t.totalWithPremium}</span>
            <span className="font-serif text-lg font-bold text-gold">
              {formatPrice(total)}
            </span>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-taupe">
          {t.currencyDisclaimer}
        </p>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-beige py-2.5 font-medium text-dark-brown transition-colors hover:bg-beige/50"
          >
            {t.cancelBid}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-gold py-2.5 font-medium text-white transition-colors hover:bg-gold-dark"
          >
            {t.confirmBid}
          </button>
        </div>
      </div>
    </div>
  );
}
