'use client';

import { apiUrl } from '@/app/lib/utils';

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
import ConditionReportTab from '../../../../components/ConditionReportTab';

type Tab = 'details' | 'condition' | 'media' | 'translations';

interface LotDetail {
  id: string;
  auctionId: string;
  lotNumber: number;
  title: string;
  artist: string;
  description: string;
  category: string | null;
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
  conditionGrade: 'mint' | 'excellent' | 'very_good' | 'good' | 'fair' | 'poor' | null;
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

const TABS: { id: Tab; label: string }[] = [
  { id: 'details', label: 'Details' },
  { id: 'condition', label: 'Condition Report' },
  { id: 'media', label: 'Media' },
  { id: 'translations', label: 'Translations' },
];

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
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiDescription, setAiDescription] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('details');

  const fetchLot = useCallback(async () => {
    try {
      const res = await fetch(apiUrl(`/api/admin/lots/${lotId}`));
      if (res.ok) {
        const data = await res.json();
        setLot(data.lot);
        setMediaItems(
          (data.media as MediaItem[]).filter((m) => m.mediaType !== 'condition'),
        );
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
        category: data.category || null,
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

      const res = await fetch(apiUrl(`/api/admin/lots/${lotId}`), {
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
      const res = await fetch(apiUrl(`/api/admin/lots/${lotId}/status`), {
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
      const res = await fetch(apiUrl(`/api/admin/lots/${lotId}`), { method: 'DELETE' });
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
      const res = await fetch(apiUrl(`/api/admin/media/${mediaId}`), { method: 'DELETE' });
      if (res.ok) {
        setMediaItems((prev) => prev.filter((m) => m.id !== mediaId));
      }
    } catch {
      setError('Failed to delete media');
    }
  };

  const handleSetPrimary = async (mediaId: string) => {
    try {
      const res = await fetch(apiUrl(`/api/admin/media/${mediaId}`), {
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
      const res = await fetch(apiUrl(`/api/admin/lots/${lotId}/media/reorder`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      if (res.ok) {
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
      const res = await fetch(apiUrl(`/api/admin/lots/${lotId}/media/youtube`), {
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

  const handleAiDescribe = async () => {
    setAiGenerating(true);
    setAiError(null);
    setAiDescription(null);
    try {
      const res = await fetch(apiUrl(`/api/admin/lots/${lotId}/ai/describe`), { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        setAiError(json.error || 'AI generation failed');
      } else {
        setAiDescription(json.description);
      }
    } catch {
      setAiError('Failed to connect to AI service');
    } finally {
      setAiGenerating(false);
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
    category: lot.category ?? '',
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

      {/* Tab Navigation */}
      <div className="border-b border-beige">
        <nav className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'text-dark-brown border-gold bg-white'
                  : 'text-taupe border-transparent hover:text-dark-brown hover:border-beige'
              }`}
            >
              {tab.label}
              {tab.id === 'condition' && lot.conditionGrade && (
                <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 capitalize">
                  {lot.conditionGrade.replace('_', ' ')}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}

      {activeTab === 'details' && (
        <div className="space-y-4">
          {/* AI Tools */}
          <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-violet-900">AI Tools</h3>
                <p className="text-xs text-violet-600 mt-0.5">Generate description from lot images using Claude AI</p>
              </div>
              <button
                type="button"
                onClick={handleAiDescribe}
                disabled={aiGenerating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {aiGenerating ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Generating...
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                    </svg>
                    Generate Description (AI)
                  </>
                )}
              </button>
            </div>

            {aiError && (
              <p className="mt-2 text-xs text-red-600 bg-red-50 rounded px-2 py-1">{aiError}</p>
            )}

            {aiDescription && (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-medium text-violet-800">Generated description (preview):</p>
                <div className="text-sm text-dark-brown bg-white border border-violet-200 rounded-lg p-3 leading-relaxed">
                  {aiDescription}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      // Copy description into the form — user still needs to save
                      const textarea = document.getElementById('description') as HTMLTextAreaElement | null;
                      if (textarea) {
                        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
                        if (nativeInputValueSetter) {
                          nativeInputValueSetter.call(textarea, aiDescription);
                          textarea.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                      }
                      setAiDescription(null);
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors"
                  >
                    Use this description
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiDescription(null)}
                    className="px-3 py-1.5 text-xs font-medium text-taupe hover:text-dark-brown transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-beige p-6">
            <LotForm
              initialData={formData}
              onSubmit={handleSubmit}
              submitLabel="Save Changes"
              loading={saving}
            />
          </div>
        </div>
      )}

      {activeTab === 'condition' && (
        <ConditionReportTab
          lotId={lotId}
          auctionId={auctionId}
          initialGrade={lot.conditionGrade}
          initialNotes={lot.conditionNotes ?? ''}
        />
      )}

      {activeTab === 'media' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-beige p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-dark-brown">Lot Media</h2>
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
        </div>
      )}

      {activeTab === 'translations' && (
        <LotTranslations lotId={lotId} />
      )}

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
