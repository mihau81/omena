'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import VisibilityBadge from '../components/VisibilityBadge';

interface UserRow {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  visibilityLevel: string;
  referrerId: string | null;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: string;
}

interface PaginatedData {
  data: UserRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface UsersClientProps {
  initialData: PaginatedData;
  initialSearch: string;
  initialVisibility: string;
  initialIsActive: string;
}

export default function UsersClient({
  initialData,
  initialSearch,
  initialVisibility,
  initialIsActive,
}: UsersClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);
  const [visibility, setVisibility] = useState(initialVisibility);
  const [isActive, setIsActive] = useState(initialIsActive);

  const applyFilters = (overrides?: { page?: number }) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (visibility) params.set('visibilityLevel', visibility);
    if (isActive) params.set('isActive', isActive);
    if (overrides?.page && overrides.page > 1) params.set('page', String(overrides.page));
    const qs = params.toString();
    router.push(`/admin/users${qs ? `?${qs}` : ''}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters();
  };

  const exportCsv = () => {
    const headers = ['Name', 'Email', 'Phone', 'Visibility', 'Active', 'Registered'];
    const rows = initialData.data.map((u) => [
      u.name,
      u.email,
      u.phone ?? '',
      u.visibilityLevel === '0' ? 'Public' : u.visibilityLevel === '1' ? 'Private' : 'VIP',
      u.isActive ? 'Yes' : 'No',
      new Date(u.createdAt).toLocaleDateString(),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'users-export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-dark-brown">Users</h1>
          <p className="text-sm text-taupe mt-1">{initialData.total} registered clients</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-dark-brown text-sm font-medium rounded-lg border border-beige hover:bg-beige/30 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export CSV
          </button>
          <Link
            href="/admin/users/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gold text-white text-sm font-medium rounded-lg hover:bg-gold-dark transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New User
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-beige p-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none"
            />
          </div>
          <select
            value={visibility}
            onChange={(e) => { setVisibility(e.target.value); }}
            className="px-3 py-2 text-sm border border-beige rounded-lg bg-white focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none"
          >
            <option value="">All Levels</option>
            <option value="0">Public</option>
            <option value="1">Private</option>
            <option value="2">VIP</option>
          </select>
          <select
            value={isActive}
            onChange={(e) => { setIsActive(e.target.value); }}
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase">Visibility</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase">Registered</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-taupe uppercase"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-beige/50">
              {initialData.data.map((user) => (
                <tr
                  key={user.id}
                  className="hover:bg-cream/30 transition-colors cursor-pointer"
                  onClick={() => router.push(`/admin/users/${user.id}`)}
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-dark-brown">{user.name}</span>
                  </td>
                  <td className="px-4 py-3 text-taupe">{user.email}</td>
                  <td className="px-4 py-3">
                    <VisibilityBadge level={user.visibilityLevel} />
                  </td>
                  <td className="px-4 py-3">
                    {user.isActive ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-taupe">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <svg className="w-4 h-4 text-taupe inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                  </td>
                </tr>
              ))}
              {initialData.data.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-taupe">
                    No users found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {initialData.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-beige">
            <p className="text-xs text-taupe">
              Page {initialData.page} of {initialData.totalPages} ({initialData.total} total)
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => applyFilters({ page: initialData.page - 1 })}
                disabled={initialData.page <= 1}
                className="px-3 py-1 text-xs rounded border border-beige hover:bg-beige/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => applyFilters({ page: initialData.page + 1 })}
                disabled={initialData.page >= initialData.totalPages}
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
