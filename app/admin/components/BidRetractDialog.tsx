'use client';

import { useState } from 'react';

interface BidRetractDialogProps {
  open: boolean;
  bidId: string;
  bidAmount: number;
  bidType: string;
  onRetracted: () => void;
  onCancel: () => void;
}

export default function BidRetractDialog({
  open,
  bidId,
  bidAmount,
  bidType,
  onRetracted,
  onCancel,
}: BidRetractDialogProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Reason is required');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/bids/${bidId}/retract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Failed to retract bid');
        return;
      }

      setReason('');
      onRetracted();
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (loading) return;
    setReason('');
    setError(null);
    onCancel();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={handleCancel} />
      <div className="relative bg-white rounded-xl shadow-lg max-w-md w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-dark-brown">Retract Bid</h3>
        <p className="mt-1 text-sm text-taupe">
          Retracting{' '}
          <span className="font-medium text-dark-brown">
            {bidAmount.toLocaleString('pl-PL')} PLN
          </span>{' '}
          <span className="capitalize">({bidType})</span> bid. This cannot be undone.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-brown mb-1">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason for retraction..."
              rows={3}
              className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:outline-none focus:ring-1 focus:ring-gold focus:border-gold resize-none"
              autoFocus
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-taupe bg-beige/50 hover:bg-beige rounded-lg transition-colors disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !reason.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-60"
            >
              {loading ? 'Retracting...' : 'Retract Bid'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
