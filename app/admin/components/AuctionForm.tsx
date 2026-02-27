'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { TierDraft } from './PremiumTierEditor';

const PremiumTierEditor = dynamic(() => import('./PremiumTierEditor'), { ssr: false });

interface AuctionFormData {
  title: string;
  slug: string;
  description: string;
  category: string;
  startDate: string;
  endDate: string;
  location: string;
  curator: string;
  visibilityLevel: '0' | '1' | '2';
  buyersPremiumRate: string;
  notes: string;
}

interface AuctionFormProps {
  auctionId?: string;           // Present when editing an existing auction
  initialData?: AuctionFormData;
  initialTiers?: TierDraft[];   // Pre-loaded premium tiers (edit mode only)
  onSubmit: (data: AuctionFormData) => Promise<void>;
  submitLabel?: string;
  loading?: boolean;
}

const CATEGORIES = [
  'mixed', 'contemporary', 'modern', 'old-masters', 'photography',
  'sculpture', 'prints', 'decorative-arts', 'jewelry', 'other',
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ąàáâãäå]/g, 'a')
    .replace(/[ćčç]/g, 'c')
    .replace(/[ęèéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[łľ]/g, 'l')
    .replace(/[ńñ]/g, 'n')
    .replace(/[óòôõö]/g, 'o')
    .replace(/[śšş]/g, 's')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[ýÿ]/g, 'y')
    .replace(/[źżž]/g, 'z')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function toDatetimeLocal(isoString: string): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(value: string): string {
  if (!value) return '';
  return new Date(value).toISOString();
}

const DEFAULT_DATA: AuctionFormData = {
  title: '',
  slug: '',
  description: '',
  category: 'mixed',
  startDate: '',
  endDate: '',
  location: '',
  curator: '',
  visibilityLevel: '0',
  buyersPremiumRate: '0.2000',
  notes: '',
};

export default function AuctionForm({
  auctionId,
  initialData,
  initialTiers,
  onSubmit,
  submitLabel = 'Save',
  loading = false,
}: AuctionFormProps) {
  const [form, setForm] = useState<AuctionFormData>(initialData ?? DEFAULT_DATA);
  const [slugManual, setSlugManual] = useState(!!initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Auto-generate slug from title
  useEffect(() => {
    if (!slugManual && form.title) {
      setForm((prev) => ({ ...prev, slug: slugify(prev.title) }));
    }
  }, [form.title, slugManual]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSlugManual(true);
    setForm((prev) => ({ ...prev, slug: e.target.value }));
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = 'Title is required';
    if (!form.slug.trim()) errs.slug = 'Slug is required';
    else if (!/^[a-z0-9-]+$/.test(form.slug)) errs.slug = 'Slug must be lowercase alphanumeric with hyphens';
    if (!form.startDate) errs.startDate = 'Start date is required';
    if (!form.endDate) errs.endDate = 'End date is required';
    if (form.startDate && form.endDate && new Date(form.startDate) >= new Date(form.endDate)) {
      errs.endDate = 'End date must be after start date';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const submissionData: AuctionFormData = {
      ...form,
      startDate: fromDatetimeLocal(form.startDate),
      endDate: fromDatetimeLocal(form.endDate),
    };

    try {
      await onSubmit(submissionData);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'fieldErrors' in err) {
        const fieldErrors = (err as { fieldErrors: Record<string, string[]> }).fieldErrors;
        const mapped: Record<string, string> = {};
        for (const [key, msgs] of Object.entries(fieldErrors)) {
          if (msgs.length > 0) mapped[key] = msgs[0];
        }
        setErrors(mapped);
      }
    }
  };

  const inputClass = (field: string) =>
    `w-full px-3 py-2.5 text-sm min-h-[44px] border rounded-lg bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold ${
      errors[field] ? 'border-red-400' : 'border-beige'
    }`;

  const labelClass = 'block text-sm font-medium text-dark-brown mb-1';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Title + Slug */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="title" className={labelClass}>Title *</label>
          <input
            id="title"
            name="title"
            type="text"
            value={form.title}
            onChange={handleChange}
            className={inputClass('title')}
            placeholder="Spring Contemporary Art Auction"
          />
          {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title}</p>}
        </div>
        <div>
          <label htmlFor="slug" className={labelClass}>
            Slug *
            {!slugManual && <span className="text-xs text-taupe ml-1">(auto-generated)</span>}
          </label>
          <input
            id="slug"
            name="slug"
            type="text"
            value={form.slug}
            onChange={handleSlugChange}
            className={inputClass('slug')}
            placeholder="spring-contemporary-art-auction"
          />
          {errors.slug && <p className="mt-1 text-xs text-red-600">{errors.slug}</p>}
        </div>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className={labelClass}>Description</label>
        <textarea
          id="description"
          name="description"
          rows={4}
          value={form.description}
          onChange={handleChange}
          className={inputClass('description')}
          placeholder="Auction description..."
        />
      </div>

      {/* Category + Visibility */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="category" className={labelClass}>Category</label>
          <select
            id="category"
            name="category"
            value={form.category}
            onChange={handleChange}
            className={inputClass('category')}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Visibility</label>
          <div className="flex flex-wrap gap-2 mt-2">
            {([['0', 'Public'], ['1', 'Private'], ['2', 'VIP']] as const).map(([val, label]) => (
              <label key={val} className="flex items-center gap-2 text-sm text-dark-brown cursor-pointer min-h-[44px] px-3 rounded-lg border border-beige hover:bg-cream/50 transition-colors">
                <input
                  type="radio"
                  name="visibilityLevel"
                  value={val}
                  checked={form.visibilityLevel === val}
                  onChange={handleChange}
                  className="text-gold focus:ring-gold"
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="startDate" className={labelClass}>Start Date *</label>
          <input
            id="startDate"
            name="startDate"
            type="datetime-local"
            value={form.startDate}
            onChange={handleChange}
            className={inputClass('startDate')}
          />
          {errors.startDate && <p className="mt-1 text-xs text-red-600">{errors.startDate}</p>}
        </div>
        <div>
          <label htmlFor="endDate" className={labelClass}>End Date *</label>
          <input
            id="endDate"
            name="endDate"
            type="datetime-local"
            value={form.endDate}
            onChange={handleChange}
            className={inputClass('endDate')}
          />
          {errors.endDate && <p className="mt-1 text-xs text-red-600">{errors.endDate}</p>}
        </div>
      </div>

      {/* Location + Curator */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="location" className={labelClass}>Location</label>
          <input
            id="location"
            name="location"
            type="text"
            value={form.location}
            onChange={handleChange}
            className={inputClass('location')}
            placeholder="Warsaw, Poland"
          />
        </div>
        <div>
          <label htmlFor="curator" className={labelClass}>Curator</label>
          <input
            id="curator"
            name="curator"
            type="text"
            value={form.curator}
            onChange={handleChange}
            className={inputClass('curator')}
            placeholder="Curator name"
          />
        </div>
      </div>

      {/* Buyer's Premium */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="buyersPremiumRate" className={labelClass}>
              Flat Buyer&#39;s Premium Rate
              <span className="ml-1 text-xs text-taupe font-normal">(fallback when no tiers set)</span>
            </label>
            <div className="relative">
              <input
                id="buyersPremiumRate"
                name="buyersPremiumRate"
                type="text"
                value={form.buyersPremiumRate}
                onChange={handleChange}
                className={inputClass('buyersPremiumRate')}
                placeholder="0.2000"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-taupe">
                ({(parseFloat(form.buyersPremiumRate || '0') * 100).toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>

        {/* Sliding-scale tier editor — only available after auction is created */}
        {auctionId ? (
          <div className="border border-beige rounded-lg p-4 space-y-3">
            <div>
              <h4 className="text-sm font-medium text-dark-brown">
                Sliding-Scale Premium Tiers
              </h4>
              <p className="text-xs text-taupe mt-0.5">
                Configure bracket-based rates. If tiers are set, they override the flat rate above.
              </p>
            </div>
            <PremiumTierEditor
              auctionId={auctionId}
              flatRate={parseFloat(form.buyersPremiumRate || '0.2000')}
              initialTiers={initialTiers}
            />
          </div>
        ) : (
          <p className="text-xs text-taupe italic">
            Save the auction first to configure sliding-scale premium tiers.
          </p>
        )}
      </div>

      {/* Internal Notes */}
      <div>
        <label htmlFor="notes" className={labelClass}>Internal Notes</label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          value={form.notes}
          onChange={handleChange}
          className={inputClass('notes')}
          placeholder="Internal notes (not visible to clients)..."
        />
      </div>

      {/* Submit */}
      <div className="flex flex-col sm:flex-row justify-end pt-4 border-t border-beige gap-3">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-3 sm:py-2.5 min-h-[44px] bg-gold text-white text-sm font-medium rounded-lg hover:bg-gold-dark transition-colors disabled:opacity-50"
        >
          {loading && (
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

export type { AuctionFormData };
