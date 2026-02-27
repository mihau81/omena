'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import LotForm from '../../../../components/LotForm';
import type { LotFormData } from '../../../../components/LotForm';

export default function NewLotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: auctionId } = use(params);
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: LotFormData) => {
    setSaving(true);
    setError(null);

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

      const res = await fetch(`/api/admin/auctions/${auctionId}/lots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      if (!res.ok) {
        if (json.details?.fieldErrors) {
          throw json.details;
        }
        setError(json.error || 'Failed to create lot');
        return;
      }

      router.push(`/admin/auctions/${auctionId}/lots/${json.lot.id}`);
    } catch (err) {
      if (err && typeof err === 'object' && 'fieldErrors' in err) {
        throw err;
      }
      setError('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/admin/auctions/${auctionId}/lots`}
          className="text-taupe hover:text-dark-brown transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
        </Link>
        <h1 className="text-2xl font-serif font-bold text-dark-brown">New Lot</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-beige p-6">
        <LotForm onSubmit={handleSubmit} submitLabel="Create Lot" loading={saving} />
      </div>
    </div>
  );
}
