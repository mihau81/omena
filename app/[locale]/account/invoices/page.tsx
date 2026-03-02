'use client';

import { useEffect, useState } from 'react';
import { apiUrl } from '@/app/lib/utils';
import { useCurrency } from '@/app/lib/CurrencyContext';

interface Invoice {
  id: string;
  invoiceNumber: string;
  auctionTitle: string;
  lotTitle: string;
  lotNumber: number;
  hammerPrice: number;
  buyersPremium: number;
  totalAmount: number;
  status: string;
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string;
}

export default function AccountInvoicesPage() {
  const { formatPrice } = useCurrency();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl('/api/me/invoices'))
      .then((res) => (res.ok ? res.json() : { invoices: [] }))
      .then((data) => setInvoices(data.invoices ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function formatDate(dateStr: string | null) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">Paid</span>;
      case 'overdue':
        return <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">Overdue</span>;
      case 'cancelled':
        return <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">Cancelled</span>;
      case 'sent':
        return <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">Sent</span>;
      default:
        return <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">Pending</span>;
    }
  };

  return (
    <div>
      <h1 className="font-serif text-3xl font-bold text-dark-brown md:text-4xl">Invoices</h1>
      <p className="mt-2 text-sm text-taupe">Your auction invoices and payment status.</p>

      {loading ? (
        <div className="mt-8 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="mt-8 text-center py-12">
          <p className="text-taupe">No invoices yet.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {invoices.map((inv) => (
            <div key={inv.id} className="rounded-xl border border-beige bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-dark-brown">{inv.invoiceNumber}</p>
                    {statusBadge(inv.status)}
                  </div>
                  <p className="mt-1 text-sm text-taupe">
                    {inv.lotTitle} — {inv.auctionTitle}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-taupe">
                    <span>Hammer: {formatPrice(inv.hammerPrice)}</span>
                    <span>Premium: {formatPrice(inv.buyersPremium)}</span>
                    {inv.dueDate && <span>Due: {formatDate(inv.dueDate)}</span>}
                    {inv.paidAt && <span>Paid: {formatDate(inv.paidAt)}</span>}
                  </div>
                </div>
                <div className="shrink-0 text-right space-y-2">
                  <p className="text-lg font-bold text-dark-brown">{formatPrice(inv.totalAmount)}</p>
                  <a
                    href={apiUrl(`/api/me/invoices/${inv.id}/pdf`)}
                    download
                    className="inline-flex items-center gap-1 text-xs text-taupe hover:text-dark-brown transition-colors"
                    title="Download PDF"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    PDF
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
