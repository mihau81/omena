'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface UserData {
  id?: string;
  email: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  visibilityLevel: '0' | '1' | '2';
  notes: string;
  referrerId?: string | null;
  isActive?: boolean;
}

interface UserFormProps {
  user?: UserData;
  mode: 'create' | 'edit';
}

export default function UserForm({ user, mode }: UserFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const [form, setForm] = useState<UserData>({
    email: user?.email ?? '',
    name: user?.name ?? '',
    phone: user?.phone ?? '',
    address: user?.address ?? '',
    city: user?.city ?? '',
    postalCode: user?.postalCode ?? '',
    country: user?.country ?? 'Poland',
    visibilityLevel: user?.visibilityLevel ?? '0',
    notes: user?.notes ?? '',
  });

  const handleChange = (field: keyof UserData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const url = mode === 'create'
        ? '/api/admin/users'
        : `/api/admin/users/${user?.id}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Failed to save user');
        setSaving(false);
        return;
      }

      if (mode === 'create' && data.tempPassword) {
        setTempPassword(data.tempPassword);
        setSaving(false);
        return;
      }

      router.push(mode === 'create' ? `/admin/users/${data.user.id}` : `/admin/users/${user?.id}`);
      router.refresh();
    } catch {
      setError('Network error');
      setSaving(false);
    }
  };

  if (tempPassword) {
    return (
      <div className="bg-white rounded-xl border border-beige p-6 max-w-xl">
        <h3 className="text-lg font-semibold text-dark-brown">User Created Successfully</h3>
        <p className="mt-2 text-sm text-taupe">
          The temporary password for <strong>{form.email}</strong> is:
        </p>
        <div className="mt-3 p-3 bg-cream rounded-lg font-mono text-sm text-dark-brown select-all">
          {tempPassword}
        </div>
        <p className="mt-2 text-xs text-taupe">
          Please share this password securely. The user should change it on first login.
        </p>
        <button
          onClick={() => router.push('/admin/users')}
          className="mt-4 px-4 py-2 text-sm font-medium bg-gold text-white rounded-lg hover:bg-gold-dark transition-colors"
        >
          Go to User List
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-beige p-6 max-w-2xl">
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Name */}
        <div>
          <label className="block text-xs font-semibold text-taupe uppercase mb-1">Name *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            required
            className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-xs font-semibold text-taupe uppercase mb-1">Email *</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => handleChange('email', e.target.value)}
            required
            className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block text-xs font-semibold text-taupe uppercase mb-1">Phone</label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none"
          />
        </div>

        {/* Visibility Level */}
        <div>
          <label className="block text-xs font-semibold text-taupe uppercase mb-1">Visibility Level</label>
          <select
            value={form.visibilityLevel}
            onChange={(e) => handleChange('visibilityLevel', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none bg-white"
          >
            <option value="0">Public (Level 0)</option>
            <option value="1">Private (Level 1)</option>
            <option value="2">VIP (Level 2)</option>
          </select>
        </div>

        {/* Address */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-taupe uppercase mb-1">Address</label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => handleChange('address', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none"
          />
        </div>

        {/* City */}
        <div>
          <label className="block text-xs font-semibold text-taupe uppercase mb-1">City</label>
          <input
            type="text"
            value={form.city}
            onChange={(e) => handleChange('city', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none"
          />
        </div>

        {/* Postal Code */}
        <div>
          <label className="block text-xs font-semibold text-taupe uppercase mb-1">Postal Code</label>
          <input
            type="text"
            value={form.postalCode}
            onChange={(e) => handleChange('postalCode', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none"
          />
        </div>

        {/* Country */}
        <div>
          <label className="block text-xs font-semibold text-taupe uppercase mb-1">Country</label>
          <input
            type="text"
            value={form.country}
            onChange={(e) => handleChange('country', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none"
          />
        </div>
      </div>

      {/* Notes */}
      <div className="mt-4">
        <label className="block text-xs font-semibold text-taupe uppercase mb-1">Admin Notes (Private)</label>
        <textarea
          value={form.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none resize-y"
          placeholder="Internal notes about this user..."
        />
      </div>

      {/* Actions */}
      <div className="mt-6 flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 text-sm font-medium bg-gold text-white rounded-lg hover:bg-gold-dark transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : mode === 'create' ? 'Create User' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 py-2.5 text-sm font-medium text-taupe bg-beige/50 rounded-lg hover:bg-beige transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
