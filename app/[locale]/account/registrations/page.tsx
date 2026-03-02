'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiUrl } from '@/app/lib/utils';
import { useLocale } from '@/app/lib/LocaleContext';

interface Registration {
  id: string;
  auctionId: string;
  auctionTitle: string;
  auctionSlug: string;
  auctionStartDate: string;
  paddleNumber: number | null;
  depositPaid: boolean;
  approvedAt: string | null;
  notes: string | null;
  createdAt: string;
  status: 'approved' | 'rejected' | 'pending';
}

export default function AccountRegistrationsPage() {
  const { locale } = useLocale();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl('/api/me/registrations'))
      .then((res) => (res.ok ? res.json() : { registrations: [] }))
      .then((data) => setRegistrations(data.registrations ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">Approved</span>;
      case 'rejected':
        return <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">Rejected</span>;
      default:
        return <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">Pending</span>;
    }
  };

  return (
    <div>
      <h1 className="font-serif text-3xl font-bold text-dark-brown md:text-4xl">Registrations</h1>
      <p className="mt-2 text-sm text-taupe">Your auction paddle registrations.</p>

      {loading ? (
        <div className="mt-8 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
        </div>
      ) : registrations.length === 0 ? (
        <div className="mt-8 text-center py-12">
          <p className="text-taupe">No registrations yet.</p>
          <Link href={`/${locale}/auctions`} className="mt-3 inline-block text-sm text-gold hover:underline">
            Browse auctions
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {registrations.map((reg) => (
            <div key={reg.id} className="rounded-xl border border-beige bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/${locale}/auctions/${reg.auctionSlug}`}
                    className="font-serif text-base font-bold text-dark-brown hover:text-gold"
                  >
                    {reg.auctionTitle}
                  </Link>
                  <p className="mt-1 text-xs text-taupe">{formatDate(reg.auctionStartDate)}</p>
                  {reg.paddleNumber && (
                    <p className="mt-2 text-sm">
                      <span className="text-taupe">Paddle: </span>
                      <span className="font-bold text-dark-brown">#{reg.paddleNumber}</span>
                    </p>
                  )}
                  {reg.notes && (
                    <p className="mt-1 text-xs text-red-600">{reg.notes}</p>
                  )}
                </div>
                <div className="shrink-0 text-right space-y-2">
                  {statusBadge(reg.status)}
                  {reg.status === 'approved' && (
                    <p className="text-xs text-taupe">
                      {reg.depositPaid ? (
                        <span className="text-green-600">Deposit paid</span>
                      ) : (
                        <span className="text-orange-600">Deposit pending</span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
