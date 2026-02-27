'use client';

import { useState, useEffect, useCallback } from 'react';

interface MaxBidPanelProps {
  lotId: string;
  nextMin: number;
}

export default function MaxBidPanel({ lotId, nextMin }: MaxBidPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasAbsenteeBid, setHasAbsenteeBid] = useState(false);
  const [maxAmount, setMaxAmount] = useState(nextMin);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');

  // Check if user already has an absentee bid when panel opens
  useEffect(() => {
    if (!isOpen) return;
    fetch(`/api/lots/${lotId}/absentee`)
      .then((r) => r.json())
      .then((data) => {
        if (data.hasAbsenteeBid) setHasAbsenteeBid(true);
      })
      .catch(() => {});
  }, [isOpen, lotId]);

  // Keep maxAmount in sync with nextMin when it changes
  useEffect(() => {
    setMaxAmount((prev) => (prev < nextMin ? nextMin : prev));
  }, [nextMin]);

  const handleSet = useCallback(async () => {
    if (maxAmount < nextMin) return;
    setLoading(true);
    setStatus('idle');
    try {
      const res = await fetch(`/api/lots/${lotId}/absentee`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxAmount }),
      });
      if (res.ok) {
        setHasAbsenteeBid(true);
        setStatus('success');
        setStatusMsg('Maximum bid set. We will bid on your behalf up to this amount.');
      } else {
        const data = await res.json();
        setStatus('error');
        setStatusMsg(data.error ?? 'Failed to set maximum bid.');
      }
    } catch {
      setStatus('error');
      setStatusMsg('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [lotId, maxAmount, nextMin]);

  const handleCancel = useCallback(async () => {
    setLoading(true);
    setStatus('idle');
    try {
      const res = await fetch(`/api/lots/${lotId}/absentee`, { method: 'DELETE' });
      if (res.ok) {
        setHasAbsenteeBid(false);
        setStatus('idle');
        setStatusMsg('');
      } else {
        const data = await res.json();
        setStatus('error');
        setStatusMsg(data.error ?? 'Failed to cancel.');
      }
    } catch {
      setStatus('error');
      setStatusMsg('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [lotId]);

  return (
    <div className="mt-3 rounded-lg border border-beige">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-dark-brown hover:bg-beige/30 transition-colors rounded-lg"
      >
        <span className="flex items-center gap-2">
          <ChevronIcon />
          Set Maximum Bid
        </span>
        <span className="text-xs text-taupe">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="border-t border-beige px-4 pb-4 pt-3">
          <p className="mb-3 text-xs text-taupe">
            Enter the most you&apos;re willing to pay. We&apos;ll automatically bid for you at
            the minimum increment, keeping your maximum confidential.
          </p>

          {hasAbsenteeBid && status !== 'success' && (
            <div className="mb-3 rounded-md bg-green-50 px-3 py-2 text-xs text-green-700">
              You have an active maximum bid on this lot.{' '}
              <button
                type="button"
                onClick={handleCancel}
                disabled={loading}
                className="underline hover:text-green-900 disabled:opacity-50"
              >
                Cancel it
              </button>
            </div>
          )}

          {status === 'success' && (
            <div className="mb-3 rounded-md bg-green-50 px-3 py-2 text-xs text-green-700">
              {statusMsg}
            </div>
          )}
          {status === 'error' && (
            <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
              {statusMsg}
            </div>
          )}

          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              value={maxAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
              onChange={(e) => {
                const raw = e.target.value.replace(/\s/g, '');
                const num = parseInt(raw, 10);
                if (!isNaN(num)) setMaxAmount(num);
                else if (raw === '') setMaxAmount(0);
              }}
              className="w-full rounded-lg border border-beige px-4 py-2.5 pr-16 text-sm text-dark-brown focus:border-gold focus:ring-2 focus:ring-gold/30 focus:outline-none"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-taupe">
              PLN
            </span>
          </div>
          {maxAmount < nextMin && (
            <p className="mt-1 text-xs text-red-600">
              Must be at least {nextMin.toLocaleString()} PLN
            </p>
          )}

          <button
            type="button"
            onClick={handleSet}
            disabled={loading || maxAmount < nextMin}
            className="mt-3 w-full rounded-lg border border-gold py-2 text-sm font-medium text-gold transition-colors hover:bg-gold/5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving…' : hasAbsenteeBid ? 'Update Maximum Bid' : 'Set Maximum Bid'}
          </button>
        </div>
      )}
    </div>
  );
}

function ChevronIcon() {
  return (
    <svg className="h-4 w-4 text-gold" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
    </svg>
  );
}
