'use client';

import { apiUrl } from '@/app/lib/utils';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ArtistRow {
  id: string;
  slug: string;
  name: string;
  nationality: string | null;
  birthYear: number | null;
  deathYear: number | null;
  lotCount: number;
  createdAt: string;
}

interface PaginatedResult {
  data: ArtistRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function formatYears(birth: number | null, death: number | null): string {
  if (!birth && !death) return '—';
  if (birth && death) return `${birth}–${death}`;
  if (birth) return `b. ${birth}`;
  return `d. ${death}`;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

interface ArtistFormData {
  name: string;
  slug: string;
  nationality: string;
  birthYear: string;
  deathYear: string;
  bio: string;
  imageUrl: string;
}

const emptyForm: ArtistFormData = {
  name: '',
  slug: '',
  nationality: '',
  birthYear: '',
  deathYear: '',
  bio: '',
  imageUrl: '',
};

export default function ArtistsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatedResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ArtistFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchArtists = useCallback(async (overrides?: { page?: number; search?: string }) => {
    setLoading(true);
    const params = new URLSearchParams();
    const q = overrides?.search ?? search;
    const p = overrides?.page ?? page;
    if (q) params.set('search', q);
    params.set('page', String(p));
    params.set('limit', '50');

    try {
      const res = await fetch(apiUrl(`/api/admin/artists?${params}`));
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    fetchArtists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchArtists({ page: 1 });
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchArtists({ page: newPage });
  };

  const handleNameChange = (name: string) => {
    setForm((f) => ({
      ...f,
      name,
      slug: f.slug === '' || f.slug === generateSlug(f.name) ? generateSlug(name) : f.slug,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError('');

    try {
      const res = await fetch(apiUrl('/api/admin/artists'), {
        method: 'POST',
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
        const { artist } = await res.json();
        setShowForm(false);
        setForm(emptyForm);
        router.push(`/admin/artists/${artist.id}`);
      } else {
        const err = await res.json();
        setFormError(err.error || 'Failed to create artist');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-dark-brown">Artists</h1>
          <p className="text-sm text-taupe mt-1">
            {data ? `${data.total} artists` : 'Loading...'}
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setFormError(''); }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gold text-white text-sm font-medium rounded-lg hover:bg-gold-dark transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Artist
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-beige p-6">
          <h2 className="text-lg font-serif font-semibold text-dark-brown mb-4">New Artist</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-taupe mb-1">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none"
                  placeholder="Artist full name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-taupe mb-1">Slug *</label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  required
                  className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none font-mono"
                  placeholder="url-friendly-slug"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-taupe mb-1">Nationality</label>
                <input
                  type="text"
                  value={form.nationality}
                  onChange={(e) => setForm((f) => ({ ...f, nationality: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none"
                  placeholder="e.g. Polish"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-taupe mb-1">Birth year</label>
                  <input
                    type="number"
                    value={form.birthYear}
                    onChange={(e) => setForm((f) => ({ ...f, birthYear: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none"
                    placeholder="e.g. 1950"
                    min={1300}
                    max={2020}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-taupe mb-1">Death year</label>
                  <input
                    type="number"
                    value={form.deathYear}
                    onChange={(e) => setForm((f) => ({ ...f, deathYear: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none"
                    placeholder="leave blank if living"
                    min={1300}
                    max={2026}
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-taupe mb-1">Bio</label>
              <textarea
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                rows={4}
                className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none resize-y"
                placeholder="Artist biography..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-taupe mb-1">Image URL</label>
              <input
                type="url"
                value={form.imageUrl}
                onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none"
                placeholder="https://..."
              />
            </div>
            {formError && (
              <p className="text-sm text-red-600">{formError}</p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setShowForm(false); setForm(emptyForm); setFormError(''); }}
                className="px-4 py-2 text-sm border border-beige rounded-lg hover:bg-beige/50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-sm font-medium bg-gold text-white rounded-lg hover:bg-gold-dark transition-colors disabled:opacity-60"
              >
                {saving ? 'Creating...' : 'Create Artist'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-xl border border-beige p-4">
        <form onSubmit={handleSearchSubmit} className="flex gap-3">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none"
            />
          </div>
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase">Nationality</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase">Years</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-taupe uppercase">Lots</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase">Slug</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-taupe uppercase"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-beige/50">
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-taupe">Loading...</td>
                </tr>
              )}
              {!loading && data?.data.map((artist) => (
                <tr
                  key={artist.id}
                  className="hover:bg-cream/30 transition-colors cursor-pointer"
                  onClick={() => router.push(`/admin/artists/${artist.id}`)}
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-dark-brown">{artist.name}</span>
                  </td>
                  <td className="px-4 py-3 text-taupe">{artist.nationality || '—'}</td>
                  <td className="px-4 py-3 text-taupe text-xs">{formatYears(artist.birthYear, artist.deathYear)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-beige text-dark-brown text-xs font-bold">
                      {artist.lotCount}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-taupe text-xs font-mono">{artist.slug}</td>
                  <td className="px-4 py-3 text-right">
                    <svg className="w-4 h-4 text-taupe inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                  </td>
                </tr>
              ))}
              {!loading && data?.data.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-taupe">No artists found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

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
