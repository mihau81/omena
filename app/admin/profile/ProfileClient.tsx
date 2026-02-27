'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import TwoFactorSetup from '@/app/admin/components/TwoFactorSetup';

type AdminRole = 'super_admin' | 'admin' | 'cataloguer' | 'auctioneer' | 'viewer';

interface AdminProfile {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  totpEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  cataloguer: 'Cataloguer',
  auctioneer: 'Auctioneer',
  viewer: 'Viewer',
};

const ROLE_COLORS: Record<AdminRole, string> = {
  super_admin: 'bg-red-100 text-red-800',
  admin: 'bg-amber-100 text-amber-800',
  cataloguer: 'bg-blue-100 text-blue-800',
  auctioneer: 'bg-green-100 text-green-800',
  viewer: 'bg-gray-100 text-gray-600',
};

export default function ProfileClient({ admin }: { admin: AdminProfile }) {
  const router = useRouter();
  const [name, setName] = useState(admin.name);
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSuccess, setNameSuccess] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingName(true);
    setNameError(null);
    setNameSuccess(false);

    const res = await fetch('/api/admin/admins/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    setSavingName(false);

    if (!res.ok) {
      setNameError(data.error ?? 'Failed to update name');
      return;
    }

    setNameSuccess(true);
    router.refresh();
    setTimeout(() => setNameSuccess(false), 3000);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPassword(true);
    setPasswordError(null);
    setPasswordSuccess(false);

    const res = await fetch('/api/admin/admins/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    setSavingPassword(false);

    if (!res.ok) {
      setPasswordError(data.error ?? 'Failed to change password');
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setPasswordSuccess(true);
    setTimeout(() => setPasswordSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-serif font-bold text-dark-brown">My Profile</h1>
        <p className="text-sm text-taupe mt-1">Manage your admin account settings</p>
      </div>

      {/* Account Info */}
      <div className="bg-white rounded-xl border border-beige p-6">
        <h2 className="text-base font-semibold text-dark-brown mb-4">Account Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs font-semibold text-taupe uppercase mb-1">Email</p>
            <p className="text-dark-brown">{admin.email}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-taupe uppercase mb-1">Role</p>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[admin.role]}`}>
              {ROLE_LABELS[admin.role]}
            </span>
          </div>
          <div>
            <p className="text-xs font-semibold text-taupe uppercase mb-1">Last Login</p>
            <p className="text-dark-brown">
              {admin.lastLoginAt
                ? new Date(admin.lastLoginAt).toLocaleString()
                : 'Never recorded'}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-taupe uppercase mb-1">Account Created</p>
            <p className="text-dark-brown">{new Date(admin.createdAt).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-taupe uppercase mb-1">2FA</p>
            {admin.totpEnabled ? (
              <span className="inline-flex items-center gap-1 text-green-700 text-xs font-medium">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                Enabled
              </span>
            ) : (
              <span className="text-xs text-taupe">Not configured</span>
            )}
          </div>
        </div>
      </div>

      {/* Edit Name */}
      <div className="bg-white rounded-xl border border-beige p-6">
        <h2 className="text-base font-semibold text-dark-brown mb-4">Display Name</h2>
        <form onSubmit={handleSaveName} className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-taupe uppercase mb-1">Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={savingName || name === admin.name}
            className="px-4 py-2 text-sm font-medium bg-gold text-white rounded-lg hover:bg-gold-dark transition-colors disabled:opacity-50 shrink-0"
          >
            {savingName ? 'Saving...' : 'Save'}
          </button>
        </form>
        {nameError && (
          <p className="mt-2 text-sm text-red-600">{nameError}</p>
        )}
        {nameSuccess && (
          <p className="mt-2 text-sm text-green-600">Name updated successfully.</p>
        )}
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-xl border border-beige p-6">
        <h2 className="text-base font-semibold text-dark-brown mb-4">Change Password</h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          {passwordError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {passwordError}
            </div>
          )}
          {passwordSuccess && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              Password changed successfully.
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-taupe uppercase mb-1">Current Password</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-taupe uppercase mb-1">New Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none"
              placeholder="Min. 8 characters"
            />
          </div>
          <button
            type="submit"
            disabled={savingPassword}
            className="px-5 py-2.5 text-sm font-medium bg-dark-brown text-white rounded-lg hover:bg-dark-brown/90 transition-colors disabled:opacity-50"
          >
            {savingPassword ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </div>

      {/* Two-Factor Authentication */}
      <TwoFactorSetup totpEnabled={admin.totpEnabled} />

      {/* Back link */}
      <div>
        <Link
          href="/admin"
          className="text-sm text-taupe hover:text-dark-brown transition-colors"
        >
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
