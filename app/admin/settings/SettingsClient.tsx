'use client';

import { useState } from 'react';
import { apiUrl } from '@/app/lib/utils';

interface SettingRow {
  id: string;
  key: string;
  value: string;
  category: string;
  label: string;
  description: string | null;
  updatedAt: string;
}

interface SettingsClientProps {
  initialSettings: Record<string, SettingRow[]>;
}

// Read-only keys that cannot be edited via the UI
const READ_ONLY_KEYS = new Set(['smtp_configured']);

const CATEGORY_META: Record<string, { title: string; description: string; icon: React.ReactNode }> = {
  company: {
    title: 'Company Information',
    description: 'Auction house name, address, and contact details used on invoices and emails.',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
      </svg>
    ),
  },
  auction: {
    title: 'Auction Defaults',
    description: "Default buyer's premium rate, currency, and visibility for new auctions.",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
  email: {
    title: 'Email Configuration',
    description: 'Sender name and address for transactional emails.',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
      </svg>
    ),
  },
};

const CATEGORY_ORDER = ['company', 'auction', 'email'];

function SettingInput({
  setting,
  value,
  onChange,
}: {
  setting: SettingRow;
  value: string;
  onChange: (val: string) => void;
}) {
  const isReadOnly = READ_ONLY_KEYS.has(setting.key);

  if (setting.key === 'smtp_configured') {
    return (
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${
            value === 'true' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
          }`}
        >
          {value === 'true' ? 'Configured' : 'Not Configured'}
        </span>
        <span className="text-xs text-taupe">Configured via environment variables</span>
      </div>
    );
  }

  if (setting.key === 'default_visibility_level') {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full max-w-xs px-3 py-2 text-sm border border-beige rounded-lg bg-white focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none"
      >
        <option value="0">0 — Public</option>
        <option value="1">1 — Private</option>
        <option value="2">2 — VIP</option>
      </select>
    );
  }

  if (setting.key === 'default_buyer_premium_rate') {
    return (
      <div className="flex items-center gap-2 max-w-xs">
        <input
          type="number"
          min="0"
          max="1"
          step="0.01"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none"
        />
        <span className="text-sm text-taupe whitespace-nowrap">
          = {(parseFloat(value || '0') * 100).toFixed(0)}%
        </span>
      </div>
    );
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      readOnly={isReadOnly}
      className={`w-full px-3 py-2 text-sm border border-beige rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none ${
        isReadOnly ? 'bg-cream/50 text-taupe cursor-not-allowed' : 'bg-white'
      }`}
    />
  );
}

function SettingsSection({
  category,
  rows,
}: {
  category: string;
  rows: SettingRow[];
}) {
  const meta = CATEGORY_META[category] ?? {
    title: category.charAt(0).toUpperCase() + category.slice(1),
    description: '',
    icon: null,
  };

  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.key, r.value])),
  );
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const editableRows = rows.filter((r) => !READ_ONLY_KEYS.has(r.key));
  const hasChanges = editableRows.some((r) => values[r.key] !== r.value);

  const handleSave = async () => {
    setSaving(true);
    setToast(null);

    const payload: Record<string, string> = {};
    for (const r of editableRows) {
      if (values[r.key] !== r.value) {
        payload[r.key] = values[r.key];
      }
    }

    try {
      const res = await fetch(apiUrl('/api/admin/settings'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setToast({ type: 'error', message: data.error ?? 'Failed to save settings' });
      } else {
        // Update row values to reflect saved state
        for (const key of data.updated as string[]) {
          const row = rows.find((r) => r.key === key);
          if (row) row.value = values[key];
        }
        setToast({ type: 'success', message: 'Settings saved successfully.' });
        setTimeout(() => setToast(null), 3000);
      }
    } catch {
      setToast({ type: 'error', message: 'Network error. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-beige shadow-sm">
      {/* Section header */}
      <div className="flex items-start gap-3 px-6 py-5 border-b border-beige">
        <div className="mt-0.5 text-gold">{meta.icon}</div>
        <div>
          <h2 className="text-base font-semibold text-dark-brown">{meta.title}</h2>
          <p className="text-sm text-taupe mt-0.5">{meta.description}</p>
        </div>
      </div>

      {/* Fields */}
      <div className="divide-y divide-beige/50">
        {rows.map((row) => (
          <div key={row.key} className="px-6 py-4">
            <div className="flex flex-col sm:flex-row sm:items-start gap-3">
              <div className="sm:w-64 shrink-0">
                <label className="block text-sm font-medium text-dark-brown">{row.label}</label>
                {row.description && (
                  <p className="text-xs text-taupe mt-0.5">{row.description}</p>
                )}
              </div>
              <div className="flex-1">
                <SettingInput
                  setting={row}
                  value={values[row.key]}
                  onChange={(val) => setValues((prev) => ({ ...prev, [row.key]: val }))}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer with save button */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-beige bg-cream/30 rounded-b-xl">
        <div>
          {toast && (
            <span
              className={`text-sm ${
                toast.type === 'success' ? 'text-green-700' : 'text-red-700'
              }`}
            >
              {toast.message}
            </span>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-gold text-white rounded-lg hover:bg-gold-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </button>
      </div>
    </div>
  );
}

export default function SettingsClient({ initialSettings }: SettingsClientProps) {
  const orderedCategories = [
    ...CATEGORY_ORDER.filter((c) => initialSettings[c]),
    ...Object.keys(initialSettings).filter((c) => !CATEGORY_ORDER.includes(c)),
  ];

  if (orderedCategories.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-beige p-8 text-center text-sm text-taupe">
        No settings found. Run{' '}
        <code className="bg-cream px-1.5 py-0.5 rounded text-xs font-mono">npx tsx db/seed-settings.ts</code>{' '}
        to seed default settings.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {orderedCategories.map((category) => (
        <SettingsSection
          key={category}
          category={category}
          rows={initialSettings[category]}
        />
      ))}
    </div>
  );
}
