'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import SortableLotList from '../../../components/SortableLotList';
import LotImport from '../../../components/LotImport';

interface LotRow {
  id: string;
  lotNumber: number;
  title: string;
  artist: string;
  status: string;
  estimateMin: number;
  estimateMax: number;
  sortOrder: number;
  primaryThumbnailUrl: string | null;
}

interface AuctionInfo {
  id: string;
  title: string;
  slug: string;
}

export default function LotsListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: auctionId } = use(params);
  const [lots, setLots] = useState<LotRow[]>([]);
  const [auction, setAuction] = useState<AuctionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [auctionRes, lotsRes] = await Promise.all([
        fetch(`/omena/api/admin/auctions/${auctionId}`),
        fetch(`/omena/api/admin/auctions/${auctionId}/lots`),
      ]);

      if (auctionRes.ok) {
        const data = await auctionRes.json();
        setAuction(data.auction);
      }

      if (lotsRes.ok) {
        const data = await lotsRes.json();
        setLots(data.lots);
      }
    } catch (err) {
      console.error('Failed to fetch lots:', err);
    } finally {
      setLoading(false);
    }
  }, [auctionId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleImported = useCallback((count: number) => {
    console.log(`Imported ${count} lots. Refreshing list...`);
    fetchData();
  }, [fetchData]);

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
            <h1 className="text-2xl font-serif font-bold text-dark-brown">
              Lots {auction ? `\u2014 ${auction.title}` : ''}
            </h1>
            <p className="text-sm text-taupe mt-0.5">{lots.length} lots — drag rows to reorder</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <a
            href={`/api/admin/auctions/${auctionId}/condition-reports`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white text-amber-700 text-sm font-medium rounded-lg border border-amber-200 hover:bg-amber-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
            </svg>
            All Condition Reports
          </a>
          <button
            onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white text-dark-brown text-sm font-medium rounded-lg border border-beige hover:bg-beige/50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
            Import CSV
          </button>
          <Link
            href={`/admin/auctions/${auctionId}/lots/new`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gold text-white text-sm font-medium rounded-lg hover:bg-gold-dark transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Lot
          </Link>
        </div>
      </div>

      <SortableLotList initialLots={lots} auctionId={auctionId} />

      {/* CSV Import modal */}
      {showImport && (
        <LotImport
          auctionId={auctionId}
          onImported={handleImported}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}
