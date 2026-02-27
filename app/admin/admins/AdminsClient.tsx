'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type AdminRole = 'super_admin' | 'admin' | 'cataloguer' | 'auctioneer' | 'viewer';

interface AdminRow {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  isActive: boolean;
  totpEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface AdminsClientProps {
  initialAdmins: AdminRow[];
  currentAdminId: string;
  currentAdminRole: string;
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

const ROLE_OPTIONS: { value: AdminRole; label: string }[] = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'cataloguer', label: 'Cataloguer' },
  { value: 'auctioneer', label: 'Auctioneer' },
  { value: 'viewer', label: 'Viewer' },
];

interface AdminFormData {
  email: string;
  name: string;
  password: string;
  role: AdminRole;
}

interface EditFormData {
  name: string;
  role: AdminRole;
  isActive: boolean;
  password: string;
}

export default function AdminsClient({
  initialAdmins,
  currentAdminId,
  currentAdminRole,
}: AdminsClientProps) {
  const router = useRouter();
  const [adminList, setAdminList] = useState<AdminRow[]>(initialAdmins);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [createForm, setCreateForm] = useState<AdminFormData>({
    email: '',
    name: '',
    password: '',
    role: 'viewer',
  });

  const [editForm, setEditForm] = useState<EditFormData>({
    name: '',
    role: 'viewer',
    isActive: true,
    password: '',
  });

  const isSuperAdmin = currentAdminRole === 'super_admin';

  const openEdit = (admin: AdminRow) => {
    setEditingAdmin(admin);
    setEditForm({
      name: admin.name,
      role: admin.role,
      isActive: admin.isActive,
      password: '',
    });
    setError(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch('/api/admin/admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(createForm),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? 'Failed to create admin');
      return;
    }

    setAdminList((prev) => [data.admin, ...prev]);
    setShowCreateModal(false);
    setCreateForm({ email: '', name: '', password: '', role: 'viewer' });
    router.refresh();
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdmin) return;
    setSaving(true);
    setError(null);

    const payload: Record<string, unknown> = {
      name: editForm.name,
      role: editForm.role,
      isActive: editForm.isActive,
    };
    if (editForm.password) payload.password = editForm.password;

    const res = await fetch(`/api/admin/admins/${editingAdmin.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? 'Failed to update admin');
      return;
    }

    setAdminList((prev) =>
      prev.map((a) =>
        a.id === editingAdmin.id
          ? { ...a, name: data.admin.name, role: data.admin.role, isActive: data.admin.isActive }
          : a,
      ),
    );
    setEditingAdmin(null);
    router.refresh();
  };

  const handleDeactivate = async (admin: AdminRow) => {
    if (!confirm(`${admin.isActive ? 'Deactivate' : 'Activate'} ${admin.name}?`)) return;

    const res = await fetch(`/api/admin/admins/${admin.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !admin.isActive }),
    });

    if (res.ok) {
      setAdminList((prev) =>
        prev.map((a) => (a.id === admin.id ? { ...a, isActive: !a.isActive } : a)),
      );
      router.refresh();
    }
  };

  const handleDelete = async (admin: AdminRow) => {
    if (!confirm(`Permanently delete ${admin.name}? This action cannot be undone.`)) return;

    const res = await fetch(`/api/admin/admins/${admin.id}`, { method: 'DELETE' });

    if (res.ok) {
      setAdminList((prev) => prev.filter((a) => a.id !== admin.id));
      router.refresh();
    } else {
      const data = await res.json();
      alert(data.error ?? 'Failed to delete admin');
    }
  };

  const canEditAdmin = (target: AdminRow) => {
    if (!isSuperAdmin && target.role === 'super_admin') return false;
    return true;
  };

  const canDeleteAdmin = (target: AdminRow) => {
    if (target.id === currentAdminId) return false;
    if (!isSuperAdmin && target.role === 'super_admin') return false;
    return true;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-dark-brown">Admin Accounts</h1>
          <p className="text-sm text-taupe mt-1">{adminList.length} administrator{adminList.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => { setShowCreateModal(true); setError(null); }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-gold text-white text-sm font-medium rounded-lg hover:bg-gold-dark transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Admin
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-beige overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-beige bg-cream/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase">Last Login</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-taupe uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-beige/50">
              {adminList.map((admin) => (
                <tr key={admin.id} className={`hover:bg-cream/30 transition-colors ${admin.id === currentAdminId ? 'bg-gold/5' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-dark-brown text-white flex items-center justify-center text-xs font-medium shrink-0">
                        {admin.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-medium text-dark-brown">{admin.name}</span>
                        {admin.id === currentAdminId && (
                          <span className="ml-1.5 text-xs text-gold">(you)</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-taupe">{admin.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[admin.role]}`}>
                      {ROLE_LABELS[admin.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {admin.isActive ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                          Inactive
                        </span>
                      )}
                      {admin.totpEnabled && (
                        <span title="2FA enabled" className="text-green-600">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                          </svg>
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-taupe">
                    {admin.lastLoginAt
                      ? new Date(admin.lastLoginAt).toLocaleString()
                      : <span className="text-taupe/50">Never</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {canEditAdmin(admin) && (
                        <button
                          onClick={() => openEdit(admin)}
                          className="text-xs px-2.5 py-1 rounded border border-beige hover:bg-beige/50 text-dark-brown transition-colors"
                        >
                          Edit
                        </button>
                      )}
                      {canDeleteAdmin(admin) && (
                        <button
                          onClick={() => handleDeactivate(admin)}
                          className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                            admin.isActive
                              ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                              : 'border-green-200 text-green-700 hover:bg-green-50'
                          }`}
                        >
                          {admin.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      )}
                      {canDeleteAdmin(admin) && (
                        <button
                          onClick={() => handleDelete(admin)}
                          className="text-xs px-2.5 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50 transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {adminList.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-taupe">
                    No admin accounts found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Create Admin Modal ────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl border border-beige w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-beige">
              <h2 className="text-lg font-semibold text-dark-brown">New Admin Account</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-taupe hover:text-dark-brown transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-taupe uppercase mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-taupe uppercase mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-taupe uppercase mb-1">Password *</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={createForm.password}
                  onChange={(e) => setCreateForm((p) => ({ ...p, password: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none"
                  placeholder="Min. 8 characters"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-taupe uppercase mb-1">Role *</label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm((p) => ({ ...p, role: e.target.value as AdminRole }))}
                  className="w-full px-3 py-2 text-sm border border-beige rounded-lg bg-white focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none"
                >
                  {ROLE_OPTIONS.filter((r) => isSuperAdmin || r.value !== 'super_admin').map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 text-sm font-medium bg-gold text-white rounded-lg hover:bg-gold-dark transition-colors disabled:opacity-50"
                >
                  {saving ? 'Creating...' : 'Create Admin'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 text-sm font-medium text-taupe bg-beige/50 rounded-lg hover:bg-beige transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Edit Admin Modal ──────────────────────────────────────── */}
      {editingAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl border border-beige w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-beige">
              <h2 className="text-lg font-semibold text-dark-brown">Edit Admin</h2>
              <button
                onClick={() => setEditingAdmin(null)}
                className="text-taupe hover:text-dark-brown transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleEdit} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}
              <div className="text-sm text-taupe">{editingAdmin.email}</div>
              <div>
                <label className="block text-xs font-semibold text-taupe uppercase mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-taupe uppercase mb-1">Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value as AdminRole }))}
                  disabled={!isSuperAdmin && editingAdmin.role === 'super_admin'}
                  className="w-full px-3 py-2 text-sm border border-beige rounded-lg bg-white focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none disabled:opacity-60"
                >
                  {ROLE_OPTIONS.filter((r) => isSuperAdmin || r.value !== 'super_admin').map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              {editingAdmin.id !== currentAdminId && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={editForm.isActive}
                    onChange={(e) => setEditForm((p) => ({ ...p, isActive: e.target.checked }))}
                    className="w-4 h-4 accent-gold"
                  />
                  <label htmlFor="isActive" className="text-sm text-dark-brown">Account active</label>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-taupe uppercase mb-1">
                  New Password <span className="normal-case text-taupe/60">(leave blank to keep current)</span>
                </label>
                <input
                  type="password"
                  minLength={8}
                  value={editForm.password}
                  onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none"
                  placeholder="Min. 8 characters"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 text-sm font-medium bg-gold text-white rounded-lg hover:bg-gold-dark transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingAdmin(null)}
                  className="px-4 py-2.5 text-sm font-medium text-taupe bg-beige/50 rounded-lg hover:bg-beige transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
