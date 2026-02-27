'use client';

import { useState, useMemo } from 'react';

interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
  mobileHide?: boolean;
  mobilePrimary?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  pageSize?: number;
  keyField?: string;
  emptyMessage?: string;
}

export default function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  pageSize = 10,
  keyField = 'id',
  emptyMessage = 'No data found',
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
      return sortAsc ? cmp : -cmp;
    });
  }, [data, sortKey, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
    setPage(0);
  };

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-beige p-8 text-center text-taupe text-sm">
        {emptyMessage}
      </div>
    );
  }

  const pagination = totalPages > 1 && (
    <div className="flex items-center justify-between px-4 py-3 border-t border-beige">
      <p className="text-xs text-taupe">
        Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, sorted.length)} of {sorted.length}
      </p>
      <div className="flex gap-1">
        <button
          onClick={() => setPage(Math.max(0, page - 1))}
          disabled={page === 0}
          className="px-3 py-2 text-xs rounded border border-beige hover:bg-beige/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[44px]"
        >
          Previous
        </button>
        <button
          onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
          disabled={page >= totalPages - 1}
          className="px-3 py-2 text-xs rounded border border-beige hover:bg-beige/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[44px]"
        >
          Next
        </button>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-beige overflow-hidden">
      {/* Mobile card view (hidden on md+) */}
      <div className="md:hidden divide-y divide-beige/50">
        {paged.map((row, i) => (
          <div key={String(row[keyField] ?? i)} className="px-4 py-4 space-y-2">
            {columns.map((col) => {
              const value = col.render ? col.render(row) : String(row[col.key] ?? '');
              const isPrimary = col.mobilePrimary;
              return (
                <div
                  key={col.key}
                  className={isPrimary ? '' : 'flex items-start justify-between gap-2'}
                >
                  {isPrimary ? (
                    <div className="text-sm font-semibold text-dark-brown">{value}</div>
                  ) : (
                    <>
                      <span className="text-xs font-medium text-taupe uppercase tracking-wide shrink-0">
                        {col.label}
                      </span>
                      <span className="text-sm text-dark-brown text-right">{value}</span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Desktop table view (hidden below md) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-beige bg-cream/50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left text-xs font-semibold text-taupe uppercase tracking-wider ${
                    col.sortable ? 'cursor-pointer select-none hover:text-dark-brown' : ''
                  }`}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && sortKey === col.key && (
                      <svg className={`w-3.5 h-3.5 transition-transform ${sortAsc ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m5 15 7-7 7 7" />
                      </svg>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-beige/50">
            {paged.map((row, i) => (
              <tr key={String(row[keyField] ?? i)} className="hover:bg-cream/30 transition-colors">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-dark-brown">
                    {col.render ? col.render(row) : String(row[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination}
    </div>
  );
}
