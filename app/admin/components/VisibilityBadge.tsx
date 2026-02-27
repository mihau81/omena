const VISIBILITY_STYLES: Record<string, { bg: string; label: string }> = {
  '0': { bg: 'bg-green-100 text-green-700', label: 'Public' },
  '1': { bg: 'bg-blue-100 text-blue-700', label: 'Private' },
  '2': { bg: 'bg-purple-100 text-purple-700', label: 'VIP' },
};

interface VisibilityBadgeProps {
  level: string;
  className?: string;
}

export default function VisibilityBadge({ level, className = '' }: VisibilityBadgeProps) {
  const style = VISIBILITY_STYLES[level] ?? VISIBILITY_STYLES['0'];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${className}`}>
      {style.label}
    </span>
  );
}
