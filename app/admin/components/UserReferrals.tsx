'use client';

import { apiUrl } from '@/app/lib/utils';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface ReferralRow {
  id: string;
  name: string;
  email: string;
  accountStatus: string;
  isActive: boolean;
  createdAt: string;
}

interface PaginatedResponse {
  data: ReferralRow[];
  total: number;
  page: number;
  totalPages: number;
}

export default function UserReferrals({ userId }: { userId: string }) {
  const [data, setData] = useState<PaginatedResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(apiUrl(`/api/admin/users/${userId}?include=referrals&page=${page}&limit=10`))
      .then((res) => res.json())
      .then((json) => {
        setData(json.referrals ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [userId, page]);

  if (loading) {
    return <div className="p-4 text-sm text-taupe">Loading referrals...</div>;
  }

  if (!data || data.data.length === 0) {
    return <div className="p-4 text-sm text-taupe">No referrals yet.</div>;
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-beige bg-cream/50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase">Email</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase">Registered</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-beige/50">
            {data.data.map((ref) => (
              <tr key={ref.id} className="hover:bg-cream/30">
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/users/${ref.id}`}
                    className="font-medium text-dark-brown hover:text-gold transition-colors"
                  >
                    {ref.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-taupe">{ref.email}</td>
                <td className="px-4 py-3">
                  {ref.accountStatus === 'approved' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                      Approved
                    </span>
                  ) : ref.accountStatus === 'pending_approval' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                      Pending
                    </span>
                  ) : ref.accountStatus === 'rejected' ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                      Rejected
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                      {ref.accountStatus}
                    </span>
                  )}
                  {!ref.isActive && (
                    <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                      Inactive
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-taupe">
                  {new Date(ref.createdAt).toLocaleString()}
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
