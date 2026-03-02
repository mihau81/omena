'use client';

import { apiUrl } from '@/app/lib/utils';
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ConfirmDialog from '../../components/ConfirmDialog';

interface ArtistDetail {
  id: string;
  slug: string;
  name: string;
  nationality: string | null;
  birthYear: number | null;
  deathYear: number | null;
  bio: string | null;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UnlinkedLot {
  id: string;
  lotNumber: number;
  title: string;
  artist: string;
  status: string;
  estimateMin: number;
  estimateMax: number;
  hammerPrice: number | null;
  auctionTitle: string;
  auctionSlug: string;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function formatPLN(amount: number): string {
  return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 }).format(amount);
}

export default function ArtistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [artist, setArtist] = useState<ArtistDetail | null>(null);
  const [unlinkedLots, setUnlinkedLots] = useState<UnlinkedLot[]>([]);
  const [lotCount, setLotCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<Partial<ArtistDetail>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [selectedLots, setSelectedLots] = useState<Set<string>>(new Set());
  const [linking, setLinking] = useState(false);
  const [linkSuccess, setLinkSuccess] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/admin/artists/${id}`));
      if (res.ok) {
        const json = await res.json();
        setArtist(json.artist);
        setUnlinkedLots(json.unlinkedLots ?? []);
        setLotCount(json.lotCount ?? 0);
        setForm({
          name: json.artist.name,
          slug: json.artist.slug,
          nationality: json.artist.nationality ?? '',
          birthYear: json.artist.birthYear,
          deathYear: json.artist.deathYear,
          bio: json.artist.bio ?? '',
          imageUrl: json.artist.imageUrl ?? '',
        });
      } else if (res.status === 404) {
        router.push('/admin/artists');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleSave = async () => {
    if (!artist) return;
    setSaving(true);
    setError('');

    try {
      const res = await fetch(apiUrl(`/api/admin/artists/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          nationality: form.nationality || null,
          birthYear: form.birthYear || null,
          deathYear: form.deathYear || null,
          bio: form.bio || null,
          imageUrl: form.imageUrl || null,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setArtist(json.artist);
        setEditMode(false);
      } else {
        const err = await res.json();
        setError(err.error || 'Failed to save');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const res = await fetch(apiUrl(`/api/admin/artists/${id}`), { method: 'DELETE' });
    if (res.ok) {
      router.push('/admin/artists');
    }
  };

  const handleLinkLots = async () => {
    if (selectedLots.size === 0) return;
    setLinking(true);
    setLinkSuccess('');

    try {
      const res = await fetch(apiUrl(`/api/admin/artists/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'link-lots', lotIds: Array.from(selectedLots) }),
      });

      if (res.ok) {
        const json = await res.json();
        setLinkSuccess(`Linked ${json.linked} lot(s) successfully.`);
        setSelectedLots(new Set());
        fetchData();
      }
    } finally {
      setLinking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="text-taupe text-sm">Loading...</div>
      </div>
    );
  }

  if (!artist) return null;

  const handleNameChange = (name: string) => {
    setForm((f) => ({
      ...f,
      name,
      slug: f.slug === artist.slug || f.slug === generateSlug(artist.name)
        ? generateSlug(name)
        : f.slug,
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link href="/admin/artists" className="text-sm text-taupe hover:text-gold transition-colors flex items-center gap-1 mb-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            Artists
          </Link>
          <h1 className="text-2xl font-serif font-bold text-dark-brown">{artist.name}</h1>
          <p className="text-sm text-taupe mt-1 font-mono">/artists/{artist.slug}</p>
        </div>
        <div className="flex gap-2">
          {!editMode ? (
            <>
              <button
                onClick={() => setEditMode(true)}
                className="px-4 py-2 text-sm font-medium bg-dark-brown text-white rounded-lg hover:bg-dark-brown/90 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => setShowDelete(true)}
                className="px-4 py-2 text-sm font-medium border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
              >
                Delete
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => { setEditMode(false); setError(''); }}
                className="px-4 py-2 text-sm border border-beige rounded-lg hover:bg-beige/50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium bg-gold text-white rounded-lg hover:bg-gold-dark transition-colors disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Artist fields */}
      <div className="bg-white rounded-xl border border-beige p-6">
        <h2 className="text-base font-semibold text-dark-brown mb-4">Artist Details</h2>
        {editMode ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-taupe mb-1">Name *</label>
                <input
                  type="text"
                  value={form.name ?? ''}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-taupe mb-1">Slug</label>
                <input
                  type="text"
                  value={form.slug ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-taupe mb-1">Nationality</label>
                <input
                  type="text"
                  value={form.nationality ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, nationality: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-taupe mb-1">Birth year</label>
                  <input
                    type="number"
                    value={form.birthYear ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, birthYear: e.target.value ? parseInt(e.target.value) : null }))}
                    className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none"
                    min={1300} max={2020}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-taupe mb-1">Death year</label>
                  <input
                    type="number"
                    value={form.deathYear ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, deathYear: e.target.value ? parseInt(e.target.value) : null }))}
                    className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none"
                    min={1300} max={2026}
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-taupe mb-1">Bio</label>
              <textarea
                value={form.bio ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                rows={5}
                className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none resize-y"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-taupe mb-1">Image URL</label>
              <input
                type="url"
                value={form.imageUrl ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none"
                placeholder="https://..."
              />
            </div>
          </div>
        ) : (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs font-medium text-taupe uppercase mb-0.5">Name</dt>
              <dd className="text-dark-brown font-medium">{artist.name}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-taupe uppercase mb-0.5">Slug</dt>
              <dd className="text-dark-brown font-mono text-xs">{artist.slug}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-taupe uppercase mb-0.5">Nationality</dt>
              <dd className="text-dark-brown">{artist.nationality || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-taupe uppercase mb-0.5">Years</dt>
              <dd className="text-dark-brown">
                {artist.birthYear || artist.deathYear
                  ? `${artist.birthYear ?? '?'}–${artist.deathYear ?? 'present'}`
                  : '—'}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-taupe uppercase mb-0.5">Bio</dt>
              <dd className="text-dark-brown whitespace-pre-wrap">{artist.bio || '—'}</dd>
            </div>
            {artist.imageUrl && (
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-taupe uppercase mb-0.5">Image</dt>
                <dd>
                  <img src={artist.imageUrl} alt={artist.name} className="h-24 w-24 object-cover rounded-lg border border-beige" />
                </dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-medium text-taupe uppercase mb-0.5">Linked lots</dt>
              <dd className="text-dark-brown font-medium">{lotCount}</dd>
            </div>
          </dl>
        )}
      </div>

      {/* Unlinked lots section */}
      {unlinkedLots.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-amber-50 border-b border-amber-200">
            <div>
              <h2 className="text-base font-semibold text-dark-brown">Unlinked Lots</h2>
              <p className="text-xs text-taupe mt-0.5">
                {unlinkedLots.length} lot(s) match this artist&apos;s name but are not yet linked.
              </p>
            </div>
            <button
              onClick={handleLinkLots}
              disabled={linking || selectedLots.size === 0}
              className="px-3 py-1.5 text-sm font-medium bg-gold text-white rounded-lg hover:bg-gold-dark transition-colors disabled:opacity-50"
            >
              {linking ? 'Linking...' : `Link Selected (${selectedLots.size})`}
            </button>
          </div>
          {linkSuccess && (
            <div className="px-4 py-2 bg-green-50 text-green-700 text-sm border-b border-green-200">
              {linkSuccess}
            </div>
          )}
          <div className="divide-y divide-beige/50">
            {unlinkedLots.map((lot) => (
              <label key={lot.id} className="flex items-start gap-3 px-4 py-3 hover:bg-cream/30 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedLots.has(lot.id)}
                  onChange={(e) => {
                    const next = new Set(selectedLots);
                    if (e.target.checked) next.add(lot.id);
                    else next.delete(lot.id);
                    setSelectedLots(next);
                  }}
                  className="mt-0.5 rounded border-beige text-gold focus:ring-gold"
                />
                <div className="flex-1 text-sm">
                  <p className="font-medium text-dark-brown">
                    Lot {lot.lotNumber}: {lot.title}
                  </p>
                  <p className="text-xs text-taupe">
                    {lot.auctionTitle} · {lot.status} · est. {formatPLN(lot.estimateMin)}–{formatPLN(lot.estimateMax)}
                    {lot.hammerPrice ? ` · sold: ${formatPLN(lot.hammerPrice)}` : ''}
                  </p>
                </div>
              </label>
            ))}
          </div>
          <div className="px-4 py-2 bg-cream/30 border-t border-beige">
            <button
              onClick={() => setSelectedLots(new Set(unlinkedLots.map((l) => l.id)))}
              className="text-xs text-gold hover:underline mr-3"
            >
              Select all
            </button>
            <button
              onClick={() => setSelectedLots(new Set())}
              className="text-xs text-taupe hover:underline"
            >
              Deselect all
            </button>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        open={showDelete}
        title="Delete Artist"
        message={`Are you sure you want to delete "${artist.name}"? This will unlink all associated lots.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </div>
  );
}
