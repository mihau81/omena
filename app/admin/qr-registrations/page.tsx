'use client';

import React, { useState, useEffect } from 'react';
import { apiUrl } from '@/app/lib/utils';

interface QrRegistration {
  id: string;
  code: string;
  label: string;
  validFrom: string;
  validUntil: string;
  maxUses: number | null;
  useCount: number;
  isActive: boolean;
  createdAt: string;
}

interface QrUser {
  id: string;
  name: string;
  email: string;
  accountStatus: string;
  createdAt: string;
}

export default function QrRegistrationsPage() {
  const [entries, setEntries] = useState<QrRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [qrUsers, setQrUsers] = useState<QrUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  async function loadData() {
    const res = await fetch(apiUrl('/api/admin/qr-registrations'));
    if (res.ok) {
      const data = await res.json();
      setEntries(data.data);
    }
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(apiUrl('/api/admin/qr-registrations'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        label,
        validFrom: new Date(validFrom).toISOString(),
        validUntil: new Date(validUntil).toISOString(),
        maxUses: maxUses ? parseInt(maxUses) : undefined,
      }),
    });
    if (res.ok) {
      setLabel('');
      setValidFrom('');
      setValidUntil('');
      setMaxUses('');
      loadData();
    }
  }

  async function handleDeactivate(id: string) {
    await fetch(apiUrl(`/api/admin/qr-registrations/${id}`), { method: 'DELETE' });
    loadData();
  }

  async function toggleUsers(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    setLoadingUsers(true);
    setQrUsers([]);
    const res = await fetch(apiUrl(`/api/admin/qr-registrations/${id}/users`));
    if (res.ok) {
      const data = await res.json();
      setQrUsers(data.users);
    }
    setLoadingUsers(false);
  }

  if (loading) return <div className="p-6 text-taupe">Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-serif text-dark-brown">QR Code Registrations</h1>

      {/* Create form */}
      <form onSubmit={handleCreate} className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-sm text-dark-brown mb-1">Label</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} required
            className="px-3 py-2 border border-beige rounded-lg text-sm" placeholder="e.g. Gala Wiosna 2026" />
        </div>
        <div>
          <label className="block text-sm text-dark-brown mb-1">Valid From</label>
          <input value={validFrom} onChange={(e) => setValidFrom(e.target.value)} type="datetime-local" required
            className="px-3 py-2 border border-beige rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm text-dark-brown mb-1">Valid Until</label>
          <input value={validUntil} onChange={(e) => setValidUntil(e.target.value)} type="datetime-local" required
            className="px-3 py-2 border border-beige rounded-lg text-sm" />
        </div>
        <div>
          <label className="block text-sm text-dark-brown mb-1">Max Uses</label>
          <input value={maxUses} onChange={(e) => setMaxUses(e.target.value)} type="number" min="1"
            className="px-3 py-2 border border-beige rounded-lg text-sm w-24" placeholder="Unlimited" />
        </div>
        <button type="submit" className="px-4 py-2 bg-gold text-white rounded-lg text-sm font-medium hover:bg-gold/90">
          Create QR Code
        </button>
      </form>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-beige">
        <table className="w-full text-sm">
          <thead className="bg-cream">
            <tr>
              <th className="text-left px-4 py-3 text-dark-brown font-medium">Label</th>
              <th className="text-left px-4 py-3 text-dark-brown font-medium">Valid Period</th>
              <th className="text-left px-4 py-3 text-dark-brown font-medium">Uses</th>
              <th className="text-left px-4 py-3 text-dark-brown font-medium">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-beige">
            {entries.map((entry) => {
              const now = new Date();
              const isExpired = new Date(entry.validUntil) < now;
              const isFull = entry.maxUses !== null && entry.useCount >= entry.maxUses;
              return (
                <React.Fragment key={entry.id}>
                <tr className="hover:bg-cream/50">
                  <td className="px-4 py-3 font-medium">{entry.label}</td>
                  <td className="px-4 py-3 text-taupe text-xs">
                    {new Date(entry.validFrom).toLocaleDateString()} — {new Date(entry.validUntil).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {entry.useCount}{entry.maxUses !== null ? ` / ${entry.maxUses}` : ''}
                  </td>
                  <td className="px-4 py-3">
                    {!entry.isActive ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Deactivated</span>
                    ) : isExpired ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">Expired</span>
                    ) : isFull ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Full</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {entry.useCount > 0 && (
                      <button onClick={() => toggleUsers(entry.id)}
                        className="text-dark-brown hover:text-gold text-xs font-medium">
                        {expandedId === entry.id ? 'Hide' : 'View'} Users ({entry.useCount})
                      </button>
                    )}
                    <a href={apiUrl(`/api/admin/qr-registrations/${entry.id}/qr-image`)}
                      target="_blank" rel="noopener noreferrer"
                      className="text-gold hover:text-gold/80 text-xs font-medium">
                      Download QR
                    </a>
                    {entry.isActive && (
                      <button onClick={() => handleDeactivate(entry.id)}
                        className="text-red-500 hover:text-red-700 text-xs">
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
                {expandedId === entry.id && (
                  <tr>
                    <td colSpan={5} className="px-4 py-3 bg-cream/50">
                      {loadingUsers ? (
                        <p className="text-xs text-taupe">Loading users...</p>
                      ) : qrUsers.length === 0 ? (
                        <p className="text-xs text-taupe">No users registered with this QR code yet.</p>
                      ) : (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-taupe">
                              <th className="text-left py-1 pr-4">Name</th>
                              <th className="text-left py-1 pr-4">Email</th>
                              <th className="text-left py-1 pr-4">Status</th>
                              <th className="text-left py-1">Registered</th>
                            </tr>
                          </thead>
                          <tbody>
                            {qrUsers.map((u) => (
                              <tr key={u.id} className="border-t border-beige/50">
                                <td className="py-1.5 pr-4">
                                  <a href={`/admin/users/${u.id}`} className="text-gold hover:underline font-medium">{u.name}</a>
                                </td>
                                <td className="py-1.5 pr-4 text-taupe">{u.email}</td>
                                <td className="py-1.5 pr-4">
                                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                                    u.accountStatus === 'approved' ? 'bg-green-100 text-green-700' :
                                    u.accountStatus === 'pending_approval' ? 'bg-amber-100 text-amber-700' :
                                    u.accountStatus === 'pending_verification' ? 'bg-blue-100 text-blue-700' :
                                    'bg-gray-100 text-gray-600'
                                  }`}>{u.accountStatus.replace('_', ' ')}</span>
                                </td>
                                <td className="py-1.5 text-taupe">{new Date(u.createdAt).toLocaleDateString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </td>
                  </tr>
                )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
