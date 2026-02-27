'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import VisibilityBadge from '../../components/VisibilityBadge';
import UserForm from '../../components/UserForm';
import UserBidHistory from '../../components/UserBidHistory';
import UserRegistrations from '../../components/UserRegistrations';
import ConfirmDialog from '../../components/ConfirmDialog';

interface UserDetail {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  visibilityLevel: string;
  referrerId: string | null;
  referrerName: string | null;
  notes: string | null;
  emailVerified: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  bidCount: number;
  registrationCount: number;
  watchedLotCount: number;
}

type Tab = 'details' | 'bids' | 'registrations';

export default function UserDetailClient({ user }: { user: UserDetail }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('details');
  const [editing, setEditing] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const handleToggleActive = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setActionLoading(false);
      setDeactivateOpen(false);
    }
  };

  const handleDelete = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/admin/users');
      }
    } finally {
      setActionLoading(false);
      setDeleteOpen(false);
    }
  };

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'details', label: 'Details' },
    { key: 'bids', label: 'Bid History', count: user.bidCount },
    { key: 'registrations', label: 'Registrations', count: user.registrationCount },
  ];

  if (editing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setEditing(false)} className="text-taupe hover:text-dark-brown">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
          </button>
          <h1 className="text-2xl font-serif font-bold text-dark-brown">Edit User</h1>
        </div>
        <UserForm
          mode="edit"
          user={{
            id: user.id,
            email: user.email,
            name: user.name,
            phone: user.phone ?? '',
            address: user.address ?? '',
            city: user.city ?? '',
            postalCode: user.postalCode ?? '',
            country: user.country ?? 'Poland',
            visibilityLevel: user.visibilityLevel as '0' | '1' | '2',
            notes: user.notes ?? '',
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb + Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-taupe mb-2">
            <Link href="/admin/users" className="hover:text-dark-brown transition-colors">Users</Link>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
            <span className="text-dark-brown">{user.name}</span>
          </div>
          <h1 className="text-2xl font-serif font-bold text-dark-brown">{user.name}</h1>
          <p className="text-sm text-taupe mt-1">{user.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-gold text-white rounded-lg hover:bg-gold-dark transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
            </svg>
            Edit
          </button>
          <button
            onClick={() => setDeactivateOpen(true)}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
              user.isActive
                ? 'text-red-700 border-red-200 hover:bg-red-50'
                : 'text-green-700 border-green-200 hover:bg-green-50'
            }`}
          >
            {user.isActive ? 'Deactivate' : 'Activate'}
          </button>
          <button
            onClick={() => setDeleteOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-700 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-beige p-4">
          <p className="text-xs text-taupe uppercase font-semibold">Status</p>
          <div className="mt-2">
            {user.isActive ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">Active</span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">Inactive</span>
            )}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-beige p-4">
          <p className="text-xs text-taupe uppercase font-semibold">Visibility</p>
          <div className="mt-2">
            <VisibilityBadge level={user.visibilityLevel} />
          </div>
        </div>
        <div className="bg-white rounded-xl border border-beige p-4">
          <p className="text-xs text-taupe uppercase font-semibold">Total Bids</p>
          <p className="mt-2 text-xl font-bold text-dark-brown">{user.bidCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-beige p-4">
          <p className="text-xs text-taupe uppercase font-semibold">Registrations</p>
          <p className="mt-2 text-xl font-bold text-dark-brown">{user.registrationCount}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-beige">
        <nav className="flex gap-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-gold text-dark-brown'
                  : 'border-transparent text-taupe hover:text-dark-brown'
              }`}
            >
              {t.label}
              {t.count !== undefined && (
                <span className="ml-1.5 text-xs text-taupe">({t.count})</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-xl border border-beige overflow-hidden">
        {tab === 'details' && (
          <div className="p-6">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
              <DetailRow label="Email" value={user.email} />
              <DetailRow
                label="Email Verified"
                value={user.emailVerified ? 'Yes' : 'No'}
              />
              <DetailRow label="Phone" value={user.phone || '—'} />
              <DetailRow label="Address" value={user.address || '—'} />
              <DetailRow label="City" value={user.city || '—'} />
              <DetailRow label="Postal Code" value={user.postalCode || '—'} />
              <DetailRow label="Country" value={user.country || '—'} />
              <DetailRow label="Referrer" value={user.referrerName || '—'} />
              <DetailRow
                label="Registered"
                value={new Date(user.createdAt).toLocaleString()}
              />
              <DetailRow
                label="Last Updated"
                value={new Date(user.updatedAt).toLocaleString()}
              />
              <DetailRow label="Watched Lots" value={String(user.watchedLotCount)} />
            </dl>

            {/* Admin Notes */}
            {user.notes && (
              <div className="mt-6 pt-6 border-t border-beige">
                <h3 className="text-xs font-semibold text-taupe uppercase mb-2">Admin Notes</h3>
                <p className="text-sm text-dark-brown whitespace-pre-wrap">{user.notes}</p>
              </div>
            )}
          </div>
        )}

        {tab === 'bids' && <UserBidHistory userId={user.id} />}
        {tab === 'registrations' && <UserRegistrations userId={user.id} />}
      </div>

      {/* Confirm Dialogs */}
      <ConfirmDialog
        open={deactivateOpen}
        title={user.isActive ? 'Deactivate User' : 'Activate User'}
        message={
          user.isActive
            ? `Are you sure you want to deactivate ${user.name}? They will no longer be able to log in or place bids.`
            : `Are you sure you want to reactivate ${user.name}?`
        }
        confirmLabel={user.isActive ? 'Deactivate' : 'Activate'}
        destructive={user.isActive}
        onConfirm={handleToggleActive}
        onCancel={() => setDeactivateOpen(false)}
      />

      <ConfirmDialog
        open={deleteOpen}
        title="Delete User"
        message={`Are you sure you want to delete ${user.name}? This action can be reversed by an administrator.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-taupe uppercase">{label}</dt>
      <dd className="mt-1 text-sm text-dark-brown">{value}</dd>
    </div>
  );
}
