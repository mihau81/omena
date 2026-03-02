'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiUrl } from '@/app/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Settlement {
  id: string;
  consignorId: string;
  consignorName: string;
  auctionId: string;
  auctionTitle: string;
  totalHammer: number;
  commissionAmount: number;
  netPayout: number;
  status: 'pending' | 'approved' | 'paid';
  paidAt: string | null;
  bankReference: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Consignor {
  id: string;
  name: string;
  companyName: string | null;
}

interface Auction {
  id: string;
  title: string;
  status: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_FILTERS = ['all', 'pending', 'approved', 'paid'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const STATUS_STYLES: Record<string, string> = {
  pending:  'bg-amber-100 text-amber-800',
  approved: 'bg-blue-100 text-blue-800',
  paid:     'bg-green-100 text-green-800',
};

const STATUS_LABELS: Record<string, string> = {
  pending:  'Pending',
  approved: 'Approved',
  paid:     'Paid',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPLN(amount: number) {
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pl-PL');
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
        STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600'
      }`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ─── Generate Settlement modal ────────────────────────────────────────────────

interface GenerateModalProps {
  consignors: Consignor[];
  auctions: Auction[];
  onClose: () => void;
  onGenerate: (consignorId: string, auctionId: string) => Promise<void>;
  generating: boolean;
  error: string | null;
}

function GenerateModal({ consignors, auctions, onClose, onGenerate, generating, error }: GenerateModalProps) {
  const [selectedConsignorId, setSelectedConsignorId] = useState('');
  const [selectedAuctionId, setSelectedAuctionId]     = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-lg max-w-lg w-full mx-4 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-dark-brown">Generate Settlement</h3>
            <p className="text-sm text-taupe mt-1">
              Calculates commission for all sold lots by a consignor in an auction.
            </p>
          </div>
          <button onClick={onClose} className="text-taupe hover:text-dark-brown transition-colors ml-4 mt-0.5">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 mb-5">
          <div>
            <label className="block text-sm font-medium text-dark-brown mb-1.5">Consignor</label>
            <select
              value={selectedConsignorId}
              onChange={(e) => setSelectedConsignorId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-beige rounded-lg bg-white text-dark-brown focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold"
            >
              <option value="">— Choose a consignor —</option>
              {consignors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.companyName ? ` (${c.companyName})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-brown mb-1.5">Auction</label>
            <select
              value={selectedAuctionId}
              onChange={(e) => setSelectedAuctionId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-beige rounded-lg bg-white text-dark-brown focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold"
            >
              <option value="">— Choose an auction —</option>
              {auctions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title} <span className="text-taupe">({a.status})</span>
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-taupe bg-beige/50 hover:bg-beige rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => selectedConsignorId && selectedAuctionId && onGenerate(selectedConsignorId, selectedAuctionId)}
            disabled={!selectedConsignorId || !selectedAuctionId || generating}
            className="px-4 py-2 text-sm font-medium text-white bg-gold hover:bg-gold-dark rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {generating && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {generating ? 'Generating…' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SettlementsPage() {
  const searchParams = useSearchParams();
  const initialConsignorId = searchParams.get('consignorId') ?? '';

  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [consignors, setConsignors]   = useState<Consignor[]>([]);
  const [auctions, setAuctions]       = useState<Auction[]>([]);
  const [loading, setLoading]         = useState(true);
  const [statusFilter, setStatusFilter]       = useState<StatusFilter>('all');
  const [consignorFilter, setConsignorFilter] = useState(initialConsignorId);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generating, setGenerating]     = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchSettlements = useCallback(async (status?: string, cId?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status && status !== 'all') params.set('status', status);
      const effectiveConsignorId = cId ?? consignorFilter;
      if (effectiveConsignorId) params.set('consignorId', effectiveConsignorId);
      const res = await fetch(apiUrl(`/api/admin/settlements${params.toString() ? `?${params}` : ''}`));
      if (res.ok) {
        const data = await res.json();
        setSettlements(data.settlements);
      }
    } finally {
      setLoading(false);
    }
  }, [consignorFilter]);

  const fetchDropdowns = useCallback(async () => {
    try {
      const [cRes, aRes] = await Promise.all([
        fetch(apiUrl('/api/admin/consignors?limit=200')),
        fetch(apiUrl('/api/admin/auctions')),
      ]);
      if (cRes.ok) {
        const d = await cRes.json();
        setConsignors(
          (d.data as Consignor[]).map((c) => ({ id: c.id, name: c.name, companyName: c.companyName })),
        );
      }
      if (aRes.ok) {
        const d = await aRes.json();
        setAuctions(
          (d.auctions as Auction[]).map((a) => ({ id: a.id, title: a.title, status: a.status })),
        );
      }
    } catch (err) {
      console.error('Failed to fetch dropdown data:', err);
    }
  }, []);

  useEffect(() => {
    fetchSettlements();
    fetchDropdowns();
  }, [fetchSettlements, fetchDropdowns]);

  useEffect(() => {
    fetchSettlements(statusFilter, consignorFilter);
  }, [fetchSettlements, statusFilter, consignorFilter]);

  // ── Generate ──────────────────────────────────────────────────────────────

  const handleGenerate = async (consignorId: string, auctionId: string) => {
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch(apiUrl('/api/admin/settlements'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consignorId, auctionId }),
      });
      if (res.ok) {
        setShowGenerateModal(false);
        await fetchSettlements(statusFilter);
      } else {
        const data = await res.json();
        setGenerateError(data.error ?? 'Failed to generate settlement');
      }
    } finally {
      setGenerating(false);
    }
  };

  // ── Counts ────────────────────────────────────────────────────────────────

  const statusCounts = STATUS_FILTERS.reduce<Record<string, number>>((acc, s) => {
    acc[s] = s === 'all' ? settlements.length : settlements.filter((x) => x.status === s).length;
    return acc;
  }, {});

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-serif font-bold text-dark-brown">Settlements</h1>
          <p className="text-sm text-taupe mt-1">Consignor payout tracking</p>
        </div>
        <button
          onClick={() => { setGenerateError(null); setShowGenerateModal(true); }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gold text-white text-sm font-medium rounded-lg hover:bg-gold-dark transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Generate Settlement
        </button>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Status tabs */}
        <div className="flex gap-1 bg-beige/30 rounded-lg p-1 flex-wrap">
          {STATUS_FILTERS.map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${
                statusFilter === status
                  ? 'bg-white text-dark-brown shadow-sm'
                  : 'text-taupe hover:text-dark-brown'
              }`}
            >
              {status === 'all' ? 'All' : STATUS_LABELS[status]}
              {' '}
              <span className="text-taupe">({statusCounts[status] ?? 0})</span>
            </button>
          ))}
        </div>

        {/* Consignor filter */}
        <select
          value={consignorFilter}
          onChange={(e) => setConsignorFilter(e.target.value)}
          className="px-3 py-1.5 text-xs border border-beige rounded-lg bg-white text-dark-brown focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold"
        >
          <option value="">All consignors</option>
          {consignors.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}{c.companyName ? ` (${c.companyName})` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-xl border border-beige p-8 text-center text-taupe text-sm">
          Loading settlements…
        </div>
      ) : settlements.length === 0 ? (
        <div className="bg-white rounded-xl border border-beige p-8 text-center text-taupe text-sm">
          No settlements found.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-beige overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-beige bg-cream/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase tracking-wider">Consignor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase tracking-wider">Auction</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-taupe uppercase tracking-wider">Total Hammer</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-taupe uppercase tracking-wider">Commission</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-taupe uppercase tracking-wider">Net Payout</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-taupe uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-beige/50">
                {settlements.map((s) => (
                  <tr key={s.id} className="hover:bg-cream/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-medium text-dark-brown">{s.consignorName}</span>
                    </td>
                    <td className="px-4 py-3 text-taupe text-xs max-w-[160px]">
                      <span className="line-clamp-2">{s.auctionTitle}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-dark-brown font-medium">
                      {formatPLN(s.totalHammer)}
                    </td>
                    <td className="px-4 py-3 text-right text-taupe">
                      {formatPLN(s.commissionAmount)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-dark-brown">
                      {formatPLN(s.netPayout)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-4 py-3 text-taupe text-xs">
                      {s.paidAt ? formatDate(s.paidAt) : formatDate(s.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/settlements/${s.id}`}
                        className="text-xs font-medium text-gold hover:text-gold-dark transition-colors"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Generate modal */}
      {showGenerateModal && (
        <GenerateModal
          consignors={consignors}
          auctions={auctions}
          onClose={() => setShowGenerateModal(false)}
          onGenerate={handleGenerate}
          generating={generating}
          error={generateError}
        />
      )}
    </div>
  );
}
