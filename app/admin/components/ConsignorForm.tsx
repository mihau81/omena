'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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

interface ConsignorFormData {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  companyName: string;
  taxId: string;
  commissionRate: string;
  notes: string;
  isActive: boolean;
}

interface ConsignorFormProps {
  mode: 'create' | 'edit';
  consignor?: {
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
  };
  lots?: ConsignorLot[];
}

const DEFAULT_FORM: ConsignorFormData = {
  name: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  postalCode: '',
  country: 'Poland',
  companyName: '',
  taxId: '',
  commissionRate: '0.1000',
  notes: '',
  isActive: true,
};

function formatCommissionPercent(rate: string | null): string {
  if (!rate) return '10%';
  const pct = parseFloat(rate) * 100;
  return `${pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(2)}%`;
}

export default function ConsignorForm({ mode, consignor, lots = [] }: ConsignorFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<ConsignorFormData>(() => {
    if (!consignor) return DEFAULT_FORM;
    return {
      name: consignor.name,
      email: consignor.email ?? '',
      phone: consignor.phone ?? '',
      address: consignor.address ?? '',
      city: consignor.city ?? '',
      postalCode: consignor.postalCode ?? '',
      country: consignor.country ?? 'Poland',
      companyName: consignor.companyName ?? '',
      taxId: consignor.taxId ?? '',
      commissionRate: consignor.commissionRate ?? '0.1000',
      notes: consignor.notes ?? '',
      isActive: consignor.isActive,
    };
  });

  const handleChange = (field: keyof ConsignorFormData, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const url = mode === 'create'
        ? '/api/admin/consignors'
        : `/api/admin/consignors/${consignor?.id}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';

      const payload = {
        ...form,
        email: form.email || null,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Failed to save consignor');
        setSaving(false);
        return;
      }

      const saved = data.consignor;
      router.push(`/admin/consignors/${saved.id}`);
      router.refresh();
    } catch {
      setError('Network error');
      setSaving(false);
    }
  };

  const inputClass =
    'w-full px-3 py-2 text-sm border border-beige rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none bg-white';
  const labelClass = 'block text-xs font-semibold text-taupe uppercase mb-1';

  // Settlement summary for edit mode
  const soldLots = lots.filter((l) => l.status === 'sold');
  const totalHammer = soldLots.reduce((sum, l) => sum + (l.hammerPrice ?? 0), 0);
  const commissionRate = parseFloat(form.commissionRate) || 0.1;
  const totalCommission = Math.round(totalHammer * commissionRate);
  const totalDue = totalHammer - totalCommission;

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-beige p-6 max-w-3xl">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Name + Company */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              required
              className={inputClass}
              placeholder="Full name"
            />
          </div>
          <div>
            <label className={labelClass}>Company Name</label>
            <input
              type="text"
              value={form.companyName}
              onChange={(e) => handleChange('companyName', e.target.value)}
              className={inputClass}
              placeholder="Company or gallery name"
            />
          </div>
        </div>

        {/* Email + Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <div>
            <label className={labelClass}>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              className={inputClass}
              placeholder="email@example.com"
            />
          </div>
          <div>
            <label className={labelClass}>Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              className={inputClass}
              placeholder="+48 000 000 000"
            />
          </div>
        </div>

        {/* Tax ID + Commission Rate */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <div>
            <label className={labelClass}>NIP / Tax ID</label>
            <input
              type="text"
              value={form.taxId}
              onChange={(e) => handleChange('taxId', e.target.value)}
              className={inputClass}
              placeholder="0000000000"
            />
          </div>
          <div>
            <label className={labelClass}>Commission Rate</label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="1"
                step="0.0001"
                value={form.commissionRate}
                onChange={(e) => handleChange('commissionRate', e.target.value)}
                className={inputClass}
                placeholder="0.1000"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-taupe pointer-events-none">
                = {formatCommissionPercent(form.commissionRate)}
              </span>
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="mt-4">
          <label className={labelClass}>Address</label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => handleChange('address', e.target.value)}
            className={inputClass}
            placeholder="Street and number"
          />
        </div>

        {/* City + Postal Code + Country */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          <div>
            <label className={labelClass}>City</label>
            <input
              type="text"
              value={form.city}
              onChange={(e) => handleChange('city', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Postal Code</label>
            <input
              type="text"
              value={form.postalCode}
              onChange={(e) => handleChange('postalCode', e.target.value)}
              className={inputClass}
              placeholder="00-000"
            />
          </div>
          <div>
            <label className={labelClass}>Country</label>
            <input
              type="text"
              value={form.country}
              onChange={(e) => handleChange('country', e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {/* Notes */}
        <div className="mt-4">
          <label className={labelClass}>Internal Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            rows={3}
            className={inputClass + ' resize-y'}
            placeholder="Private notes about this consignor..."
          />
        </div>

        {/* Active toggle */}
        <div className="mt-4 flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => handleChange('isActive', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-10 h-5 bg-beige rounded-full peer peer-checked:bg-gold transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-transform peer-checked:after:translate-x-5" />
          </label>
          <span className="text-sm text-dark-brown">Active consignor</span>
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center gap-3 pt-4 border-t border-beige">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 text-sm font-medium bg-gold text-white rounded-lg hover:bg-gold-dark transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : mode === 'create' ? 'Create Consignor' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-5 py-2.5 text-sm font-medium text-taupe bg-beige/50 rounded-lg hover:bg-beige transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>

      {/* Consigned Lots Table (edit mode only) */}
      {mode === 'edit' && lots.length > 0 && (
        <div className="bg-white rounded-xl border border-beige overflow-hidden max-w-3xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-beige">
            <h2 className="text-lg font-serif font-semibold text-dark-brown">Consigned Lots</h2>
            <span className="text-sm text-taupe">{lots.length} total</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-beige bg-cream/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase">Lot</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase">Auction</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-taupe uppercase">Estimate</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-taupe uppercase">Hammer</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-taupe uppercase">Commission</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-beige/50">
                {lots.map((lot) => {
                  const hammer = lot.hammerPrice;
                  const commission = hammer ? Math.round(hammer * commissionRate) : null;
                  return (
                    <tr key={lot.lotId} className="hover:bg-cream/30 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/auctions/${lot.auctionId}/lots/${lot.lotId}`}
                          className="font-medium text-dark-brown hover:text-gold transition-colors"
                        >
                          #{lot.lotNumber} {lot.title}
                        </Link>
                        {lot.artist && (
                          <p className="text-xs text-taupe mt-0.5">{lot.artist}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-taupe text-xs">{lot.auctionTitle}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          lot.status === 'sold'
                            ? 'bg-green-100 text-green-700'
                            : lot.status === 'passed'
                            ? 'bg-red-100 text-red-700'
                            : lot.status === 'active'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-beige text-taupe'
                        }`}>
                          {lot.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-taupe">
                        {lot.estimateMin.toLocaleString()}–{lot.estimateMax.toLocaleString()} PLN
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-dark-brown">
                        {hammer ? `${hammer.toLocaleString()} PLN` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-taupe">
                        {commission ? `${commission.toLocaleString()} PLN` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Settlement Summary */}
          {soldLots.length > 0 && (
            <div className="px-6 py-4 bg-cream/30 border-t border-beige">
              <h3 className="text-xs font-semibold text-taupe uppercase mb-3">Settlement Summary</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-taupe">Lots Sold</p>
                  <p className="text-lg font-bold text-dark-brown mt-0.5">{soldLots.length}</p>
                </div>
                <div>
                  <p className="text-xs text-taupe">Total Hammer</p>
                  <p className="text-lg font-bold text-dark-brown mt-0.5">
                    {totalHammer.toLocaleString()} PLN
                  </p>
                </div>
                <div>
                  <p className="text-xs text-taupe">
                    Commission ({formatCommissionPercent(form.commissionRate)})
                  </p>
                  <p className="text-lg font-bold text-red-600 mt-0.5">
                    -{totalCommission.toLocaleString()} PLN
                  </p>
                </div>
                <div>
                  <p className="text-xs text-taupe">Due to Consignor</p>
                  <p className="text-lg font-bold text-green-700 mt-0.5">
                    {totalDue.toLocaleString()} PLN
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {mode === 'edit' && lots.length === 0 && (
        <div className="bg-white rounded-xl border border-beige p-6 max-w-3xl text-sm text-taupe text-center">
          No lots have been assigned to this consignor yet.
        </div>
      )}
    </div>
  );
}
