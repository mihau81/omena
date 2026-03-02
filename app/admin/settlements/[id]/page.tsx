'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiUrl } from '@/app/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SettlementItem {
  id: string;
  settlementId: string;
  lotId: string;
  lotNumber: number;
  lotTitle: string;
  lotArtist: string;
  hammerPrice: number;
  commissionRate: string;
  commissionAmount: number;
}

interface SettlementDetail {
  id: string;
  consignorId: string;
  consignorName: string;
  consignorEmail: string | null;
  consignorCompany: string | null;
  consignorTaxId: string | null;
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
  items: SettlementItem[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

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

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('pl-PL', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatCommissionRate(rate: string) {
  const pct = parseFloat(rate) * 100;
  return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(2)}%`;
}

// ─── Mark as Paid modal ───────────────────────────────────────────────────────

interface MarkPaidModalProps {
  onClose: () => void;
  onConfirm: (bankReference: string, notes: string) => Promise<void>;
  saving: boolean;
}

function MarkPaidModal({ onClose, onConfirm, saving }: MarkPaidModalProps) {
  const [bankReference, setBankReference] = useState('');
  const [notes, setNotes]                 = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-lg max-w-md w-full mx-4 p-6">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-semibold text-dark-brown">Mark as Paid</h3>
          <button onClick={onClose} className="text-taupe hover:text-dark-brown transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 mb-5">
          <div>
            <label className="block text-sm font-medium text-dark-brown mb-1.5">
              Bank Reference <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={bankReference}
              onChange={(e) => setBankReference(e.target.value)}
              placeholder="Transfer reference number or ID"
              className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-brown mb-1.5">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Optional payment notes…"
              className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-taupe bg-beige/50 hover:bg-beige rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => bankReference.trim() && onConfirm(bankReference.trim(), notes)}
            disabled={!bankReference.trim() || saving}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {saving ? 'Saving…' : 'Mark as Paid'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportToCSV(settlement: SettlementDetail) {
  const headers = ['Lot #', 'Title', 'Artist', 'Hammer Price', 'Commission Rate', 'Commission Amount', 'Net to Consignor'];
  const rows = settlement.items.map((item) => [
    item.lotNumber,
    `"${item.lotTitle.replace(/"/g, '""')}"`,
    `"${item.lotArtist.replace(/"/g, '""')}"`,
    item.hammerPrice,
    formatCommissionRate(item.commissionRate),
    item.commissionAmount,
    item.hammerPrice - item.commissionAmount,
  ]);

  // Summary row
  rows.push([
    '',
    '"TOTAL"',
    '',
    settlement.totalHammer,
    '',
    settlement.commissionAmount,
    settlement.netPayout,
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `settlement-${settlement.consignorName.replace(/\s+/g, '-')}-${new Date(settlement.createdAt).toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SettlementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [settlement, setSettlement] = useState<SettlementDetail | null>(null);
  const [loading, setLoading]       = useState(true);
  const [updating, setUpdating]     = useState(false);
  const [showMarkPaid, setShowMarkPaid] = useState(false);
  const [actionError, setActionError]   = useState<string | null>(null);

  const fetchSettlement = useCallback(async () => {
    try {
      const res = await fetch(apiUrl(`/api/admin/settlements/${id}`));
      if (res.ok) {
        const data = await res.json();
        setSettlement(data.settlement);
      } else if (res.status === 404) {
        router.push('/admin/settlements');
      }
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchSettlement();
  }, [fetchSettlement]);

  // ── Status actions ────────────────────────────────────────────────────────

  const handleApprove = async () => {
    if (!settlement) return;
    setUpdating(true);
    setActionError(null);
    try {
      const res = await fetch(apiUrl(`/api/admin/settlements/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });
      if (res.ok) {
        await fetchSettlement();
      } else {
        const data = await res.json();
        setActionError(data.error ?? 'Failed to approve');
      }
    } finally {
      setUpdating(false);
    }
  };

  const handleMarkPaid = async (bankReference: string, notes: string) => {
    setUpdating(true);
    setActionError(null);
    try {
      const res = await fetch(apiUrl(`/api/admin/settlements/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paid', bankReference, notes }),
      });
      if (res.ok) {
        setShowMarkPaid(false);
        await fetchSettlement();
      } else {
        const data = await res.json();
        setActionError(data.error ?? 'Failed to mark as paid');
      }
    } finally {
      setUpdating(false);
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/settlements" className="text-taupe hover:text-dark-brown transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
          </Link>
          <h1 className="text-2xl font-serif font-bold text-dark-brown">Loading…</h1>
        </div>
      </div>
    );
  }

  if (!settlement) return null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Breadcrumb + header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-taupe mb-2">
            <Link href="/admin/settlements" className="hover:text-dark-brown transition-colors">
              Settlements
            </Link>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
            <span className="text-dark-brown">{settlement.consignorName}</span>
          </div>
          <h1 className="text-2xl font-serif font-bold text-dark-brown">
            Settlement — {settlement.consignorName}
          </h1>
          <p className="text-sm text-taupe mt-1">{settlement.auctionTitle}</p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 items-start">
          <button
            onClick={() => exportToCSV(settlement)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-dark-brown border border-beige rounded-lg hover:bg-beige/50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export CSV
          </button>

          {settlement.status === 'pending' && (
            <button
              onClick={handleApprove}
              disabled={updating}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
            >
              Approve
            </button>
          )}

          {settlement.status === 'approved' && (
            <button
              onClick={() => setShowMarkPaid(true)}
              disabled={updating}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
            >
              Mark as Paid
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {actionError && (
        <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">
          {actionError}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-beige p-4">
          <p className="text-xs text-taupe uppercase font-semibold">Status</p>
          <div className="mt-2">
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[settlement.status]}`}>
              {STATUS_LABELS[settlement.status]}
            </span>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-beige p-4">
          <p className="text-xs text-taupe uppercase font-semibold">Total Hammer</p>
          <p className="mt-2 text-xl font-bold text-dark-brown">{formatPLN(settlement.totalHammer)}</p>
        </div>
        <div className="bg-white rounded-xl border border-beige p-4">
          <p className="text-xs text-taupe uppercase font-semibold">Commission</p>
          <p className="mt-2 text-xl font-bold text-dark-brown">{formatPLN(settlement.commissionAmount)}</p>
        </div>
        <div className="bg-white rounded-xl border border-beige p-4">
          <p className="text-xs text-taupe uppercase font-semibold">Net Payout</p>
          <p className="mt-2 text-xl font-bold text-green-700">{formatPLN(settlement.netPayout)}</p>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lot breakdown table */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-beige overflow-hidden">
          <div className="px-4 py-3 border-b border-beige bg-cream/30">
            <h2 className="text-sm font-semibold text-dark-brown">
              Lot Breakdown
              <span className="ml-2 text-taupe font-normal">({settlement.items.length} lots)</span>
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-beige bg-cream/20">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-taupe uppercase">#</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-taupe uppercase">Lot</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-taupe uppercase">Hammer</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-taupe uppercase">Rate</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-taupe uppercase">Commission</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-taupe uppercase">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-beige/50">
                {settlement.items.map((item) => (
                  <tr key={item.id} className="hover:bg-cream/20 transition-colors">
                    <td className="px-4 py-2.5 text-xs text-taupe font-mono">{item.lotNumber}</td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-dark-brown text-xs">
                        {item.lotTitle.length > 50 ? item.lotTitle.slice(0, 50) + '…' : item.lotTitle}
                      </div>
                      {item.lotArtist && (
                        <div className="text-taupe text-xs">{item.lotArtist}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-dark-brown font-medium text-xs">
                      {formatPLN(item.hammerPrice)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-taupe text-xs">
                      {formatCommissionRate(item.commissionRate)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-taupe text-xs">
                      {formatPLN(item.commissionAmount)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-dark-brown font-semibold text-xs">
                      {formatPLN(item.hammerPrice - item.commissionAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-beige bg-cream/30">
                  <td className="px-4 py-2.5" colSpan={2}>
                    <span className="text-xs font-bold text-dark-brown uppercase">Total</span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-dark-brown font-bold text-xs">
                    {formatPLN(settlement.totalHammer)}
                  </td>
                  <td className="px-4 py-2.5"></td>
                  <td className="px-4 py-2.5 text-right text-dark-brown font-bold text-xs">
                    {formatPLN(settlement.commissionAmount)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-green-700 font-bold text-xs">
                    {formatPLN(settlement.netPayout)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Right column: consignor info + payment details */}
        <div className="space-y-4">
          {/* Consignor info */}
          <div className="bg-white rounded-xl border border-beige p-4">
            <h3 className="text-xs font-semibold text-taupe uppercase tracking-wider mb-3">Consignor</h3>
            <div className="space-y-1.5">
              <Link
                href={`/admin/consignors/${settlement.consignorId}`}
                className="font-medium text-dark-brown hover:text-gold transition-colors text-sm block"
              >
                {settlement.consignorName}
              </Link>
              {settlement.consignorCompany && (
                <p className="text-xs text-taupe">{settlement.consignorCompany}</p>
              )}
              {settlement.consignorEmail && (
                <p className="text-xs text-taupe">{settlement.consignorEmail}</p>
              )}
              {settlement.consignorTaxId && (
                <p className="text-xs text-taupe">NIP: {settlement.consignorTaxId}</p>
              )}
            </div>
          </div>

          {/* Payment details */}
          {(settlement.bankReference || settlement.paidAt) && (
            <div className="bg-white rounded-xl border border-beige p-4">
              <h3 className="text-xs font-semibold text-taupe uppercase tracking-wider mb-3">Payment</h3>
              <div className="space-y-2">
                {settlement.paidAt && (
                  <div className="flex justify-between text-sm">
                    <span className="text-taupe">Paid at</span>
                    <span className="text-dark-brown font-medium">{formatDate(settlement.paidAt)}</span>
                  </div>
                )}
                {settlement.bankReference && (
                  <div className="flex justify-between text-sm">
                    <span className="text-taupe">Reference</span>
                    <span className="font-mono text-dark-brown text-xs break-all text-right max-w-[120px]">
                      {settlement.bankReference}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {settlement.notes && (
            <div className="bg-white rounded-xl border border-beige p-4">
              <h3 className="text-xs font-semibold text-taupe uppercase tracking-wider mb-2">Notes</h3>
              <p className="text-sm text-taupe">{settlement.notes}</p>
            </div>
          )}

          {/* Metadata */}
          <div className="bg-white rounded-xl border border-beige p-4 text-xs text-taupe space-y-1.5">
            <h3 className="font-semibold uppercase tracking-wider mb-2">Details</h3>
            <div className="flex justify-between">
              <span>Created</span>
              <span>{formatDateTime(settlement.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span>Updated</span>
              <span>{formatDateTime(settlement.updatedAt)}</span>
            </div>
            <div className="flex justify-between">
              <span>ID</span>
              <span className="font-mono">{settlement.id.slice(0, 8)}…</span>
            </div>
          </div>

          {/* Settlements link on consignor page */}
          <Link
            href={`/admin/consignors/${settlement.consignorId}`}
            className="flex items-center gap-2 text-sm text-taupe hover:text-dark-brown transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
            </svg>
            View consignor profile
          </Link>
        </div>
      </div>

      {/* Mark as Paid modal */}
      {showMarkPaid && (
        <MarkPaidModal
          onClose={() => setShowMarkPaid(false)}
          onConfirm={handleMarkPaid}
          saving={updating}
        />
      )}
    </div>
  );
}
