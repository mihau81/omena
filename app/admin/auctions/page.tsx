'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';

interface Auction {
  id: string;
  title: string;
  slug: string;
  status: string;
  visibilityLevel: string;
  startDate: string;
  endDate: string;
  lotCount: number;
  sortOrder: number;
}

const VISIBILITY_LABELS: Record<string, string> = {
  '0': 'Public',
  '1': 'Private',
  '2': 'VIP',
};

const STATUS_FILTERS = ['all', 'draft', 'preview', 'live', 'reconciliation', 'archive'] as const;

export default function AuctionsListPage() {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deleteTarget, setDeleteTarget] = useState<Auction | null>(null);
  const [dragItem, setDragItem] = useState<number | null>(null);
  const [dragOverItem, setDragOverItem] = useState<number | null>(null);

  const fetchAuctions = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/auctions');
      if (res.ok) {
        const data = await res.json();
        setAuctions(data.auctions);
      }
    } catch (err) {
      console.error('Failed to fetch auctions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAuctions(); }, [fetchAuctions]);

  const filteredAuctions = statusFilter === 'all'
    ? auctions
    : auctions.filter((a) => a.status === statusFilter);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/admin/auctions/${deleteTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        setAuctions((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      }
    } catch (err) {
      console.error('Failed to delete auction:', err);
    }
    setDeleteTarget(null);
  };

  const handleDragStart = (index: number) => {
    setDragItem(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverItem(index);
  };

  const handleDrop = async () => {
    if (dragItem === null || dragOverItem === null || dragItem === dragOverItem) {
      setDragItem(null);
      setDragOverItem(null);
      return;
    }

    const reordered = [...filteredAuctions];
    const [moved] = reordered.splice(dragItem, 1);
    reordered.splice(dragOverItem, 0, moved);

    // Update local state immediately (optimistic)
    const withNewOrder = reordered.map((a, i) => ({ ...a, sortOrder: i }));
    setAuctions((prev) => {
      const ids = new Set(withNewOrder.map((a) => a.id));
      return [
        ...withNewOrder,
        ...prev.filter((a) => !ids.has(a.id)),
      ].sort((a, b) => a.sortOrder - b.sortOrder);
    });

    setDragItem(null);
    setDragOverItem(null);

    // Persist to backend
    try {
      await fetch('/api/admin/auctions/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: withNewOrder.map((a) => ({ id: a.id, sortOrder: a.sortOrder })),
        }),
      });
    } catch (err) {
      console.error('Failed to reorder:', err);
      fetchAuctions(); // Revert on failure
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-serif font-bold text-dark-brown">Auctions</h1>
        </div>
        <div className="bg-white rounded-xl border border-beige p-8 text-center text-taupe text-sm">
          Loading auctions...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-serif font-bold text-dark-brown">Auctions</h1>
        <Link
          href="/admin/auctions/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] bg-gold text-white text-sm font-medium rounded-lg hover:bg-gold-dark transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Auction
        </Link>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 bg-beige/30 rounded-lg p-1 overflow-x-auto">
        {STATUS_FILTERS.map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-2 min-h-[36px] text-xs font-medium rounded-md capitalize transition-colors whitespace-nowrap ${
              statusFilter === status
                ? 'bg-white text-dark-brown shadow-sm'
                : 'text-taupe hover:text-dark-brown'
            }`}
          >
            {status}
            {status !== 'all' && (
              <span className="ml-1 text-taupe">
                ({auctions.filter((a) => a.status === status).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      {filteredAuctions.length === 0 ? (
        <div className="bg-white rounded-xl border border-beige p-8 text-center text-taupe text-sm">
          No auctions found.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-beige overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-beige bg-cream/50">
                  <th className="px-2 py-3 w-10" />
                  <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase tracking-wider">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase tracking-wider">Visibility</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase tracking-wider">Dates</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase tracking-wider">Lots</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-taupe uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-beige/50">
                {filteredAuctions.map((auction, index) => (
                  <tr
                    key={auction.id}
                    className={`hover:bg-cream/30 transition-colors ${
                      dragOverItem === index ? 'bg-gold/5' : ''
                    }`}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={handleDrop}
                    onDragEnd={() => { setDragItem(null); setDragOverItem(null); }}
                  >
                    <td className="px-2 py-3 cursor-grab text-taupe hover:text-dark-brown">
                      <svg className="w-4 h-4 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                      </svg>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/auctions/${auction.id}`}
                        className="font-medium text-dark-brown hover:text-gold transition-colors"
                      >
                        {auction.title}
                      </Link>
                      <p className="text-xs text-taupe mt-0.5">/{auction.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={auction.status} />
                    </td>
                    <td className="px-4 py-3 text-taupe">
                      {VISIBILITY_LABELS[auction.visibilityLevel] ?? auction.visibilityLevel}
                    </td>
                    <td className="px-4 py-3 text-taupe text-xs">
                      <div>{new Date(auction.startDate).toLocaleDateString()}</div>
                      <div className="text-taupe/60">{new Date(auction.endDate).toLocaleDateString()}</div>
                    </td>
                    <td className="px-4 py-3 text-taupe">
                      {auction.lotCount}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/auctions/${auction.id}`}
                          className="text-xs font-medium text-gold hover:text-gold-dark transition-colors"
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() => setDeleteTarget(auction)}
                          className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Auction"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? This action can be undone by an administrator.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
