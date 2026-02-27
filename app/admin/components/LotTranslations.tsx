'use client';

import { useState, useEffect, useCallback } from 'react';
import DynamicList from './DynamicList';

const LOCALES = [
  { code: 'pl', label: 'PL', name: 'Polski' },
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'de', label: 'DE', name: 'Deutsch' },
  { code: 'fr', label: 'FR', name: 'Français' },
  { code: 'uk', label: 'UK', name: 'Ukrainian' },
] as const;

type LocaleCode = (typeof LOCALES)[number]['code'];

interface TranslationFormData {
  title: string;
  description: string;
  medium: string;
  provenance: string[];
  exhibitions: string[];
  conditionNotes: string;
}

interface TranslationRecord extends TranslationFormData {
  id: string;
  lotId: string;
  locale: string;
  createdAt: string;
  updatedAt: string;
}

interface LotTranslationsProps {
  lotId: string;
}

const EMPTY_FORM: TranslationFormData = {
  title: '',
  description: '',
  medium: '',
  provenance: [],
  exhibitions: [],
  conditionNotes: '',
};

export default function LotTranslations({ lotId }: LotTranslationsProps) {
  const [activeLocale, setActiveLocale] = useState<LocaleCode>('en');
  const [translations, setTranslations] = useState<Record<string, TranslationRecord | null>>({});
  const [forms, setForms] = useState<Record<string, TranslationFormData>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successes, setSuccesses] = useState<Record<string, string>>({});

  const fetchTranslations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/lots/${lotId}/translations`);
      if (!res.ok) return;
      const data = await res.json();
      const byLocale: Record<string, TranslationRecord | null> = {};
      const initialForms: Record<string, TranslationFormData> = {};

      LOCALES.forEach(({ code }) => {
        byLocale[code] = null;
        initialForms[code] = { ...EMPTY_FORM };
      });

      for (const t of (data.translations as TranslationRecord[])) {
        byLocale[t.locale] = t;
        initialForms[t.locale] = {
          title: t.title,
          description: t.description,
          medium: t.medium,
          provenance: Array.isArray(t.provenance) ? t.provenance : [],
          exhibitions: Array.isArray(t.exhibitions) ? t.exhibitions : [],
          conditionNotes: t.conditionNotes ?? '',
        };
      }

      setTranslations(byLocale);
      setForms(initialForms);
    } catch (err) {
      console.error('Failed to fetch translations:', err);
    } finally {
      setLoading(false);
    }
  }, [lotId]);

  useEffect(() => {
    fetchTranslations();
  }, [fetchTranslations]);

  const hasTranslation = (locale: string) => Boolean(translations[locale]);

  const handleFormChange = (
    locale: string,
    field: keyof TranslationFormData,
    value: string | string[],
  ) => {
    setForms((prev) => ({
      ...prev,
      [locale]: { ...prev[locale], [field]: value },
    }));
    // Clear error on change
    setErrors((prev) => {
      const next = { ...prev };
      delete next[locale];
      return next;
    });
  };

  const handleSave = async (locale: string) => {
    const form = forms[locale];
    if (!form) return;

    if (!form.title.trim()) {
      setErrors((prev) => ({ ...prev, [locale]: 'Title is required' }));
      return;
    }

    setSaving((prev) => ({ ...prev, [locale]: true }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[locale];
      return next;
    });

    try {
      const res = await fetch(`/api/admin/lots/${lotId}/translations/${locale}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description,
          medium: form.medium,
          provenance: form.provenance.filter(Boolean),
          exhibitions: form.exhibitions.filter(Boolean),
          conditionNotes: form.conditionNotes,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setErrors((prev) => ({ ...prev, [locale]: json.error || 'Failed to save translation' }));
        return;
      }

      setTranslations((prev) => ({ ...prev, [locale]: json.translation }));
      setSuccesses((prev) => ({ ...prev, [locale]: 'Translation saved' }));
      setTimeout(() => setSuccesses((prev) => {
        const next = { ...prev };
        delete next[locale];
        return next;
      }), 3000);
    } catch {
      setErrors((prev) => ({ ...prev, [locale]: 'An unexpected error occurred' }));
    } finally {
      setSaving((prev) => ({ ...prev, [locale]: false }));
    }
  };

  const handleDelete = async (locale: string) => {
    if (!hasTranslation(locale)) return;
    if (!confirm(`Delete ${locale.toUpperCase()} translation? This cannot be undone.`)) return;

    setDeleting((prev) => ({ ...prev, [locale]: true }));

    try {
      const res = await fetch(`/api/admin/lots/${lotId}/translations/${locale}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const json = await res.json();
        setErrors((prev) => ({ ...prev, [locale]: json.error || 'Failed to delete translation' }));
        return;
      }

      setTranslations((prev) => ({ ...prev, [locale]: null }));
      setForms((prev) => ({ ...prev, [locale]: { ...EMPTY_FORM } }));
      setSuccesses((prev) => ({ ...prev, [locale]: 'Translation deleted' }));
      setTimeout(() => setSuccesses((prev) => {
        const next = { ...prev };
        delete next[locale];
        return next;
      }), 3000);
    } catch {
      setErrors((prev) => ({ ...prev, [locale]: 'An unexpected error occurred' }));
    } finally {
      setDeleting((prev) => ({ ...prev, [locale]: false }));
    }
  };

  const inputClass =
    'w-full px-3 py-2 text-sm border border-beige rounded-lg bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold';
  const labelClass = 'block text-sm font-medium text-dark-brown mb-1';

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-beige p-6">
        <h2 className="text-lg font-serif font-semibold text-dark-brown mb-4">Translations</h2>
        <p className="text-sm text-taupe">Loading translations...</p>
      </div>
    );
  }

  const activeForm = forms[activeLocale] ?? { ...EMPTY_FORM };

  return (
    <div className="bg-white rounded-xl border border-beige p-6">
      <h2 className="text-lg font-serif font-semibold text-dark-brown mb-4">
        Multi-language Content
      </h2>

      {/* Locale tabs */}
      <div className="flex gap-1 mb-6 border-b border-beige">
        {LOCALES.map(({ code, label, name }) => (
          <button
            key={code}
            type="button"
            onClick={() => setActiveLocale(code)}
            title={name}
            className={`
              relative px-4 py-2 text-sm font-medium rounded-t-lg transition-colors
              ${activeLocale === code
                ? 'bg-white border border-b-white border-beige text-gold -mb-px z-10'
                : 'text-taupe hover:text-dark-brown hover:bg-beige/40'
              }
            `}
          >
            {label}
            {/* Green dot indicator if translation exists */}
            {hasTranslation(code) && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-green-500" />
            )}
          </button>
        ))}
      </div>

      {/* Active locale form */}
      <div className="space-y-4">
        {/* Status notice */}
        {hasTranslation(activeLocale) ? (
          <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            Translation exists for {LOCALES.find((l) => l.code === activeLocale)?.name}.
            {translations[activeLocale]?.updatedAt && (
              <> Last updated: {new Date(translations[activeLocale]!.updatedAt).toLocaleString()}</>
            )}
          </p>
        ) : (
          <p className="text-xs text-taupe bg-beige/30 border border-beige rounded-lg px-3 py-2">
            No translation yet for {LOCALES.find((l) => l.code === activeLocale)?.name}.
            Fill in the fields below and save to create one.
          </p>
        )}

        {/* Error / success alerts */}
        {errors[activeLocale] && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">
            {errors[activeLocale]}
          </div>
        )}
        {successes[activeLocale] && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-sm text-green-700">
            {successes[activeLocale]}
          </div>
        )}

        {/* Title */}
        <div>
          <label className={labelClass}>Title *</label>
          <input
            type="text"
            value={activeForm.title}
            onChange={(e) => handleFormChange(activeLocale, 'title', e.target.value)}
            className={inputClass}
            placeholder="Translated title..."
          />
        </div>

        {/* Description */}
        <div>
          <label className={labelClass}>Description</label>
          <textarea
            rows={4}
            value={activeForm.description}
            onChange={(e) => handleFormChange(activeLocale, 'description', e.target.value)}
            className={inputClass}
            placeholder="Translated description..."
          />
        </div>

        {/* Medium */}
        <div>
          <label className={labelClass}>Medium</label>
          <input
            type="text"
            value={activeForm.medium}
            onChange={(e) => handleFormChange(activeLocale, 'medium', e.target.value)}
            className={inputClass}
            placeholder="e.g. Oil on canvas"
          />
        </div>

        {/* Provenance + Exhibitions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <DynamicList
            label="Provenance"
            items={activeForm.provenance}
            onChange={(items) => handleFormChange(activeLocale, 'provenance', items)}
            placeholder="Collection / gallery..."
          />
          <DynamicList
            label="Exhibitions"
            items={activeForm.exhibitions}
            onChange={(items) => handleFormChange(activeLocale, 'exhibitions', items)}
            placeholder="Exhibition name, year..."
          />
        </div>

        {/* Condition Notes */}
        <div>
          <label className={labelClass}>Condition Notes</label>
          <textarea
            rows={3}
            value={activeForm.conditionNotes}
            onChange={(e) => handleFormChange(activeLocale, 'conditionNotes', e.target.value)}
            className={inputClass}
            placeholder="Translated condition details..."
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-beige">
          <div>
            {hasTranslation(activeLocale) && (
              <button
                type="button"
                disabled={deleting[activeLocale]}
                onClick={() => handleDelete(activeLocale)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
              >
                {deleting[activeLocale] ? 'Deleting...' : 'Delete translation'}
              </button>
            )}
          </div>
          <button
            type="button"
            disabled={saving[activeLocale]}
            onClick={() => handleSave(activeLocale)}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-gold text-white text-sm font-medium rounded-lg hover:bg-gold-dark transition-colors disabled:opacity-50"
          >
            {saving[activeLocale] && (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {saving[activeLocale]
              ? 'Saving...'
              : hasTranslation(activeLocale)
                ? 'Update translation'
                : 'Save translation'
            }
          </button>
        </div>
      </div>
    </div>
  );
}
