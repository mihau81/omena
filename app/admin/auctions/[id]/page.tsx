'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AuctionForm from '../../components/AuctionForm';
import type { AuctionFormData } from '../../components/AuctionForm';
import StatusBadge from '../../components/StatusBadge';
import StatusWorkflow from '../../components/StatusWorkflow';
import ConfirmDialog from '../../components/ConfirmDialog';

interface AuctionDetail {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  startDate: string;
  endDate: string;
  location: string;
  curator: string;
  status: string;
  visibilityLevel: '0' | '1' | '2';
  buyersPremiumRate: string;
  notes: string;
  lotCount: number;
  createdAt: string;
  updatedAt: string;
}

function toDatetimeLocal(isoString: string): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditAuctionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [auction, setAuction] = useState<AuctionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const fetchAuction = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/auctions/${id}`);
      if (res.ok) {
        const data = await res.json();
        setAuction(data.auction);
      } else if (res.status === 404) {
        router.push('/admin/auctions');
      }
    } catch (err) {
      console.error('Failed to fetch auction:', err);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { fetchAuction(); }, [fetchAuction]);

  const handleSubmit = async (data: AuctionFormData) => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/admin/auctions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const json = await res.json();

      if (!res.ok) {
        if (json.details?.fieldErrors) {
          throw json.details;
        }
        setError(json.error || 'Failed to update auction');
        return;
      }

      setAuction(json.auction);
      setSuccess('Auction updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      if (err && typeof err === 'object' && 'fieldErrors' in err) {
        throw err;
      }
      setError('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setStatusLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/auctions/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || 'Failed to change status');
        return;
      }

      setAuction((prev) => prev ? { ...prev, ...json.auction } : null);
      setSuccess(`Status changed to ${newStatus}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError('Failed to change status');
    } finally {
      setStatusLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/admin/auctions/${id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/admin/auctions');
      }
    } catch {
      setError('Failed to delete auction');
    }
    setDeleteOpen(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/auctions" className="text-taupe hover:text-dark-brown transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
          </Link>
          <h1 className="text-2xl font-serif font-bold text-dark-brown">Loading...</h1>
        </div>
      </div>
    );
  }

  if (!auction) return null;

  const formData: AuctionFormData = {
    title: auction.title,
    slug: auction.slug,
    description: auction.description,
    category: auction.category,
    startDate: toDatetimeLocal(auction.startDate),
    endDate: toDatetimeLocal(auction.endDate),
    location: auction.location,
    curator: auction.curator,
    visibilityLevel: auction.visibilityLevel,
    buyersPremiumRate: auction.buyersPremiumRate,
    notes: auction.notes ?? '',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/auctions" className="text-taupe hover:text-dark-brown transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-serif font-bold text-dark-brown">{auction.title}</h1>
              <StatusBadge status={auction.status} />
            </div>
            <p className="text-sm text-taupe mt-0.5">
              /{auction.slug} &middot; {auction.lotCount} lots
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/auctions/${id}/lots`}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-dark-brown bg-cream hover:bg-beige rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
            </svg>
            Manage Lots ({auction.lotCount})
          </Link>
          <Link
            href={`/admin/auctions/${id}/bids`}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-dark-brown bg-cream hover:bg-beige rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
            </svg>
            Manage Bids
          </Link>
          <Link
            href={`/admin/auctions/${id}/registrations`}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-dark-brown bg-cream hover:bg-beige rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm6-10.125a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0Zm1.294 6.336a6.721 6.721 0 0 1-3.17.789 6.721 6.721 0 0 1-3.168-.789 3.376 3.376 0 0 1 6.338 0Z" />
            </svg>
            Registrations
          </Link>
          <StatusWorkflow
            currentStatus={auction.status}
            auctionId={auction.id}
            onStatusChange={handleStatusChange}
            loading={statusLoading}
          />
          <button
            onClick={() => setDeleteOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
            Delete
          </button>
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

      {/* Form */}
      <div className="bg-white rounded-xl border border-beige p-6">
        <AuctionForm
          initialData={formData}
          onSubmit={handleSubmit}
          submitLabel="Save Changes"
          loading={saving}
        />
      </div>

      {/* Meta info */}
      <div className="bg-white rounded-xl border border-beige p-4 text-xs text-taupe">
        <p>Created: {new Date(auction.createdAt).toLocaleString()}</p>
        <p>Last updated: {new Date(auction.updatedAt).toLocaleString()}</p>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete Auction"
        message={`Are you sure you want to delete "${auction.title}"? This will soft-delete the auction.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
