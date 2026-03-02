'use client';

import { useState } from 'react';
import { apiUrl } from '@/app/lib/utils';

interface Props {
  auctionId: string;
  initialCatalogUrl: string | null;
}

export default function CatalogButton({ auctionId, initialCatalogUrl }: Props) {
  const [generating, setGenerating] = useState(false);
  const [catalogUrl, setCatalogUrl] = useState<string | null>(initialCatalogUrl);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch(apiUrl(`/api/admin/auctions/${auctionId}/catalog`), {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Failed to generate catalog');
        return;
      }
      setCatalogUrl(json.catalogPdfUrl);
    } catch {
      setError('Network error');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleGenerate}
        disabled={generating}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-dark-brown bg-cream hover:bg-beige rounded-lg transition-colors disabled:opacity-50"
        title={catalogUrl ? 'Regenerate catalog PDF' : 'Generate catalog PDF'}
      >
        {generating ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-taupe border-t-transparent" />
            Generating…
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m.75 12 3 3m0 0 3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            {catalogUrl ? 'Regenerate Catalog' : 'Generate Catalog'}
          </>
        )}
      </button>

      {catalogUrl && !generating && (
        <a
          href={catalogUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gold border border-gold hover:bg-gold/10 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Download PDF
        </a>
      )}

      {error && (
        <span className="text-xs text-red-600">{error}</span>
      )}
    </div>
  );
}
