'use client';

import Link from 'next/link';
import ConsignorForm from '../../../admin/components/ConsignorForm';

export default function NewConsignorPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/consignors"
          className="text-taupe hover:text-dark-brown transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
        </Link>
        <div>
          <div className="flex items-center gap-2 text-sm text-taupe mb-1">
            <Link href="/admin/consignors" className="hover:text-dark-brown transition-colors">
              Consignors
            </Link>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
            <span className="text-dark-brown">New Consignor</span>
          </div>
          <h1 className="text-2xl font-serif font-bold text-dark-brown">New Consignor</h1>
        </div>
      </div>

      <ConsignorForm mode="create" />
    </div>
  );
}
