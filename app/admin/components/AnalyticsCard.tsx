interface TrendIndicator {
  direction: 'up' | 'down' | 'flat';
  label: string;
}

interface AnalyticsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: TrendIndicator;
  icon?: React.ReactNode;
}

function TrendIcon({ direction }: { direction: TrendIndicator['direction'] }) {
  if (direction === 'up') {
    return (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18" />
      </svg>
    );
  }
  if (direction === 'down') {
    return (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" />
      </svg>
    );
  }
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
    </svg>
  );
}

export default function AnalyticsCard({ title, value, subtitle, trend, icon }: AnalyticsCardProps) {
  const trendColorClass =
    trend?.direction === 'up'
      ? 'text-green-600 bg-green-50'
      : trend?.direction === 'down'
        ? 'text-red-600 bg-red-50'
        : 'text-taupe bg-beige';

  return (
    <div className="bg-white rounded-xl border border-beige p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-taupe leading-tight">{title}</p>
        {icon && (
          <div className="p-2 bg-gold/10 rounded-lg text-gold shrink-0">
            {icon}
          </div>
        )}
      </div>

      <div>
        <p className="text-2xl font-bold text-dark-brown tabular-nums">{value}</p>
        {subtitle && (
          <p className="text-xs text-taupe mt-0.5">{subtitle}</p>
        )}
      </div>

      {trend && (
        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium w-fit ${trendColorClass}`}>
          <TrendIcon direction={trend.direction} />
          {trend.label}
        </div>
      )}
    </div>
  );
}
