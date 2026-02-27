'use client';

import { useState } from 'react';
import ConfirmDialog from './ConfirmDialog';

interface StatusTransition {
  from: string;
  to: string;
  label: string;
  confirmMessage: string;
}

const TRANSITIONS: StatusTransition[] = [
  {
    from: 'draft',
    to: 'preview',
    label: 'Publish Preview',
    confirmMessage: 'This will make the auction catalog visible to eligible users. Bidding will not yet be open.',
  },
  {
    from: 'preview',
    to: 'live',
    label: 'Go Live',
    confirmMessage: 'This will open bidding for this auction. Make sure all lots are ready.',
  },
  {
    from: 'live',
    to: 'reconciliation',
    label: 'Close Bidding',
    confirmMessage: 'This will close all bidding for this auction. No more bids will be accepted.',
  },
  {
    from: 'reconciliation',
    to: 'archive',
    label: 'Archive',
    confirmMessage: 'This will archive the auction. This action is final — the auction will become read-only.',
  },
];

const STATUS_BUTTON_STYLES: Record<string, string> = {
  preview: 'bg-blue-600 hover:bg-blue-700 text-white',
  live: 'bg-green-600 hover:bg-green-700 text-white',
  reconciliation: 'bg-yellow-600 hover:bg-yellow-700 text-white',
  archive: 'bg-gray-600 hover:bg-gray-700 text-white',
};

interface StatusWorkflowProps {
  currentStatus: string;
  auctionId: string;
  onStatusChange: (newStatus: string) => void;
  loading?: boolean;
}

export default function StatusWorkflow({
  currentStatus,
  auctionId,
  onStatusChange,
  loading = false,
}: StatusWorkflowProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingTransition, setPendingTransition] = useState<StatusTransition | null>(null);

  const transition = TRANSITIONS.find((t) => t.from === currentStatus);
  if (!transition) return null;

  const handleClick = () => {
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
      <button
        onClick={handleClick}
        disabled={loading}
        className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
          STATUS_BUTTON_STYLES[transition.to] ?? 'bg-gray-600 hover:bg-gray-700 text-white'
        }`}
      >
        {loading ? (
          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
          </svg>
        )}
        {transition.label}
      </button>

      <ConfirmDialog
        open={confirmOpen}
        title={`${transition.label}?`}
        message={transition.confirmMessage}
        confirmLabel={transition.label}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
