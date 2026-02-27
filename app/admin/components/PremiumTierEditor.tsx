'use client';

import { useState, useCallback } from 'react';
import { calculatePremium, calculateFlatPremium, STANDARD_TIERS, formatRate } from '@/lib/premium';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TierDraft {
  minAmount: string;
  maxAmount: string; // empty string = unlimited
  rate: string;      // percentage string, e.g. "25"
}

interface PremiumTierEditorProps {
  auctionId: string;
  flatRate: number;        // decimal, e.g. 0.20
  initialTiers?: TierDraft[];
  onSaved?: (tiers: TierDraft[]) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPLN(amount: number): string {
  return amount.toLocaleString('pl-PL', { maximumFractionDigits: 0 }) + ' PLN';
}

function parseTierForCalc(tier: TierDraft) {
  const min = parseInt(tier.minAmount, 10);
  const max = tier.maxAmount.trim() === '' ? null : parseInt(tier.maxAmount, 10);
  const rate = parseFloat(tier.rate) / 100;
  return { minAmount: min, maxAmount: max, rate };
}

function tiersToApiPayload(tiers: TierDraft[]) {
  return tiers.map((t, idx) => ({
    minAmount: parseInt(t.minAmount, 10),
    maxAmount: t.maxAmount.trim() === '' ? null : parseInt(t.maxAmount, 10),
    rate: (parseFloat(t.rate) / 100).toFixed(4),
    sortOrder: idx,
  }));
}

function validateTiers(tiers: TierDraft[]): string | null {
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i];
    const min = parseInt(t.minAmount, 10);
    const rateNum = parseFloat(t.rate);

    if (isNaN(min) || min < 0) return `Tier ${i + 1}: min amount must be a non-negative number`;
    if (rateNum <= 0 || rateNum > 100) return `Tier ${i + 1}: rate must be between 0 and 100`;

    if (t.maxAmount.trim() !== '') {
      const max = parseInt(t.maxAmount, 10);
      if (isNaN(max) || max <= min) return `Tier ${i + 1}: max amount must be greater than min`;
    }
  }

  // Check contiguous ranges
  if (tiers.length > 1) {
    for (let i = 0; i < tiers.length - 1; i++) {
      const current = tiers[i];
      const next = tiers[i + 1];

      if (current.maxAmount.trim() === '') {
        return `Only the last tier can have unlimited max amount`;
      }
      const currentMax = parseInt(current.maxAmount, 10);
      const nextMin = parseInt(next.minAmount, 10);
      if (currentMax !== nextMin) {
        return `Tier ${i + 1} ends at ${currentMax} but tier ${i + 2} starts at ${nextMin} — ranges must be contiguous`;
      }
    }
  }

  return null;
}

const EMPTY_TIER: TierDraft = { minAmount: '0', maxAmount: '', rate: '20' };

// ─── Component ───────────────────────────────────────────────────────────────

export default function PremiumTierEditor({
  auctionId,
  flatRate,
  initialTiers = [],
  onSaved,
}: PremiumTierEditorProps) {
  const [tiers, setTiers] = useState<TierDraft[]>(initialTiers);
  const [previewPrice, setPreviewPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // ── Tier management ─────────────────────────────────────────────────────

  const addTier = useCallback(() => {
    setTiers((prev) => {
      if (prev.length === 0) {
        return [{ minAmount: '0', maxAmount: '', rate: '20' }];
      }
      const last = prev[prev.length - 1];
      const newMin = last.maxAmount.trim() === '' ? '' : last.maxAmount;
      return [...prev, { minAmount: newMin, maxAmount: '', rate: '20' }];
    });
    setValidationError(null);
  }, []);

  const removeTier = useCallback((index: number) => {
    setTiers((prev) => prev.filter((_, i) => i !== index));
    setValidationError(null);
  }, []);

  const updateTier = useCallback((index: number, field: keyof TierDraft, value: string) => {
    setTiers((prev) =>
      prev.map((tier, i) => (i === index ? { ...tier, [field]: value } : tier)),
    );
    setValidationError(null);
  }, []);

  const applyStandardTiers = useCallback(() => {
    setTiers(
      STANDARD_TIERS.map((t) => ({
        minAmount: String(t.minAmount),
        maxAmount: t.maxAmount !== null ? String(t.maxAmount) : '',
        rate: String(Math.round(t.rate * 100)),
      })),
    );
    setValidationError(null);
  }, []);

  const clearTiers = useCallback(() => {
    setTiers([]);
    setValidationError(null);
  }, []);

  // ── Save ────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    const err = validateTiers(tiers);
    if (err) {
      setValidationError(err);
      return;
    }
    setValidationError(null);
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const res = await fetch(`/api/admin/auctions/${auctionId}/premium-tiers`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tiers: tiersToApiPayload(tiers) }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to save tiers');
      }

      setSaveSuccess(true);
      onSaved?.(tiers);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  }, [auctionId, tiers, onSaved]);

  // ── Preview calculation ─────────────────────────────────────────────────

  const previewPriceNum = parseInt(previewPrice.replace(/\s/g, ''), 10);
  const hasValidPreview = !isNaN(previewPriceNum) && previewPriceNum > 0;

  let previewResult = null;
  if (hasValidPreview) {
    if (tiers.length > 0) {
      const err = validateTiers(tiers);
      if (!err) {
        previewResult = calculatePremium(previewPriceNum, tiers.map(parseTierForCalc));
      }
    } else {
      previewResult = calculateFlatPremium(previewPriceNum, flatRate);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  const inputCls =
    'w-full px-2.5 py-1.5 text-sm border border-beige rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold';

  return (
    <div className="space-y-4">
      {/* Header + action buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm text-taupe">
            {tiers.length === 0
              ? `Using flat rate: ${formatRate(flatRate)} on all amounts`
              : `${tiers.length} tier${tiers.length > 1 ? 's' : ''} configured`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={applyStandardTiers}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gold/50 text-gold hover:bg-gold/5 transition-colors"
          >
            Add standard tiers (25% / 20% / 12%)
          </button>
          <button
            type="button"
            onClick={addTier}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-beige text-dark-brown hover:bg-beige/50 transition-colors"
          >
            + Add tier
          </button>
          {tiers.length > 0 && (
            <button
              type="button"
              onClick={clearTiers}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
            >
              Clear all (use flat rate)
            </button>
          )}
        </div>
      </div>

      {/* Tier table */}
      {tiers.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-xs uppercase text-taupe border-b border-beige">
                <th className="pb-2 text-left font-medium pr-3">Min (PLN)</th>
                <th className="pb-2 text-left font-medium pr-3">Max (PLN)</th>
                <th className="pb-2 text-left font-medium pr-3">Rate (%)</th>
                <th className="pb-2 text-left font-medium w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-beige/50">
              {tiers.map((tier, idx) => (
                <tr key={idx}>
                  <td className="py-2 pr-3">
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={tier.minAmount}
                      onChange={(e) => updateTier(idx, 'minAmount', e.target.value)}
                      className={inputCls}
                      placeholder="0"
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={tier.maxAmount}
                      onChange={(e) => updateTier(idx, 'maxAmount', e.target.value)}
                      className={inputCls}
                      placeholder="unlimited"
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <div className="relative">
                      <input
                        type="number"
                        min={0.01}
                        max={100}
                        step={0.5}
                        value={tier.rate}
                        onChange={(e) => updateTier(idx, 'rate', e.target.value)}
                        className={inputCls + ' pr-6'}
                        placeholder="20"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-taupe pointer-events-none">
                        %
                      </span>
                    </div>
                  </td>
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => removeTier(idx)}
                      className="text-red-400 hover:text-red-600 transition-colors p-1"
                      title="Remove tier"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Validation error */}
      {validationError && (
        <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{validationError}</p>
      )}

      {/* Preview section */}
      <div className="bg-beige/30 rounded-lg p-4 space-y-3">
        <p className="text-xs font-medium text-dark-brown uppercase tracking-wide">Preview</p>
        <div className="flex gap-2 items-center">
          <div className="relative flex-1 max-w-xs">
            <input
              type="text"
              inputMode="numeric"
              value={previewPrice}
              onChange={(e) => setPreviewPrice(e.target.value.replace(/[^0-9\s]/g, ''))}
              placeholder="Enter hammer price..."
              className={inputCls}
            />
          </div>
          <span className="text-sm text-taupe shrink-0">PLN hammer</span>
        </div>

        {hasValidPreview && previewResult && (
          <div className="space-y-2">
            {previewResult.breakdown.map((item, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span className="text-taupe">
                  {item.range} @ {formatRate(item.rate)}
                </span>
                <span className="font-medium text-dark-brown">
                  {formatPLN(item.amount)}
                </span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-semibold border-t border-beige pt-2">
              <span className="text-dark-brown">Buyer&#39;s premium</span>
              <span className="text-gold">{formatPLN(previewResult.premium)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold border-t border-beige pt-2">
              <span className="text-dark-brown">Total payable</span>
              <span className="text-dark-brown">
                {formatPLN(previewPriceNum + previewResult.premium)}
              </span>
            </div>
          </div>
        )}

        {hasValidPreview && !previewResult && tiers.length > 0 && (
          <p className="text-xs text-amber-600">Fix tier errors above to see preview.</p>
        )}
      </div>

      {/* Save button + feedback */}
      <div className="flex items-center justify-between pt-2">
        <div className="text-sm">
          {saveError && <p className="text-red-600">{saveError}</p>}
          {saveSuccess && <p className="text-green-600">Tiers saved successfully.</p>}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gold text-white text-sm font-medium rounded-lg hover:bg-gold-dark transition-colors disabled:opacity-50"
        >
          {saving && (
            <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          Save tiers
        </button>
      </div>
    </div>
  );
}
