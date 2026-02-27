const STATUS_STYLES: Record<string, string> = {
  // Auction statuses
  draft: 'bg-gray-100 text-gray-700',
  preview: 'bg-blue-100 text-blue-700',
  live: 'bg-green-100 text-green-700',
  reconciliation: 'bg-yellow-100 text-yellow-700',
  archive: 'bg-gray-100 text-gray-500',
  // Lot statuses
  catalogued: 'bg-blue-100 text-blue-700',
  published: 'bg-indigo-100 text-indigo-700',
  active: 'bg-green-100 text-green-700',
  sold: 'bg-gold/20 text-gold-dark',
  passed: 'bg-red-100 text-red-700',
  withdrawn: 'bg-gray-100 text-gray-500',
  // Generic
  approved: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  rejected: 'bg-red-100 text-red-700',
  disabled: 'bg-red-100 text-red-700',
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${style} ${className}`}>
      {status === 'live' && (
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse" />
      )}
      {status.replace(/_/g, ' ')}
    </span>
  );
}
