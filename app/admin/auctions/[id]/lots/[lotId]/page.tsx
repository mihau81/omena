'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import LotForm from '../../../../components/LotForm';
import type { LotFormData } from '../../../../components/LotForm';
import StatusBadge from '../../../../components/StatusBadge';
import LotStatusWorkflow from '../../../../components/LotStatusWorkflow';
import ConfirmDialog from '../../../../components/ConfirmDialog';
import MediaGrid from '../../../../components/MediaGrid';
import MediaUpload from '../../../../components/MediaUpload';
import LotTranslations from '../../../../components/LotTranslations';

interface LotDetail {
  id: string;
  auctionId: string;
  lotNumber: number;
  title: string;
  artist: string;
  description: string;
  medium: string;
  dimensions: string;
  year: number | null;
  estimateMin: number;
  estimateMax: number;
  reservePrice: number | null;
  startingBid: number | null;
  status: string;
  visibilityOverride: string | null;
  provenance: string[];
  exhibitions: string[];
  literature: string[];
  conditionNotes: string;
  notes: string;
  consignorId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MediaItem {
  id: string;
  mediaType: string;
  url: string;
  thumbnailUrl: string | null;
  originalFilename: string | null;
  isPrimary: boolean;
  sortOrder: number;
}

export default function EditLotPage({
  params,
}: {
  params: Promise<{ id: string; lotId: string }>;
}) {
  const { id: auctionId, lotId } = use(params);
  const router = useRouter();
  const [lot, setLot] = useState<LotDetail | null>(null);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [youtubeOpen, setYoutubeOpen] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeError, setYoutubeError] = useState<string | null>(null);

  const fetchLot = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/lots/${lotId}`);
      if (res.ok) {
        const data = await res.json();
        setLot(data.lot);
        setMediaItems(data.media);
      } else if (res.status === 404) {
        router.push(`/admin/auctions/${auctionId}/lots`);
      }
    } catch (err) {
      console.error('Failed to fetch lot:', err);
    } finally {
      setLoading(false);
    }
  }, [lotId, auctionId, router]);

  useEffect(() => {
    fetchLot();
  }, [fetchLot]);

  const handleSubmit = async (data: LotFormData) => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const body = {
        title: data.title,
        artist: data.artist,
        description: data.description,
        medium: data.medium,
        dimensions: data.dimensions,
        year: data.year ? parseInt(data.year) : null,
        estimateMin: data.estimateMin ? parseInt(data.estimateMin) : 0,
        estimateMax: data.estimateMax ? parseInt(data.estimateMax) : 0,
        reservePrice: data.reservePrice ? parseInt(data.reservePrice) : null,
        startingBid: data.startingBid ? parseInt(data.startingBid) : null,
        visibilityOverride: data.visibilityOverride || null,
        provenance: data.provenance.filter(Boolean),
        exhibitions: data.exhibitions.filter(Boolean),
        literature: data.literature.filter(Boolean),
        conditionNotes: data.conditionNotes,
        notes: data.notes,
        consignorId: data.consignorId || null,
      };

      const res = await fetch(`/api/admin/lots/${lotId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      if (!res.ok) {
        if (json.details?.fieldErrors) throw json.details;
        setError(json.error || 'Failed to update lot');
        return;
      }

      setLot(json.lot);
      setSuccess('Lot updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      if (err && typeof err === 'object' && 'fieldErrors' in err) throw err;
      setError('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setStatusLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/lots/${lotId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || 'Failed to change status');
        return;
      }

      setLot((prev) => (prev ? { ...prev, ...json.lot } : null));
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
      const res = await fetch(`/api/admin/lots/${lotId}`, { method: 'DELETE' });
      if (res.ok) {
        router.push(`/admin/auctions/${auctionId}/lots`);
      }
    } catch {
      setError('Failed to delete lot');
    }
    setDeleteOpen(false);
  };

  const handleMediaDelete = async (mediaId: string) => {
    try {
      const res = await fetch(`/api/admin/media/${mediaId}`, { method: 'DELETE' });
      if (res.ok) {
        setMediaItems((prev) => prev.filter((m) => m.id !== mediaId));
      }
    } catch {
      setError('Failed to delete media');
    }
  };

  const handleSetPrimary = async (mediaId: string) => {
    try {
      const res = await fetch(`/api/admin/media/${mediaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPrimary: true }),
      });
      if (res.ok) {
        setMediaItems((prev) =>
          prev.map((m) => ({ ...m, isPrimary: m.id === mediaId })),
        );
      }
    } catch {
      setError('Failed to set primary');
    }
  };

  const handleReorder = async (items: { id: string; sortOrder: number }[]) => {
    try {
      const res = await fetch(`/api/admin/lots/${lotId}/media/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      if (res.ok) {
        // Re-sort local state
        setMediaItems((prev) => {
          const map = new Map(items.map((i) => [i.id, i.sortOrder]));
          return [...prev].sort(
            (a, b) => (map.get(a.id) ?? a.sortOrder) - (map.get(b.id) ?? b.sortOrder),
          );
        });
      }
    } catch {
      setError('Failed to reorder media');
    }
  };

  const handleAddYoutube = async () => {
    setYoutubeError(null);
    try {
      const res = await fetch(`/api/admin/lots/${lotId}/media/youtube`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: youtubeUrl }),
      });

      const json = await res.json();

      if (!res.ok) {
        setYoutubeError(json.error || 'Failed to add YouTube video');
        return;
      }

      setMediaItems((prev) => [...prev, json.media]);
      setYoutubeUrl('');
      setYoutubeOpen(false);
    } catch {
      setYoutubeError('Failed to add YouTube video');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/auctions/${auctionId}/lots`}
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

  if (!lot) return null;

  const formData: LotFormData = {
    title: lot.title,
    artist: lot.artist,
    description: lot.description,
    medium: lot.medium,
    dimensions: lot.dimensions,
    year: lot.year?.toString() ?? '',
    estimateMin: lot.estimateMin?.toString() ?? '',
    estimateMax: lot.estimateMax?.toString() ?? '',
    reservePrice: lot.reservePrice?.toString() ?? '',
    startingBid: lot.startingBid?.toString() ?? '',
    visibilityOverride: lot.visibilityOverride ?? '',
    provenance: Array.isArray(lot.provenance) ? lot.provenance : [],
    exhibitions: Array.isArray(lot.exhibitions) ? lot.exhibitions : [],
    literature: Array.isArray(lot.literature) ? lot.literature : [],
    conditionNotes: lot.conditionNotes ?? '',
    notes: lot.notes ?? '',
    consignorId: lot.consignorId ?? '',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/auctions/${auctionId}/lots`}
            className="text-taupe hover:text-dark-brown transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-serif font-bold text-dark-brown">
                Lot #{lot.lotNumber}: {lot.title}
              </h1>
              <StatusBadge status={lot.status} />
            </div>
            <p className="text-sm text-taupe mt-0.5">
              {lot.artist || 'Unknown artist'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <LotStatusWorkflow
            currentStatus={lot.status}
            onStatusChange={handleStatusChange}
            loading={statusLoading}
          />
          <a
            href={`/api/admin/lots/${lotId}/condition-report`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
            </svg>
            Condition Report
          </a>
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

      {/* Media Section */}
      <div className="bg-white rounded-xl border border-beige p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-serif font-semibold text-dark-brown">Media</h2>
          <button
            onClick={() => setYoutubeOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
            Add YouTube
          </button>
        </div>

        <MediaUpload lotId={lotId} onUploaded={fetchLot} />

        <div className="mt-4">
          <MediaGrid
            items={mediaItems}
            onDelete={handleMediaDelete}
            onSetPrimary={handleSetPrimary}
            onReorder={handleReorder}
          />
        </div>
      </div>

      {/* YouTube dialog */}
      {youtubeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setYoutubeOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-lg max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-dark-brown">Add YouTube Video</h3>
            <div className="mt-4">
              <input
                type="url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full px-3 py-2 text-sm border border-beige rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold"
              />
              {youtubeError && (
                <p className="mt-1 text-xs text-red-600">{youtubeError}</p>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setYoutubeOpen(false);
                  setYoutubeUrl('');
                  setYoutubeError(null);
                }}
                className="px-4 py-2 text-sm font-medium text-taupe bg-beige/50 hover:bg-beige rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddYoutube}
                disabled={!youtubeUrl}
                className="px-4 py-2 text-sm font-medium text-white bg-gold hover:bg-gold-dark rounded-lg transition-colors disabled:opacity-50"
              >
                Add Video
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lot Form */}
      <div className="bg-white rounded-xl border border-beige p-6">
        <h2 className="text-lg font-serif font-semibold text-dark-brown mb-4">Lot Details</h2>
        <LotForm
          initialData={formData}
          onSubmit={handleSubmit}
          submitLabel="Save Changes"
          loading={saving}
        />
      </div>

      {/* Translations */}
      <LotTranslations lotId={lotId} />

      {/* Meta info */}
      <div className="bg-white rounded-xl border border-beige p-4 text-xs text-taupe">
        <p>Created: {new Date(lot.createdAt).toLocaleString()}</p>
        <p>Last updated: {new Date(lot.updatedAt).toLocaleString()}</p>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete Lot"
        message={`Are you sure you want to delete Lot #${lot.lotNumber}: "${lot.title}"? This will soft-delete the lot.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
