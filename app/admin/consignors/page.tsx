'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ConsignorRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  taxId: string | null;
  commissionRate: string | null;
  isActive: boolean;
  createdAt: string;
  lotCount: number;
}

interface PaginatedResult {
  data: ConsignorRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function formatCommissionPercent(rate: string | null): string {
  if (!rate) return '10%';
  const pct = parseFloat(rate) * 100;
  return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(2)}%`;
}

export default function ConsignorsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [isActive, setIsActive] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatedResult | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchConsignors = async (overrides?: { page?: number; search?: string; isActive?: string }) => {
    setLoading(true);
    const params = new URLSearchParams();
    const q = overrides?.search ?? search;
    const active = overrides?.isActive ?? isActive;
    const p = overrides?.page ?? page;

    if (q) params.set('search', q);
    if (active) params.set('isActive', active);
    params.set('page', String(p));
    params.set('limit', '20');

    try {
      const res = await fetch(`/api/admin/consignors?${params}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConsignors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchConsignors({ page: 1 });
  };

  const handleActiveChange = (val: string) => {
    setIsActive(val);
    setPage(1);
    fetchConsignors({ isActive: val, page: 1 });
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchConsignors({ page: newPage });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-dark-brown">Consignors</h1>
          <p className="text-sm text-taupe mt-1">
            {data ? `${data.total} consignors` : 'Loading...'}
          </p>
        </div>
        <Link
          href="/admin/consignors/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gold text-white text-sm font-medium rounded-lg hover:bg-gold-dark transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Consignor
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-beige p-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by name, email or company..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none"
            />
          </div>
          <select
            value={isActive}
            onChange={(e) => handleActiveChange(e.target.value)}
            className="px-3 py-2 text-sm border border-beige rounded-lg bg-white focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none"
          >
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium bg-dark-brown text-white rounded-lg hover:bg-dark-brown/90 transition-colors"
          >
            Search
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-beige overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-beige bg-cream/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase">Company / NIP</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-taupe uppercase">Commission</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-taupe uppercase">Lots</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-taupe uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-taupe uppercase"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-beige/50">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-taupe">
                    Loading...
                  </td>
                </tr>
              )}
              {!loading && data?.data.map((c) => (
                <tr
                  key={c.id}
                  className="hover:bg-cream/30 transition-colors cursor-pointer"
                  onClick={() => router.push(`/admin/consignors/${c.id}`)}
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-dark-brown">{c.name}</span>
                  </td>
                  <td className="px-4 py-3 text-taupe">
                    {c.email && <p>{c.email}</p>}
                    {c.phone && <p className="text-xs">{c.phone}</p>}
                  </td>
                  <td className="px-4 py-3 text-taupe text-xs">
                    {c.companyName && <p className="font-medium text-dark-brown">{c.companyName}</p>}
                    {c.taxId && <p>NIP: {c.taxId}</p>}
                    {!c.companyName && !c.taxId && <span>—</span>}
                  </td>
                  <td className="px-4 py-3 text-center text-sm">
                    {formatCommissionPercent(c.commissionRate)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-beige text-dark-brown text-xs font-bold">
                      {c.lotCount}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {c.isActive ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <svg className="w-4 h-4 text-taupe inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                  </td>
                </tr>
              ))}
              {!loading && data?.data.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-taupe">
                    No consignors found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-beige">
            <p className="text-xs text-taupe">
              Page {data.page} of {data.totalPages} ({data.total} total)
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => handlePageChange(data.page - 1)}
                disabled={data.page <= 1}
                className="px-3 py-1 text-xs rounded border border-beige hover:bg-beige/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => handlePageChange(data.page + 1)}
                disabled={data.page >= data.totalPages}
                className="px-3 py-1 text-xs rounded border border-beige hover:bg-beige/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
