'use client';

import { useEffect, useState } from 'react';
import { apiUrl } from '@/app/lib/utils';

interface Profile {
  id: string;
  email: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  hasPassword: boolean;
  createdAt: string;
}

export default function AccountProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Profile form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('');

  // Password form
  const [showPassword, setShowPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch(apiUrl('/api/me/profile'))
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.profile) {
          setProfile(data.profile);
          setName(data.profile.name);
          setPhone(data.profile.phone);
          setAddress(data.profile.address);
          setCity(data.profile.city);
          setPostalCode(data.profile.postalCode);
          setCountry(data.profile.country);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(apiUrl('/api/me/profile'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, address, city, postalCode, country }),
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Profile updated successfully.' });
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Failed to update profile.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'An unexpected error occurred.' });
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault();
    setPwMessage(null);

    if (newPassword !== confirmPassword) {
      setPwMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    setPwSaving(true);

    try {
      const res = await fetch(apiUrl('/api/me/password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPassword || undefined, newPassword }),
      });

      if (res.ok) {
        setPwMessage({ type: 'success', text: 'Password updated successfully.' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setShowPassword(false);
        if (profile) setProfile({ ...profile, hasPassword: true });
      } else {
        const data = await res.json();
        setPwMessage({ type: 'error', text: data.error || 'Failed to update password.' });
      }
    } catch {
      setPwMessage({ type: 'error', text: 'An unexpected error occurred.' });
    } finally {
      setPwSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
      </div>
    );
  }

  if (!profile) {
    return <p className="text-taupe py-12 text-center">Failed to load profile.</p>;
  }

  return (
    <div className="max-w-xl">
      <h1 className="font-serif text-3xl font-bold text-dark-brown md:text-4xl">Profile</h1>
      <p className="mt-2 text-sm text-taupe">Update your personal information.</p>

      {/* Profile form */}
      <form onSubmit={handleProfileSave} className="mt-8 space-y-4">
        <div>
          <label className="block text-sm font-medium text-dark-brown mb-1.5">Email</label>
          <input
            type="email"
            value={profile.email}
            disabled
            className="w-full px-3 py-2.5 rounded-lg border border-beige bg-beige/30 text-taupe cursor-not-allowed"
          />
        </div>

        <div>
          <label htmlFor="prof-name" className="block text-sm font-medium text-dark-brown mb-1.5">Name</label>
          <input
            id="prof-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            className="w-full px-3 py-2.5 rounded-lg border border-beige bg-cream/30 text-dark-brown focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors"
          />
        </div>

        <div>
          <label htmlFor="prof-phone" className="block text-sm font-medium text-dark-brown mb-1.5">Phone</label>
          <input
            id="prof-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-beige bg-cream/30 text-dark-brown focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors"
          />
        </div>

        <div>
          <label htmlFor="prof-address" className="block text-sm font-medium text-dark-brown mb-1.5">Address</label>
          <input
            id="prof-address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-beige bg-cream/30 text-dark-brown focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="prof-city" className="block text-sm font-medium text-dark-brown mb-1.5">City</label>
            <input
              id="prof-city"
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-beige bg-cream/30 text-dark-brown focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors"
            />
          </div>
          <div>
            <label htmlFor="prof-postal" className="block text-sm font-medium text-dark-brown mb-1.5">Postal Code</label>
            <input
              id="prof-postal"
              type="text"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-beige bg-cream/30 text-dark-brown focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors"
            />
          </div>
        </div>

        <div>
          <label htmlFor="prof-country" className="block text-sm font-medium text-dark-brown mb-1.5">Country</label>
          <input
            id="prof-country"
            type="text"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-beige bg-cream/30 text-dark-brown focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors"
          />
        </div>

        {message && (
          <div className={`p-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {message.text}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 bg-gold text-white font-medium rounded-lg hover:bg-gold/90 focus:outline-none focus:ring-2 focus:ring-gold/50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors text-sm"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>

      {/* Password section */}
      <div className="mt-12 border-t border-beige pt-8">
        <h2 className="font-serif text-xl font-bold text-dark-brown">
          {profile.hasPassword ? 'Change Password' : 'Set Password'}
        </h2>
        <p className="mt-1 text-sm text-taupe">
          {profile.hasPassword
            ? 'Update your account password.'
            : 'You signed up with a magic link. Set a password to also log in with email and password.'}
        </p>

        {!showPassword ? (
          <button
            onClick={() => setShowPassword(true)}
            className="mt-4 text-sm text-gold hover:underline"
          >
            {profile.hasPassword ? 'Change password' : 'Set a password'}
          </button>
        ) : (
          <form onSubmit={handlePasswordSave} className="mt-4 space-y-4">
            {profile.hasPassword && (
              <div>
                <label htmlFor="pw-current" className="block text-sm font-medium text-dark-brown mb-1.5">Current Password</label>
                <input
                  id="pw-current"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full px-3 py-2.5 rounded-lg border border-beige bg-cream/30 text-dark-brown focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors"
                />
              </div>
            )}
            <div>
              <label htmlFor="pw-new" className="block text-sm font-medium text-dark-brown mb-1.5">New Password</label>
              <input
                id="pw-new"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full px-3 py-2.5 rounded-lg border border-beige bg-cream/30 text-dark-brown focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors"
                placeholder="Min 8 characters"
              />
            </div>
            <div>
              <label htmlFor="pw-confirm" className="block text-sm font-medium text-dark-brown mb-1.5">Confirm Password</label>
              <input
                id="pw-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-3 py-2.5 rounded-lg border border-beige bg-cream/30 text-dark-brown focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors"
                placeholder="Repeat password"
              />
            </div>

            {pwMessage && (
              <div className={`p-3 rounded-lg text-sm ${
                pwMessage.type === 'success'
                  ? 'bg-green-50 border border-green-200 text-green-700'
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}>
                {pwMessage.text}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={pwSaving}
                className="px-6 py-2.5 bg-gold text-white font-medium rounded-lg hover:bg-gold/90 focus:outline-none focus:ring-2 focus:ring-gold/50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors text-sm"
              >
                {pwSaving ? 'Saving...' : 'Update Password'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPassword(false);
                  setPwMessage(null);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
                className="px-4 py-2.5 text-sm text-taupe hover:text-dark-brown transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
