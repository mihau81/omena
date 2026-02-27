'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PaymentInfo {
  status: string;
  provider: string;
  externalId: string | null;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  userId: string;
  lotId: string;
  auctionId: string;
  hammerPrice: number;
  buyersPremium: number;
  totalAmount: number;
  currency: string;
  status: string;
  dueDate: string | null;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined
  userName: string;
  userEmail: string;
  userAddress: string | null;
  userCity: string | null;
  userPostalCode: string | null;
  userCountry: string | null;
  lotTitle: string;
  lotNumber: number;
  auctionTitle: string;
  auctionSlug: string;
  // Payment
  payment: PaymentInfo | null;
}

interface Auction {
  id: string;
  title: string;
  status: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_FILTERS = ['all', 'pending', 'sent', 'paid', 'overdue', 'cancelled'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const STATUS_STYLES: Record<string, string> = {
  pending:   'bg-amber-100 text-amber-800',
  sent:      'bg-blue-100 text-blue-800',
  paid:      'bg-green-100 text-green-800',
  overdue:   'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-600',
};

const PAYMENT_STATUS_STYLES: Record<string, string> = {
  pending:    'bg-amber-50 text-amber-700',
  processing: 'bg-blue-50 text-blue-700',
  succeeded:  'bg-green-50 text-green-700',
  failed:     'bg-red-50 text-red-700',
  refunded:   'bg-purple-50 text-purple-700',
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending:    'Pending',
  processing: 'Processing',
  succeeded:  'Paid via Stripe',
  failed:     'Failed',
  refunded:   'Refunded',
};

const STATUS_LABELS: Record<string, string> = {
  pending:   'Pending',
  sent:      'Sent',
  paid:      'Paid',
  overdue:   'Overdue',
  cancelled: 'Cancelled',
};

const NEXT_STATUSES: Record<string, string[]> = {
  pending:   ['sent', 'cancelled'],
  sent:      ['paid', 'overdue', 'cancelled'],
  overdue:   ['paid', 'cancelled'],
  paid:      [],
  cancelled: [],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Payment badge ───────────────────────────────────────────────────────────

function PaymentBadge({ payment }: { payment: PaymentInfo | null }) {
  if (!payment) {
    return (
      <span className="inline-block px-2 py-0.5 rounded-full text-xs text-taupe bg-beige/40">
        —
      </span>
    );
  }
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
        PAYMENT_STATUS_STYLES[payment.status] ?? 'bg-gray-100 text-gray-600'
      }`}
      title={`${payment.provider}${payment.externalId ? ` · ${payment.externalId}` : ''}`}
    >
      {PAYMENT_STATUS_LABELS[payment.status] ?? payment.status}
    </span>
  );
}

// ─── Generate for Auction modal ───────────────────────────────────────────────

interface GenerateModalProps {
  auctions: Auction[];
  onClose: () => void;
  onGenerate: (auctionId: string) => Promise<void>;
  generating: boolean;
  result: { generated: number; skipped: number; errors: Array<{ lotId: string; error: string }> } | null;
}

function GenerateModal({ auctions, onClose, onGenerate, generating, result }: GenerateModalProps) {
  const [selectedAuctionId, setSelectedAuctionId] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-lg max-w-lg w-full mx-4 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-dark-brown">Generate Invoices for Auction</h3>
            <p className="text-sm text-taupe mt-1">
              Generates invoices for all sold lots that do not yet have one.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-taupe hover:text-dark-brown transition-colors ml-4 mt-0.5"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!result ? (
          <>
            <div className="mb-5">
              <label className="block text-sm font-medium text-dark-brown mb-1.5">
                Select Auction
              </label>
              <select
                value={selectedAuctionId}
                onChange={(e) => setSelectedAuctionId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-beige rounded-lg bg-white text-dark-brown focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold"
              >
                <option value="">— Choose an auction —</option>
                {auctions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                    {' '}
                    <span className="text-taupe">({a.status})</span>
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-taupe bg-beige/50 hover:bg-beige rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => selectedAuctionId && onGenerate(selectedAuctionId)}
                disabled={!selectedAuctionId || generating}
                className="px-4 py-2 text-sm font-medium text-white bg-gold hover:bg-gold-dark rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {generating && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {generating ? 'Generating…' : 'Generate Invoices'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-3 mb-5">
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-100 rounded-lg">
                <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <span className="text-sm text-green-800 font-medium">
                  {result.generated} invoice{result.generated !== 1 ? 's' : ''} generated
                </span>
              </div>
              {result.skipped > 0 && (
                <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                  <svg className="w-5 h-5 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                  <span className="text-sm text-amber-800">
                    {result.skipped} lot{result.skipped !== 1 ? 's' : ''} already had invoices (skipped)
                  </span>
                </div>
              )}
              {result.errors.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                    </svg>
                    <span className="text-sm font-medium text-red-800">
                      {result.errors.length} error{result.errors.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <ul className="space-y-1">
                    {result.errors.map((e) => (
                      <li key={e.lotId} className="text-xs text-red-700 font-mono">
                        {e.lotId.slice(0, 8)}…: {e.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-white bg-gold hover:bg-gold-dark rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Invoice detail panel ─────────────────────────────────────────────────────

interface DetailPanelProps {
  invoice: Invoice;
  onClose: () => void;
  onStatusChange: (id: string, status: string) => Promise<void>;
  onNotesChange: (id: string, notes: string) => Promise<void>;
  updatingId: string | null;
}

const PROVIDER_LABELS: Record<string, string> = {
  stripe:     'Stripe',
  przelewy24: 'Przelewy24',
  transfer:   'Bank Transfer',
};

function DetailPanel({ invoice, onClose, onStatusChange, onNotesChange, updatingId }: DetailPanelProps) {
  const [notes, setNotes] = useState(invoice.notes ?? '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesDirty, setNotesDirty] = useState(false);

  const nextStatuses = NEXT_STATUSES[invoice.status] ?? [];

  const handleNotesSave = async () => {
    setSavingNotes(true);
    await onNotesChange(invoice.id, notes);
    setSavingNotes(false);
    setNotesDirty(false);
  };

  const timeline: Array<{ label: string; date: string | null; active: boolean }> = [
    { label: 'Created', date: invoice.createdAt, active: true },
    { label: 'Sent', date: null, active: invoice.status === 'sent' || invoice.status === 'paid' || invoice.status === 'overdue' },
    { label: 'Paid', date: invoice.paidAt, active: invoice.status === 'paid' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative ml-auto h-full w-full max-w-xl bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-beige bg-cream/30">
          <div>
            <p className="text-xs text-taupe uppercase tracking-wider mb-0.5">Invoice</p>
            <h2 className="text-lg font-mono font-bold text-dark-brown">{invoice.invoiceNumber}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-taupe hover:text-dark-brown transition-colors mt-0.5"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Status + actions */}
          <div className="flex items-center gap-3 flex-wrap">
            <StatusBadge status={invoice.status} />
            {nextStatuses.map((next) => (
              <button
                key={next}
                onClick={() => onStatusChange(invoice.id, next)}
                disabled={updatingId === invoice.id}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
                  next === 'paid'
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : next === 'cancelled'
                    ? 'bg-red-100 text-red-600 hover:bg-red-200'
                    : next === 'sent'
                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                }`}
              >
                {next === 'sent' && 'Mark Sent'}
                {next === 'paid' && 'Mark Paid'}
                {next === 'overdue' && 'Mark Overdue'}
                {next === 'cancelled' && 'Cancel'}
              </button>
            ))}
            <a
              href={`/omena/api/admin/invoices/${invoice.id}?format=html`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto px-3 py-1 text-xs font-medium rounded-lg bg-beige/60 text-dark-brown hover:bg-beige transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              View HTML
            </a>
          </div>

          {/* Buyer */}
          <section>
            <h3 className="text-xs font-semibold text-taupe uppercase tracking-wider mb-2">Buyer</h3>
            <div className="bg-cream/40 rounded-lg p-3 space-y-1">
              <p className="text-sm font-medium text-dark-brown">{invoice.userName}</p>
              <p className="text-xs text-taupe">{invoice.userEmail}</p>
              {(invoice.userAddress || invoice.userCity) && (
                <p className="text-xs text-taupe">
                  {[invoice.userAddress, invoice.userPostalCode, invoice.userCity, invoice.userCountry]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              )}
            </div>
          </section>

          {/* Lot */}
          <section>
            <h3 className="text-xs font-semibold text-taupe uppercase tracking-wider mb-2">Lot</h3>
            <div className="bg-cream/40 rounded-lg p-3 space-y-1">
              <p className="text-sm font-medium text-dark-brown">
                <span className="text-taupe font-normal">#{invoice.lotNumber}</span>{' '}
                {invoice.lotTitle}
              </p>
              <p className="text-xs text-taupe">{invoice.auctionTitle}</p>
            </div>
          </section>

          {/* Financials */}
          <section>
            <h3 className="text-xs font-semibold text-taupe uppercase tracking-wider mb-2">Financials</h3>
            <div className="bg-cream/40 rounded-lg p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-taupe">Hammer price</span>
                <span className="text-dark-brown font-medium">{formatPLN(invoice.hammerPrice)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-taupe">Buyer's premium</span>
                <span className="text-dark-brown">{formatPLN(invoice.buyersPremium)}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-beige/70 pt-2 mt-2">
                <span className="font-semibold text-dark-brown">Total</span>
                <span className="font-bold text-dark-brown">{formatPLN(invoice.totalAmount)}</span>
              </div>
              <div className="flex justify-between text-xs text-taupe pt-1">
                <span>Due date</span>
                <span>{formatDate(invoice.dueDate)}</span>
              </div>
              {invoice.paidAt && (
                <div className="flex justify-between text-xs text-green-700">
                  <span>Paid at</span>
                  <span>{formatDate(invoice.paidAt)}</span>
                </div>
              )}
            </div>
          </section>

          {/* Payment info */}
          {invoice.payment && (
            <section>
              <h3 className="text-xs font-semibold text-taupe uppercase tracking-wider mb-2">Payment</h3>
              <div className="bg-cream/40 rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-taupe">Provider</span>
                  <span className="text-dark-brown font-medium">
                    {PROVIDER_LABELS[invoice.payment.provider] ?? invoice.payment.provider}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-taupe">Status</span>
                  <PaymentBadge payment={invoice.payment} />
                </div>
                {invoice.payment.externalId && (
                  <div className="flex justify-between text-xs">
                    <span className="text-taupe">Reference</span>
                    <span className="font-mono text-dark-brown text-xs break-all text-right max-w-[160px]">
                      {invoice.payment.externalId}
                    </span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Status timeline */}
          <section>
            <h3 className="text-xs font-semibold text-taupe uppercase tracking-wider mb-3">Timeline</h3>
            <ol className="relative border-l border-beige ml-3 space-y-4">
              {timeline.map((step) => (
                <li key={step.label} className="pl-5 relative">
                  <span
                    className={`absolute -left-1.5 top-0.5 w-3 h-3 rounded-full border-2 ${
                      step.active
                        ? 'border-gold bg-gold'
                        : 'border-beige bg-white'
                    }`}
                  />
                  <p className={`text-sm font-medium ${step.active ? 'text-dark-brown' : 'text-taupe'}`}>
                    {step.label}
                  </p>
                  {step.date && (
                    <p className="text-xs text-taupe">{formatDateTime(step.date)}</p>
                  )}
                </li>
              ))}
            </ol>
          </section>

          {/* Notes */}
          <section>
            <h3 className="text-xs font-semibold text-taupe uppercase tracking-wider mb-2">Notes</h3>
            <textarea
              value={notes}
              onChange={(e) => { setNotes(e.target.value); setNotesDirty(true); }}
              rows={3}
              placeholder="Add internal notes…"
              className="w-full px-3 py-2 text-sm border border-beige rounded-lg bg-white text-dark-brown placeholder-taupe/60 focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold resize-none"
            />
            {notesDirty && (
              <div className="mt-2 flex justify-end">
                <button
                  onClick={handleNotesSave}
                  disabled={savingNotes}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-gold hover:bg-gold-dark rounded-lg transition-colors disabled:opacity-50"
                >
                  {savingNotes ? 'Saving…' : 'Save Notes'}
                </button>
              </div>
            )}
          </section>

          {/* Metadata */}
          <section className="text-xs text-taupe space-y-1 pt-2 border-t border-beige">
            <div className="flex justify-between">
              <span>Invoice ID</span>
              <span className="font-mono">{invoice.id.slice(0, 8)}…</span>
            </div>
            <div className="flex justify-between">
              <span>Created</span>
              <span>{formatDateTime(invoice.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span>Updated</span>
              <span>{formatDateTime(invoice.updatedAt)}</span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [auctionFilter, setAuctionFilter] = useState<string>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<{
    generated: number;
    skipped: number;
    errors: Array<{ lotId: string; error: string }>;
  } | null>(null);

  // ── Fetch helpers ──────────────────────────────────────────────────────────

  const fetchAuctions = useCallback(async () => {
    try {
      const res = await fetch('/omena/api/admin/auctions');
      if (res.ok) {
        const data = await res.json();
        setAuctions(
          (data.auctions as Auction[]).map((a) => ({
            id: a.id,
            title: a.title,
            status: a.status,
          })),
        );
      }
    } catch (err) {
      console.error('Failed to fetch auctions:', err);
    }
  }, []);

  const fetchInvoices = useCallback(async (status?: string, auctionId?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status && status !== 'all') params.set('status', status);
      if (auctionId && auctionId !== 'all') params.set('auctionId', auctionId);
      const qs = params.toString();
      const url = `/omena/api/admin/invoices${qs ? `?${qs}` : ''}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.invoices);
      }
    } catch (err) {
      console.error('Failed to fetch invoices:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAuctions();
  }, [fetchAuctions]);

  useEffect(() => {
    fetchInvoices(statusFilter === 'all' ? undefined : statusFilter, auctionFilter === 'all' ? undefined : auctionFilter);
  }, [fetchInvoices, statusFilter, auctionFilter]);

  // ── Status update ──────────────────────────────────────────────────────────

  const handleStatusChange = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    try {
      const res = await fetch(`/omena/api/admin/invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        setInvoices((prev) =>
          prev.map((inv) => (inv.id === id ? { ...inv, ...data.invoice } : inv)),
        );
        if (selectedInvoice?.id === id) {
          setSelectedInvoice((prev) => prev ? { ...prev, ...data.invoice } : null);
        }
      } else {
        const err = await res.json();
        alert(err.error ?? 'Failed to update status');
      }
    } catch (err) {
      console.error('Failed to update invoice status:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  // ── Notes update ───────────────────────────────────────────────────────────

  const handleNotesChange = async (id: string, notes: string) => {
    try {
      const current = invoices.find((i) => i.id === id);
      if (!current) return;
      const res = await fetch(`/omena/api/admin/invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: current.status, notes }),
      });
      if (res.ok) {
        const data = await res.json();
        setInvoices((prev) =>
          prev.map((inv) => (inv.id === id ? { ...inv, notes } : inv)),
        );
        if (selectedInvoice?.id === id) {
          setSelectedInvoice((prev) => prev ? { ...prev, notes, ...data.invoice } : null);
        }
      }
    } catch (err) {
      console.error('Failed to update notes:', err);
    }
  };

  // ── Batch generate ─────────────────────────────────────────────────────────

  const handleGenerate = async (auctionId: string) => {
    setGenerating(true);
    try {
      const res = await fetch('/omena/api/admin/invoices/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auctionId }),
      });
      const data = await res.json();
      setGenerateResult({
        generated: data.generated ?? 0,
        skipped: data.skipped ?? 0,
        errors: data.errors ?? [],
      });
      // Refresh invoice list so newly generated ones appear
      if ((data.generated ?? 0) > 0) {
        await fetchInvoices(
          statusFilter === 'all' ? undefined : statusFilter,
          auctionFilter === 'all' ? undefined : auctionFilter,
        );
      }
    } catch (err) {
      console.error('Failed to generate invoices:', err);
    } finally {
      setGenerating(false);
    }
  };

  // ── Counts (use local data) ────────────────────────────────────────────────

  const statusCounts = STATUS_FILTERS.reduce<Record<string, number>>((acc, s) => {
    acc[s] = s === 'all' ? invoices.length : invoices.filter((i) => i.status === s).length;
    return acc;
  }, {});

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-serif font-bold text-dark-brown">Invoices</h1>
          <p className="text-sm text-taupe mt-1">
            Manage buyer invoices and payment status
          </p>
        </div>
        <button
          onClick={() => { setGenerateResult(null); setShowGenerateModal(true); }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gold text-white text-sm font-medium rounded-lg hover:bg-gold-dark transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Generate for Auction
        </button>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Status filter tabs */}
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

        {/* Auction filter */}
        <select
          value={auctionFilter}
          onChange={(e) => setAuctionFilter(e.target.value)}
          className="px-3 py-1.5 text-xs border border-beige rounded-lg bg-white text-dark-brown focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold"
        >
          <option value="all">All auctions</option>
          {auctions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-xl border border-beige p-8 text-center text-taupe text-sm">
          Loading invoices…
        </div>
      ) : invoices.length === 0 ? (
        <div className="bg-white rounded-xl border border-beige p-8 text-center text-taupe text-sm">
          No invoices found.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-beige overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-beige bg-cream/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase tracking-wider">Invoice #</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase tracking-wider">Buyer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase tracking-wider">Lot</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase tracking-wider">Auction</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-taupe uppercase tracking-wider">Hammer</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-taupe uppercase tracking-wider">Premium</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-taupe uppercase tracking-wider">Total</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase tracking-wider">Payment</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase tracking-wider">Due</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-taupe uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-beige/50">
                {invoices.map((invoice) => {
                  const nextStatuses = NEXT_STATUSES[invoice.status] ?? [];
                  return (
                    <tr
                      key={invoice.id}
                      className="hover:bg-cream/30 transition-colors cursor-pointer"
                      onClick={() => setSelectedInvoice(invoice)}
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-semibold text-dark-brown">
                          {invoice.invoiceNumber}
                        </span>
                        <div className="text-xs text-taupe mt-0.5">
                          {new Date(invoice.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-dark-brown">{invoice.userName}</div>
                        <div className="text-xs text-taupe">{invoice.userEmail}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-dark-brown">
                          <span className="text-taupe text-xs">#{invoice.lotNumber}</span>{' '}
                          {invoice.lotTitle.length > 40
                            ? invoice.lotTitle.slice(0, 40) + '…'
                            : invoice.lotTitle}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-taupe text-xs max-w-[140px]">
                        <span className="line-clamp-2">{invoice.auctionTitle}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-dark-brown font-medium">
                        {formatPLN(invoice.hammerPrice)}
                      </td>
                      <td className="px-4 py-3 text-right text-taupe">
                        {formatPLN(invoice.buyersPremium)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-dark-brown">
                        {formatPLN(invoice.totalAmount)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={invoice.status} />
                      </td>
                      <td className="px-4 py-3">
                        <PaymentBadge payment={invoice.payment} />
                      </td>
                      <td className="px-4 py-3 text-taupe text-xs">
                        {invoice.dueDate
                          ? new Date(invoice.dueDate).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {/* View HTML invoice */}
                          <a
                            href={`/omena/api/admin/invoices/${invoice.id}?format=html`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-gold hover:text-gold-dark transition-colors"
                          >
                            View
                          </a>

                          {/* Status transition buttons */}
                          {nextStatuses.map((nextStatus) => (
                            <button
                              key={nextStatus}
                              onClick={() => handleStatusChange(invoice.id, nextStatus)}
                              disabled={updatingId === invoice.id}
                              className={`text-xs font-medium transition-colors disabled:opacity-50 ${
                                nextStatus === 'paid'
                                  ? 'text-green-600 hover:text-green-800'
                                  : nextStatus === 'cancelled'
                                  ? 'text-red-500 hover:text-red-700'
                                  : 'text-blue-600 hover:text-blue-800'
                              }`}
                            >
                              {nextStatus === 'sent' && 'Mark Sent'}
                              {nextStatus === 'paid' && 'Mark Paid'}
                              {nextStatus === 'overdue' && 'Mark Overdue'}
                              {nextStatus === 'cancelled' && 'Cancel'}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail panel */}
      {selectedInvoice && (
        <DetailPanel
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onStatusChange={handleStatusChange}
          onNotesChange={handleNotesChange}
          updatingId={updatingId}
        />
      )}

      {/* Generate modal */}
      {showGenerateModal && (
        <GenerateModal
          auctions={auctions}
          onClose={() => { setShowGenerateModal(false); setGenerateResult(null); }}
          onGenerate={handleGenerate}
          generating={generating}
          result={generateResult}
        />
      )}
    </div>
  );
}
