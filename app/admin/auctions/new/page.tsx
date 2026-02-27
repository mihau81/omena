'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AuctionForm from '../../components/AuctionForm';
import type { AuctionFormData } from '../../components/AuctionForm';

export default function NewAuctionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (data: AuctionFormData) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/auctions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const json = await res.json();

      if (!res.ok) {
        if (json.details?.fieldErrors) {
          throw json.details;
        }
        setError(json.error || 'Failed to create auction');
        return;
      }

      router.push(`/admin/auctions/${json.auction.id}`);
    } catch (err) {
      if (err && typeof err === 'object' && 'fieldErrors' in err) {
        throw err; // Re-throw field errors for the form to handle
      }
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/auctions"
          className="text-taupe hover:text-dark-brown transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-serif font-bold text-dark-brown">New Auction</h1>
          <p className="text-sm text-taupe mt-0.5">Create a new auction</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Form */}
      <div className="bg-white rounded-xl border border-beige p-6">
        <AuctionForm
          onSubmit={handleSubmit}
          submitLabel="Create Auction"
          loading={loading}
        />
      </div>
    </div>
  );
}
