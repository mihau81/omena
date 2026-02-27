'use client';

interface AuditDiffProps {
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  changedFields: string[] | null;
  action: string;
}

export default function AuditDiff({ oldData, newData, changedFields, action }: AuditDiffProps) {
  if (action === 'INSERT' && newData) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Created record</p>
        <DataGrid data={newData} highlightKeys={null} variant="new" />
      </div>
    );
  }

  if (action === 'DELETE' && oldData) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">Deleted record</p>
        <DataGrid data={oldData} highlightKeys={null} variant="old" />
      </div>
    );
  }

  if (action === 'UPDATE') {
    const allKeys = Array.from(new Set([
      ...Object.keys(oldData ?? {}),
      ...Object.keys(newData ?? {}),
    ])).sort();

    const changed = new Set(changedFields ?? allKeys);

    return (
      <div className="space-y-3">
        <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
          {changed.size} field{changed.size !== 1 ? 's' : ''} changed
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border border-beige rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-cream/50">
                <th className="px-3 py-2 text-left font-semibold text-taupe w-1/4">Field</th>
                <th className="px-3 py-2 text-left font-semibold text-taupe w-[37.5%]">Before</th>
                <th className="px-3 py-2 text-left font-semibold text-taupe w-[37.5%]">After</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-beige/50">
              {allKeys.filter((k) => changed.has(k)).map((key) => {
                const before = oldData?.[key];
                const after = newData?.[key];
                return (
                  <tr key={key} className="bg-amber-50/30">
                    <td className="px-3 py-2 font-mono text-taupe font-medium">{key}</td>
                    <td className="px-3 py-2 font-mono text-red-700 bg-red-50/50 max-w-xs">
                      <TruncatedValue value={before} />
                    </td>
                    <td className="px-3 py-2 font-mono text-green-700 bg-green-50/50 max-w-xs">
                      <TruncatedValue value={after} />
                    </td>
                  </tr>
                );
              })}
              {allKeys.filter((k) => !changed.has(k)).map((key) => {
                const val = newData?.[key] ?? oldData?.[key];
                return (
                  <tr key={key} className="opacity-50">
                    <td className="px-3 py-2 font-mono text-taupe">{key}</td>
                    <td className="px-3 py-2 font-mono text-taupe" colSpan={2}>
                      <TruncatedValue value={val} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return <p className="text-xs text-taupe italic">No data available</p>;
}

function DataGrid({
  data,
  highlightKeys,
  variant,
}: {
  data: Record<string, unknown>;
  highlightKeys: Set<string> | null;
  variant: 'old' | 'new';
}) {
  const colorClass = variant === 'new' ? 'text-green-700 bg-green-50/50' : 'text-red-700 bg-red-50/50';

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border border-beige rounded-lg overflow-hidden">
        <tbody className="divide-y divide-beige/50">
          {Object.entries(data).map(([key, val]) => (
            <tr key={key} className={highlightKeys?.has(key) ? colorClass : ''}>
              <td className="px-3 py-2 font-mono text-taupe font-medium w-1/4">{key}</td>
              <td className={`px-3 py-2 font-mono ${colorClass}`}>
                <TruncatedValue value={val} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TruncatedValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="italic opacity-50">null</span>;
  }
  if (typeof value === 'object') {
    const str = JSON.stringify(value);
    const truncated = str.length > 200 ? str.slice(0, 200) + '…' : str;
    return <span title={str}>{truncated}</span>;
  }
  const str = String(value);
  const truncated = str.length > 200 ? str.slice(0, 200) + '…' : str;
  return <span title={str}>{truncated}</span>;
}
