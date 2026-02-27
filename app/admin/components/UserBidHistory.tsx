'use client';

import { useState, useEffect } from 'react';

interface BidRow {
  id: string;
  amount: number;
  bidType: string;
  isWinning: boolean;
  createdAt: string;
  lotId: string;
  lotNumber: number;
  lotTitle: string;
  auctionTitle: string;
  auctionSlug: string;
}

interface PaginatedResponse {
  data: BidRow[];
  total: number;
  page: number;
  totalPages: number;
}

export default function UserBidHistory({ userId }: { userId: string }) {
  const [data, setData] = useState<PaginatedResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/users/${userId}?include=bids&page=${page}&limit=10`)
      .then((res) => res.json())
      .then((json) => {
        setData(json.bids ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [userId, page]);

  if (loading) {
    return <div className="p-4 text-sm text-taupe">Loading bid history...</div>;
  }

  if (!data || data.data.length === 0) {
    return <div className="p-4 text-sm text-taupe">No bids placed yet.</div>;
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-beige bg-cream/50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase">Lot</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase">Auction</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-taupe uppercase">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase">Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-beige/50">
            {data.data.map((bid) => (
              <tr key={bid.id} className="hover:bg-cream/30">
                <td className="px-4 py-3 text-dark-brown">
                  <span className="font-medium">#{bid.lotNumber}</span>{' '}
                  <span className="text-taupe">{bid.lotTitle}</span>
                </td>
                <td className="px-4 py-3 text-dark-brown">{bid.auctionTitle}</td>
                <td className="px-4 py-3 text-right font-medium text-dark-brown">
                  PLN {bid.amount.toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-taupe capitalize">{bid.bidType}</span>
                </td>
                <td className="px-4 py-3">
                  {bid.isWinning ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                      Winning
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                      Outbid
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-taupe">
                  {new Date(bid.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-beige">
          <p className="text-xs text-taupe">
            Page {data.page} of {data.totalPages} ({data.total} total)
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="px-3 py-1 text-xs rounded border border-beige hover:bg-beige/50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(Math.min(data.totalPages, page + 1))}
              disabled={page >= data.totalPages}
              className="px-3 py-1 text-xs rounded border border-beige hover:bg-beige/50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
