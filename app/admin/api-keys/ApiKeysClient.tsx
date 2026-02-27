'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ApiKeyRow {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: unknown;
  rateLimit: number;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  expiresAt: string | null;
}

interface ApiKeysClientProps {
  initialKeys: ApiKeyRow[];
}

interface CreateFormData {
  name: string;
  rateLimit: number;
  expiresAt: string;
}

export default function ApiKeysClient({ initialKeys }: ApiKeysClientProps) {
  const router = useRouter();
  const [keys, setKeys] = useState<ApiKeyRow[]>(initialKeys);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [createForm, setCreateForm] = useState<CreateFormData>({
    name: '',
    rateLimit: 1000,
    expiresAt: '',
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload: Record<string, unknown> = {
      name: createForm.name,
      rateLimit: createForm.rateLimit,
      permissions: ['lots:read', 'auctions:read'],
    };
    if (createForm.expiresAt) {
      payload.expiresAt = new Date(createForm.expiresAt).toISOString();
    }

    const res = await fetch('/api/admin/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? 'Failed to create API key');
      return;
    }

    setKeys((prev) => [data.apiKey, ...prev]);
    setShowCreateModal(false);
    setCreateForm({ name: '', rateLimit: 1000, expiresAt: '' });
    setCreatedKey(data.plainKey);
    router.refresh();
  };

  const handleToggleActive = async (key: ApiKeyRow) => {
    const action = key.isActive ? 'Deactivate' : 'Activate';
    if (!confirm(`${action} API key "${key.name}"?`)) return;

    const res = await fetch(`/api/admin/api-keys/${key.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !key.isActive }),
    });

    if (res.ok) {
      setKeys((prev) => prev.map((k) => k.id === key.id ? { ...k, isActive: !k.isActive } : k));
      router.refresh();
    } else {
      const data = await res.json();
      alert(data.error ?? 'Failed to update API key');
    }
  };

  const handleDelete = async (key: ApiKeyRow) => {
    if (!confirm(`Permanently delete API key "${key.name}" (prefix: ${key.keyPrefix}...)?\n\nThis will immediately revoke all access for clients using this key. This action cannot be undone.`)) return;

    const res = await fetch(`/api/admin/api-keys/${key.id}`, { method: 'DELETE' });

    if (res.ok) {
      setKeys((prev) => prev.filter((k) => k.id !== key.id));
      router.refresh();
    } else {
      const data = await res.json();
      alert(data.error ?? 'Failed to delete API key');
    }
  };

  const handleCopyKey = async () => {
    if (!createdKey) return;
    try {
      await navigator.clipboard.writeText(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select the text
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return null;
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-dark-brown">API Keys</h1>
          <p className="text-sm text-taupe mt-1">
            {keys.length} key{keys.length !== 1 ? 's' : ''} &mdash; for third-party integrations (Invaluable, Artnet, Barnebys)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/api/v1/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-taupe border border-beige rounded-lg hover:bg-beige/50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
            </svg>
            API Docs
          </a>
          <button
            onClick={() => { setShowCreateModal(true); setError(null); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gold text-white text-sm font-medium rounded-lg hover:bg-gold-dark transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New API Key
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
        <strong>Security note:</strong> API keys are shown only once at creation time. The system only stores a bcrypt hash &mdash; the plain key cannot be recovered. If a key is lost, delete it and create a new one.
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-beige overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-beige bg-cream/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase">Key Prefix</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase">Rate Limit</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase">Last Used</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-taupe uppercase">Expires</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-taupe uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-beige/50">
              {keys.map((key) => {
                const expired = isExpired(key.expiresAt);
                return (
                  <tr key={key.id} className="hover:bg-cream/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-dark-brown">{key.name}</div>
                      <div className="text-xs text-taupe/60 mt-0.5">
                        Created {formatDate(key.createdAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs bg-cream px-2 py-0.5 rounded border border-beige font-mono">
                        {key.keyPrefix}...
                      </code>
                    </td>
                    <td className="px-4 py-3 text-taupe">
                      {key.rateLimit.toLocaleString()}/hr
                    </td>
                    <td className="px-4 py-3">
                      {key.isActive && !expired ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                          Active
                        </span>
                      ) : expired ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                          Expired
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-taupe">
                      {key.lastUsedAt
                        ? formatDate(key.lastUsedAt)
                        : <span className="text-taupe/50">Never</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-xs text-taupe">
                      {key.expiresAt
                        ? <span className={expired ? 'text-red-600' : ''}>{formatDate(key.expiresAt)}</span>
                        : <span className="text-taupe/50">Never</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleToggleActive(key)}
                          className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                            key.isActive
                              ? 'border-amber-200 text-amber-700 hover:bg-amber-50'
                              : 'border-green-200 text-green-700 hover:bg-green-50'
                          }`}
                        >
                          {key.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleDelete(key)}
                          className="text-xs px-2.5 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {keys.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-taupe">
                    No API keys yet. Create one to allow third-party platforms to access your catalog.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Create API Key Modal ────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl border border-beige w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-beige">
              <h2 className="text-lg font-semibold text-dark-brown">New API Key</h2>
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
                  maxLength={100}
                  placeholder="e.g., Invaluable, Artnet, Barnebys"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-taupe uppercase mb-1">Rate Limit (requests/hour)</label>
                <input
                  type="number"
                  min={1}
                  max={100000}
                  value={createForm.rateLimit}
                  onChange={(e) => setCreateForm((p) => ({ ...p, rateLimit: parseInt(e.target.value, 10) || 1000 }))}
                  className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none"
                />
                <p className="text-xs text-taupe mt-1">Default: 1,000 requests/hour. Increase for high-volume integrations.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-taupe uppercase mb-1">Expiry Date (optional)</label>
                <input
                  type="datetime-local"
                  value={createForm.expiresAt}
                  onChange={(e) => setCreateForm((p) => ({ ...p, expiresAt: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-beige rounded-lg focus:ring-2 focus:ring-gold/30 focus:border-gold outline-none"
                />
                <p className="text-xs text-taupe mt-1">Leave blank for a key that never expires.</p>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                <strong>Permissions:</strong> The key will have read-only access to public auction lots and auctions (<code>lots:read</code>, <code>auctions:read</code>).
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 text-sm font-medium bg-gold text-white rounded-lg hover:bg-gold-dark transition-colors disabled:opacity-50"
                >
                  {saving ? 'Generating...' : 'Generate API Key'}
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

      {/* ─── Copy Key Modal (shown ONCE after creation) ───────────────── */}
      {createdKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl border border-beige w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-beige">
              <h2 className="text-lg font-semibold text-dark-brown">API Key Created</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-900 font-medium">
                Copy this key now. It will not be shown again.
              </div>
              <div>
                <label className="block text-xs font-semibold text-taupe uppercase mb-1">Your API Key</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={createdKey}
                    className="flex-1 px-3 py-2 text-sm font-mono border border-beige rounded-lg bg-cream focus:outline-none select-all"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    type="button"
                    onClick={handleCopyKey}
                    className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors shrink-0 ${
                      copied
                        ? 'bg-green-100 border-green-300 text-green-700'
                        : 'bg-beige border-beige hover:bg-beige/70 text-dark-brown'
                    }`}
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
              <p className="text-sm text-taupe">
                Send this key to your integration partner. They should pass it in every request as:
              </p>
              <pre className="bg-dark-brown text-cream text-xs rounded-lg p-3 overflow-x-auto">
                <code>{`Authorization: Bearer ${createdKey}`}</code>
              </pre>
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => { setCreatedKey(null); setCopied(false); }}
                  className="px-5 py-2.5 text-sm font-medium bg-gold text-white rounded-lg hover:bg-gold-dark transition-colors"
                >
                  I have saved the key
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
