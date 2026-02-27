'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';

interface RegistrationRow {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  paddleNumber: number;
  isApproved: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
  depositPaid: boolean;
  notes: string | null;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

interface AuctionInfo {
  id: string;
  title: string;
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

function StatusBadge({ status }: { status: 'pending' | 'approved' | 'rejected' }) {
  if (status === 'approved') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
        Approved
      </span>
    );
  }
  if (status === 'rejected') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
        Rejected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
      Pending
    </span>
  );
}

export default function RegistrationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: auctionId } = use(params);
  const [auction, setAuction] = useState<AuctionInfo | null>(null);
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/auctions/${auctionId}/registrations`);
      if (res.ok) {
        const data = await res.json();
        setAuction(data.auction);
        setRegistrations(data.registrations);
      } else if (res.status === 404) {
        setError('Auction not found');
      }
    } catch {
      setError('Failed to load registrations');
    } finally {
      setLoading(false);
    }
  }, [auctionId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Clear selection when filter changes
  useEffect(() => { setSelectedIds(new Set()); }, [statusFilter]);

  const handleApprove = async (regId: string) => {
    setActionLoading(regId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/registrations/${regId}/approve`, { method: 'PATCH' });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Failed to approve registration');
        return;
      }
      setSuccess(`Registration approved — paddle #${json.paddleNumber}`);
      setTimeout(() => setSuccess(null), 4000);
      setRegistrations((prev) =>
        prev.map((r) =>
          r.id === regId
            ? { ...r, isApproved: true, status: 'approved', paddleNumber: json.paddleNumber }
            : r,
        ),
      );
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(regId); return next; });
    } catch {
      setError('Failed to approve registration');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectId) return;
    setActionLoading(rejectId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/registrations/${rejectId}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Failed to reject registration');
        return;
      }
      setSuccess('Registration rejected');
      setTimeout(() => setSuccess(null), 3000);
      setRegistrations((prev) =>
        prev.map((r) =>
          r.id === rejectId
            ? { ...r, isApproved: false, approvedBy: 'admin', status: 'rejected', notes: rejectReason || r.notes }
            : r,
        ),
      );
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(rejectId); return next; });
      setRejectId(null);
      setRejectReason('');
    } catch {
      setError('Failed to reject registration');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkApprove = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/auctions/${auctionId}/registrations`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk_approve', ids }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Bulk approve failed');
        return;
      }
      setSuccess(
        `${json.approved} registration${json.approved !== 1 ? 's' : ''} approved` +
          (json.skipped > 0 ? ` (${json.skipped} skipped)` : ''),
      );
      setTimeout(() => setSuccess(null), 5000);
      // Refresh data to get updated paddle numbers
      await fetchData();
      setSelectedIds(new Set());
    } catch {
      setError('Bulk approve failed');
    } finally {
      setBulkLoading(false);
    }
  };

  const pending = registrations.filter((r) => r.status === 'pending');
  const approved = registrations.filter((r) => r.status === 'approved');
  const rejected = registrations.filter((r) => r.status === 'rejected');

  const filteredRegistrations =
    statusFilter === 'all'
      ? registrations
      : registrations.filter((r) => r.status === statusFilter);

  const pendingInView = filteredRegistrations.filter((r) => r.status === 'pending');

  const allPendingSelected =
    pendingInView.length > 0 &&
    pendingInView.every((r) => selectedIds.has(r.id));

  const handleToggleSelectAll = () => {
    if (allPendingSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pendingInView.forEach((r) => next.delete(r.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pendingInView.forEach((r) => next.add(r.id));
        return next;
      });
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href={`/admin/auctions/${auctionId}`} className="text-taupe hover:text-dark-brown transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
          </Link>
          <h1 className="text-2xl font-serif font-bold text-dark-brown">Loading...</h1>
        </div>
      </div>
    );
  }

  const selectedPendingCount = Array.from(selectedIds).filter((id) =>
    registrations.find((r) => r.id === id && r.status === 'pending'),
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/admin/auctions/${auctionId}`} className="text-taupe hover:text-dark-brown transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-serif font-bold text-dark-brown">Bid Registrations</h1>
            {auction && (
              <p className="text-sm text-taupe mt-0.5">{auction.title}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm text-taupe">
          <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded font-medium">{pending.length} pending</span>
          <span className="bg-green-100 text-green-700 px-2 py-1 rounded font-medium">{approved.length} approved</span>
          <span className="bg-red-100 text-red-700 px-2 py-1 rounded font-medium">{rejected.length} rejected</span>
        </div>
      </div>

      {/* Alerts */}
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

      {/* Toolbar: filter tabs + bulk actions */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Filter tabs */}
        <div className="flex items-center gap-1 bg-cream rounded-lg p-1 border border-beige">
          {(['all', 'pending', 'approved', 'rejected'] as StatusFilter[]).map((tab) => {
            const count =
              tab === 'all'
                ? registrations.length
                : tab === 'pending'
                  ? pending.length
                  : tab === 'approved'
                    ? approved.length
                    : rejected.length;
            return (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors capitalize ${
                  statusFilter === tab
                    ? 'bg-white text-dark-brown shadow-sm border border-beige'
                    : 'text-taupe hover:text-dark-brown'
                }`}
              >
                {tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1)}{' '}
                <span className="ml-1 opacity-60">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Bulk approve button */}
        {selectedPendingCount > 0 && (
          <button
            onClick={handleBulkApprove}
            disabled={bulkLoading}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {bulkLoading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Approving…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                Approve selected ({selectedPendingCount})
              </>
            )}
          </button>
        )}
      </div>

      {/* Registrations table */}
      {filteredRegistrations.length === 0 ? (
        <div className="bg-white rounded-xl border border-beige p-10 text-center text-taupe">
          {statusFilter === 'all'
            ? 'No registrations yet for this auction.'
            : `No ${statusFilter} registrations.`}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-beige overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-beige bg-cream/50">
                  {/* Select-all checkbox for pending rows */}
                  <th className="px-4 py-3 w-10">
                    {pendingInView.length > 0 && (
                      <input
                        type="checkbox"
                        checked={allPendingSelected}
                        onChange={handleToggleSelectAll}
                        aria-label="Select all pending"
                        className="rounded border-beige text-gold focus:ring-gold/30"
                      />
                    )}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase tracking-wide">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase tracking-wide">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase tracking-wide">Paddle</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase tracking-wide">Deposit</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase tracking-wide">Requested</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase tracking-wide">Notes</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-taupe uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-beige/50">
                {filteredRegistrations.map((reg) => (
                  <tr
                    key={reg.id}
                    className={`hover:bg-cream/20 ${selectedIds.has(reg.id) ? 'bg-green-50/40' : ''}`}
                  >
                    <td className="px-4 py-3">
                      {reg.status === 'pending' && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(reg.id)}
                          onChange={() => handleToggleSelect(reg.id)}
                          aria-label={`Select ${reg.userName}`}
                          className="rounded border-beige text-gold focus:ring-gold/30"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-dark-brown">
                      <Link href={`/admin/users/${reg.userId}`} className="hover:underline">
                        {reg.userName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-taupe">{reg.userEmail}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={reg.status} />
                    </td>
                    <td className="px-4 py-3 text-dark-brown">
                      {reg.status === 'approved' ? `#${reg.paddleNumber}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {reg.depositPaid ? (
                        <span className="text-green-600 text-xs font-medium">Paid</span>
                      ) : (
                        <span className="text-taupe text-xs">Not paid</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-taupe">
                      {new Date(reg.createdAt).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-4 py-3 text-xs text-taupe max-w-[160px] truncate" title={reg.notes ?? ''}>
                      {reg.notes || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {reg.status === 'pending' && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleApprove(reg.id)}
                            disabled={actionLoading === reg.id || bulkLoading}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
                          >
                            {actionLoading === reg.id ? 'Approving…' : 'Approve'}
                          </button>
                          <button
                            onClick={() => { setRejectId(reg.id); setRejectReason(''); }}
                            disabled={actionLoading === reg.id || bulkLoading}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reject dialog */}
      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl border border-beige shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-serif font-bold text-dark-brown">Reject Registration</h2>
            <p className="text-sm text-taupe">
              Optionally provide a reason. The user will be notified.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (optional)"
              rows={3}
              className="w-full px-3 py-2 text-sm border border-beige rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold"
            />
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => { setRejectId(null); setRejectReason(''); }}
                className="px-4 py-2 text-sm font-medium text-taupe hover:text-dark-brown border border-beige rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectSubmit}
                disabled={actionLoading === rejectId}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                {actionLoading === rejectId ? 'Rejecting…' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
