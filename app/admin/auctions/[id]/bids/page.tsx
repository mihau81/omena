'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import BidEntryForm from '../../../components/BidEntryForm';
import BidRetractDialog from '../../../components/BidRetractDialog';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuctionInfo {
  id: string;
  title: string;
  slug: string;
  status: string;
}

interface LotRow {
  id: string;
  lotNumber: number;
  title: string;
  artist: string;
  status: string;
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

interface BidsData {
  bids: BidRow[];
  nextMinBid: number;
  currentHighestBid: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const LOT_STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  sold: 'bg-blue-100 text-blue-700',
  published: 'bg-yellow-100 text-yellow-700',
  passed: 'bg-gray-100 text-gray-500',
  withdrawn: 'bg-red-100 text-red-600',
  draft: 'bg-gray-100 text-gray-400',
  catalogued: 'bg-purple-100 text-purple-700',
};

// ─── Page Component ───────────────────────────────────────────────────────────

export default function AuctionBidsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: auctionId } = use(params);

  const [auction, setAuction] = useState<AuctionInfo | null>(null);
  const [lots, setLots] = useState<LotRow[]>([]);
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [bidsData, setBidsData] = useState<BidsData | null>(null);
  const [loadingPage, setLoadingPage] = useState(true);
  const [loadingBids, setLoadingBids] = useState(false);
  const [retractDialog, setRetractDialog] = useState<{
    bidId: string;
    amount: number;
    bidType: string;
  } | null>(null);
  const [lotFilter, setLotFilter] = useState('');

  // ── Load auction + lots ────────────────────────────────────────────────────

  const fetchPageData = useCallback(async () => {
    try {
      const [auctionRes, lotsRes] = await Promise.all([
        fetch(`/api/admin/auctions/${auctionId}`),
        fetch(`/api/admin/auctions/${auctionId}/lots`),
      ]);

      if (auctionRes.ok) {
        const data = await auctionRes.json();
        setAuction(data.auction);
      }

      if (lotsRes.ok) {
        const data = await lotsRes.json();
        const fetchedLots: LotRow[] = data.lots;
        setLots(fetchedLots);

        // Auto-select first active lot, or first lot
        const firstActive = fetchedLots.find((l) => l.status === 'active');
        setSelectedLotId(firstActive?.id ?? fetchedLots[0]?.id ?? null);
      }
    } catch (err) {
      console.error('Failed to fetch auction data:', err);
    } finally {
      setLoadingPage(false);
    }
  }, [auctionId]);

  useEffect(() => {
    fetchPageData();
  }, [fetchPageData]);

  // ── Load bids for selected lot ─────────────────────────────────────────────

  const fetchBids = useCallback(async (lotId: string) => {
    setLoadingBids(true);
    setBidsData(null);
    try {
      const res = await fetch(`/api/admin/lots/${lotId}/bids`);
      if (res.ok) {
        const data = await res.json();
        setBidsData(data);
      }
    } catch (err) {
      console.error('Failed to fetch bids:', err);
    } finally {
      setLoadingBids(false);
    }
  }, []);

  useEffect(() => {
    if (selectedLotId) {
      fetchBids(selectedLotId);
    }
  }, [selectedLotId, fetchBids]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleBidPlaced = () => {
    if (selectedLotId) fetchBids(selectedLotId);
  };

  const handleRetracted = () => {
    setRetractDialog(null);
    if (selectedLotId) fetchBids(selectedLotId);
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const selectedLot = lots.find((l) => l.id === selectedLotId) ?? null;

  const filteredLots = lots.filter((l) => {
    if (!lotFilter) return true;
    const q = lotFilter.toLowerCase();
    return (
      String(l.lotNumber).includes(q) ||
      l.title.toLowerCase().includes(q) ||
      l.artist.toLowerCase().includes(q)
    );
  });

  // ── Loading skeleton ───────────────────────────────────────────────────────

  if (loadingPage) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/auctions/${auctionId}`}
            className="text-taupe hover:text-dark-brown transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
          </Link>
          <h1 className="text-2xl font-serif font-bold text-dark-brown">Loading...</h1>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/auctions/${auctionId}`}
            className="text-taupe hover:text-dark-brown transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-serif font-bold text-dark-brown">
              Bid Management
            </h1>
            {auction && (
              <p className="text-sm text-taupe mt-0.5">
                {auction.title} &middot;{' '}
                <span className="capitalize">{auction.status}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/admin/auctions/${auctionId}/lots`}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-dark-brown bg-cream hover:bg-beige rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
            </svg>
            Lots ({lots.length})
          </Link>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex gap-4" style={{ minHeight: 600 }}>
        {/* ── Left: Lot list ─────────────────────────────────────────────── */}
        <div className="w-64 flex-shrink-0 flex flex-col gap-2">
          <div className="bg-white rounded-xl border border-beige overflow-hidden flex flex-col">
            <div className="p-3 border-b border-beige">
              <input
                type="text"
                value={lotFilter}
                onChange={(e) => setLotFilter(e.target.value)}
                placeholder="Filter lots..."
                className="w-full px-2.5 py-1.5 text-xs border border-beige rounded-lg focus:outline-none focus:ring-1 focus:ring-gold focus:border-gold"
              />
            </div>

            <div className="overflow-y-auto flex-1" style={{ maxHeight: 580 }}>
              {filteredLots.length === 0 ? (
                <p className="p-4 text-xs text-taupe text-center">No lots found</p>
              ) : (
                filteredLots.map((lot) => {
                  const isSelected = lot.id === selectedLotId;
                  const statusColor =
                    LOT_STATUS_COLORS[lot.status] ?? 'bg-gray-100 text-gray-500';
                  return (
                    <button
                      key={lot.id}
                      onClick={() => setSelectedLotId(lot.id)}
                      className={`w-full text-left px-3 py-2.5 border-b border-beige/50 last:border-b-0 transition-colors ${
                        isSelected
                          ? 'bg-gold/10 border-l-2 border-l-gold'
                          : 'hover:bg-cream/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="text-xs font-semibold text-dark-brown">
                          #{lot.lotNumber}
                        </span>
                        <span
                          className={`inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded capitalize ${statusColor}`}
                        >
                          {lot.status}
                        </span>
                      </div>
                      <p className="text-xs text-dark-brown truncate">{lot.title}</p>
                      {lot.artist && (
                        <p className="text-[11px] text-taupe truncate">{lot.artist}</p>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ── Right: Bids panel ──────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {!selectedLot ? (
            <div className="bg-white rounded-xl border border-beige flex items-center justify-center h-48">
              <p className="text-sm text-taupe">Select a lot to view bids</p>
            </div>
          ) : (
            <>
              {/* Lot header */}
              <div className="bg-white rounded-xl border border-beige px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-taupe">
                        Lot #{selectedLot.lotNumber}
                      </span>
                      <span
                        className={`inline-flex px-2 py-0.5 text-[11px] font-medium rounded capitalize ${
                          LOT_STATUS_COLORS[selectedLot.status] ?? 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {selectedLot.status}
                      </span>
                    </div>
                    <h2 className="text-base font-semibold text-dark-brown mt-0.5">
                      {selectedLot.title}
                    </h2>
                    {selectedLot.artist && (
                      <p className="text-sm text-taupe">{selectedLot.artist}</p>
                    )}
                  </div>

                  {bidsData && (
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-taupe">Total bids</p>
                      <p className="text-2xl font-semibold text-dark-brown">
                        {bidsData.bids.length}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Entry form + bid table in grid */}
              <div className="flex gap-4 items-start">
                {/* Bid entry form */}
                <div className="w-64 flex-shrink-0">
                  {bidsData && (
                    <BidEntryForm
                      lotId={selectedLot.id}
                      lotTitle={selectedLot.title}
                      currentHighestBid={bidsData.currentHighestBid}
                      nextMinBid={bidsData.nextMinBid}
                      onBidPlaced={handleBidPlaced}
                    />
                  )}
                  {!bidsData && !loadingBids && (
                    <BidEntryForm
                      lotId={selectedLot.id}
                      lotTitle={selectedLot.title}
                      currentHighestBid={0}
                      nextMinBid={100}
                      onBidPlaced={handleBidPlaced}
                    />
                  )}
                </div>

                {/* Bid history table */}
                <div className="flex-1 min-w-0">
                  {loadingBids ? (
                    <div className="bg-white rounded-xl border border-beige p-6 text-center">
                      <p className="text-sm text-taupe">Loading bids...</p>
                    </div>
                  ) : !bidsData || bidsData.bids.length === 0 ? (
                    <div className="bg-white rounded-xl border border-beige p-8 text-center">
                      <svg
                        className="w-8 h-8 text-beige mx-auto mb-2"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z"
                        />
                      </svg>
                      <p className="text-sm text-taupe">No bids yet for this lot</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl border border-beige overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-beige bg-cream/50">
                              <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase tracking-wider">
                                Bidder
                              </th>
                              <th className="px-4 py-3 text-right text-xs font-semibold text-taupe uppercase tracking-wider">
                                Amount
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase tracking-wider">
                                Type
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase tracking-wider">
                                Paddle
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase tracking-wider">
                                Status
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase tracking-wider">
                                Time
                              </th>
                              <th className="px-4 py-3" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-beige/50">
                            {bidsData.bids.map((bid) => (
                              <tr
                                key={bid.id}
                                className={`transition-colors ${
                                  bid.isRetracted
                                    ? 'bg-red-50/50 opacity-60'
                                    : bid.isWinning
                                    ? 'bg-green-50/40'
                                    : 'hover:bg-cream/30'
                                }`}
                              >
                                {/* Bidder */}
                                <td className="px-4 py-3">
                                  {bid.userName ? (
                                    <div>
                                      <p className="text-xs font-medium text-dark-brown">
                                        {bid.userName}
                                      </p>
                                      {bid.userEmail && (
                                        <p className="text-[11px] text-taupe">{bid.userEmail}</p>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-taupe italic">
                                      {bid.bidType === 'phone' ? 'Phone bidder' : 'Floor bidder'}
                                    </span>
                                  )}
                                </td>

                                {/* Amount */}
                                <td className="px-4 py-3 text-right">
                                  <span
                                    className={`font-semibold ${
                                      bid.isRetracted
                                        ? 'line-through text-taupe'
                                        : 'text-dark-brown'
                                    }`}
                                  >
                                    {bid.amount.toLocaleString('pl-PL')} PLN
                                  </span>
                                </td>

                                {/* Type */}
                                <td className="px-4 py-3">
                                  <span
                                    className={`inline-flex px-2 py-0.5 text-[11px] font-medium rounded capitalize ${
                                      bid.bidType === 'online'
                                        ? 'bg-blue-100 text-blue-700'
                                        : bid.bidType === 'phone'
                                        ? 'bg-purple-100 text-purple-700'
                                        : bid.bidType === 'floor'
                                        ? 'bg-orange-100 text-orange-700'
                                        : 'bg-gray-100 text-gray-600'
                                    }`}
                                  >
                                    {bid.bidType}
                                  </span>
                                </td>

                                {/* Paddle */}
                                <td className="px-4 py-3 text-xs text-taupe">
                                  {bid.paddleNumber ?? '—'}
                                </td>

                                {/* Status */}
                                <td className="px-4 py-3">
                                  {bid.isRetracted ? (
                                    <div>
                                      <span className="inline-flex px-2 py-0.5 text-[11px] font-medium rounded bg-red-100 text-red-600">
                                        Retracted
                                      </span>
                                      {bid.retractionReason && (
                                        <p className="text-[11px] text-taupe mt-0.5 max-w-[120px] truncate" title={bid.retractionReason}>
                                          {bid.retractionReason}
                                        </p>
                                      )}
                                    </div>
                                  ) : bid.isWinning ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded bg-green-100 text-green-700">
                                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                                      Winning
                                    </span>
                                  ) : (
                                    <span className="inline-flex px-2 py-0.5 text-[11px] font-medium rounded bg-gray-100 text-gray-500">
                                      Outbid
                                    </span>
                                  )}
                                </td>

                                {/* Time */}
                                <td className="px-4 py-3 text-xs text-taupe whitespace-nowrap">
                                  {new Date(bid.createdAt).toLocaleTimeString('pl-PL', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                  })}
                                  <br />
                                  <span className="text-[10px]">
                                    {new Date(bid.createdAt).toLocaleDateString('pl-PL')}
                                  </span>
                                </td>

                                {/* Actions */}
                                <td className="px-4 py-3">
                                  {!bid.isRetracted && (
                                    <button
                                      onClick={() =>
                                        setRetractDialog({
                                          bidId: bid.id,
                                          amount: bid.amount,
                                          bidType: bid.bidType,
                                        })
                                      }
                                      className="text-xs text-red-500 hover:text-red-700 hover:underline transition-colors"
                                      title="Retract this bid"
                                    >
                                      Retract
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bid retraction dialog */}
      {retractDialog && (
        <BidRetractDialog
          open
          bidId={retractDialog.bidId}
          bidAmount={retractDialog.amount}
          bidType={retractDialog.bidType}
          onRetracted={handleRetracted}
          onCancel={() => setRetractDialog(null)}
        />
      )}
    </div>
  );
}
