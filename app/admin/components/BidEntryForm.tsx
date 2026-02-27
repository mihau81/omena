'use client';

import { useState } from 'react';

interface BidEntryFormProps {
  lotId: string;
  lotTitle: string;
  currentHighestBid: number;
  nextMinBid: number;
  onBidPlaced: () => void;
}

function formatDisplay(val: string): string {
  const n = val.replace(/\D/g, '');
  if (!n) return '';
  return parseInt(n, 10).toLocaleString('pl-PL');
}

function parseDisplay(val: string): number {
  const n = val.replace(/\D/g, '');
  return n ? parseInt(n, 10) : 0;
}

export default function BidEntryForm({
  lotId,
  lotTitle,
  currentHighestBid,
  nextMinBid,
  onBidPlaced,
}: BidEntryFormProps) {
  const [amount, setAmount] = useState('');
  const [bidType, setBidType] = useState<'phone' | 'floor'>('phone');
  const [paddleNumber, setPaddleNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const numAmount = parseDisplay(amount);
    if (!numAmount || numAmount < nextMinBid) {
      setError(`Amount must be at least ${nextMinBid.toLocaleString('pl-PL')} PLN`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/lots/${lotId}/bids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: numAmount,
          bidType,
          paddleNumber: paddleNumber ? parseInt(paddleNumber, 10) : undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Failed to place bid');
        return;
      }

      setSuccess(`Bid of ${numAmount.toLocaleString('pl-PL')} PLN placed`);
      setAmount('');
      setPaddleNumber('');
      onBidPlaced();
      setTimeout(() => setSuccess(null), 5000);
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-beige p-5">
      <h3 className="text-sm font-semibold text-dark-brown mb-1">Enter Bid</h3>
      <p className="text-xs text-taupe mb-4 truncate" title={lotTitle}>{lotTitle}</p>

      {currentHighestBid > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-800">
            Current highest:{' '}
            <span className="font-semibold">
              {currentHighestBid.toLocaleString('pl-PL')} PLN
            </span>
          </p>
          <p className="text-xs text-amber-800 mt-0.5">
            Next minimum:{' '}
            <span className="font-semibold">{nextMinBid.toLocaleString('pl-PL')} PLN</span>
          </p>
        </div>
      )}

      {currentHighestBid === 0 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-700">
            Opening bid — minimum:{' '}
            <span className="font-semibold">{nextMinBid.toLocaleString('pl-PL')} PLN</span>
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Bid type toggle */}
        <div>
          <label className="block text-xs font-medium text-taupe mb-1">Bid Type</label>
          <div className="flex gap-2">
            {(['phone', 'floor'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setBidType(type)}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors capitalize ${
                  bidType === type
                    ? 'bg-dark-brown text-white border-dark-brown'
                    : 'bg-white text-taupe border-beige hover:border-dark-brown'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="block text-xs font-medium text-taupe mb-1">
            Amount (PLN) <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(formatDisplay(e.target.value))}
            placeholder={`Min. ${nextMinBid.toLocaleString('pl-PL')} PLN`}
            className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:outline-none focus:ring-1 focus:ring-gold focus:border-gold"
            required
          />
        </div>

        {/* Paddle number */}
        <div>
          <label className="block text-xs font-medium text-taupe mb-1">
            Paddle # <span className="text-taupe/60">(optional)</span>
          </label>
          <input
            type="number"
            value={paddleNumber}
            onChange={(e) => setPaddleNumber(e.target.value)}
            placeholder="e.g. 42"
            min="1"
            className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:outline-none focus:ring-1 focus:ring-gold focus:border-gold"
          />
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        {success && (
          <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            {success}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 text-sm font-medium text-white bg-gold hover:bg-gold-dark rounded-lg transition-colors disabled:opacity-60"
        >
          {loading ? 'Placing...' : 'Place Bid'}
        </button>
      </form>
    </div>
  );
}
