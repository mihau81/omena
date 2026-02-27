'use client';

import { useState, useEffect } from 'react';
import DynamicList from './DynamicList';

export interface LotFormData {
  title: string;
  artist: string;
  description: string;
  medium: string;
  dimensions: string;
  year: string;
  estimateMin: string;
  estimateMax: string;
  reservePrice: string;
  startingBid: string;
  visibilityOverride: string;
  provenance: string[];
  exhibitions: string[];
  literature: string[];
  conditionNotes: string;
  notes: string;
  consignorId: string;
}

interface ConsignorOption {
  id: string;
  name: string;
  companyName: string | null;
}

interface LotFormProps {
  initialData?: LotFormData;
  onSubmit: (data: LotFormData) => Promise<void>;
  submitLabel?: string;
  loading?: boolean;
}

const DEFAULT_DATA: LotFormData = {
  title: '',
  artist: '',
  description: '',
  medium: '',
  dimensions: '',
  year: '',
  estimateMin: '',
  estimateMax: '',
  reservePrice: '',
  startingBid: '',
  visibilityOverride: '',
  provenance: [],
  exhibitions: [],
  literature: [],
  conditionNotes: '',
  notes: '',
  consignorId: '',
};

export default function LotForm({
  initialData,
  onSubmit,
  submitLabel = 'Save',
  loading = false,
}: LotFormProps) {
  const [form, setForm] = useState<LotFormData>(initialData ?? DEFAULT_DATA);
  const [consignors, setConsignors] = useState<ConsignorOption[]>([]);

  useEffect(() => {
    fetch('/api/admin/consignors?isActive=true&limit=100')
      .then((r) => r.json())
      .then((d) => setConsignors(d.data ?? []))
      .catch(() => setConsignors([]));
  }, []);
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = 'Title is required';
    if (form.estimateMin && form.estimateMax) {
      const min = parseInt(form.estimateMin);
      const max = parseInt(form.estimateMax);
      if (!isNaN(min) && !isNaN(max) && min > max) {
        errs.estimateMax = 'Max estimate must be >= min estimate';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      await onSubmit(form);
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
      {/* Title + Artist */}
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
            placeholder="Artwork title"
          />
          {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title}</p>}
        </div>
        <div>
          <label htmlFor="artist" className={labelClass}>Artist</label>
          <input
            id="artist"
            name="artist"
            type="text"
            value={form.artist}
            onChange={handleChange}
            className={inputClass('artist')}
            placeholder="Artist name"
          />
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
          placeholder="Lot description..."
        />
      </div>

      {/* Medium + Dimensions + Year */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label htmlFor="medium" className={labelClass}>Medium</label>
          <input
            id="medium"
            name="medium"
            type="text"
            value={form.medium}
            onChange={handleChange}
            className={inputClass('medium')}
            placeholder="Oil on canvas"
          />
        </div>
        <div>
          <label htmlFor="dimensions" className={labelClass}>Dimensions</label>
          <input
            id="dimensions"
            name="dimensions"
            type="text"
            value={form.dimensions}
            onChange={handleChange}
            className={inputClass('dimensions')}
            placeholder="100 x 80 cm"
          />
        </div>
        <div>
          <label htmlFor="year" className={labelClass}>Year</label>
          <input
            id="year"
            name="year"
            type="number"
            value={form.year}
            onChange={handleChange}
            className={inputClass('year')}
            placeholder="2024"
          />
        </div>
      </div>

      {/* Estimates */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label htmlFor="estimateMin" className={labelClass}>Estimate Min (PLN)</label>
          <input
            id="estimateMin"
            name="estimateMin"
            type="number"
            value={form.estimateMin}
            onChange={handleChange}
            className={inputClass('estimateMin')}
            placeholder="0"
          />
        </div>
        <div>
          <label htmlFor="estimateMax" className={labelClass}>Estimate Max (PLN)</label>
          <input
            id="estimateMax"
            name="estimateMax"
            type="number"
            value={form.estimateMax}
            onChange={handleChange}
            className={inputClass('estimateMax')}
            placeholder="0"
          />
          {errors.estimateMax && <p className="mt-1 text-xs text-red-600">{errors.estimateMax}</p>}
        </div>
        <div>
          <label htmlFor="reservePrice" className={labelClass}>Reserve Price (PLN)</label>
          <input
            id="reservePrice"
            name="reservePrice"
            type="number"
            value={form.reservePrice}
            onChange={handleChange}
            className={inputClass('reservePrice')}
            placeholder="Optional"
          />
        </div>
        <div>
          <label htmlFor="startingBid" className={labelClass}>Starting Bid (PLN)</label>
          <input
            id="startingBid"
            name="startingBid"
            type="number"
            value={form.startingBid}
            onChange={handleChange}
            className={inputClass('startingBid')}
            placeholder="Optional"
          />
        </div>
      </div>

      {/* Visibility */}
      <div>
        <label className={labelClass}>Visibility Override</label>
        <div className="flex flex-wrap gap-2 mt-1">
          {([['', 'Inherit'], ['0', 'Public'], ['1', 'Private'], ['2', 'VIP']] as const).map(([val, label]) => (
            <label key={val} className="flex items-center gap-2 text-sm text-dark-brown cursor-pointer min-h-[44px] px-3 rounded-lg border border-beige hover:bg-cream/50 transition-colors">
              <input
                type="radio"
                name="visibilityOverride"
                value={val}
                checked={form.visibilityOverride === val}
                onChange={handleChange}
                className="text-gold focus:ring-gold"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* Provenance / Exhibitions / Literature */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <DynamicList
          label="Provenance"
          items={form.provenance}
          onChange={(items) => setForm((prev) => ({ ...prev, provenance: items }))}
          placeholder="Collection / gallery..."
        />
        <DynamicList
          label="Exhibitions"
          items={form.exhibitions}
          onChange={(items) => setForm((prev) => ({ ...prev, exhibitions: items }))}
          placeholder="Exhibition name, year..."
        />
        <DynamicList
          label="Literature"
          items={form.literature}
          onChange={(items) => setForm((prev) => ({ ...prev, literature: items }))}
          placeholder="Publication reference..."
        />
      </div>

      {/* Condition Notes */}
      <div>
        <label htmlFor="conditionNotes" className={labelClass}>Condition Notes</label>
        <textarea
          id="conditionNotes"
          name="conditionNotes"
          rows={3}
          value={form.conditionNotes}
          onChange={handleChange}
          className={inputClass('conditionNotes')}
          placeholder="Condition details..."
        />
      </div>

      {/* Internal Notes */}
      <div>
        <label htmlFor="notes" className={labelClass}>Internal Notes</label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          value={form.notes}
          onChange={handleChange}
          className={inputClass('notes')}
          placeholder="Internal notes (not visible to clients)..."
        />
      </div>

      {/* Consignor */}
      <div>
        <label htmlFor="consignorId" className={labelClass}>Consignor</label>
        <select
          id="consignorId"
          name="consignorId"
          value={form.consignorId}
          onChange={handleChange}
          className={inputClass('consignorId')}
        >
          <option value="">— No consignor —</option>
          {consignors.map((c) => (
            <option key={c.id} value={c.id}>
              {c.companyName ? `${c.name} (${c.companyName})` : c.name}
            </option>
          ))}
        </select>
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
