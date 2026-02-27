'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ConsignorForm from '../../components/ConsignorForm';
import ConfirmDialog from '../../components/ConfirmDialog';

interface ConsignorDetail {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  companyName: string | null;
  taxId: string | null;
  commissionRate: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lotCount: number;
  soldLotCount: number;
}

interface ConsignorLot {
  lotId: string;
  lotNumber: number;
  title: string;
  artist: string;
  status: string;
  estimateMin: number;
  estimateMax: number;
  hammerPrice: number | null;
  auctionId: string;
  auctionTitle: string;
  auctionSlug: string;
  createdAt: string;
}

export default function ConsignorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [consignor, setConsignor] = useState<ConsignorDetail | null>(null);
  const [lots, setLots] = useState<ConsignorLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchConsignor = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/consignors/${id}`);
      if (res.ok) {
        const data = await res.json();
        setConsignor(data.consignor);
        setLots(data.lots);
      } else if (res.status === 404) {
        router.push('/admin/consignors');
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchConsignor();
  }, [fetchConsignor]);

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/admin/consignors/${id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/admin/consignors');
      }
    } finally {
      setDeleteLoading(false);
      setDeleteOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/consignors" className="text-taupe hover:text-dark-brown transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
          </Link>
          <h1 className="text-2xl font-serif font-bold text-dark-brown">Loading...</h1>
        </div>
      </div>
    );
  }

  if (!consignor) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-taupe mb-2">
            <Link href="/admin/consignors" className="hover:text-dark-brown transition-colors">
              Consignors
            </Link>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
            <span className="text-dark-brown">{consignor.name}</span>
          </div>
          <h1 className="text-2xl font-serif font-bold text-dark-brown">{consignor.name}</h1>
          {consignor.companyName && (
            <p className="text-sm text-taupe mt-1">{consignor.companyName}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setDeleteOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-700 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
            Delete
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-beige p-4">
          <p className="text-xs text-taupe uppercase font-semibold">Status</p>
          <div className="mt-2">
            {consignor.isActive ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">Active</span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">Inactive</span>
            )}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-beige p-4">
          <p className="text-xs text-taupe uppercase font-semibold">Total Lots</p>
          <p className="mt-2 text-xl font-bold text-dark-brown">{consignor.lotCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-beige p-4">
          <p className="text-xs text-taupe uppercase font-semibold">Lots Sold</p>
          <p className="mt-2 text-xl font-bold text-dark-brown">{consignor.soldLotCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-beige p-4">
          <p className="text-xs text-taupe uppercase font-semibold">Commission</p>
          <p className="mt-2 text-xl font-bold text-dark-brown">
            {consignor.commissionRate
              ? `${(parseFloat(consignor.commissionRate) * 100).toFixed(0)}%`
              : '10%'}
          </p>
        </div>
      </div>

      {/* Form */}
      <ConsignorForm mode="edit" consignor={consignor} lots={lots} />

      {/* Meta info */}
      <div className="bg-white rounded-xl border border-beige p-4 text-xs text-taupe max-w-3xl">
        <p>Created: {new Date(consignor.createdAt).toLocaleString()}</p>
        <p>Last updated: {new Date(consignor.updatedAt).toLocaleString()}</p>
        {consignor.taxId && <p>NIP: {consignor.taxId}</p>}
        {consignor.email && <p>Email: {consignor.email}</p>}
        {consignor.phone && <p>Phone: {consignor.phone}</p>}
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Delete Consignor"
        message={`Are you sure you want to delete ${consignor.name}? This will soft-delete the consignor. Any lots assigned to them will retain the association but this consignor will no longer appear in lists.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
