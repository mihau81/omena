'use client';

import { apiUrl } from '@/app/lib/utils';
import { getValidBidOptions, getBidIncrement } from '@/lib/bid-increments';

import { useState, useEffect, useCallback, use, useRef } from 'react';
import Link from 'next/link';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuctionInfo {
  id: string;
  title: string;
  status: string;
}

interface LotSummary {
  id: string;
  lotNumber: number;
  title: string;
  artist: string;
  status: string;
  startingBid: number | null;
  estimateMin: number;
  estimateMax: number;
  currentHighestBid: number;
  nextMinBid: number;
  bidCount: number;
  closingAt: string | null;
  timerDuration: number | null;
}

interface BidRow {
  id: string;
  amount: number;
  bidType: string;
  paddleNumber: number | null;
  isWinning: boolean;
  createdAt: string;
  userName: string | null;
  userEmail: string | null;
  isRetracted: boolean;
  retractionReason: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPLN(amount: number): string {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function BidTypeBadge({ bidType }: { bidType: string }) {
  const styles: Record<string, string> = {
    online: 'bg-blue-100 text-blue-700',
    phone: 'bg-amber-100 text-amber-700',
    floor: 'bg-green-100 text-green-700',
    absentee: 'bg-purple-100 text-purple-700',
    system: 'bg-gray-100 text-gray-500',
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[bidType] ?? 'bg-gray-100 text-gray-600'}`}
    >
      {bidType}
    </span>
  );
}

function LotStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    published: 'bg-blue-100 text-blue-700',
    sold: 'bg-gray-200 text-gray-600',
    passed: 'bg-red-100 text-red-600',
    withdrawn: 'bg-yellow-100 text-yellow-700',
    draft: 'bg-gray-100 text-gray-400',
    catalogued: 'bg-sky-100 text-sky-700',
  };
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}
    >
      {status}
    </span>
  );
}

// ─── Countdown Component ──────────────────────────────────────────────────────

function Countdown({
  closingAt,
  onExpired,
}: {
  closingAt: string;
  onExpired?: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((new Date(closingAt).getTime() - Date.now()) / 1000)),
  );
  const expiredRef = useRef(false);

  useEffect(() => {
    expiredRef.current = false;
    const interval = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.floor((new Date(closingAt).getTime() - Date.now()) / 1000),
      );
      setSecondsLeft(remaining);
      if (remaining === 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpired?.();
        clearInterval(interval);
      }
    }, 250);
    return () => clearInterval(interval);
  }, [closingAt, onExpired]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const display = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  let colorClass = 'text-green-700 bg-green-50';
  if (secondsLeft <= 10) colorClass = 'text-red-700 bg-red-50 animate-pulse';
  else if (secondsLeft <= 30) colorClass = 'text-amber-700 bg-amber-50';

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded font-mono text-sm font-bold ${colorClass}`}
    >
      {display}
    </span>
  );
}

// ─── Timer Controls Component ─────────────────────────────────────────────────

function TimerControls({
  lotId,
  lot,
  onTimerChange,
  onError,
}: {
  lotId: string;
  lot: LotSummary;
  onTimerChange: () => void;
  onError: (msg: string) => void;
}) {
  const [duration, setDuration] = useState(String(lot.timerDuration ?? 120));
  const [busy, setBusy] = useState(false);

  const timerAction = async (
    action: string,
    extra?: { durationSeconds?: number; extensionSeconds?: number },
  ) => {
    setBusy(true);
    try {
      const res = await fetch(apiUrl(`/api/admin/lots/${lotId}/timer`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const json = await res.json();
      if (!res.ok) {
        onError(json.error ?? 'Timer action failed');
        return;
      }
      onTimerChange();
    } catch {
      onError('Timer action failed');
    } finally {
      setBusy(false);
    }
  };

  const hasTimer = !!lot.closingAt;
  const isActive = lot.status === 'active';

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {hasTimer ? (
        <>
          <Countdown closingAt={lot.closingAt!} onExpired={onTimerChange} />
          <button
            onClick={() => timerAction('extend', { extensionSeconds: 30 })}
            disabled={busy}
            className="px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded border border-amber-200 transition-colors disabled:opacity-50"
          >
            +30s
          </button>
          <button
            onClick={() => timerAction('stop')}
            disabled={busy}
            className="px-2 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded border border-red-200 transition-colors disabled:opacity-50"
          >
            Stop
          </button>
        </>
      ) : (
        isActive && (
          <>
            <input
              type="number"
              min="10"
              max="3600"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-16 px-2 py-1 text-xs border border-beige rounded focus:outline-none focus:ring-1 focus:ring-gold/30"
              title="Timer duration in seconds"
            />
            <span className="text-xs text-taupe">s</span>
            <button
              onClick={() => timerAction('start', { durationSeconds: parseInt(duration, 10) })}
              disabled={busy}
              className="px-2 py-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded border border-green-200 transition-colors disabled:opacity-50"
            >
              Start Timer
            </button>
          </>
        )
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LiveAuctionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: auctionId } = use(params);

  // Auction metadata
  const [auction, setAuction] = useState<AuctionInfo | null>(null);

  // Lots list
  const [lots, setLots] = useState<LotSummary[]>([]);
  const [lotsLoading, setLotsLoading] = useState(true);

  // Selected lot + its bid history
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [bidHistory, setBidHistory] = useState<BidRow[]>([]);
  const [currentHighestBid, setCurrentHighestBid] = useState(0);
  const [nextMinBid, setNextMinBid] = useState(0);
  const [bidsLoading, setBidsLoading] = useState(false);

  // Bid form
  const [bidAmount, setBidAmount] = useState('');
  const [bidType, setBidType] = useState<'phone' | 'floor'>('floor');
  const [paddleNumber, setPaddleNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Retract
  const [retractingId, setRetractingId] = useState<string | null>(null);
  const [retractReason, setRetractReason] = useState('');
  const [retracting, setRetracting] = useState(false);

  // Feedback
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ── Fetch auction metadata ──────────────────────────────────────────────────

  const fetchAuction = useCallback(async () => {
    try {
      const res = await fetch(apiUrl(`/api/admin/auctions/${auctionId}`));
      if (res.ok) {
        const data = await res.json();
        setAuction({ id: data.auction.id, title: data.auction.title, status: data.auction.status });
      }
    } catch {
      // non-fatal
    }
  }, [auctionId]);

  // ── Fetch lots list ─────────────────────────────────────────────────────────

  const fetchLots = useCallback(async () => {
    try {
      const res = await fetch(apiUrl(`/api/admin/auctions/${auctionId}/lots`));
      if (res.ok) {
        const data = await res.json();
        setLots(
          data.lots.map((l: LotSummary) => ({
            ...l,
            currentHighestBid: l.currentHighestBid ?? 0,
            nextMinBid: l.nextMinBid ?? 0,
          })),
        );
      }
    } catch {
      setError('Failed to load lots');
    } finally {
      setLotsLoading(false);
    }
  }, [auctionId]);

  // ── Fetch bid history for selected lot ─────────────────────────────────────

  const fetchBidHistory = useCallback(async (lotId: string) => {
    setBidsLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/admin/lots/${lotId}/bids`));
      if (res.ok) {
        const data = await res.json();
        setBidHistory(data.bids ?? []);
        setCurrentHighestBid(data.currentHighestBid ?? 0);
        setNextMinBid(data.nextMinBid ?? 0);
        setBidAmount(String(data.nextMinBid ?? ''));
      } else {
        setError('Failed to load bid history');
      }
    } catch {
      setError('Failed to load bid history');
    } finally {
      setBidsLoading(false);
    }
  }, []);

  // ── Initial load ────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchAuction();
    fetchLots();
  }, [fetchAuction, fetchLots]);

  // ── Polling: refresh lots list every 10s and bid history every 5s ──────────

  useEffect(() => {
    const lotsInterval = setInterval(() => { fetchLots(); }, 10_000);
    return () => clearInterval(lotsInterval);
  }, [fetchLots]);

  useEffect(() => {
    if (!selectedLotId) return;
    const bidsInterval = setInterval(() => { fetchBidHistory(selectedLotId); }, 5_000);
    return () => clearInterval(bidsInterval);
  }, [selectedLotId, fetchBidHistory]);

  // ── Select lot ──────────────────────────────────────────────────────────────

  const handleSelectLot = (lotId: string) => {
    setSelectedLotId(lotId);
    setBidHistory([]);
    setError(null);
    setSuccess(null);
    setBidAmount('');
    fetchBidHistory(lotId);
  };

  // ── Submit bid ──────────────────────────────────────────────────────────────

  const handlePlaceBid = async () => {
    if (!selectedLotId) return;

    const amount = parseInt(bidAmount, 10);
    if (!bidAmount || isNaN(amount) || amount <= 0) {
      setError('Please enter a valid bid amount');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(apiUrl(`/api/admin/lots/${selectedLotId}/bids`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          bidType,
          paddleNumber: paddleNumber ? parseInt(paddleNumber, 10) : null,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? 'Failed to place bid');
        return;
      }

      setSuccess(
        `${bidType === 'phone' ? 'Phone' : 'Floor'} bid of ${formatPLN(amount)} placed successfully`,
      );
      setTimeout(() => setSuccess(null), 4_000);

      await Promise.all([fetchBidHistory(selectedLotId), fetchLots()]);
      setBidAmount(String(json.nextMinBid ?? ''));
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Retract bid ─────────────────────────────────────────────────────────────

  const handleRetractConfirm = async () => {
    if (!retractingId || !retractReason.trim()) return;

    setRetracting(true);
    setError(null);

    try {
      const res = await fetch(apiUrl(`/api/admin/bids/${retractingId}/retract`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: retractReason.trim() }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? 'Failed to retract bid');
        return;
      }

      setSuccess('Bid retracted successfully');
      setTimeout(() => setSuccess(null), 4_000);
      setRetractingId(null);
      setRetractReason('');

      if (selectedLotId) {
        await Promise.all([fetchBidHistory(selectedLotId), fetchLots()]);
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setRetracting(false);
    }
  };

  const selectedLot = lots.find((l) => l.id === selectedLotId);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/auctions/${auctionId}`}
            className="text-taupe hover:text-dark-brown transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-cream"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-serif font-bold text-dark-brown">
              Live Auction Control
            </h1>
            {auction && (
              <p className="text-sm text-taupe mt-0.5">
                {auction.title}
                {auction.status !== 'live' && (
                  <span className="ml-2 text-amber-600 font-medium">
                    (Status: {auction.status} — not currently live)
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => { fetchLots(); if (selectedLotId) fetchBidHistory(selectedLotId); }}
          className="inline-flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] text-sm font-medium text-dark-brown bg-cream hover:bg-beige rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Feedback banners */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* Main layout: single column on mobile, two-column on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Left column: Lot list */}
        <div className="bg-white rounded-xl border border-beige overflow-hidden">
          <div className="px-4 py-3 border-b border-beige bg-cream/40">
            <h2 className="text-sm font-semibold text-dark-brown uppercase tracking-wide">
              Lots ({lots.length})
            </h2>
          </div>

          {lotsLoading ? (
            <div className="px-4 py-8 text-center text-sm text-taupe">Loading lots...</div>
          ) : lots.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-taupe">No lots found for this auction.</div>
          ) : (
            <div className="overflow-y-auto max-h-64 lg:max-h-[calc(100vh-260px)]">
              {lots.map((lot) => {
                const hasTimer = !!lot.closingAt;
                return (
                  <button
                    key={lot.id}
                    onClick={() => handleSelectLot(lot.id)}
                    className={`w-full text-left px-4 py-4 lg:py-3 border-b border-beige/50 transition-colors min-h-[60px] ${
                      selectedLotId === lot.id
                        ? 'bg-gold/10 border-l-4 border-l-gold'
                        : hasTimer
                        ? 'border-l-4 border-l-amber-400 hover:bg-amber-50/30 animate-[pulse_3s_ease-in-out_infinite]'
                        : 'hover:bg-cream/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono text-taupe">#{lot.lotNumber}</span>
                          <LotStatusBadge status={lot.status} />
                          {hasTimer && (
                            <Countdown
                              closingAt={lot.closingAt!}
                              onExpired={fetchLots}
                            />
                          )}
                        </div>
                        <p className="text-sm font-medium text-dark-brown mt-0.5 truncate">
                          {lot.title}
                        </p>
                        {lot.artist && (
                          <p className="text-xs text-taupe truncate">{lot.artist}</p>
                        )}
                        {/* Timer controls inline for active lots */}
                        {selectedLotId === lot.id && (
                          <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                            <TimerControls
                              lotId={lot.id}
                              lot={lot}
                              onTimerChange={fetchLots}
                              onError={setError}
                            />
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        {lot.currentHighestBid > 0 ? (
                          <p className="text-sm font-semibold text-dark-brown">
                            {formatPLN(lot.currentHighestBid)}
                          </p>
                        ) : (
                          <p className="text-xs text-taupe">No bids</p>
                        )}
                        <p className="text-xs text-taupe">
                          {lot.bidCount} bid{lot.bidCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column: Bid entry + history */}
        <div className="space-y-4">

          {/* Bid entry form */}
          <div className="bg-white rounded-xl border border-beige p-4">
            <h2 className="text-sm font-semibold text-dark-brown uppercase tracking-wide mb-3">
              Enter Bid
            </h2>

            {!selectedLotId ? (
              <p className="text-sm text-taupe">Select a lot from the list to enter a bid.</p>
            ) : (
              <div className="space-y-3">
                {/* Selected lot info */}
                <div className={`rounded-lg px-3 py-2 ${selectedLot?.closingAt ? 'bg-amber-50 border border-amber-200' : 'bg-cream/40'}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-taupe">Selected lot</p>
                    {selectedLot?.closingAt && (
                      <Countdown
                        closingAt={selectedLot.closingAt}
                        onExpired={() => { fetchLots(); if (selectedLotId) fetchBidHistory(selectedLotId); }}
                      />
                    )}
                  </div>
                  <p className="text-sm font-medium text-dark-brown">
                    #{selectedLot?.lotNumber} — {selectedLot?.title}
                  </p>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-xs text-taupe">
                      Current highest:{' '}
                      <span className="font-semibold text-dark-brown">
                        {currentHighestBid > 0 ? formatPLN(currentHighestBid) : 'No bids'}
                      </span>
                    </span>
                    <span className="text-xs text-taupe">
                      Next min:{' '}
                      <span className="font-semibold text-amber-700">{formatPLN(nextMinBid)}</span>
                    </span>
                  </div>
                </div>

                {/* Timer controls */}
                {selectedLot && (
                  <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
                    <p className="text-xs font-medium text-taupe mb-2">Timer Control</p>
                    <TimerControls
                      lotId={selectedLotId}
                      lot={selectedLot}
                      onTimerChange={fetchLots}
                      onError={setError}
                    />
                  </div>
                )}

                {/* Bid type selector */}
                <div>
                  <label className="block text-xs font-medium text-taupe mb-1">Bid Type</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setBidType('floor')}
                      className={`flex-1 py-3 px-3 min-h-[44px] text-sm font-medium rounded-lg border transition-colors ${
                        bidType === 'floor'
                          ? 'bg-green-600 text-white border-green-600'
                          : 'bg-white text-taupe border-beige hover:border-green-400'
                      }`}
                    >
                      Floor
                    </button>
                    <button
                      type="button"
                      onClick={() => setBidType('phone')}
                      className={`flex-1 py-3 px-3 min-h-[44px] text-sm font-medium rounded-lg border transition-colors ${
                        bidType === 'phone'
                          ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-white text-taupe border-beige hover:border-amber-400'
                      }`}
                    >
                      Phone
                    </button>
                  </div>
                </div>

                {/* Amount + paddle row */}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-taupe mb-1">
                      Amount (PLN)
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={nextMinBid}
                      step="1"
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      placeholder={String(nextMinBid)}
                      className="w-full px-3 py-2.5 min-h-[44px] text-sm border border-beige rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold"
                    />
                  </div>
                  <div className="w-28">
                    <label className="block text-xs font-medium text-taupe mb-1">
                      Paddle #
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      value={paddleNumber}
                      onChange={(e) => setPaddleNumber(e.target.value)}
                      placeholder="Optional"
                      className="w-full px-3 py-2.5 min-h-[44px] text-sm border border-beige rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold"
                    />
                  </div>
                </div>

                {/* Quick-bid increment tags */}
                {nextMinBid > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-medium text-taupe">Quick Bid</label>
                      <span className="text-xs text-taupe">
                        Increment: {formatPLN(getBidIncrement(currentHighestBid))}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {getValidBidOptions(currentHighestBid, 4).map((amount) => {
                        const isSelected = bidAmount === String(amount);
                        return (
                          <button
                            key={amount}
                            type="button"
                            onClick={() => setBidAmount(String(amount))}
                            className={`px-3 py-2.5 min-h-[44px] text-sm font-semibold rounded-lg border transition-colors ${
                              isSelected
                                ? 'bg-gold text-white border-gold'
                                : 'text-dark-brown bg-cream hover:bg-beige border-beige/60 hover:border-gold/40'
                            }`}
                          >
                            {formatPLN(amount)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="button"
                  onClick={handlePlaceBid}
                  disabled={submitting || !bidAmount}
                  className="w-full py-3 px-4 min-h-[44px] text-sm font-semibold text-white bg-dark-brown hover:bg-dark-brown/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  {submitting
                    ? 'Placing Bid…'
                    : `Place ${bidType === 'phone' ? 'Phone' : 'Floor'} Bid`}
                </button>
              </div>
            )}
          </div>

          {/* Bid history for selected lot */}
          <div className="bg-white rounded-xl border border-beige overflow-hidden">
            <div className="px-4 py-3 border-b border-beige bg-cream/40">
              <h2 className="text-sm font-semibold text-dark-brown uppercase tracking-wide">
                Bid History
                {selectedLot && (
                  <span className="ml-2 font-normal text-taupe normal-case">
                    — Lot #{selectedLot.lotNumber}
                  </span>
                )}
              </h2>
            </div>

            {!selectedLotId ? (
              <div className="px-4 py-6 text-center text-sm text-taupe">
                Select a lot to view its bid history.
              </div>
            ) : bidsLoading ? (
              <div className="px-4 py-6 text-center text-sm text-taupe">Loading...</div>
            ) : bidHistory.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-taupe">
                No bids yet for this lot.
              </div>
            ) : (
              <div className="overflow-y-auto max-h-72">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-beige/60">
                      <th className="px-3 py-2 text-left text-xs font-semibold text-taupe uppercase tracking-wide">
                        Amount
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-taupe uppercase tracking-wide">
                        Type
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-taupe uppercase tracking-wide hidden sm:table-cell">
                        Paddle / Bidder
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-taupe uppercase tracking-wide hidden md:table-cell">
                        Time
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-taupe uppercase tracking-wide">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-beige/40">
                    {bidHistory.map((bid) => (
                      <tr
                        key={bid.id}
                        className={`${bid.isRetracted ? 'opacity-40 line-through' : ''} ${
                          bid.isWinning && !bid.isRetracted ? 'bg-gold/5' : ''
                        }`}
                      >
                        <td className="px-3 py-2 font-semibold text-dark-brown">
                          {formatPLN(bid.amount)}
                          {bid.isWinning && !bid.isRetracted && (
                            <span className="ml-1 text-xs text-gold font-medium">WINNING</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <BidTypeBadge bidType={bid.bidType} />
                        </td>
                        <td className="px-3 py-2 text-xs text-taupe hidden sm:table-cell">
                          {bid.paddleNumber ? (
                            <span>Paddle #{bid.paddleNumber}</span>
                          ) : bid.userName ? (
                            <span title={bid.userEmail ?? ''}>{bid.userName}</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-taupe hidden md:table-cell">
                          {new Date(bid.createdAt).toLocaleTimeString('pl-PL', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {!bid.isRetracted && (
                            <button
                              onClick={() => {
                                setRetractingId(bid.id);
                                setRetractReason('');
                              }}
                              className="inline-flex items-center gap-1 px-3 py-2 min-h-[36px] text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                            >
                              Retract
                            </button>
                          )}
                          {bid.isRetracted && bid.retractionReason && (
                            <span
                              className="text-xs text-taupe italic"
                              title={bid.retractionReason}
                            >
                              Retracted
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Retract dialog */}
      {retractingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl border border-beige shadow-xl w-full max-w-md p-6 space-y-4 mx-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-serif font-bold text-dark-brown">Retract Bid</h2>
              <button
                onClick={() => { setRetractingId(null); setRetractReason(''); }}
                className="text-taupe hover:text-dark-brown min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-cream transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-taupe">
              Retracting a bid is permanent. The previous highest bid will become the new winning bid.
              Please provide a reason for the record.
            </p>
            <div>
              <label className="block text-xs font-medium text-dark-brown mb-1">
                Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={retractReason}
                onChange={(e) => setRetractReason(e.target.value)}
                placeholder="e.g. Bidder requested retraction, phone connection issue, duplicate bid..."
                rows={3}
                className="w-full px-3 py-2 text-sm border border-beige rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold"
              />
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => { setRetractingId(null); setRetractReason(''); }}
                className="px-4 py-3 min-h-[44px] text-sm font-medium text-taupe hover:text-dark-brown border border-beige rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRetractConfirm}
                disabled={retracting || !retractReason.trim()}
                className="px-4 py-3 min-h-[44px] text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                {retracting ? 'Retracting…' : 'Confirm Retraction'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
