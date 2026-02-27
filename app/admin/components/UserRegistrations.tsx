'use client';

import { useState, useEffect } from 'react';

interface RegistrationRow {
  id: string;
  auctionId: string;
  auctionTitle: string;
  auctionSlug: string;
  paddleNumber: number;
  isApproved: boolean;
  depositPaid: boolean;
  createdAt: string;
}

interface PaginatedResponse {
  data: RegistrationRow[];
  total: number;
  page: number;
  totalPages: number;
}

export default function UserRegistrations({ userId }: { userId: string }) {
  const [data, setData] = useState<PaginatedResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/users/${userId}?include=registrations&page=${page}&limit=10`)
      .then((res) => res.json())
      .then((json) => {
        setData(json.registrations ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [userId, page]);

  if (loading) {
    return <div className="p-4 text-sm text-taupe">Loading registrations...</div>;
  }

  if (!data || data.data.length === 0) {
    return <div className="p-4 text-sm text-taupe">No auction registrations yet.</div>;
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-beige bg-cream/50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase">Auction</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase">Paddle</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase">Approved</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase">Deposit</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-beige/50">
            {data.data.map((reg) => (
              <tr key={reg.id} className="hover:bg-cream/30">
                <td className="px-4 py-3 text-dark-brown font-medium">{reg.auctionTitle}</td>
                <td className="px-4 py-3 text-dark-brown">#{reg.paddleNumber}</td>
                <td className="px-4 py-3">
                  {reg.isApproved ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                      Approved
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
                      Pending
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {reg.depositPaid ? (
                    <span className="text-green-600 text-xs font-medium">Paid</span>
                  ) : (
                    <span className="text-taupe text-xs">Not paid</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-taupe">
                  {new Date(reg.createdAt).toLocaleDateString()}
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
