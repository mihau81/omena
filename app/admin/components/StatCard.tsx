interface StatCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  icon: React.ReactNode;
  trend?: { value: string; positive: boolean };
}

export default function StatCard({ label, value, sublabel, icon, trend }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-beige p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-taupe font-medium">{label}</p>
          <p className="text-2xl font-bold text-dark-brown mt-1">{value}</p>
          {sublabel && (
            <p className="text-xs text-taupe mt-1">{sublabel}</p>
          )}
          {trend && (
            <p className={`text-xs mt-1 font-medium ${trend.positive ? 'text-green-600' : 'text-red-600'}`}>
              {trend.positive ? '+' : ''}{trend.value}
            </p>
          )}
        </div>
        <div className="p-2.5 bg-gold/10 rounded-lg text-gold">
          {icon}
        </div>
      </div>
    </div>
  );
}
