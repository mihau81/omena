'use client';

import { useState } from 'react';
import ConfirmDialog from './ConfirmDialog';

interface StatusTransition {
  from: string;
  to: string;
  label: string;
  confirmMessage: string;
  style: string;
}

const TRANSITIONS: StatusTransition[] = [
  {
    from: 'draft',
    to: 'catalogued',
    label: 'Mark Catalogued',
    confirmMessage: 'This marks the lot data as complete and ready for review.',
    style: 'bg-blue-600 hover:bg-blue-700 text-white',
  },
  {
    from: 'catalogued',
    to: 'published',
    label: 'Publish',
    confirmMessage: 'This will make the lot visible per its visibility settings.',
    style: 'bg-indigo-600 hover:bg-indigo-700 text-white',
  },
  {
    from: 'published',
    to: 'active',
    label: 'Activate Bidding',
    confirmMessage: 'This will open the lot for bidding.',
    style: 'bg-green-600 hover:bg-green-700 text-white',
  },
  {
    from: 'active',
    to: 'sold',
    label: 'Mark Sold',
    confirmMessage: 'This will mark the lot as sold at the hammer price.',
    style: 'bg-gold hover:bg-gold-dark text-white',
  },
  {
    from: 'active',
    to: 'passed',
    label: 'Mark Passed',
    confirmMessage: 'This will mark the lot as passed (no sale).',
    style: 'bg-red-600 hover:bg-red-700 text-white',
  },
  {
    from: 'published',
    to: 'withdrawn',
    label: 'Withdraw',
    confirmMessage: 'This will withdraw the lot from the auction.',
    style: 'bg-gray-600 hover:bg-gray-700 text-white',
  },
  {
    from: 'active',
    to: 'withdrawn',
    label: 'Withdraw',
    confirmMessage: 'This will withdraw the lot from the active auction. Any bids will remain on record.',
    style: 'bg-gray-600 hover:bg-gray-700 text-white',
  },
  {
    from: 'catalogued',
    to: 'draft',
    label: 'Back to Draft',
    confirmMessage: 'This will move the lot back to draft status for further editing.',
    style: 'bg-gray-500 hover:bg-gray-600 text-white',
  },
  {
    from: 'passed',
    to: 'active',
    label: 'Reactivate',
    confirmMessage: 'This will reopen the lot for bidding.',
    style: 'bg-green-600 hover:bg-green-700 text-white',
  },
];

interface LotStatusWorkflowProps {
  currentStatus: string;
  onStatusChange: (newStatus: string) => void;
  loading?: boolean;
}

export default function LotStatusWorkflow({
  currentStatus,
  onStatusChange,
  loading = false,
}: LotStatusWorkflowProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingTransition, setPendingTransition] = useState<StatusTransition | null>(null);

  const available = TRANSITIONS.filter((t) => t.from === currentStatus);
  if (available.length === 0) return null;

  const handleClick = (transition: StatusTransition) => {
    setPendingTransition(transition);
    setConfirmOpen(true);
  };

  const handleConfirm = () => {
    setConfirmOpen(false);
    if (pendingTransition) {
      onStatusChange(pendingTransition.to);
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {available.map((t) => (
          <button
            key={t.to}
            onClick={() => handleClick(t)}
            disabled={loading}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${t.style}`}
          >
            {loading ? (
              <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            )}
            {t.label}
          </button>
        ))}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={pendingTransition ? `${pendingTransition.label}?` : ''}
        message={pendingTransition?.confirmMessage ?? ''}
        confirmLabel={pendingTransition?.label ?? 'Confirm'}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
