'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface AuditLogFiltersProps {
  tableName: string;
  action: string;
  performedBy: string;
  recordId: string;
  dateFrom: string;
  dateTo: string;
}

const TABLE_OPTIONS = [
  'auctions', 'lots', 'media', 'users', 'admins',
  'bids', 'bid_registrations', 'absentee_bids', 'invoices',
];

const ACTION_OPTIONS = ['INSERT', 'UPDATE', 'DELETE'];

export default function AuditLogFilters({
  tableName,
  action,
  performedBy,
  recordId,
  dateFrom,
  dateTo,
}: AuditLogFiltersProps) {
  const router = useRouter();
  const [localTable, setLocalTable] = useState(tableName);
  const [localAction, setLocalAction] = useState(action);
  const [localPerformedBy, setLocalPerformedBy] = useState(performedBy);
  const [localRecordId, setLocalRecordId] = useState(recordId);
  const [localDateFrom, setLocalDateFrom] = useState(dateFrom);
  const [localDateTo, setLocalDateTo] = useState(dateTo);

  const applyFilters = (overrides?: { page?: number }) => {
    const params = new URLSearchParams();
    if (localTable) params.set('tableName', localTable);
    if (localAction) params.set('action', localAction);
    if (localPerformedBy) params.set('performedBy', localPerformedBy);
    if (localRecordId) params.set('recordId', localRecordId);
    if (localDateFrom) params.set('dateFrom', localDateFrom);
    if (localDateTo) params.set('dateTo', localDateTo);
    if (overrides?.page && overrides.page > 1) params.set('page', String(overrides.page));
    const qs = params.toString();
    router.push(`/admin/audit-log${qs ? `?${qs}` : ''}`);
  };

  const clearFilters = () => {
    setLocalTable('');
    setLocalAction('');
    setLocalPerformedBy('');
    setLocalRecordId('');
    setLocalDateFrom('');
    setLocalDateTo('');
    router.push('/admin/audit-log');
  };

  const hasFilters = localTable || localAction || localPerformedBy || localRecordId || localDateFrom || localDateTo;

  return (
    <div className="bg-white rounded-xl border border-beige p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Entity type */}
        <div>
          <label className="block text-xs font-medium text-taupe mb-1">Entity type</label>
          <select
            value={localTable}
            onChange={(e) => setLocalTable(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-beige rounded-lg bg-white focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none"
          >
            <option value="">All tables</option>
            {TABLE_OPTIONS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Action */}
        <div>
          <label className="block text-xs font-medium text-taupe mb-1">Action</label>
          <select
            value={localAction}
            onChange={(e) => setLocalAction(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-beige rounded-lg bg-white focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none"
          >
            <option value="">All actions</option>
            {ACTION_OPTIONS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        {/* Record ID */}
        <div>
          <label className="block text-xs font-medium text-taupe mb-1">Record ID</label>
          <input
            type="text"
            placeholder="UUID..."
            value={localRecordId}
            onChange={(e) => setLocalRecordId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none font-mono"
          />
        </div>

        {/* Performed by (actor UUID) */}
        <div>
          <label className="block text-xs font-medium text-taupe mb-1">Actor ID</label>
          <input
            type="text"
            placeholder="Admin/user UUID..."
            value={localPerformedBy}
            onChange={(e) => setLocalPerformedBy(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none font-mono"
          />
        </div>

        {/* Date from */}
        <div>
          <label className="block text-xs font-medium text-taupe mb-1">From date</label>
          <input
            type="date"
            value={localDateFrom}
            onChange={(e) => setLocalDateFrom(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none"
          />
        </div>

        {/* Date to */}
        <div>
          <label className="block text-xs font-medium text-taupe mb-1">To date</label>
          <input
            type="date"
            value={localDateTo}
            onChange={(e) => setLocalDateTo(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => applyFilters()}
          className="px-4 py-2 text-sm font-medium bg-dark-brown text-white rounded-lg hover:bg-dark-brown/90 transition-colors"
        >
          Apply filters
        </button>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="px-4 py-2 text-sm font-medium text-taupe border border-beige rounded-lg hover:bg-beige/30 transition-colors"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
