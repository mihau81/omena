'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AuditLogFilters from '../components/AuditLogFilters';
import AuditDiff from '../components/AuditDiff';

interface AuditEntry {
  id: number;
  tableName: string;
  recordId: string;
  action: string;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  changedFields: string[] | null;
  performedBy: string | null;
  performedByType: string | null;
  ipAddress: string | null;
  createdAt: string;
}

interface PaginatedAuditLog {
  data: AuditEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface Filters {
  tableName: string;
  action: string;
  performedBy: string;
  recordId: string;
  dateFrom: string;
  dateTo: string;
}

interface AuditLogClientProps {
  initialData: PaginatedAuditLog;
  filters: Filters;
}

const ACTION_COLORS: Record<string, string> = {
  INSERT: 'bg-green-100 text-green-700',
  UPDATE: 'bg-amber-100 text-amber-700',
  DELETE: 'bg-red-100 text-red-700',
};

export default function AuditLogClient({ initialData, filters }: AuditLogClientProps) {
  const router = useRouter();
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const toggleRow = (id: number) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const goToPage = (page: number) => {
    const params = new URLSearchParams();
    if (filters.tableName) params.set('tableName', filters.tableName);
    if (filters.action) params.set('action', filters.action);
    if (filters.performedBy) params.set('performedBy', filters.performedBy);
    if (filters.recordId) params.set('recordId', filters.recordId);
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    if (page > 1) params.set('page', String(page));
    const qs = params.toString();
    router.push(`/admin/audit-log${qs ? `?${qs}` : ''}`);
  };

  const exportCsv = () => {
    const headers = ['ID', 'Timestamp', 'Table', 'Action', 'Record ID', 'Actor ID', 'Actor type', 'IP Address', 'Changed fields'];
    const rows = initialData.data.map((entry) => [
      String(entry.id),
      entry.createdAt,
      entry.tableName,
      entry.action,
      entry.recordId,
      entry.performedBy ?? '',
      entry.performedByType ?? '',
      entry.ipAddress ?? '',
      (entry.changedFields ?? []).join('; '),
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-dark-brown">Audit Log</h1>
          <p className="text-sm text-taupe mt-1">
            {initialData.total.toLocaleString()} entries
            {(filters.tableName || filters.action || filters.performedBy || filters.recordId || filters.dateFrom || filters.dateTo) && ' (filtered)'}
          </p>
        </div>
        <button
          onClick={exportCsv}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-dark-brown text-sm font-medium rounded-lg border border-beige hover:bg-beige/30 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <AuditLogFilters {...filters} />

      {/* Table */}
      <div className="bg-white rounded-xl border border-beige overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-beige bg-cream/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase tracking-wider w-8"></th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase tracking-wider">Timestamp</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase tracking-wider">Table</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase tracking-wider">Action</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase tracking-wider">Record ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase tracking-wider">Actor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase tracking-wider">Changed fields</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-beige/50">
              {initialData.data.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-taupe">
                    No audit log entries found.
                  </td>
                </tr>
              )}
              {initialData.data.map((entry) => (
                <>
                  <tr
                    key={entry.id}
                    className="hover:bg-cream/30 transition-colors cursor-pointer"
                    onClick={() => toggleRow(entry.id)}
                  >
                    <td className="px-4 py-3">
                      <svg
                        className={`w-4 h-4 text-taupe transition-transform ${expandedRow === entry.id ? 'rotate-90' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                      </svg>
                    </td>
                    <td className="px-4 py-3 text-xs text-taupe whitespace-nowrap">
                      <span className="block">{formatDate(entry.createdAt)}</span>
                      <span className="block text-taupe/60">{formatTime(entry.createdAt)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-dark-brown">{entry.tableName}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${ACTION_COLORS[entry.action] ?? 'bg-gray-100 text-gray-700'}`}>
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-taupe">{truncateUuid(entry.recordId)}</span>
                    </td>
                    <td className="px-4 py-3">
                      {entry.performedBy ? (
                        <div>
                          <span className="font-mono text-xs text-taupe">{truncateUuid(entry.performedBy)}</span>
                          {entry.performedByType && (
                            <span className="ml-1 text-xs text-taupe/60">({entry.performedByType})</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-taupe/50 italic">system</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {entry.changedFields && entry.changedFields.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {entry.changedFields.slice(0, 4).map((f) => (
                            <span key={f} className="px-1.5 py-0.5 bg-amber-50 text-amber-700 text-xs rounded font-mono">
                              {f}
                            </span>
                          ))}
                          {entry.changedFields.length > 4 && (
                            <span className="px-1.5 py-0.5 text-taupe/60 text-xs">
                              +{entry.changedFields.length - 4} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-taupe/50">—</span>
                      )}
                    </td>
                  </tr>

                  {expandedRow === entry.id && (
                    <tr key={`${entry.id}-detail`} className="bg-cream/20">
                      <td colSpan={7} className="px-6 py-4">
                        <div className="space-y-3">
                          {/* Metadata row */}
                          <div className="flex flex-wrap gap-4 text-xs text-taupe">
                            <span><span className="font-semibold">Log ID:</span> #{entry.id}</span>
                            <span><span className="font-semibold">Record ID:</span> <span className="font-mono">{entry.recordId}</span></span>
                            {entry.performedBy && (
                              <span><span className="font-semibold">Actor:</span> <span className="font-mono">{entry.performedBy}</span></span>
                            )}
                            {entry.ipAddress && (
                              <span><span className="font-semibold">IP:</span> {entry.ipAddress}</span>
                            )}
                          </div>
                          {/* Diff */}
                          <AuditDiff
                            oldData={entry.oldData}
                            newData={entry.newData}
                            changedFields={entry.changedFields}
                            action={entry.action}
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {initialData.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-beige">
            <p className="text-xs text-taupe">
              Page {initialData.page} of {initialData.totalPages} ({initialData.total.toLocaleString()} total)
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => goToPage(initialData.page - 1)}
                disabled={initialData.page <= 1}
                className="px-3 py-1 text-xs rounded border border-beige hover:bg-beige/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              {/* Page number buttons (show up to 5 around current) */}
              {getPageRange(initialData.page, initialData.totalPages).map((p) =>
                p === '…' ? (
                  <span key={p} className="px-2 py-1 text-xs text-taupe">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => goToPage(Number(p))}
                    className={`px-3 py-1 text-xs rounded border transition-colors ${
                      Number(p) === initialData.page
                        ? 'border-gold bg-gold text-white'
                        : 'border-beige hover:bg-beige/50'
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                onClick={() => goToPage(initialData.page + 1)}
                disabled={initialData.page >= initialData.totalPages}
                className="px-3 py-1 text-xs rounded border border-beige hover:bg-beige/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function truncateUuid(uuid: string) {
  if (uuid.length <= 13) return uuid;
  return `${uuid.slice(0, 8)}…${uuid.slice(-4)}`;
}

function getPageRange(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '…')[] = [1];
  if (current > 3) pages.push('…');
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
    pages.push(p);
  }
  if (current < total - 2) pages.push('…');
  pages.push(total);
  return pages;
}
