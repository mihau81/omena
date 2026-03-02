'use client';

import { useState, useEffect, useRef } from 'react';
import { apiUrl } from '@/app/lib/utils';

interface WhitelistEntry {
  id: string;
  email: string;
  name: string | null;
  notes: string | null;
  usedAt: string | null;
  createdAt: string;
}

export default function WhitelistsPage() {
  const [entries, setEntries] = useState<WhitelistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadData() {
    const res = await fetch(apiUrl('/api/admin/whitelists'));
    if (res.ok) {
      const data = await res.json();
      setEntries(data.data);
    }
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(apiUrl('/api/admin/whitelists'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name: name || undefined }),
    });
    if (res.ok) {
      setEmail('');
      setName('');
      loadData();
    }
  }

  async function handleDelete(id: string) {
    await fetch(apiUrl(`/api/admin/whitelists/${id}`), { method: 'DELETE' });
    loadData();
  }

  async function handleImport() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(apiUrl('/api/admin/whitelists/import'), {
      method: 'POST',
      body: formData,
    });
    if (res.ok) {
      const data = await res.json();
      alert(`Imported: ${data.imported}, Skipped: ${data.skipped}`);
      loadData();
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  if (loading) return <div className="p-6 text-taupe">Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-serif text-dark-brown">Email Whitelist</h1>

      {/* Add form */}
      <form onSubmit={handleAdd} className="flex gap-3 items-end">
        <div>
          <label className="block text-sm text-dark-brown mb-1">Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required
            className="px-3 py-2 border border-beige rounded-lg text-sm" placeholder="user@example.com" />
        </div>
        <div>
          <label className="block text-sm text-dark-brown mb-1">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="px-3 py-2 border border-beige rounded-lg text-sm" placeholder="Optional" />
        </div>
        <button type="submit" className="px-4 py-2 bg-gold text-white rounded-lg text-sm font-medium hover:bg-gold/90">
          Add
        </button>
      </form>

      {/* CSV import */}
      <div className="flex gap-3 items-center">
        <input ref={fileRef} type="file" accept=".csv" className="text-sm" />
        <button onClick={handleImport} className="px-4 py-2 bg-dark-brown text-white rounded-lg text-sm font-medium hover:bg-dark-brown/90">
          Import CSV
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-beige">
        <table className="w-full text-sm">
          <thead className="bg-cream">
            <tr>
              <th className="text-left px-4 py-3 text-dark-brown font-medium">Email</th>
              <th className="text-left px-4 py-3 text-dark-brown font-medium">Name</th>
              <th className="text-left px-4 py-3 text-dark-brown font-medium">Status</th>
              <th className="text-left px-4 py-3 text-dark-brown font-medium">Added</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-beige">
            {entries.map((entry) => (
              <tr key={entry.id} className="hover:bg-cream/50">
                <td className="px-4 py-3">{entry.email}</td>
                <td className="px-4 py-3 text-taupe">{entry.name || '—'}</td>
                <td className="px-4 py-3">
                  {entry.usedAt ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">Used</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">Available</span>
                  )}
                </td>
                <td className="px-4 py-3 text-taupe">{new Date(entry.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right">
                  {!entry.usedAt && (
                    <button onClick={() => handleDelete(entry.id)} className="text-red-500 hover:text-red-700 text-xs">
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
